import { Color3, CreateCylinder, StandardMaterial } from '../rendering/babylon';
import type { Scene, Mesh } from '../rendering/babylon';
import type { Simulation } from '../domain/Simulation';
import encounters from '../../../shared/encounters.json';
export class BossHazardView {
  private meshes = new Map<string, Mesh>();
  private material: StandardMaterial;
  constructor(private scene: Scene) { this.material = new StandardMaterial('boss-warning-rune', scene); this.material.diffuseColor = Color3.FromHexString('#cf3434'); this.material.emissiveColor = Color3.FromHexString('#e93d35'); this.material.alpha = .55; this.material.disableLighting = true; }
  update(sim: Simulation): void {
    const marks = [...sim.bossHazards.map(mark => ({ ...mark, id: 'spell-' + mark.id })), ...sim.livingZombies.filter(z => z.windup > 0 && z.windupTarget).map(z => ({ id: z.id, position: z.windupTarget!, radius: z.kind === 'overlord' ? encounters.finalBoss.slamRadius : encounters.forgeGuardian.slamRadius, remaining: z.windup }))];
    const ids = new Set(marks.map(mark => mark.id));
    for (const [id, mesh] of this.meshes)
      if (!ids.has(id)) {
        mesh.dispose();
        this.meshes.delete(id);
      }
    for (const mark of marks) {
      let mesh = this.meshes.get(mark.id);
      if (!mesh) {
        mesh = CreateCylinder('boss-danger-' + mark.id, { diameter: mark.radius * 2, height: .035, tessellation: 48 }, this.scene);
        mesh.material = this.material;
        mesh.isPickable = false;
        this.meshes.set(mark.id, mesh);
      }
      mesh.position.set(mark.position.x, .025, mark.position.z);
    }
    this.material.alpha = .4 + Math.sin(sim.elapsed * 18) * .16;
  }
  reset(): void {
    for (const mesh of this.meshes.values())
      mesh.dispose(); this.meshes.clear();
  }
}
