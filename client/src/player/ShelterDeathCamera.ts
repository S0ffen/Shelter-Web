import { UniversalCamera, Vector3 } from '../rendering/babylon';
import type { Scene } from '../rendering/babylon';
import { BASE_BOUNDS, SHELTER_HALL } from '../world/ShelterLayout';

/** Spectates the base without moving the player's body or changing checkpoint coordinates. */
export class ShelterDeathCamera {
  readonly camera: UniversalCamera;

  constructor(private readonly scene: Scene, private readonly firstPerson: UniversalCamera) {
    const width = BASE_BOUNDS.maxX - BASE_BOUNDS.minX, depth = BASE_BOUNDS.maxZ - BASE_BOUNDS.minZ;
    this.camera = new UniversalCamera('shelter-death-camera', new Vector3(
      SHELTER_HALL.x + width * .45, SHELTER_HALL.height + 17, BASE_BOUNDS.minZ - depth * .5,
    ), scene);
    this.camera.inputs.clear();
    this.camera.fov = 1.05;
    this.camera.minZ = .1;
    this.camera.maxZ = 550;
    this.camera.setTarget(new Vector3(SHELTER_HALL.x, 1.8, (BASE_BOUNDS.minZ + BASE_BOUNDS.maxZ) / 2));
    this.scene.activeCamera = firstPerson;
  }

  update(waitingForRespawn: boolean): void {
    this.scene.activeCamera = waitingForRespawn ? this.camera : this.firstPerson;
  }
}
