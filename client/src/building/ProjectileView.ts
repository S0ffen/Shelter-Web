import { Color3, CreateSphere, Scene, StandardMaterial } from '../rendering/babylon';
import type { Mesh } from '../rendering/babylon';
import type { MagicProjectile } from './MagicTowerSystem';

export class ProjectileView {
  private readonly meshes = new Map<number, Mesh>();
  private readonly trails = new Map<number, Mesh[]>();
  private readonly material: StandardMaterial;

  constructor(private readonly scene: Scene, private readonly onLaunch: () => void = () => {}) {
    this.material = new StandardMaterial('magic-projectile-light', scene);
    this.material.diffuseColor = Color3.FromHexString('#b5edd0');
    this.material.emissiveColor = Color3.FromHexString('#6de0aa');
  }

  update(projectiles: readonly MagicProjectile[]): void {
    for (const [id, mesh] of this.meshes) {
      if (!projectiles.some(projectile => projectile.id === id)) { mesh.dispose(); this.trails.get(id)?.forEach(tail => tail.dispose()); this.trails.delete(id); this.meshes.delete(id); }
    }
    for (const projectile of projectiles) {
      let mesh = this.meshes.get(projectile.id);
      if (!mesh) {
        mesh = CreateSphere(`magic-shot-${projectile.id}`, { diameter: 0.26, segments: 8 }, this.scene);
        mesh.material = this.material;
        mesh.isPickable = false;
        this.meshes.set(projectile.id, mesh);
        this.onLaunch();
        const trail = [0, 1, 2, 3].map(index => { const tail = CreateSphere('magic-trail-' + projectile.id + '-' + index, { diameter: .17 * (1 - index * .18), segments: 4 }, this.scene); tail.material = this.material; tail.isPickable = false; tail.position.set(projectile.position.x, projectile.position.y, projectile.position.z); return tail; });
        this.trails.set(projectile.id, trail);
      }
      const trail = this.trails.get(projectile.id)!;
      for (let i = trail.length - 1; i > 0; i--) trail[i].position.copyFrom(trail[i - 1].position);
      trail[0].position.copyFrom(mesh.position);
      mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
    }
  }
}
