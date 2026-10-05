import { CONFIG } from './config';
import { distance } from './types';
import type { GameEvent, MatchPhase, ResourceCounts, Position } from './types';
import { Player } from '../player/Player';
import { Shelter } from '../shelter/Shelter';
import { Zombie } from '../enemies/Zombie';
import { ZombieAI } from '../enemies/ZombieAI';
import { ZombieSpawner } from '../enemies/ZombieSpawner';
import { hasLineOfSight, isBlocked } from '../world/WorldLayout';
import { NavigationGrid } from '../world/NavigationGrid';
import { ResourceManager } from '../resources/ResourceManager';
import { createResourceNodes } from '../resources/ResourceNode';
import { BuildingSystem } from '../building/BuildingSystem';
import type { BuildContext, PlacementResult } from '../building/BuildingSystem';
import type { BuildingKind } from '../building/Building';
import { MagicTowerSystem } from '../building/MagicTowerSystem';
import { SurvivalCycle, SURVIVAL_SETTINGS } from './SurvivalCycle';
import type { SurvivalSettings } from './SurvivalCycle';

/** Local gameplay authority; the server currently persists checkpoints, not combat decisions. */
export class Simulation {
  runId: string = crypto.randomUUID();
  player = new Player();
  shelter = new Shelter();
  zombies: Zombie[] = [];
  phase: MatchPhase = 'ready';
  resourceManager = new ResourceManager();
  resourceNodes = createResourceNodes();
  buildingSystem = new BuildingSystem();
  towerSystem = new MagicTowerSystem();
  cycle: SurvivalCycle;
  spawner: ZombieSpawner;
  totalKills = 0;
  elapsed = 0;
  swordCooldown = 0;
  private aiCountdown = 0;
  private routeCountdown = 0;
  private readonly ai = new ZombieAI();
  private events: GameEvent[] = [];
  private navigation: NavigationGrid | null = null;
  private navigationKey = '';
  private readonly settings: SurvivalSettings;

  constructor(options: { settings?: Partial<SurvivalSettings>; seed?: number } = {}) {
    this.settings = { ...SURVIVAL_SETTINGS, ...options.settings };
    this.cycle = new SurvivalCycle(this.settings);
    this.spawner = new ZombieSpawner(options.seed);
  }

  get resources(): ResourceCounts { return this.resourceManager.counts; }
  get livingZombies(): Zombie[] { return this.zombies.filter(zombie => zombie.alive); }
  get remainingZombies(): number { return this.livingZombies.length + this.cycle.state.pendingSpawns; }
  get buildContext(): BuildContext {
    return { player: this.player.position, zombies: this.livingZombies.map(zombie => zombie.position), resources: this.resourceManager, nodes: this.resourceNodes };
  }
  get obstacles() {
    return [...this.buildingSystem.footprints, ...this.resourceNodes.filter(node => !node.isDestroyed).map(node => node.footprint)];
  }

  reset(): void {
    this.runId = crypto.randomUUID();
    this.player = new Player();
    this.shelter = new Shelter();
    this.zombies = [];
    this.resourceManager = new ResourceManager();
    this.resourceNodes = createResourceNodes();
    this.buildingSystem = new BuildingSystem();
    this.towerSystem = new MagicTowerSystem();
    this.cycle = new SurvivalCycle(this.settings);
    this.spawner = new ZombieSpawner();
    this.totalKills = 0;
    this.phase = 'ready';
    this.elapsed = this.swordCooldown = this.aiCountdown = this.routeCountdown = 0;
    this.navigation = null;
    this.navigationKey = '';
    this.events = [];
  }

  private refreshNavigation(): NavigationGrid {
    const obstacles = this.obstacles;
    const key = obstacles.map(area => [area.x, area.z, area.width, area.depth].join(',')).join('|');
    if (!this.navigation || this.navigationKey !== key) {
      this.navigation = new NavigationGrid(obstacles);
      this.navigationKey = key;
      this.repath();
    }
    return this.navigation;
  }
  private repath(): void {
    if (!this.navigation) return;
    for (const zombie of this.livingZombies) if (zombie.mode === 'siege') {
      zombie.route = this.navigation.routeFrom(zombie.position);
      zombie.routeIndex = 0;
    }
  }

