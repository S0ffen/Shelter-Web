import { Color3, CreateSphere, Scene, StandardMaterial } from '../rendering/babylon';
import type { Mesh } from '../rendering/babylon';
import type { MagicProjectile } from './MagicTowerSystem';

export class ProjectileView {
  private readonly meshes = new Map<number, Mesh>();
  private readonly material: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.material = new StandardMaterial('magic-projectile-light', scene);
    this.material.diffuseColor = Color3.FromHexString('#b5edd0');
    this.material.emissiveColor = Color3.FromHexString('#6de0aa');
  }

  update(projectiles: readonly MagicProjectile[]): void {
    for (const [id, mesh] of this.meshes) {
      if (!projectiles.some(projectile => projectile.id === id)) { mesh.dispose(); this.meshes.delete(id); }
    }
    for (const projectile of projectiles) {
      let mesh = this.meshes.get(projectile.id);
      if (!mesh) {
        mesh = CreateSphere(`magic-shot-${projectile.id}`, { diameter: 0.18, segments: 8 }, this.scene);
        mesh.material = this.material;
        mesh.isPickable = false;
        this.meshes.set(projectile.id, mesh);
      }
      mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
    }
  }
}
