import { Mesh, CreateBox, Scene, UniversalCamera, Vector3 } from '../rendering/babylon';
import { CONFIG } from '../domain/config';
import type { Player } from './Player';
import type { InputManager } from '../core/InputManager';

export class PlayerController {
  readonly camera: UniversalCamera;
  private readonly body: Mesh;
  moving = false;

  constructor(scene: Scene, private readonly input: Pick<InputManager, 'consumeLook' | 'down'>) {
    this.camera = new UniversalCamera('player-camera', Vector3.Zero(), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.05;
    this.camera.maxZ = 180;
    this.camera.fov = 1.18;
    this.body = CreateBox('player-collider', { size: 1 }, scene);
    this.body.isVisible = false;
    this.body.isPickable = false;
    this.body.ellipsoid = new Vector3(0.32, 0.8, 0.32);
    this.reset();
  }

  reset(): void {
    this.body.position.set(CONFIG.player.spawn.x, 0.85, CONFIG.player.spawn.z);
    this.camera.position.set(this.body.position.x, 1.7, this.body.position.z);
    this.camera.rotation.set(0.03, 0.22, 0);
    this.moving = false;
  }

  update(dt: number, player: Player): void {
    const look = this.input.consumeLook();
    this.camera.rotation.y += look.x * 0.0022;
    this.camera.rotation.x = Math.max(-1.45, Math.min(1.45, this.camera.rotation.x + look.y * 0.0022));
    const forward = Number(this.input.down('KeyW')) - Number(this.input.down('KeyS'));
    const strafe = Number(this.input.down('KeyD')) - Number(this.input.down('KeyA'));
    const length = Math.hypot(forward, strafe);
    this.moving = length > 0;
    if (length > 0) {
      const yaw = this.camera.rotation.y;
      const step = CONFIG.player.speed * dt / length;
      this.body.moveWithCollisions(new Vector3(
        (Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * step,
        0,
        (Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * step,
      ));
    }
    this.body.position.y = 0.85;
    this.camera.position.set(this.body.position.x, 1.7, this.body.position.z);
    player.position = { x: this.body.position.x, z: this.body.position.z };
    player.yaw = this.camera.rotation.y;
  }

  restore(player: Player): void {
    this.body.position.set(player.position.x, 0.85, player.position.z);
    this.camera.position.set(player.position.x, 1.7, player.position.z);
    this.camera.rotation.set(0.03, player.yaw, 0);
    this.body.computeWorldMatrix(true);
    this.moving = false;
  }
}
