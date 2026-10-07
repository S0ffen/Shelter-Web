import type { Scene, UniversalCamera } from '../rendering/babylon';
import type { Simulation } from '../domain/Simulation';
import type { Position } from '../domain/types';
import type { BuildingKind } from './Building';
import { BUILDINGS } from './Building';
import { generatorPadAt } from '../world/ShelterLayout';
import { BuildingView } from './BuildingView';

/** Placement preview adapter; gameplay validates the placement again on click. */
export class BuildingController {
  active = false;
  movingId: string | null = null;
  kind: BuildingKind = 'storehouse';
  rotation = 0;
  position: Position | null = null;
  reason: string | null = 'Celuj w ziemię';
  readonly view: BuildingView;

  constructor(private readonly scene: Scene, private readonly camera: UniversalCamera) {
    this.view = new BuildingView(scene);
  }

  toggle(): void { this.movingId=null; this.active = !this.active; }
  select(kind: BuildingKind): void { this.movingId=null; this.kind = kind; this.active = true; }
  rotate(): void { if (this.active) this.rotation = (this.rotation + Math.PI / 2) % (Math.PI * 2); }
  cancel(): void { this.movingId=null; this.active = false; this.position = null; }
  reset(): void { this.cancel(); this.rotation = 0; this.view.reset(); }

  beginMove(sim: Simulation, id: string | null): string {
    const tower=sim.demolitionTarget(id);
    if(!sim.skills.bonuses.moveTower)return 'Odblokuj Turret Tower Moving w Engineer';
    if(!tower||tower.kind!=='magic-tower')return 'Podejdź do wieży i wyceluj';
    this.kind='magic-tower';this.rotation=tower.rotation;this.movingId=tower.id;this.active=true;return 'Celuj w ziemię · LPM przenieś · PPM anuluj';
  }
  update(sim: Simulation): void {
    this.view.sync(sim.buildingSystem.buildings);
    if (!this.active || sim.phase !== 'playing') { this.view.preview(null, null, 0, false); return; }
    const pick = this.scene.pickWithRay(this.camera.getForwardRay(8), mesh => mesh.isPickable && mesh.isEnabled());
    this.position = pick?.pickedMesh?.metadata?.buildGround && pick.pickedPoint
      ? { x: Math.round(pick.pickedPoint.x * 2) / 2, z: Math.round(pick.pickedPoint.z * 2) / 2 }
      : null;
    if (this.position && this.kind === 'arcane-core') this.position = generatorPadAt(this.position, 1.7) ?? this.position;
    this.reason = this.position ? this.movingId ? sim.validateMoveTower(this.movingId,this.position,this.rotation) : sim.buildingSystem.validate(this.kind, this.position, this.rotation, sim.buildContext) : 'Celuj w ziemię w zasięgu 6 m';
    this.view.preview(this.kind, this.position, this.rotation, this.reason === null);
  }

  confirm(sim: Simulation): string {
    this.update(sim);
    if (!this.position) return this.reason!;
    if (this.movingId) { const reason=sim.validateMoveTower(this.movingId,this.position,this.rotation);if(reason)return reason;const message=sim.moveTower(this.movingId,this.position,this.rotation);this.cancel();return message; }
    const result = sim.placeBuilding(this.kind, this.position, this.rotation);
    return result.ok ? `Zbudowano ${BUILDINGS[this.kind].label}` : result.reason;
  }
}
