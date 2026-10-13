import lighting from '../../../shared/lighting.json';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_specular.js';
import '@babylonjs/core/Rendering/outlineRenderer.js';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import type { AssetContainer, InstantiatedEntries } from '@babylonjs/core/assetContainer.js';
import type { Material } from '@babylonjs/core/Materials/material.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial.js';
import { SerializationHelper } from '@babylonjs/core/Misc/decorators.serialization.js';
import { Color3, CreateBox, Mesh, Scene, StandardMaterial, TransformNode, Vector3 } from '../rendering/babylon';
import {
  ENEMY_MODEL_PROFILES, ENEMY_MODEL_SOURCES,
  type BasicEnemyKind, type EnemyModelProfile, type EnemyModelSource, type EnemyModelSourceId,
} from './EnemyModelManifest';

export interface EnemyModelLibraryOptions {
  readonly sources?: Readonly<Record<EnemyModelSourceId, EnemyModelSource>>;
  readonly load?: (source: EnemyModelSource, scene: Scene) => Promise<AssetContainer>;
  readonly onLoadError?: (source: EnemyModelSource, error: unknown) => void;
}

export interface EnemyModelInstance {
  readonly root: TransformNode;
  readonly bodyTransform: TransformNode;
  readonly meshes: readonly Mesh[];
  readonly hitProxy: Mesh;
  readonly animations: InstantiatedEntries['animationGroups'];
  dispose(): void;
}

/** Owns templates for one scene. Actors share geometry and textures; disposing an actor
 * never disposes its materials. Templates are released only when the library/scene ends. */
export class EnemyModelLibrary {
  private readonly sources: Readonly<Record<EnemyModelSourceId, EnemyModelSource>>;
  private readonly load: NonNullable<EnemyModelLibraryOptions['load']>;
  private readonly onLoadError: NonNullable<EnemyModelLibraryOptions['onLoadError']>;
  private readonly templates = new Map<EnemyModelSourceId, Promise<AssetContainer | null>>();
  private readonly containers = new Set<AssetContainer>();
  private readonly materials = new Map<string, Material>();
  private readonly actors = new Set<EnemyModelInstance>();
  private disposed = false;
  private readonly canLoad: boolean;

  constructor(private readonly scene: Scene, options: EnemyModelLibraryOptions = {}) {
    this.sources = options.sources ?? ENEMY_MODEL_SOURCES;
    this.canLoad = options.load !== undefined || typeof XMLHttpRequest !== 'undefined';
    this.load = options.load ?? ((source, scene) => LoadAssetContainerAsync(source.url, scene, {
      pluginOptions: { gltf: { animationStartMode: 0 } },
    }));
    this.onLoadError = options.onLoadError ?? ((source, error) => console.warn(`Enemy model unavailable: ${source.title}`, error));
    scene.onDisposeObservable.addOnce(() => this.dispose());
  }

  private template(id: EnemyModelSourceId): Promise<AssetContainer | null> {
    const source = this.sources[id];
    if (!source.available || !this.canLoad || this.disposed || this.scene.isDisposed) return Promise.resolve(null);
    let pending = this.templates.get(id);
    if (!pending) {
      pending = Promise.resolve().then(() => this.load(source, this.scene)).then(container => {
        if (this.disposed || this.scene.isDisposed) { container.dispose(); return null; }
        // Templates must stay in the bind pose. Only cloned actor groups are played.
        for (const group of container.animationGroups) group.stop(true);
        this.containers.add(container);
        return container;
      }).catch(error => {
        if (!this.disposed && !this.scene.isDisposed) this.onLoadError(source, error);
        return null;
      });
      this.templates.set(id, pending);
    }
    return pending;
  }

  async preload(): Promise<void> {
    await Promise.all(Object.values(ENEMY_MODEL_PROFILES).map(profile => this.template(profile.source)));
  }

  private material(source: Material | null, kind: BasicEnemyKind, profile: EnemyModelProfile): Material | null {
    if (!source) return null;
    const key = `${kind}:${source.uniqueId}`;
    const previous = this.materials.get(key);
    if (previous) return previous;
    const name = `enemy-${kind}-${source.name}`;
    const tint = Color3.FromHexString(profile.tint);
    let variant: Material;
    if (source instanceof PBRMaterial) {
      // Instanciate deliberately keeps Texture objects shared. Clone() duplicates them.
      const pbr = SerializationHelper.Instanciate(() => new PBRMaterial(name, this.scene), source);
      pbr.name = pbr.id = name;
      pbr.maxSimultaneousLights = lighting.maxLights;
      pbr.albedoColor = source.albedoColor.multiply(tint);
      pbr.emissiveColor = source.emissiveColor.clone();
      source.stencil.copyTo(pbr.stencil);
      variant = pbr;
    } else if (source instanceof StandardMaterial) {
      const standard = SerializationHelper.Instanciate(() => new StandardMaterial(name, this.scene), source);
      standard.name = standard.id = name;
      standard.maxSimultaneousLights = lighting.maxLights;
      standard.diffuseColor = source.diffuseColor.multiply(tint);
      standard.emissiveColor = source.emissiveColor.clone();
      source.stencil.copyTo(standard.stencil);
      variant = standard;
    } else if (source instanceof MultiMaterial) {
      const multi = new MultiMaterial(name, this.scene);
      // Store first so a malformed cyclic material graph cannot recurse indefinitely.
      this.materials.set(key, multi);
      multi.subMaterials = source.subMaterials.map(material => this.material(material, kind, profile));
      return multi;
    } else {
      return source;
    }
    this.materials.set(key, variant);
    return variant;
  }

