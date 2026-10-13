import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { CreateBox, Scene, StandardMaterial, Texture, TransformNode, Vector3 } from '../src/rendering/babylon';
import { EnemyModelLibrary } from '../src/enemies/EnemyModelLibrary';
import { ENEMY_MODEL_PROFILES, ENEMY_MODEL_SOURCES } from '../src/enemies/EnemyModelManifest';
import { ImportedZombieView } from '../src/enemies/ImportedZombieView';
import { Player } from '../src/player/Player';
import { Zombie } from '../src/enemies/Zombie';

/** The fixture has the handedness wrapper and displaced origin typical of imported GLB assets. */
function template(scene: Scene): { container: AssetContainer; texture: Texture } {
  const container = new AssetContainer(scene);
  const root = new TransformNode('synthetic-gltf-root', scene);
  root.scaling.z = -1;
  const body = CreateBox('synthetic-body', { width: .8, height: 2, depth: .4 }, scene);
  body.position.set(2, 4, 3); body.parent = root;
  const gear = CreateBox('synthetic-gear', { width: .2, height: .4, depth: .2 }, scene);
  gear.position.set(2.6, 4.4, 3); gear.parent = root;
  const material = new StandardMaterial('synthetic-material', scene);
  const texture = new Texture(null, scene); material.diffuseTexture = texture;
  body.material = gear.material = material;
  container.rootNodes.push(root); container.transformNodes.push(root);
  container.meshes.push(body, gear); container.materials.push(material);
  container.textures.push(texture); container.geometries.push(body.geometry!, gear.geometry!);
  container.removeAllFromScene();
  return { container, texture };
}

function availableSources() {
  return Object.fromEntries(Object.entries(ENEMY_MODEL_SOURCES).map(([id, source]) =>
    [id, { ...source, available: true }])) as typeof ENEMY_MODEL_SOURCES;
}

function visualMeshes(scene: Scene, id: string) {
  return scene.getTransformNodeByName(`${id}-model-rig`)!.getChildMeshes()
    .filter(mesh => mesh.getTotalVertices() > 0 && !mesh.isPickable);
}

