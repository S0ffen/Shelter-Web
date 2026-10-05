import type { Scene, UniversalCamera } from '../rendering/babylon';
import type { Simulation } from '../domain/Simulation';
import type { Position } from '../domain/types';
import type { BuildingKind } from './Building';
import { BUILDINGS } from './Building';
import { BuildingView } from './BuildingView';

/** Placement preview adapter; gameplay validates the placement again on click. */
export class BuildingController {
  active = false;
  kind: BuildingKind = 'storehouse';
  rotation = 0;
  position: Position | null = null;
  reason: string | null = 'Celuj w ziemię';
  readonly view: BuildingView;

  constructor(private readonly scene: Scene, private readonly camera: UniversalCamera) {
    this.view = new BuildingView(scene);
  }

  toggle(): void { this.active = !this.active; }
  select(kind: BuildingKind): void { this.kind = kind; this.active = true; }
  rotate(): void { if (this.active) this.rotation = (this.rotation + Math.PI / 2) % (Math.PI * 2); }
  cancel(): void { this.active = false; this.position = null; }
  reset(): void { this.cancel(); this.rotation = 0; this.view.reset(); }

  update(sim: Simulation): void {
    this.view.sync(sim.buildingSystem.buildings);
    if (!this.active || sim.phase !== 'playing') { this.view.preview(null, null, 0, false); return; }
    const pick = this.scene.pickWithRay(this.camera.getForwardRay(8), mesh => mesh.isPickable && mesh.isEnabled());
    this.position = pick?.pickedMesh?.metadata?.buildGround && pick.pickedPoint
      ? { x: Math.round(pick.pickedPoint.x * 2) / 2, z: Math.round(pick.pickedPoint.z * 2) / 2 }
      : null;
    this.reason = this.position ? sim.buildingSystem.validate(this.kind, this.position, this.rotation, sim.buildContext) : 'Celuj w ziemię w zasięgu 6 m';
    this.view.preview(this.kind, this.position, this.rotation, this.reason === null);
  }

  confirm(sim: Simulation): string {
    this.update(sim);
    if (!this.position) return this.reason!;
    const result = sim.placeBuilding(this.kind, this.position, this.rotation);
    return result.ok ? `Zbudowano ${BUILDINGS[this.kind].label}` : result.reason;
  }
}