  start(): void {
    if (this.phase === 'ready') {
      this.phase = 'playing';
      const navigation = this.refreshNavigation();
      for (let i = 0; i < this.settings.dayPatrolCount; i++) {
        const zombie = this.spawner.spawn(navigation, this.player.position, this.zombies, 'patrol');
        if (zombie) this.zombies.push(zombie);
      }
      this.cycle.state.patrolCountdown = this.settings.patrolRespawnInterval;
    } else if (this.phase === 'paused') this.phase = 'playing';
  }
  pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
  beginNight(): boolean {
    if (this.phase !== 'playing' || this.cycle.state.period !== 'day' || this.shelter.distanceFrom(this.player.position) > 8) return false;
    this.cycle.state.periodElapsed = this.settings.dayDuration;
    return true;
  }

  placeBuilding(kind: BuildingKind, position: Position, rotation: number): PlacementResult {
    if (this.phase !== 'playing') return { ok: false, reason: 'Buduj podczas rozgrywki' };
    const result = this.buildingSystem.place(kind, position, rotation, this.buildContext);
    if (result.ok) {
      this.resourceManager.setCapacity(this.buildingSystem.capacity);
      this.refreshNavigation();
    }
    return result;
  }

  attack(targetId: string | null): boolean {
    if (this.phase !== 'playing' || this.swordCooldown > 0) return false;
    this.swordCooldown = CONFIG.sword.cooldown;
    this.events.push({ type: 'swing' });
    const node = this.resourceNodes.find(candidate => candidate.id === targetId);
    if (node) {
      if (node.isDestroyed || node.distanceFrom(this.player.position) > CONFIG.sword.range) return true;
      const obstacles = [...this.buildingSystem.footprints, ...this.resourceNodes.filter(other => other.id !== node.id && !other.isDestroyed).map(other => other.footprint)];
      if (!hasLineOfSight(this.player.position, node.position, obstacles)) return true;
      const hit = node.previewDamage(CONFIG.sword.damage);
      if (!this.resourceManager.canAccept(node.resourceType, hit.reward)) {
        this.events.push({ type: 'storage-full', kind: node.resourceType, needed: hit.reward });
        return true;
      }
      node.damage(CONFIG.sword.damage);
      this.events.push({ type: 'resource-hit', nodeId: node.id, damage: hit.damage });
      if (hit.reward > 0) {
        this.resourceManager.add(node.resourceType, hit.reward);
        this.events.push({ type: 'resource-gained', kind: node.resourceType, amount: hit.reward });
      }
      if (hit.destroyed) this.events.push({ type: 'resource-destroyed', nodeId: node.id });
      return true;
    }
    const zombie = this.zombies.find(enemy => enemy.id === targetId && enemy.alive);
    if (!zombie || distance(this.player.position, zombie.position) > CONFIG.sword.range + 0.4) return true;
    if (!hasLineOfSight(this.player.position, zombie.position, this.obstacles)) return true;
    this.damageZombie(zombie.id, CONFIG.sword.damage, 'sword');
    return true;
  }

  private damageZombie(id: string, amount: number, source: 'sword' | 'tower'): void {
    const zombie = this.zombies.find(enemy => enemy.id === id && enemy.alive);
    if (!zombie) return;
    zombie.damage(amount);
    this.events.push({ type: 'zombie-hit', zombieId: id, damage: amount, source });
    if (!zombie.alive) {
      this.totalKills++;
      this.events.push({ type: 'zombie-dead', zombieId: id });
    }
  }