describe('optional imported enemy models', () => {
  it('keeps current opponents playable without fetching unavailable assets', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), load = vi.fn(async () => template(scene).container);
      const sources = Object.fromEntries(Object.entries(ENEMY_MODEL_SOURCES).map(([id, source]) =>
        [id, { ...source, available: false }])) as typeof ENEMY_MODEL_SOURCES;
      const library = new EnemyModelLibrary(scene, { sources, load });
      for (const kind of ['normal', 'fast', 'tank'] as const) {
        const view = new ImportedZombieView(scene, `fallback-${kind}`, kind, library);
        await view.ready;
        expect(scene.getTransformNodeByName(`fallback-${kind}-rig`)?.isEnabled()).toBe(true);
        expect(scene.getTransformNodeByName(`fallback-${kind}-model-rig`)).toBeNull();
        view.dispose();
      }
      expect(load).not.toHaveBeenCalled(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('shares one imported geometry and its texture between independent actors', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = template(scene);
      const load = vi.fn(async () => source.container);
      const library = new EnemyModelLibrary(scene, { sources: availableSources(), load });
      const [first, second] = await Promise.all([library.create('normal', 'first'), library.create('normal', 'second')]);
      expect(first).not.toBeNull(); expect(second).not.toBeNull();
      expect(load).toHaveBeenCalledTimes(1);
      expect(first!.root).not.toBe(second!.root);
      expect(first!.meshes[0]).not.toBe(second!.meshes[0]);
      expect(first!.meshes[0].geometry).toBe(second!.meshes[0].geometry);
      expect(first!.meshes[0].material).toBe(second!.meshes[0].material);
      expect(second!.meshes[0].material?.getActiveTextures()).toContain(source.texture);
      expect(first!.hitProxy.metadata.zombieId).toBe('first');
      expect(second!.hitProxy.metadata.zombieId).toBe('second');
      expect(first!.meshes.every(mesh => !mesh.isPickable && !mesh.checkCollisions)).toBe(true);
      const destroyTexture = vi.spyOn(source.texture, 'dispose');
      first!.dispose();
      expect(destroyTexture).not.toHaveBeenCalled();
      expect(second!.meshes.every(mesh => !mesh.isDisposed())).toBe(true);
      expect(second!.meshes[0].getTotalVertices()).toBeGreaterThan(0);
      second!.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('normalizes displaced GLB feet and size without changing shared source vertices', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = template(scene);
      const originalPositions = Array.from(source.container.meshes[0].getVerticesData('position')!);
      const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: async () => source.container });
      const actor = await library.create('normal', 'normalized');
      actor!.root.computeWorldMatrix(true);
      actor!.bodyTransform.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      const bounds = actor!.bodyTransform.getHierarchyBoundingVectors();
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(ENEMY_MODEL_PROFILES.normal.height, 5);
      expect((bounds.max.x + bounds.min.x) / 2).toBeCloseTo(0, 5);
      expect((bounds.max.z + bounds.min.z) / 2).toBeCloseTo(0, 5);
      expect(Array.from(source.container.meshes[0].getVerticesData('position')!)).toEqual(originalPositions);
      actor!.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('flashes only the struck opponent and removes corpse hit targets', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = template(scene);
      const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: async () => source.container });
      const firstView = new ImportedZombieView(scene, 'struck', 'normal', library);
      const secondView = new ImportedZombieView(scene, 'untouched', 'normal', library);
      await Promise.all([firstView.ready, secondView.ready]);
      const first = new Zombie('struck'), second = new Zombie('untouched'), player = new Player();
      firstView.hit(); firstView.update(first, player, 1, .01, 0); secondView.update(second, player, 1, .01, 0);
      expect(visualMeshes(scene, 'struck').some(mesh => mesh.renderOverlay)).toBe(true);
      expect(visualMeshes(scene, 'untouched').every(mesh => !mesh.renderOverlay)).toBe(true);
      first.damage(1000); firstView.update(first, player, 1, .01, 1);
      expect(scene.getTransformNodeByName('struck-model-rig')!.getChildMeshes().every(mesh => !mesh.isPickable)).toBe(true);
      expect(scene.getTransformNodeByName('untouched-model-rig')!.getChildMeshes().some(mesh => mesh.isPickable)).toBe(true);
      firstView.dispose(); secondView.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('does not resurrect an actor when its download finishes after disposal', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = template(scene);
      let finish!: (container: AssetContainer) => void;
      const pending = new Promise<AssetContainer>(resolve => { finish = resolve; });
      const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: () => pending });
      const view = new ImportedZombieView(scene, 'removed', 'normal', library);
      expect(scene.getTransformNodeByName('removed-rig')).not.toBeNull();
      view.dispose(); finish(source.container); await view.ready;
      expect(scene.getTransformNodeByName('removed-rig')).toBeNull();
      expect(scene.getTransformNodeByName('removed-model-rig')).toBeNull();
      expect(scene.meshes.some(mesh => mesh.metadata?.zombieId === 'removed')).toBe(false);
      library.dispose();
    } finally { engine.dispose(); }
  });

  it('retains the fallback after a failed model request and reports the failure', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), error = new Error('model unavailable'), onLoadError = vi.fn();
      const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: async () => { throw error; }, onLoadError });
      const view = new ImportedZombieView(scene, 'failed', 'normal', library);
      await view.ready;
      expect(scene.getTransformNodeByName('failed-rig')?.isEnabled()).toBe(true);
      expect(scene.getTransformNodeByName('failed-model-rig')).toBeNull();
      expect(onLoadError).toHaveBeenCalledTimes(1);
      view.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });
});


