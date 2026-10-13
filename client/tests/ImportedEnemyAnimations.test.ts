import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { AssetContainer } from '@babylonjs/core/assetContainer.js';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox, Scene, TransformNode, Vector3 } from '../src/rendering/babylon';
import { CONFIG } from '../src/domain/config';
import { EnemyAnimationController } from '../src/enemies/EnemyAnimationController';
import { EnemyModelLibrary } from '../src/enemies/EnemyModelLibrary';
import { ImportedZombieView } from '../src/enemies/ImportedZombieView';
import { Player } from '../src/player/Player';
import { Zombie } from '../src/enemies/Zombie';

function fixture(scene: Scene): AssetContainer {
  const container = new AssetContainer(scene);
  const root = new TransformNode('source-root', scene);
  const limb = new TransformNode('LeftThigh', scene); limb.parent = root;
  limb.rotationQuaternion = Quaternion.Identity();
  const mesh = CreateBox('source-body', { height: 2, width: .8, depth: .4 }, scene);
  mesh.position.y = 1; mesh.parent = root;
  container.rootNodes.push(root); container.transformNodes.push(root, limb);
  container.meshes.push(mesh); container.geometries.push(mesh.geometry!);
  for (const [name, length, angle] of [['Walk', 30, .25], ['Run', 18, .65], ['Attack', 18, -.8]] as const) {
    const animation = new Animation(name, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    animation.setKeys([
      { frame: 0, value: Quaternion.Identity() },
      { frame: length / 2, value: Quaternion.RotationAxis(Vector3.Right(), angle) },
      { frame: length, value: Quaternion.Identity() },
    ]);
    const group = new AnimationGroup(name, scene); group.addTargetedAnimation(animation, limb);
    container.animationGroups.push(group);
  }
  container.removeAllFromScene();
  return container;
}

function clip(scene: Scene, id: string, name: string): AnimationGroup {
  return scene.animationGroups.find(group => group.name === `${id}-${name}`)!;
}
function velocity(zombie: Zombie, factor: number): void {
  zombie.previousPosition = { x: 0, z: 0 };
  zombie.position = { x: zombie.stats.speed * factor * CONFIG.simulationStep, z: 0 };
}

describe('imported enemy animation playback', () => {
  it.each(['normal', 'fast', 'tank'] as const)('switches %s from Walk to Run using actual simulation speed', async kind => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = fixture(scene);
      const library = new EnemyModelLibrary(scene, { load: async () => source });
      const view = new ImportedZombieView(scene, 'moving', kind, library);
      await view.ready;
      const zombie = new Zombie('moving', undefined, kind), player = new Player();
      velocity(zombie, 1); view.update(zombie, player, .2, 1 / 144, 0);
      expect(clip(scene, 'moving', 'Walk').isPlaying).toBe(true);
      expect(clip(scene, 'moving', 'Run').isPlaying).toBeFalsy();
      velocity(zombie, 1.65); view.update(zombie, player, .9, .2, 1);
      expect(clip(scene, 'moving', 'Run').isPlaying).toBe(true);
      expect(clip(scene, 'moving', 'Run').speedRatio).toBeCloseTo(1);
      expect(clip(scene, 'moving', 'Walk').isPlaying).toBe(false);
      // Changing frame rate/alpha does not reinterpret a fixed-step displacement.
      view.update(zombie, player, .1, 1 / 240, 2);
      expect(clip(scene, 'moving', 'Run').isPlaying).toBe(true);
      expect(scene.getTransformNodeByName('moving-model-body')!.position.length()).toBe(0);
      view.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('crossfades locomotion without modifying shared template bones', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = fixture(scene);
      const library = new EnemyModelLibrary(scene, { load: async () => source });
      const actor = await library.create('normal', 'blended');
      const controller = new EnemyAnimationController(actor!.animations);
      const walk = clip(scene, 'blended', 'Walk'), run = clip(scene, 'blended', 'Run');
      controller.update('walk', .016);
      controller.update('run', .06, 1.2);
      expect(walk.weight).toBeCloseTo(.5); expect(run.weight).toBeCloseTo(.5);
      expect(walk.isPlaying && run.isPlaying).toBe(true);
      controller.update('run', .06, 1.2);
      expect(walk.isPlaying).toBe(false); expect(run.weight).toBe(1);
      run.goToFrame(9);
      const animated = run.targetedAnimations[0].target as TransformNode;
      const original = source.animationGroups[1].targetedAnimations[0].target as TransformNode;
      expect(animated).not.toBe(original);
      expect(animated.rotationQuaternion!.equals(Quaternion.Identity())).toBe(false);
      expect(original.rotationQuaternion!.equals(Quaternion.Identity())).toBe(true);
      controller.reset(); actor!.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('plays a complete one-shot melee clip, and retriggers on the next attack cooldown edge', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = fixture(scene);
      const library = new EnemyModelLibrary(scene, { load: async () => source });
      const view = new ImportedZombieView(scene, 'striking', 'fast', library);
      await view.ready;
      const zombie = new Zombie('striking', undefined, 'fast'), player = new Player();
      const attack = clip(scene, 'striking', 'Attack'), start = vi.spyOn(attack, 'start');
      view.update(zombie, player, 1, .01, 0);
      zombie.attackCooldown = zombie.stats.attackCooldown;
      view.update(zombie, player, 1, .01, 0);
      expect(attack.isPlaying).toBe(true); expect(attack.loopAnimation).toBe(false);
      // The old visual stopped after .24s; the authored .6s arm swing must finish.
      zombie.attackCooldown -= .3; view.update(zombie, player, 1, .3, .3);
      expect(attack.isPlaying).toBe(true); expect(start).toHaveBeenCalledTimes(1);
      attack.goToFrame(12); zombie.attackCooldown = 0;
      view.update(zombie, player, 1, .01, .31);
      zombie.attackCooldown = zombie.stats.attackCooldown;
      view.update(zombie, player, 1, .01, .32);
      expect(start).toHaveBeenCalledTimes(2);
      expect(attack.getCurrentFrame()).toBe(0);
      expect(scene.getTransformNodeByName('striking-model-body')!.position.z).toBe(0);
      view.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });

  it('freezes skeletal playback during pause and restores the bind pose on idle/reset', async () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine), source = fixture(scene);
      const library = new EnemyModelLibrary(scene, { load: async () => source });
      const view = new ImportedZombieView(scene, 'pausing', 'normal', library);
      await view.ready;
      const zombie = new Zombie('pausing'), player = new Player(), walk = clip(scene, 'pausing', 'Walk');
      velocity(zombie, 1); view.update(zombie, player, 1, .016, 0);
      walk.goToFrame(15);
      const limb = walk.targetedAnimations[0].target as TransformNode;
      const posed = limb.rotationQuaternion!.clone();
      view.update(zombie, player, 1, 0, 0);
      expect(walk.speedRatio).toBe(0); expect(limb.rotationQuaternion!.equals(posed)).toBe(true);
      view.update(zombie, player, 1, .016, 0);
      expect(walk.speedRatio).toBe(1);
      velocity(zombie, 0); view.update(zombie, player, 1, .2, 1);
      expect(walk.isPlaying).toBe(false);
      expect(limb.rotationQuaternion!.equals(Quaternion.Identity())).toBe(true);
      velocity(zombie, 1); view.update(zombie, player, 1, .016, 2); walk.goToFrame(15);
      view.reset(); expect(walk.isPlaying).toBe(false);
      expect(limb.rotationQuaternion!.equals(Quaternion.Identity())).toBe(true);
      view.dispose(); library.dispose();
    } finally { engine.dispose(); }
  });
});


