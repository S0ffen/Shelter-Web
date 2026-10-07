import { Color3, CreateBox, CreateCylinder, CreatePolyhedron, Scene, StandardMaterial, TransformNode } from '../rendering/babylon';
import { surfaceMaterial, tileBox } from '../rendering/SurfaceMaterials';
import { BUILDINGS } from './Building';
import type { Building, BuildingKind } from './Building';
import type { Position } from '../domain/types';
import type { Mesh } from '../rendering/babylon';
import type { TowerState } from './MagicTowerSystem';

export class BuildingView {
  private readonly roots = new Map<string, TransformNode>();
  private readonly turrets = new Map<string, TransformNode>();
  private readonly stone: StandardMaterial;
  private readonly wood: StandardMaterial;
  private readonly metal: StandardMaterial;
  private readonly crystal: StandardMaterial;
  private readonly ghost: StandardMaterial;
  private previewRoot: TransformNode | null = null;
  private previewKind: BuildingKind | null = null;

  constructor(private readonly scene: Scene) {
    const material = (name: string, hex: string): StandardMaterial => {
      const value = new StandardMaterial(name, scene);
      value.diffuseColor = Color3.FromHexString(hex);
      value.specularColor = Color3.Black();
      return value;
    };
    this.stone = surfaceMaterial(scene, 'stone');
    this.wood = surfaceMaterial(scene, 'wood');
    this.metal = surfaceMaterial(scene, 'metal');
    this.crystal = material('building-crystal', '#8ccca8');
    this.crystal.emissiveColor = Color3.FromHexString('#4d9977');
    this.ghost = material('building-preview', '#78c998');
    this.ghost.alpha = 0.4;
    this.ghost.backFaceCulling = false;
  }

  private create(kind: BuildingKind, id: string, preview: boolean): TransformNode {
    const root = new TransformNode(id, this.scene);
    const definition = BUILDINGS[kind];
    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial): Mesh => {
      const mesh = CreateBox(`${id}-${name}`, { width: w, height: h, depth: d }, this.scene);
      mesh.parent = root;
      mesh.position.set(x, y, z);
      mesh.material = preview ? this.ghost : mat;
      if (!preview && mat.diffuseTexture) tileBox(mesh, w, h, d);
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      return mesh;
    };
    box('base', definition.width, 0.22, definition.depth, 0, 0.11, 0, this.stone);
    if (kind === 'storehouse') {
      box('walls', 2.55, 1.65, 1.95, 0, 1, 0, this.wood);
      for (const x of [-1.2, 1.2]) box('beam', 0.16, 1.95, 2.1, x, 1.05, 0, this.metal);
      box('roof', 2.8, 0.28, 2.2, 0, 2.05, 0, this.metal);
      box('door', 0.8, 1.2, 0.03, 0, 0.82, -0.99, this.metal);
    } else {
      const pillar = CreateCylinder(`${id}-pillar`, { diameter: kind === 'magic-tower' ? 0.95 : 1.2, height: kind === 'magic-tower' ? 2.3 : 1.2, tessellation: 8 }, this.scene);
      pillar.parent = root;
      pillar.position.y = kind === 'magic-tower' ? 1.35 : 0.85;
      pillar.material = preview ? this.ghost : this.stone;
      pillar.isPickable = false;
      const crystal = CreatePolyhedron(`${id}-crystal`, { type: 1, size: 0.32 }, this.scene);
      crystal.parent = root;
      crystal.position.y = kind === 'magic-tower' ? 2.95 : 1.9;
      crystal.scaling.y = 1.5;
      crystal.material = preview ? this.ghost : this.crystal;
      crystal.isPickable = false;
      if (kind === 'magic-tower') {
        const turret = new TransformNode(`${id}-turret`, this.scene);
        turret.parent = root;
        turret.position.y = 2.55;
        const crown = box('crown', 1.45, 0.22, 1.45, 0, 0, 0, this.metal);
        crown.parent = turret;
        crystal.parent = turret;
        crystal.position.y = 0.4;
        const barrel = box('focus', 0.22, 0.22, 0.9, 0, 0.3, 0.45, this.metal);
        barrel.parent = turret;
        if (!preview) this.turrets.set(id, turret);
      }
      else for (const x of [-0.7, 0.7]) box('core-frame', 0.12, 2, 0.15, x, 1.15, 0, this.metal);
    }
    if (!preview) {
      const collider = CreateBox(`${id}-collider`, { width: definition.width, height: definition.height, depth: definition.depth }, this.scene);
      collider.parent = root;
      collider.position.y = definition.height / 2;
      collider.isVisible = false;
      collider.checkCollisions = true;
      collider.isPickable = true;
      collider.metadata = { buildingId: id };
    }
    return root;
  }

  sync(buildings: readonly Building[]): void {
    for (const [id, root] of this.roots) {
      if (!buildings.some(building => building.id === id)) { root.dispose(); this.roots.delete(id); this.turrets.delete(id); }
    }
    for (const building of buildings) {
      const existing = this.roots.get(building.id);
      if (existing) { existing.position.set(building.position.x,0,building.position.z); existing.rotation.y=building.rotation; existing.computeWorldMatrix(true); existing.getChildMeshes().forEach(mesh=>mesh.computeWorldMatrix(true)); continue; }
      const root = this.create(building.kind, building.id, false);
      root.position.set(building.position.x, 0, building.position.z);
      root.rotation.y = building.rotation;
      root.computeWorldMatrix(true);
      root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      this.roots.set(building.id, root);
    }
  }

  updateTowers(states: ReadonlyMap<string, TowerState>, dt: number): void {
    for (const [id, turret] of this.turrets) {
      const state = states.get(id);
      if (!state) continue;
      const desired = state.yaw - this.roots.get(id)!.rotation.y;
      const delta = Math.atan2(Math.sin(desired - turret.rotation.y), Math.cos(desired - turret.rotation.y));
      turret.rotation.y += delta * Math.min(1, dt * 12);
    }
  }

  preview(kind: BuildingKind | null, position: Position | null, rotation: number, valid: boolean): void {
    if (!kind || !position) { this.previewRoot?.setEnabled(false); return; }
    if (this.previewKind !== kind) {
      this.previewRoot?.dispose();
      this.previewRoot = this.create(kind, 'build-preview', true);
      this.previewKind = kind;
    }
    this.previewRoot!.setEnabled(true);
    this.previewRoot!.position.set(position.x, 0, position.z);
    this.previewRoot!.rotation.y = rotation;
    const color = valid ? Color3.FromHexString('#78c998') : Color3.FromHexString('#d17760');
    this.ghost.diffuseColor.copyFrom(color);
    this.ghost.emissiveColor.copyFrom(color.scale(0.3));
  }

  reset(): void {
    for (const root of this.roots.values()) root.dispose();
    this.roots.clear();
    this.turrets.clear();
    this.previewRoot?.setEnabled(false);
  }
}