it('preserves shared PBR texture objects and leaves the source material tint unchanged', async () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), source = template(scene);
    const original = new PBRMaterial('source-pbr', scene);
    original.albedoColor.set(.6, .7, .8);
    original.albedoTexture = original.bumpTexture = original.metallicTexture = source.texture;
    source.container.materials.push(original);
    source.container.meshes.forEach(mesh => { mesh.material = original; });
    const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: async () => source.container });
    const actor = await library.create('normal', 'pbr-shared');
    const variant = actor!.meshes[0].material as PBRMaterial;
    expect(variant).toBeInstanceOf(PBRMaterial); expect(variant).not.toBe(original);
    expect(variant.albedoTexture).toBe(source.texture);
    expect(variant.bumpTexture).toBe(source.texture);
    expect(variant.metallicTexture).toBe(source.texture);
    expect(original.albedoColor.asArray()).toEqual([.6, .7, .8]);
    const destroyTexture = vi.spyOn(source.texture, 'dispose');
    actor!.dispose(); expect(destroyTexture).not.toHaveBeenCalled();
    library.dispose();
  } finally { engine.dispose(); }
});

/** Parse the shipped mesh with Babylon; skip image decoding that requires a browser canvas. */
async function shippedTemplate(source: (typeof ENEMY_MODEL_SOURCES)[keyof typeof ENEMY_MODEL_SOURCES], scene: Scene) {
  const bytes = readFileSync(new URL(`../public${source.url}`, import.meta.url));
  return LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
    pluginExtension: '.glb', pluginOptions: { gltf: { skipMaterials: true, animationStartMode: 0 } },
  });
}

it.each(['normal', 'fast', 'tank'] as const)('loads the shipped %s GLB into a normalized, usable actor', async kind => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine);
    const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: shippedTemplate });
    const actor = await library.create(kind, `shipped-${kind}`);
    expect(actor).not.toBeNull();
    const vertices = actor!.meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0);
    expect(vertices).toBeGreaterThan(100);
    expect(vertices).toBeLessThan(kind === 'fast' ? 75000 : 16000);
    for (const mesh of actor!.meshes) {
      const normals = mesh.getVerticesData('normal')!;
      expect(normals).not.toBeNull(); expect(normals.length).toBe(mesh.getTotalVertices() * 3);
      let invalidNormals = 0;
      for (let index = 0; index < normals.length; index += 3) {
        const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
        if (!Number.isFinite(length) || Math.abs(length - 1) > .002) invalidNormals++;
      }
      expect(invalidNormals).toBe(0);
    }
    actor!.root.setEnabled(true); actor!.root.computeWorldMatrix(true);
    // Animated visual meshes have padded culling bounds. Measure the actual skinned
    // rest vertices so these checks still prove true feet and character height.
    const bounds = { min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) };
    for (const mesh of actor!.meshes) {
      const world = mesh.computeWorldMatrix(true);
      mesh.skeleton?.prepare(true);
      const positions = mesh.getPositionData(true)!;
      for (let index = 0; index < positions.length; index += 3) {
        const vertex = Vector3.TransformCoordinates(new Vector3(positions[index], positions[index + 1], positions[index + 2]), world);
        bounds.min.minimizeInPlace(vertex); bounds.max.maximizeInPlace(vertex);
      }
    }
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(ENEMY_MODEL_PROFILES[kind].height, 4);
    // The rig pipeline bakes each source's authored orientation into glTF +Z.
    const convertedRoot = actor!.bodyTransform.getChildMeshes().find(mesh => mesh.name.endsWith('__root__'))!;
    expect(convertedRoot).toBeDefined(); convertedRoot.computeWorldMatrix(true);
    const authorForward = new Vector3(0, 0, 1);
    const worldForward = Vector3.TransformNormal(authorForward, convertedRoot.getWorldMatrix()).normalize();
    expect(worldForward.x).toBeCloseTo(0, 5); expect(worldForward.y).toBeCloseTo(0, 5);
    expect(worldForward.z).toBeCloseTo(1, 5);
    expect(actor!.hitProxy.metadata.zombieId).toBe(`shipped-${kind}`);
    expect(actor!.meshes.every(mesh => !mesh.isPickable && !mesh.checkCollisions)).toBe(true);
    actor!.dispose(); library.dispose();
  } finally { engine.dispose(); }
}, 15000);

