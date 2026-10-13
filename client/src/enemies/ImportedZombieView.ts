import { arenaEnemyHeight } from '../world/ArenaLayout';
import type { Scene } from '../rendering/babylon';
import type { Player } from '../player/Player';
import { CONFIG } from '../domain/config';
import type { Zombie } from './Zombie';
import { NIGHT_SPEED_MULTIPLIER } from './ZombieTypes';
import { EnemyModelLibrary, type EnemyModelInstance } from './EnemyModelLibrary';
import { ENEMY_MODEL_PROFILES, type BasicEnemyKind } from './EnemyModelManifest';
import { EnemyAnimationController, type EnemyMotion } from './EnemyAnimationController';
import { ZombieView } from './ZombieView';

type Frame = { zombie: Zombie; player: Player; alpha: number; dt: number; time: number; attackStarted: boolean };

/** Keeps gameplay and ray targets working while the supplied skeletal model loads.
 * Older unrigged assets retain body motion as a graceful loading/error fallback. */
export class ImportedZombieView {
  readonly ready: Promise<void>;
  private fallback: ZombieView | null;
  private model: EnemyModelInstance | null = null;
  private animation: EnemyAnimationController | null = null;
  private lastFrame: Frame | null = null;
  private disposed = false;
  private hitTime = 0;
  private deathTime = 0;
  private strikeTime = 0;
  private previousWindup = 0;
  private previousAttackCooldown = 0;
  private running = false;

  constructor(scene: Scene, readonly id: string, readonly kind: BasicEnemyKind, library: EnemyModelLibrary) {
    this.fallback = new ZombieView(scene, id, kind);
    this.ready = library.create(kind, id).then(model => {
      if (!model) return;
      if (this.disposed || scene.isDisposed) { model.dispose(); return; }
      this.model = model;
      this.animation = new EnemyAnimationController(model.animations);
      if (this.lastFrame) this.pose(this.lastFrame);
      this.fallback?.dispose();
      this.fallback = null;
    });
  }

  hit(): void { this.hitTime = .2; this.fallback?.hit(); }
  reset(): void {
    this.deathTime = this.hitTime = this.strikeTime = this.previousWindup = this.previousAttackCooldown = 0;
    this.running = false;
    this.animation?.reset();
    this.fallback?.reset();
    this.model?.root.setEnabled(true);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.animation?.reset(); this.animation = null;
    this.fallback?.dispose(); this.fallback = null;
    this.model?.dispose(); this.model = null;
    this.lastFrame = null;
  }

  update(zombie: Zombie, player: Player, alpha: number, dt: number, time: number): void {
    if (this.disposed) return;
    this.hitTime = Math.max(0, this.hitTime - dt);
    const attackStarted = zombie.alive && ((this.previousWindup > 0 && zombie.windup === 0) || zombie.attackCooldown > this.previousAttackCooldown + .001);
    if (attackStarted) this.strikeTime = this.strikeDuration(zombie);
    this.previousWindup = zombie.windup;
    this.previousAttackCooldown = zombie.attackCooldown;
    this.strikeTime = Math.max(0, this.strikeTime - dt);
    if (!zombie.alive) this.deathTime += dt;
    this.lastFrame = { zombie, player, alpha, dt, time, attackStarted };
    this.fallback?.update(zombie, player, alpha, dt, time);
    if (this.model) this.pose(this.lastFrame);
  }

  private strikeDuration(zombie: Zombie): number {
    const duration = this.animation?.duration('attack') ?? 0;
    return duration > 0 ? Math.min(duration, zombie.stats.attackCooldown * .85) : .24;
  }

  private pose({ zombie, player, alpha, dt, time, attackStarted }: Frame): void {
    const model = this.model!, animation = this.animation!;
    const floorY = arenaEnemyHeight(zombie.id, zombie.kind);
    const x = zombie.previousPosition.x + (zombie.position.x - zombie.previousPosition.x) * alpha;
    const z = zombie.previousPosition.z + (zombie.position.z - zombie.previousPosition.z) * alpha;
    model.root.position.set(x, floorY, z);
    model.root.setEnabled(zombie.alive || this.deathTime <= 2);
    model.hitProxy.isPickable = zombie.alive;
    for (const mesh of model.meshes) {
      mesh.renderOverlay = this.hitTime > 0;
      mesh.overlayAlpha = Math.min(.65, this.hitTime * 3);
    }
    if (!zombie.alive) {
      animation.update('death', dt);
      model.bodyTransform.position.setAll(0);
      model.bodyTransform.rotation.set(0, ENEMY_MODEL_PROFILES[this.kind].yaw, 0);
      model.root.rotation.z = Math.min(Math.PI / 2, this.deathTime * 3.5);
      model.root.position.y = floorY - Math.min(.35, this.deathTime * .3);
      return;
    }
    const target = zombie.intent === 'player' ? player.position : zombie.intent === 'patrol' ? zombie.patrolTarget : zombie.route[zombie.routeIndex] ?? zombie.position;
    model.root.rotation.set(0, Math.atan2(target.x - x, target.z - z), 0);
    // Positions delimit one fixed simulation step, independently of render FPS/alpha.
    const speed = Math.hypot(zombie.position.x - zombie.previousPosition.x, zombie.position.z - zombie.previousPosition.z) / CONFIG.simulationStep;
    const walking = speed > Math.max(.12, zombie.stats.speed * .15);
    const ratio = speed / zombie.stats.speed;
    this.running = walking && ratio > (this.running ? 1.12 : 1.3);
    const attacking = zombie.windup > 0 || this.strikeTime > 0;
    const motion: EnemyMotion = attacking ? 'attack' : !walking ? 'idle' : this.running ? 'run' : 'walk';
    const referenceSpeed = zombie.stats.speed * (this.running ? NIGHT_SPEED_MULTIPLIER : 1);
    const attackRate = animation.duration('attack') / this.strikeDuration(zombie);
    const rate = attacking ? attackRate || 1 : Math.max(.45, Math.min(2.5, speed / referenceSpeed));
    animation.update(motion, dt, rate, attackStarted);

    if (animation.hasSkeletalMotion) {
      // The authored clips move actual joints; a second whole-model lunge/bob would
      // double those movements and slide feet across the floor.
      model.bodyTransform.position.setAll(0);
      model.bodyTransform.rotation.set(0, ENEMY_MODEL_PROFILES[this.kind].yaw, 0);
      return;
    }
    const frequency = this.kind === 'fast' ? 12 : this.kind === 'tank' ? 5 : 7;
    const phase = time * frequency + x * .47 + z * .23;
    const windup = zombie.windup > 0 ? Math.min(1, zombie.windup) : 0;
    const strike = this.strikeTime / .24;
    model.bodyTransform.position.set(0, walking ? Math.abs(Math.sin(phase)) * .035 : Math.sin(phase * .25) * .006, -windup * .08 + strike * .16);
    model.bodyTransform.rotation.set(this.kind === 'fast' ? .1 + strike * .12 : -windup * .08 + strike * .1, ENEMY_MODEL_PROFILES[this.kind].yaw, walking ? Math.sin(phase) * .025 : 0);
  }
}