it.each(['normal', 'fast', 'tank'] as const)('keeps animated %s limbs in a fixed culling envelope without changing hit size', async kind => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine);
    const templates: AssetContainer[] = [];
    const library = new EnemyModelLibrary(scene, { load: async source => {
      const bytes = readFileSync(new URL(`../public${source.url}`, import.meta.url));
      const container = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
        pluginExtension: '.glb', pluginOptions: { gltf: { skipMaterials: true, animationStartMode: 0 } },
      });
      templates.push(container); return container;
    } });
    const actor = await library.create(kind, 'bounded');
    expect(actor).not.toBeNull();
    for (const mesh of actor!.meshes) {
      expect(mesh.skeleton).not.toBeNull();
      const envelope = mesh.getBoundingInfo();
      // Canonical source height is1; culling padding must not affect target dimensions.
      expect(envelope.maximum.y).toBeGreaterThanOrEqual(1.749);
      expect(actor!.hitProxy.getBoundingInfo().maximum.y - actor!.hitProxy.getBoundingInfo().minimum.y).toBeCloseTo(
        kind === 'normal' ? 1.9 : kind === 'fast' ? 1.8 : 2.3,
      );
      for (const group of actor!.animations) {
        group.start(false);
        for (const fraction of [.25, .5, .75]) {
          group.goToFrame(group.from + (group.to - group.from) * fraction);
          mesh.skeleton!.prepare(true);
          const positions = mesh.getPositionData(true)!;
          let outside = 0;
          for (let index = 0; index < positions.length; index += 3) {
            if (positions[index] < envelope.minimum.x - .0001 || positions[index] > envelope.maximum.x + .0001 ||
                positions[index + 1] < envelope.minimum.y - .0001 || positions[index + 1] > envelope.maximum.y + .0001 ||
                positions[index + 2] < envelope.minimum.z - .0001 || positions[index + 2] > envelope.maximum.z + .0001) outside++;
          }
          expect(outside).toBe(0);
          expect(mesh.getBoundingInfo()).toBe(envelope);
        }
        group.stop(true);
      }
    }
    // Clones do not inflate the cached source mesh bounds used for later normalization.
    expect(templates[0].meshes.find(mesh => mesh.getTotalVertices() > 0)!.getBoundingInfo().maximum.y).toBeLessThan(1.01);
    actor!.dispose(); library.dispose();
  } finally { engine.dispose(); }
}, 15000);