it('shares three model templates across a mixed 48-enemy horde and releases all actors on reset', async () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), load = vi.fn(shippedTemplate);
    const library = new EnemyModelLibrary(scene, { sources: availableSources(), load });
    const kinds = Array.from({ length: 48 }, (_, index) => index < 24 ? 'normal' as const : index < 40 ? 'fast' as const : 'tank' as const);
    const actors = await Promise.all(kinds.map((kind, index) => library.create(kind, `wave-${index}`)));
    expect(actors.every(actor => actor !== null)).toBe(true);
    expect(load).toHaveBeenCalledTimes(3);
    expect(new Set(actors.map(actor => actor!.meshes[0].geometry)).size).toBe(3);
    for (const kind of ['normal', 'fast', 'tank'] as const) {
      const group = actors.filter((_, index) => kinds[index] === kind);
      expect(group.every(actor => actor!.meshes[0].geometry === group[0]!.meshes[0].geometry)).toBe(true);
    }
    expect(new Set(actors.map(actor => actor!.hitProxy)).size).toBe(48);
    // Pose state is per enemy even though immutable mesh and texture data stay shared.
    expect(new Set(actors.map(actor => actor!.meshes[0].skeleton)).size).toBe(48);
    expect(actors.every(actor => actor!.animations.length === 3)).toBe(true);
    expect(new Set(actors.flatMap(actor => actor!.animations)).size).toBe(48 * 3);
    const actorTargets = actors.map(actor => new Set(actor!.animations.flatMap(group =>
      group.targetedAnimations.map(targeted => targeted.target))));
    expect(actorTargets.every((targets, index) => index === 0 || [...targets].every(target =>
      !actorTargets[0].has(target)))).toBe(true);
    for (const actor of actors) actor!.dispose();
    expect(scene.transformNodes.some(node => node.name.startsWith('wave-'))).toBe(false);
    expect(scene.meshes.some(mesh => mesh.metadata?.zombieId?.startsWith('wave-'))).toBe(false);
    const next = await library.create('normal', 'next-wave');
    expect(next!.meshes[0].getTotalVertices()).toBeGreaterThan(100);
    expect(load).toHaveBeenCalledTimes(3);
    next!.dispose(); library.dispose();
  } finally { engine.dispose(); }
}, 15000);


it('animates a normal melee strike from the attack cooldown without requiring boss windup', async () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), source = template(scene);
    const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: async () => source.container });
    const view = new ImportedZombieView(scene, 'melee', 'normal', library);
    await view.ready;
    const zombie = new Zombie('melee'), player = new Player();
    view.update(zombie, player, 1, .01, 0);
    zombie.attackCooldown = zombie.stats.attackCooldown;
    view.update(zombie, player, 1, .01, 0);
    const body = scene.getTransformNodeByName('melee-model-body')!;
    expect(zombie.windup).toBe(0); expect(body.position.z).toBeGreaterThan(0);
    zombie.attackCooldown = 0; view.update(zombie, player, 1, .3, 1);
    expect(body.position.z).toBeCloseTo(0);
    view.dispose(); library.dispose();
  } finally { engine.dispose(); }
});