  async create(kind: BasicEnemyKind, id: string): Promise<EnemyModelInstance | null> {
    const profile = ENEMY_MODEL_PROFILES[kind];
    const template = await this.template(profile.source);
    if (!template || this.disposed || this.scene.isDisposed) return null;
    let entries: InstantiatedEntries | undefined;
    let root: TransformNode | undefined;
    try {
      // Mesh clones share geometry, but unlike InstancedMesh their hit overlay is independent.
      entries = template.instantiateModelsToScene(name => `${id}-${name}`, false, { doNotInstantiate: true });
      root = new TransformNode(`${id}-model-rig`, this.scene);
      const body = new TransformNode(`${id}-model-body`, this.scene);
      body.parent = root;
      const alignment = new TransformNode(`${id}-model-alignment`, this.scene);
      alignment.parent = body;
      for (const node of entries.rootNodes) node.parent = alignment;
      const meshes = alignment.getChildMeshes().filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
      if (!meshes.length) throw new Error('The asset has no renderable meshes');
      const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        min.minimizeInPlace(box.minimumWorld);
        max.maximizeInPlace(box.maximumWorld);
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.receiveShadows = true;
        mesh.metadata = { zombieId: id, zombieKind: kind, importedEnemy: true };
        mesh.material = this.material(mesh.material, kind, profile);
        mesh.overlayColor = Color3.FromHexString('#ffb458');
        mesh.overlayAlpha = .55;
      }
      const height = max.y - min.y;
      if (!Number.isFinite(height) || height < .0001) throw new Error('The asset has invalid bounds');
      const scale = profile.height / height;
      // Keep the glTF handedness root intact; normalize only our wrapper transforms.
      alignment.position.set(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
      body.scaling.set(scale * profile.widthScale, scale, scale * profile.depthScale);
      body.rotation.y = profile.yaw;
      for (const mesh of meshes) this.padSkinnedBounds(mesh);
      const hitProxy = CreateBox(`${id}-model-hit-target`, {
        width: kind === 'tank' ? 1.08 : kind === 'fast' ? .64 : .72,
        height: profile.height,
        depth: kind === 'tank' ? .8 : .6,
      }, this.scene);
      hitProxy.parent = root;
      hitProxy.position.y = profile.height / 2;
      hitProxy.visibility = 0;
      hitProxy.isPickable = true;
      hitProxy.checkCollisions = false;
      hitProxy.metadata = { zombieId: id, zombieKind: kind, unlitDetail: true };
      root.setEnabled(false);
      let released = false;
      const actorRoot = root, actorEntries = entries;
      const instance: EnemyModelInstance = {
        root: actorRoot, bodyTransform: body, meshes, hitProxy, animations: actorEntries.animationGroups,
        dispose: () => {
          if (released) return;
          released = true;
          this.actors.delete(instance);
          // Entries release actor skeletons/animations; materials and textures remain shared.
          actorEntries.dispose();
          actorRoot.dispose(false, false);
        },
      };
      this.actors.add(instance);
      return instance;
    } catch (error) {
      entries?.dispose();
      root?.dispose(false, false);
      this.onLoadError(this.sources[profile.source], error);
      return null;
    }
  }

  private padSkinnedBounds(mesh: Mesh): void {
    if (!mesh.skeleton) return;
    const original = mesh.getBoundingInfo(), min = original.minimum, max = original.maximum;
    const height = max.y - min.y;
    if (!Number.isFinite(height) || height <= 0) return;
    const centerX = (min.x + max.x) / 2, centerZ = (min.z + max.z) / 2;
    // GPU joints can raise a weapon or swing limbs beyond the rest-pose bounds.
    // Pad once in canonical model space, after measuring the true rest height.
    // World bounds still follow the actor; no CPU skin/bounds scan is needed per frame.
    const paddedMin = new Vector3(Math.min(min.x, centerX - height * .9), min.y - height * .15, Math.min(min.z, centerZ - height * .7));
    const paddedMax = new Vector3(Math.max(max.x, centerX + height * .9), max.y + height * .75, Math.max(max.z, centerZ + height * 1.1));
    const world = mesh.computeWorldMatrix(true);
    mesh.setBoundingInfo(new BoundingInfo(paddedMin, paddedMax, world));
    for (const subMesh of mesh.subMeshes ?? []) {
      if (!subMesh.IsGlobal) subMesh.setBoundingInfo(new BoundingInfo(paddedMin, paddedMax, world));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const actor of [...this.actors]) actor.dispose();
    for (const material of this.materials.values()) material.dispose(false, false);
    this.materials.clear();
    for (const container of this.containers) container.dispose();
    this.containers.clear();
    this.templates.clear();
  }
}