  update(dt: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    this.swordCooldown = Math.max(0, this.swordCooldown - dt);
    const transition = this.cycle.update(dt, this.livingZombies.length);
    if (transition === 'night-started') {
      for (const zombie of this.livingZombies) zombie.mode = 'siege';
      this.repath();
      this.events.push({ type: transition, day: this.cycle.state.day, waveSize: this.cycle.state.waveSize });
    } else if (transition === 'day-started') {
      this.events.push({ type: transition, day: this.cycle.state.day });
    }
    if (this.cycle.wantsSpawn(this.livingZombies.length)) {
      const zombie = this.spawner.spawn(this.refreshNavigation(), this.player.position, this.zombies, this.cycle.state.period === 'night' ? 'siege' : 'patrol');
      if (zombie) { this.zombies.push(zombie); this.cycle.spawned(); }
      else {
        this.cycle.state.spawnCountdown = 1;
        this.cycle.state.patrolCountdown = 2;
      }
    }
    this.aiCountdown -= dt;
    const decide = this.aiCountdown <= 0;
    if (decide) { this.aiCountdown += CONFIG.aiInterval; this.refreshNavigation(); }
    this.routeCountdown -= dt;
    if (this.routeCountdown <= 0) { this.routeCountdown = 2; this.repath(); }
    const obstacles = this.obstacles;
    for (const zombie of this.zombies) {
      if (!zombie.alive) { zombie.deathAge += dt; continue; }
      zombie.previousPosition = { ...zombie.position };
      zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);
      if (decide) {
        if (zombie.mode === 'patrol' && distance(zombie.position, zombie.patrolTarget) < 0.3) {
          zombie.patrolTarget = this.spawner.patrolTarget(zombie, this.navigation!);
        }
        this.ai.decide(zombie, this.player, obstacles);
      }
      const attackingPlayer = zombie.intent === 'player' &&
        distance(zombie.position, this.player.position) <= CONFIG.zombie.attackRange &&
        hasLineOfSight(zombie.position, this.player.position, obstacles);
      const attackingShelter = zombie.intent === 'shelter' && this.shelter.distanceFrom(zombie.position) <= CONFIG.shelter.attackRange;
      if (attackingPlayer || attackingShelter) {
        if (zombie.attackCooldown === 0) {
          zombie.attackCooldown = CONFIG.zombie.attackCooldown;
          if (attackingPlayer) { this.player.damage(CONFIG.zombie.damage); this.events.push({ type: 'player-hit', damage: CONFIG.zombie.damage }); }
          else { this.shelter.damage(CONFIG.shelter.damage); this.events.push({ type: 'shelter-hit', damage: CONFIG.shelter.damage }); }
        }
      } else {
        const target = zombie.intent === 'player' ? this.player.position : zombie.intent === 'patrol' ? zombie.patrolTarget : zombie.route[zombie.routeIndex];
        if (target) this.ai.move(zombie, target, dt, obstacles);
      }
      // Keep individuals visible instead of stacking all meshes on the same waypoint.
      for (const other of this.zombies) {
        if (other === zombie || !other.alive) continue;
        const d = distance(zombie.position, other.position);
        if (d <= 0 || d >= 0.65) continue;
        const push = Math.min(0.65 - d, dt * 0.8);
        const candidate = { x: zombie.position.x + (zombie.position.x - other.position.x) / d * push, z: zombie.position.z + (zombie.position.z - other.position.z) / d * push };
        if (!isBlocked(candidate, 0.35, obstacles)) zombie.position = candidate;
      }
    }
    this.towerSystem.update(dt, this.buildingSystem.buildings, this.zombies, this.buildingSystem.towerPowerBudget,
      (id, amount) => this.damageZombie(id, amount, 'tower'), this.resourceNodes.filter(node => !node.isDestroyed).map(node => node.footprint));
    this.zombies = this.zombies.filter(zombie => zombie.alive || zombie.deathAge < 3);
    if (this.player.hp === 0 || this.shelter.hp === 0) { this.phase = 'lost'; this.towerSystem.projectiles.length = 0; }
  }

  drainEvents(): GameEvent[] { const events = this.events; this.events = []; return events; }
}