it('releases a template that finishes loading after its scene library has been disposed', async () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), source = template(scene);
    let finish!: (container: AssetContainer) => void;
    const pending = new Promise<AssetContainer>(resolve => { finish = resolve; });
    const library = new EnemyModelLibrary(scene, { sources: availableSources(), load: () => pending });
    const actor = library.create('normal', 'scene-closed');
    const release = vi.spyOn(source.container, 'dispose');
    await Promise.resolve(); // The request has started; completion must still be cleaned up.
    library.dispose(); finish(source.container);
    expect(await actor).toBeNull(); expect(release).toHaveBeenCalledTimes(1);
    expect(scene.getTransformNodeByName('scene-closed-model-rig')).toBeNull();
  } finally { engine.dispose(); }
});


it('enables three distinct locally shipped models with embedded resources', () => {
  expect(new Set(Object.values(ENEMY_MODEL_PROFILES).map(profile => profile.source)).size).toBe(3);
  for (const source of Object.values(ENEMY_MODEL_SOURCES)) {
    expect(source.available).toBe(true);
    const bytes = readFileSync(new URL(`../public${source.url}`, import.meta.url));
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.byteLength).toBeLessThan((source.url.includes('feral-ghoul') ? 6 : 5) * 1024 * 1024);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as {
      buffers: { uri?: string }[]; images: { uri?: string; bufferView?: number }[];
    };
    expect(gltf.buffers.every(buffer => !buffer.uri)).toBe(true);
    expect(gltf.images.every(image => typeof image.bufferView === 'number')).toBe(true);
  }
});


