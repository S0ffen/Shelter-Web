import { Mesh, CreateBox, Scene, UniversalCamera, Vector3 } from '../rendering/babylon';
import { CONFIG } from '../domain/config';
import { FINAL_ARENA, terrainHeight, inFinalArena } from '../world/ArenaLayout';
import { PLAYER_SETTINGS, type Player } from './Player';
import type { InputManager } from '../core/InputManager';

export class PlayerController {
  readonly camera: UniversalCamera;
  private readonly body: Mesh;
  moving = false;
  private jumpHeld = false;
  private shakeRemaining = 0;
  private shakeStrength = 0;
  shake(strength = .035): void { this.shakeRemaining = .2; this.shakeStrength = strength; }

  constructor(scene: Scene, private readonly input: Pick<InputManager, 'consumeLook' | 'down'>) {
    this.camera = new UniversalCamera('player-camera', Vector3.Zero(), scene);
    this.camera.inputs.clear(); this.camera.minZ = .05; this.camera.maxZ = 550; this.camera.fov = 1.18;
    this.body = CreateBox('player-collider', { size: 1 }, scene);
    this.body.isVisible = false; this.body.isPickable = false; this.body.ellipsoid = new Vector3(.32, .8, .32);
    this.reset();
  }
  reset(): void {
    this.body.position.set(CONFIG.player.spawn.x, .85, CONFIG.player.spawn.z);
    this.camera.position.set(this.body.position.x, 1.7, this.body.position.z);
    this.camera.rotation.set(.03, .22, 0); this.moving = this.jumpHeld = false;
  }
  update(dt: number, player: Player, speed: number = CONFIG.player.speed): void {
    const look = this.input.consumeLook();
    this.camera.rotation.y += look.x * .0022;
    this.camera.rotation.x = Math.max(-1.45, Math.min(1.45, this.camera.rotation.x + look.y * .0022));
    const forward = Number(this.input.down('KeyW')) - Number(this.input.down('KeyS'));
    const strafe = Number(this.input.down('KeyD')) - Number(this.input.down('KeyA'));
    const length = Math.hypot(forward, strafe), before = this.body.position.clone();
    this.moving = length > 0;
    const jump = this.input.down('Space');
    if (jump && !this.jumpHeld && player.verticalVelocity === 0 && Math.abs(player.height - terrainHeight(player.position)) < .1)
      player.verticalVelocity = PLAYER_SETTINGS.jumpSpeed;
    this.jumpHeld = jump;
    if (length > 0) {
      const yaw = this.camera.rotation.y, step = speed * dt / length;
      this.body.moveWithCollisions(new Vector3((Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * step, 0,
        (Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * step));
    }
    // Retaining walls also constrain a low body when a long frame would tunnel across an edge.
    if (player.height < FINAL_ARENA.surfaceY - .25 && inFinalArena({ x: before.x, z: before.z }) &&
      !inFinalArena({ x: this.body.position.x, z: this.body.position.z }, FINAL_ARENA.gateThickness / 2 + .3)) {
      this.body.position.x = before.x; this.body.position.z = before.z;
    }
    const ground = terrainHeight({ x: this.body.position.x, z: this.body.position.z });
    if (this.body.position.y > ground + .85 + 1e-5 || player.verticalVelocity > 0) {
      player.verticalVelocity = Math.max(-PLAYER_SETTINGS.terminalVelocity, player.verticalVelocity - PLAYER_SETTINGS.gravity * dt);
      const oldY = this.body.position.y, change = player.verticalVelocity * dt;
      this.body.moveWithCollisions(new Vector3(0, change, 0));
      if (player.verticalVelocity > 0 && this.body.position.y - oldY < change - .001) player.verticalVelocity = 0;
    }
    if (this.body.position.y <= ground + .85 && player.verticalVelocity <= 0) {
      this.body.position.y = ground + .85; player.verticalVelocity = 0;
    }
    player.height = this.body.position.y - .85;
    this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
    const shake = this.shakeRemaining / .2 * this.shakeStrength;
    this.camera.position.set(this.body.position.x + Math.sin(this.shakeRemaining * 120) * shake,
      player.height + 1.7 + Math.cos(this.shakeRemaining * 95) * shake, this.body.position.z);
    player.position = { x: this.body.position.x, z: this.body.position.z }; player.yaw = this.camera.rotation.y;
  }
  restore(player: Player): void {
    this.body.position.set(player.position.x, player.height + .85, player.position.z);
    this.camera.position.set(player.position.x, player.height + 1.7, player.position.z);
    this.camera.rotation.set(.03, player.yaw, 0); this.body.computeWorldMatrix(true); this.moving = this.jumpHeld = false;
  }
}