type GltfAccessor = {
  bufferView: number; byteOffset?: number; componentType: number; count: number;
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4'; normalized?: boolean;
};
type GltfAsset = {
  accessors: GltfAccessor[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  nodes: { name?: string; mesh?: number; skin?: number }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  images: { bufferView: number }[];
  animations: { name: string; samplers: { input: number; output: number }[];
    channels: { sampler: number; target: { node: number; path: string } }[] }[];
};

function shippedAsset(kind: 'normal' | 'fast' | 'tank') {
  const source = ENEMY_MODEL_SOURCES[ENEMY_MODEL_PROFILES[kind].source];
  const bytes = readFileSync(new URL(`../public${source.url}`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as GltfAsset;
  const binary = bytes.subarray(28 + jsonLength);
  const sizes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const rawAccessor = (index: number): Buffer => {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const elementSize = sizes[accessor.componentType] * counts[accessor.type];
    const stride = view.byteStride ?? elementSize;
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const packed = Buffer.alloc(elementSize * accessor.count);
    for (let element = 0; element < accessor.count; element++) {
      binary.copy(packed, element * elementSize, start + element * stride, start + element * stride + elementSize);
    }
    return packed;
  };
  const values = (index: number): number[] => {
    const accessor = gltf.accessors[index], packed = rawAccessor(index), size = sizes[accessor.componentType];
    return Array.from({ length: packed.length / size }, (_, offset) => {
      const position = offset * size;
      const value = accessor.componentType === 5126 ? packed.readFloatLE(position) :
        accessor.componentType === 5125 ? packed.readUInt32LE(position) :
        accessor.componentType === 5123 ? packed.readUInt16LE(position) :
        accessor.componentType === 5122 ? packed.readInt16LE(position) :
        accessor.componentType === 5121 ? packed.readUInt8(position) : packed.readInt8(position);
      if (!accessor.normalized || accessor.componentType === 5126) return value;
      return accessor.componentType === 5123 ? value / 65535 : accessor.componentType === 5121 ? value / 255 :
        Math.max(-1, value / (accessor.componentType === 5122 ? 32767 : 127));
    });
  };
  return { gltf, binary, rawAccessor, values };
}

it.each(['normal', 'fast', 'tank'] as const)('ships a normalized skin and three limb animation clips for %s', kind => {
  const { gltf, values } = shippedAsset(kind), primitive = gltf.meshes[0].primitives[0];
  expect(gltf.skins).toHaveLength(1);
  expect(gltf.nodes.some(node => node.mesh === 0 && node.skin === 0)).toBe(true);
  const skin = gltf.skins[0];
  expect(skin.joints.length).toBeGreaterThanOrEqual(15);
  const jointNames = skin.joints.map(index => gltf.nodes[index].name ?? '');
  expect(jointNames.some(name => /head/i.test(name))).toBe(true);
  expect(jointNames.some(name => /arm/i.test(name))).toBe(true);
  expect(jointNames.some(name => /thigh|leg/i.test(name))).toBe(true);
  const bindMatrices = values(skin.inverseBindMatrices);
  expect(bindMatrices).toHaveLength(skin.joints.length * 16);
  expect(bindMatrices.every(Number.isFinite)).toBe(true);
  for (let index = 0; index < bindMatrices.length; index += 16) {
    // Affine bind matrices must have a valid bottom row and an invertible orientation.
    expect(bindMatrices[index + 3]).toBeCloseTo(0, 6);
    expect(bindMatrices[index + 7]).toBeCloseTo(0, 6);
    expect(bindMatrices[index + 11]).toBeCloseTo(0, 6);
    expect(bindMatrices[index + 15]).toBeCloseTo(1, 6);
    const m = bindMatrices.slice(index, index + 16);
    const determinant = m[0] * (m[5] * m[10] - m[6] * m[9]) -
      m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    expect(Math.abs(determinant)).toBeGreaterThan(.000001);
  }
  const joints = values(primitive.attributes.JOINTS_0), weights = values(primitive.attributes.WEIGHTS_0);
  const vertices = gltf.accessors[primitive.attributes.POSITION].count;
  expect(joints).toHaveLength(vertices * 4); expect(weights).toHaveLength(vertices * 4);
  expect(joints.every(joint => Number.isInteger(joint) && joint >= 0 && joint < skin.joints.length)).toBe(true);
  expect(weights.every(weight => Number.isFinite(weight) && weight >= 0 && weight <= 1)).toBe(true);
  let invalidSums = 0, legVertices = 0, armVertices = 0;
  for (let index = 0; index < weights.length; index += 4) {
    if (Math.abs(weights[index] + weights[index + 1] + weights[index + 2] + weights[index + 3] - 1) > .0001) invalidSums++;
    const influences = jointNames.filter((_, joint) => [0, 1, 2, 3].some(slot =>
      joints[index + slot] === joint && weights[index + slot] > .2));
    if (influences.some(name => /thigh|shin|foot|leg/i.test(name))) legVertices++;
    if (influences.some(name => /arm|hand/i.test(name))) armVertices++;
  }
  expect(invalidSums).toBe(0); expect(legVertices).toBeGreaterThan(100); expect(armVertices).toBeGreaterThan(100);
  // UV/normal seam duplicates must receive identical influences or the animated mesh cracks.
  const positions = values(primitive.attributes.POSITION);
  const influencesAtPosition = new Map<string, number[]>();
  let duplicatePositions = 0, inconsistentSeams = 0;
  for (let vertex = 0; vertex < vertices; vertex++) {
    const key = positions.slice(vertex * 3, vertex * 3 + 3).join(',');
    const skinning = [...joints.slice(vertex * 4, vertex * 4 + 4), ...weights.slice(vertex * 4, vertex * 4 + 4)];
    const previous = influencesAtPosition.get(key);
    if (previous) {
      duplicatePositions++;
      if (skinning.some((value, slot) => Math.abs(value - previous[slot]) > .0001)) inconsistentSeams++;
    } else influencesAtPosition.set(key, skinning);
  }
  expect(duplicatePositions).toBeGreaterThan(100); expect(inconsistentSeams).toBe(0);
  expect(gltf.animations.map(animation => animation.name).sort()).toEqual(['Attack', 'Run', 'Walk']);
  for (const clip of gltf.animations) {
    expect(clip.channels.length).toBeGreaterThanOrEqual(6);
    const targets = clip.channels.map(channel => gltf.nodes[channel.target.node].name ?? '');
    expect(clip.channels.every(channel => skin.joints.includes(channel.target.node))).toBe(true);
    for (const channel of clip.channels.filter(channel => channel.target.path === 'rotation')) {
      const output = values(clip.samplers[channel.sampler].output);
      let invalidQuaternions = 0;
      for (let index = 0; index < output.length; index += 4) {
        if (Math.abs(Math.hypot(...output.slice(index, index + 4)) - 1) > .0001) invalidQuaternions++;
      }
      expect(invalidQuaternions).toBe(0);
      // All cycles and the one-shot attack return to the opening joint pose.
      const last = output.length - 4;
      const closingDot = output[0] * output[last] + output[1] * output[last + 1] +
        output[2] * output[last + 2] + output[3] * output[last + 3];
      expect(Math.abs(closingDot)).toBeCloseTo(1, 4);
    }
    expect(targets.some(name => /arm/i.test(name))).toBe(true);
    if (clip.name !== 'Attack') expect(targets.some(name => /thigh|shin|leg/i.test(name))).toBe(true);
    for (const sampler of clip.samplers) {
      const times = values(sampler.input), output = values(sampler.output);
      expect(times.length).toBeGreaterThanOrEqual(3);
      expect(times[0]).toBe(0); expect(times.at(-1)).toBeGreaterThan(.2);
      expect(times.every((time, index) => Number.isFinite(time) && (index === 0 || time > times[index - 1]))).toBe(true);
      expect(output.every(Number.isFinite)).toBe(true);
    }
  }
});

it.each(['normal', 'fast', 'tank'] as const)('preserves the textured geometry of %s while adding its rig', kind => {
  const { gltf, binary, rawAccessor, values } = shippedAsset(kind), primitive = gltf.meshes[0].primitives[0];
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/imported-enemy-static-streams.json', import.meta.url), 'utf8')) as
    Record<string, { attributes: Record<string, string>; images: string[]; vertices: number;
      pairDistances: { a: number; b: number; normalizedDistance: number }[] }>;
  const baseline = fixtures[ENEMY_MODEL_PROFILES[kind].source];
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  for (const semantic of ['TEXCOORD_0']) expect(sha(rawAccessor(primitive.attributes[semantic]))).toBe(baseline.attributes[semantic]);
  expect(sha(rawAccessor(primitive.indices))).toBe(baseline.attributes.indices);
  const images = gltf.images.map(image => {
    const view = gltf.bufferViews[image.bufferView], start = view.byteOffset ?? 0;
    return sha(binary.subarray(start, start + view.byteLength));
  });
  expect(images.sort()).toEqual([...baseline.images].sort());
  const positions = values(primitive.attributes.POSITION);
  expect(positions.length / 3).toBe(baseline.vertices);
  const heights = positions.filter((_, index) => index % 3 === 1);
  const height = Math.max(...heights) - Math.min(...heights);
  expect(height).toBeCloseTo(1, 5);
  expect(Math.min(...heights)).toBeCloseTo(0, 5);
  // Rigid orientation changes and uniform scaling retain shape, including weapons and cloth.
  for (const { a, b, normalizedDistance } of baseline.pairDistances) {
    expect(Math.hypot(positions[a * 3] - positions[b * 3], positions[a * 3 + 1] - positions[b * 3 + 1],
      positions[a * 3 + 2] - positions[b * 3 + 2]) / height).toBeCloseTo(normalizedDistance, 5);
  }
});

it.each(['normal', 'fast', 'tank'] as const)('deforms %s limbs for Walk, Run and Attack without changing another actor', async kind => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), library = new EnemyModelLibrary(scene, { sources: availableSources(), load: shippedTemplate });
    const [first, other] = await Promise.all([library.create(kind, `animated-${kind}`), library.create(kind, `still-${kind}`)]);
    const mesh = first!.meshes[0], untouched = other!.meshes[0];
    expect(mesh.geometry).toBe(untouched.geometry); expect(mesh.skeleton).not.toBe(untouched.skeleton);
    const bind = Array.from(mesh.getVerticesData('position')!);
    mesh.skeleton!.prepare(true); untouched.skeleton!.prepare(true);
    const original = Array.from(mesh.getPositionData(true)!);
    const still = Array.from(untouched.getPositionData(true)!);
    expect(original.every(Number.isFinite)).toBe(true);
    let restError = 0;
    for (let index = 0; index < bind.length; index++) restError = Math.max(restError, Math.abs(bind[index] - original[index]));
    expect(restError).toBeLessThan(.0001);
    const posed: Record<string, number[]> = {};
    for (const name of ['Walk', 'Run', 'Attack']) {
      const clip = first!.animations.find(group => group.name.endsWith(name))!;
      expect(clip).toBeDefined();
      clip.start(false); clip.goToFrame(clip.from + (clip.to - clip.from) * .28);
      mesh.skeleton!.prepare(true); untouched.skeleton!.prepare(true);
      const animated = Array.from(mesh.getPositionData(true)!);
      expect(animated.every(Number.isFinite)).toBe(true);
      let moved = 0;
      for (let vertex = 0; vertex < bind.length; vertex += 3) {
        if (Math.hypot(animated[vertex] - original[vertex], animated[vertex + 1] - original[vertex + 1],
          animated[vertex + 2] - original[vertex + 2]) > .005) moved++;
      }
      expect(moved).toBeGreaterThan(mesh.getTotalVertices() * .05);
      expect(Array.from(untouched.getPositionData(true)!)).toEqual(still);
      expect(Array.from(mesh.getVerticesData('position')!)).toEqual(bind);
      posed[name] = animated;
      clip.stop();
    }
    expect(posed.Walk).not.toEqual(posed.Run);
    expect(posed.Attack).not.toEqual(posed.Walk);
    first!.dispose();
    expect(scene.skeletons).toContain(untouched.skeleton);
    expect(untouched.getPositionData(true)).not.toBeNull();
    other!.dispose(); library.dispose();
  } finally { engine.dispose(); }
}, 15000);


it.each(['normal', 'fast', 'tank'] as const)('keeps %s attack triangles from stretching into weapon or cloth spikes', async kind => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), library = new EnemyModelLibrary(scene, { sources: availableSources(), load: shippedTemplate });
    const actor = await library.create(kind, `strain-${kind}`);
    const attack = actor!.animations.find(group => group.name.endsWith('Attack'))!;
    attack.start(false);
    for (const fraction of [.27, .48]) {
      attack.goToFrame(attack.from + (attack.to - attack.from) * fraction);
      for (const mesh of actor!.meshes) {
        mesh.skeleton!.prepare(true);
        const rest = mesh.getVerticesData('position')!, posed = mesh.getPositionData(true)!, indices = mesh.getIndices()!;
        let spikes = 0, worstGrowth = 0;
        for (let triangle = 0; triangle < indices.length; triangle += 3) {
          for (let edge = 0; edge < 3; edge++) {
            const a = indices[triangle + edge] * 3, b = indices[triangle + (edge + 1) % 3] * 3;
            const restLength = Math.hypot(rest[a] - rest[b], rest[a + 1] - rest[b + 1], rest[a + 2] - rest[b + 2]);
            const posedLength = Math.hypot(posed[a] - posed[b], posed[a + 1] - posed[b + 1], posed[a + 2] - posed[b + 2]);
            if (posedLength > .15 && posedLength > restLength * 5) {
              spikes++; worstGrowth = Math.max(worstGrowth, posedLength - restLength);
            }
          }
        }
        expect(spikes, `${kind} Attack ${fraction}: ${spikes} stretched edges, worst growth ${worstGrowth.toFixed(3)} body heights`).toBe(0);
      }
    }
    attack.stop(true); actor!.dispose(); library.dispose();
  } finally { engine.dispose(); }
}, 15000);
