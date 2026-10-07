import { ARENA_GATES, inFinalArena, FINAL_ARENA } from '../world/ArenaLayout';
import encounters from '../../../shared/encounters.json';
import { PERKS, SkillTree } from './SkillTree';
import { Corruption } from './Corruption';
import { CONFIG } from './config';
import { distance } from './types';
import type { GameEvent, MatchPhase, ResourceCounts, Position, AttackKind } from './types';
import { Player } from '../player/Player';
import { Shelter, SHELTER_LEVELS, SHELTER_REPAIR } from '../shelter/Shelter';
import { inHall, inBase, SHELTER_CORE_ID, SHELTER_DEPOSIT, SHELTER_DEPOSIT_ID } from '../world/ShelterLayout';
import { freshAbilities, updatePassives, receivePlayerDamage, useAbility } from './SkillRuntime';
import { Zombie } from '../enemies/Zombie';
import { ZombieAI } from '../enemies/ZombieAI';
import { ZombieSpawner } from '../enemies/ZombieSpawner';
import type { Footprint } from '../world/WorldLayout';
import { hasLineOfSight, isBlocked } from '../world/WorldLayout';
import { NavigationGrid } from '../world/NavigationGrid';
import { ResourceManager } from '../resources/ResourceManager';
import { createResourceNodes } from '../resources/ResourceNode';
import { BuildingSystem } from '../building/BuildingSystem';
import type { BuildContext, PlacementResult } from '../building/BuildingSystem';
import { BUILDINGS } from '../building/Building';
import type { BuildingKind } from '../building/Building';
import { MagicTowerSystem } from '../building/MagicTowerSystem';
import { SurvivalCycle, SURVIVAL_SETTINGS } from './SurvivalCycle';
import type { SurvivalSettings } from './SurvivalCycle';
/** Local gameplay authority; the server currently persists checkpoints, not combat decisions. */
export class Simulation {
  runId: string = crypto.randomUUID();
  player = new Player();
  corruption = new Corruption();
  skills = new SkillTree();
  abilities = freshAbilities();
  bossHazards: {
    id: number;
    position: Position;
    remaining: number;
    radius: number;
    damage: number;
  }[] = [];
  encounters = { forgeGuardianDefeated: false, graveGuardianDefeated: false, ravagerDefeated: false, finalBossDefeated: false };
  finalArenaActive = false;
  shelter = new Shelter();
  zombies: Zombie[] = [];
  phase: MatchPhase = 'ready';
  resourceManager = new ResourceManager();
  carriedManager = new ResourceManager(CONFIG.resources.carriedCapacity);
  resourceNodes = createResourceNodes();
  buildingSystem = new BuildingSystem();
  towerSystem = new MagicTowerSystem();
  cycle: SurvivalCycle;
  spawner: ZombieSpawner;
  totalKills = 0;
  elapsed = 0;
  swordCooldown = 0;
  swordCooldownDuration = CONFIG.sword.cooldown as number;
  repairCooldown = 0;
  private aiCountdown = 0;
  private routeCountdown = 0;
  private readonly ai = new ZombieAI();
  private events: GameEvent[] = [];
  private navigation: NavigationGrid | null = null;
  private navigationKey = '';
  private readonly settings: SurvivalSettings;
  constructor(options: {
    settings?: Partial<SurvivalSettings>;
    seed?: number;
  } = {}) {
    this.settings = { ...SURVIVAL_SETTINGS, ...options.settings };
    this.cycle = new SurvivalCycle(this.settings);
    this.spawner = new ZombieSpawner(options.seed);
  }
  get movementSpeed(): number { return CONFIG.player.speed * this.corruption.movementMultiplier * this.skills.bonuses.movementSpeed; }
  get carried(): ResourceCounts { return this.carriedManager.counts; }
  get resources(): ResourceCounts { return this.resourceManager.counts; }
  get livingZombies(): Zombie[] { return this.zombies.filter(zombie => zombie.alive); }
  get remainingZombies(): number { return this.livingZombies.length + this.cycle.state.pendingSpawns; }
  get buildContext(): BuildContext {
    return { player: this.player.position, zombies: this.livingZombies.map(zombie => zombie.position), resources: this.resourceManager, nodes: this.resourceNodes };
  }
  get obstacles() {
    return [...(this.finalArenaActive ? ARENA_GATES : []), ...this.buildingSystem.footprints, ...this.resourceNodes.filter(node => !node.isDestroyed).map(node => node.footprint)];
  }
  reset(): void {
    this.runId = crypto.randomUUID();
    this.player = new Player();
    this.corruption = new Corruption();
    this.skills = new SkillTree();
    this.abilities = freshAbilities();
    this.bossHazards = [];
    this.encounters = { forgeGuardianDefeated: false, graveGuardianDefeated: false, ravagerDefeated: false, finalBossDefeated: false };
    this.finalArenaActive = false;
    this.shelter = new Shelter();
    this.zombies = [];
    this.resourceManager = new ResourceManager();
    this.carriedManager = new ResourceManager(CONFIG.resources.carriedCapacity);
    this.resourceNodes = createResourceNodes();
    this.buildingSystem = new BuildingSystem();
    this.towerSystem = new MagicTowerSystem();
    this.cycle = new SurvivalCycle(this.settings);
    this.spawner = new ZombieSpawner();
    this.totalKills = 0;
    this.phase = 'ready';
    this.elapsed = this.swordCooldown = this.repairCooldown = this.aiCountdown = this.routeCountdown = 0;
    this.swordCooldownDuration = CONFIG.sword.cooldown;
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
    if (!this.navigation)
      return;
    for (const zombie of this.livingZombies)
      if (zombie.mode === 'siege') {
        zombie.route = this.navigation.routeFrom(zombie.position);
        zombie.routeIndex = 0;
      }
  }
  start(): void {
    if (this.phase === 'ready') {
      this.phase = 'playing';
      const navigation = this.refreshNavigation();
      for (let i = 0;i < this.settings.dayPatrolCount;i++) {
        const zombie = this.spawner.spawn(navigation, this.player.position, this.zombies, 'patrol');
        if (zombie)
          this.zombies.push(zombie);
      }
      this.cycle.state.patrolCountdown = this.settings.patrolRespawnInterval;
    }
    else if (this.phase === 'paused')
      this.phase = 'playing';
  }
  pause(): void {
    if (this.phase === 'playing')
      this.phase = 'paused';
  }
  beginNight(): boolean {
    if (this.phase !== 'playing' || this.cycle.state.period !== 'day' || !inBase(this.player.position))
      return false;
    this.cycle.state.periodElapsed = this.settings.dayDuration;
    return true;
  }
  placeBuilding(kind: BuildingKind, position: Position, rotation: number): PlacementResult {
    if (this.phase !== 'playing')
      return { ok: false, reason: 'Buduj podczas rozgrywki' };
    const result = this.buildingSystem.place(kind, position, rotation, this.buildContext);
    if (result.ok) {
      this.resourceManager.setCapacity(this.buildingSystem.capacity);
      this.refreshNavigation();
    }
    return result;
  }
  demolitionTarget(id: string | null) {
    const building = this.buildingSystem.buildings.find(b => b.id === id && b.alive);
    return building && this.phase === 'playing' && inBase(this.player.position) && building.distanceFrom(this.player.position) <= 3 && hasLineOfSight(this.player.position, building.contactPoint(this.player.position), this.obstacles.filter(a => a.x !== building.position.x || a.z !== building.position.z)) ? building : null;
  }
  demolishBuilding(id: string | null): string {
    if (!this.skills.bonuses.recycle)
      return 'Odblokuj Recycle w Engineer';
    const building = this.demolitionTarget(id);
    if (!building)
      return 'Podejdź do konstrukcji i wyceluj';
    const cost = this.buildingSystem.costFor(building.kind);
    this.buildingSystem.buildings.splice(this.buildingSystem.buildings.indexOf(building), 1);
    this.towerSystem.towers.delete(building.id);
    this.towerSystem.projectiles.splice(0, this.towerSystem.projectiles.length, ...this.towerSystem.projectiles.filter(p => p.sourceId !== building.id));
    this.resourceManager.setCapacity(this.buildingSystem.capacity);
    const wood = this.resourceManager.add('wood', Math.floor(cost.wood * this.skills.bonuses.recycle)), iron = this.resourceManager.add('iron', Math.floor(cost.iron * this.skills.bonuses.recycle));
    this.refreshNavigation();
    return 'RECYCLE · zwrot ' + wood + ' Wood / ' + iron + ' Iron';
  }
  validateMoveTower(id: string, position: Position, rotation: number): string | null {
    const building = this.buildingSystem.buildings.find(b => b.id === id && b.kind === 'magic-tower' && b.alive);
    if (!building || !this.skills.bonuses.moveTower || this.phase !== 'playing')
      return 'Przenoszenie wież jest niedostępne';
    const index = this.buildingSystem.buildings.indexOf(building);
    this.buildingSystem.buildings.splice(index, 1);
    const resources = new ResourceManager();
    Object.assign(resources.counts, { wood: 1e6, iron: 1e6 });
    try {
      return this.buildingSystem.validate('magic-tower', position, rotation, { ...this.buildContext, resources });
    }
    finally {
      this.buildingSystem.buildings.splice(index, 0, building);
    }
  }
  moveTower(id: string, position: Position, rotation: number): string {
    const reason = this.validateMoveTower(id, position, rotation);
    if (reason)
      return reason;
    const building = this.buildingSystem.buildings.find(b => b.id === id)!;
    Object.assign(building.position, position);
    building.rotation = rotation;
    this.refreshNavigation();
    return 'Wieża przeniesiona';
  }
  improveShelter(): string {
    if (this.phase !== 'playing' || !inHall(this.player.position))
      return 'Wejdź do Shelteru, aby go rozbudować';
    if (this.cycle.state.period !== 'day')
      return 'Rozbudowa Shelteru jest możliwa za dnia';
    const next = SHELTER_LEVELS[this.shelter.level];
    if (!next)
      return 'Shelter ma już najwyższy poziom';
    if (!this.resourceManager.spend({ wood: Math.ceil(next.cost.wood * this.skills.bonuses.buildingCost), iron: Math.ceil(next.cost.iron * this.skills.bonuses.buildingCost) }))
      return 'Za mało materiałów na rozbudowę Shelteru';
    this.shelter.upgrade();
    return `Shelter · poziom ${this.shelter.level} · ${this.shelter.maxHp} HP`;
  }
  repairShelter(): string {
    if (this.phase !== 'playing' || !inHall(this.player.position) || this.shelter.distanceFrom(this.player.position) > CONFIG.sword.range || !hasLineOfSight(this.player.position, this.shelter.contactPoint(this.player.position), this.obstacles))
      return 'Podejdź do centralnego słupa i uderz LPM';
    if (this.shelter.hp >= this.shelter.maxHp)
      return 'Rdzeń Shelteru nie wymaga naprawy';
    if (this.repairCooldown > 0)
      return 'Zaczekaj na zakończenie naprawy';
    if (!this.resourceManager.spend(SHELTER_REPAIR.cost))
      return 'Naprawa wymaga 2 Wood i 1 Iron';
    const amount = Math.min(Math.round(SHELTER_REPAIR.amount * this.repairMultiplier), this.shelter.maxHp - this.shelter.hp);
    this.shelter.hp += amount;
    this.repairCooldown = SHELTER_REPAIR.cooldown / this.skills.bonuses.repairSpeed;
    this.events.push({ type: 'shelter-repaired', amount });
    return `Naprawiono rdzeń · +${amount} HP`;
  }
  attack(targetId: string | null, kind: AttackKind = 'quick'): boolean {
    if (this.phase !== 'playing' || this.swordCooldown > 0)
      return false;
    const strike = kind === 'heavy' ? CONFIG.sword.heavy : CONFIG.sword;
    const stealth = this.abilities.cloak > 0;
    this.abilities.cloak = 0;
    this.swordCooldown = this.swordCooldownDuration = strike.cooldown / this.skills.bonuses.attackSpeed;
    this.events.push({ type: 'swing', kind });
    if (targetId === SHELTER_CORE_ID) {
      if (kind === 'quick') {
        const message = this.repairShelter();
        if (!message.startsWith('Naprawiono'))
          this.events.push({ type: 'action-blocked', message });
      }
      else
        this.events.push({ type: 'action-blocked', message: 'Naprawiaj rdzeń szybkim uderzeniem LPM' });
      return true;
    }
    const building = this.buildingSystem.buildings.find(candidate => candidate.id === targetId);
    if (building) {
      if (kind === 'quick')
        this.events.push({ type: 'action-blocked', message: this.repairBuilding(building.id) });
      return true;
    }
    const node = this.resourceNodes.find(candidate => candidate.id === targetId);
    if (node) {
      if (this.resourceGuard(node.id)) {
        this.events.push({ type: 'action-blocked', message: 'Ancient Forge jest strzeżona · pokonaj Forge Guardiana' });
        return true;
      }
      if (node.isDestroyed || node.distanceFrom(this.player.position) > strike.range + this.skills.bonuses.harvestRange)
        return true;
      const obstacles = [...this.buildingSystem.footprints, ...this.resourceNodes.filter(other => other.id !== node.id && !other.isDestroyed).map(other => other.footprint)];
      if (!hasLineOfSight(this.player.position, node.position, obstacles))
        return true;
      const hit = node.previewDamage(Math.round(strike.damage * this.skills.bonuses.harvestDamage));
      if (hit.reward > 0)
        hit.reward += node.reward.filter(step => node.health > step.health && node.health - hit.damage <= step.health).length * this.skills.bonuses.harvestBonus;
      if (!this.carriedManager.canAccept(node.resourceType, hit.reward)) {
        this.events.push({ type: 'storage-full', kind: node.resourceType, needed: hit.reward });
        return true;
      }
      node.damage(Math.round(strike.damage * this.skills.bonuses.harvestDamage));
      this.events.push({ type: 'resource-hit', nodeId: node.id, damage: hit.damage });
      if (hit.reward > 0) {
        this.carriedManager.add(node.resourceType, hit.reward);
        this.events.push({ type: 'resource-gained', kind: node.resourceType, amount: hit.reward });
      }
      if (hit.destroyed)
        this.events.push({ type: 'resource-destroyed', nodeId: node.id });
      return true;
    }
    const zombie = this.zombies.find(enemy => enemy.id === targetId && enemy.alive);
    if (!zombie || distance(this.player.position, zombie.position) > strike.range + this.skills.bonuses.meleeRange + 0.4)
      return true;
    if (!hasLineOfSight(this.player.position, zombie.position, this.obstacles))
      return true;
    this.damageZombie(zombie.id, Math.round(strike.damage * this.skills.bonuses.meleeDamage * (kind === 'heavy' ? this.skills.bonuses.heavyDamage : 1) * (stealth ? 2 : 1)), 'sword');
    this.abilities.cloak = 0;
    if (this.skills.bonuses.slow > 0)
      zombie.slow = 2;
    return true;
  }
  damageZombie(id: string, amount: number, source: 'sword' | 'tower'): void {
    const zombie = this.zombies.find(enemy => enemy.id === id && enemy.alive);
    if (!zombie)
      return;
    if (zombie.kind === 'overlord')
      amount = Math.round(amount * (1 - encounters.finalBoss.resistance));
    zombie.damage(amount);
    this.events.push({ type: 'zombie-hit', zombieId: id, damage: amount, source });
    if (!zombie.alive) {
      this.totalKills++;
      if (this.skills.bonuses.scavenger > 0 && this.spawner.random() < this.skills.bonuses.scavenger) {
        const kind = this.spawner.random() < .5 ? 'wood' : 'iron';
        const amount = this.carriedManager.add(kind, 1);
        if (amount)
          this.events.push({ type: 'resource-gained', kind, amount });
      }
      if (zombie.kind === 'overlord') {
        this.encounters.finalBossDefeated = true;
        this.finalArenaActive = false;
        if (this.player.hp > 0 && this.shelter.hp > 0) {
          this.phase = 'won';
          this.towerSystem.projectiles.length = 0;
          this.bossHazards = [];
          this.events.push({ type: 'run-completed' });
        }
      }
      if (zombie.kind === 'guardian') {
        this.encounters.forgeGuardianDefeated = true;
        this.events.push({ type: 'guardian-defeated' });
      }
      if (zombie.kind === 'warden') { this.encounters.graveGuardianDefeated = true; this.events.push({ type: 'action-blocked', message: 'Strażnik Katakumb pokonany · zapasy drewna odblokowane' }); }
      if (zombie.kind === 'ravager') { this.encounters.ravagerDefeated = true; this.events.push({ type: 'action-blocked', message: 'Kolos pokonany · środkowy plac jest wolny' }); }
      this.events.push({ type: 'zombie-dead', zombieId: id });
    }
  }
  update(dt: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0)
      return;
    if (!this.encounters.finalBossDefeated && !this.finalArenaActive && inFinalArena(this.player.position, FINAL_ARENA.entryInset)) {
      this.finalArenaActive = true;
      this.events.push({ type: 'action-blocked', message: 'ARENA ZAMKNIĘTA · pokonaj Władcę Klątwy. Pieczęć chroni Psyche.' });
    }
    this.ensureGuardian();
    updatePassives(this, dt);
    this.updateBossHazards(dt);
    const corruptionDamage = this.corruption.update(dt, inBase(this.player.position) || this.finalArenaActive && FINAL_ARENA.protectsPsyche, this.skills.bonuses.corruptionRate);
    if (corruptionDamage > 0)
      this.hitPlayer(corruptionDamage, true);
    this.elapsed += dt;
    this.swordCooldown = Math.max(0, this.swordCooldown - dt);
    this.repairCooldown = Math.max(0, this.repairCooldown - dt);
    const previousPeriod = this.cycle.state.period;
    const previousRemaining = this.cycle.secondsRemaining;
    const transition = this.cycle.update(dt, this.livingZombies.filter(z => z.mode !== 'guard').length);
    if (previousPeriod === 'day')
      for (const seconds of this.cycle.settings.warningSeconds) {
        if (previousRemaining > seconds && this.cycle.secondsRemaining <= seconds && !transition)
          this.events.push({ type: 'night-warning', seconds });
      }
    if (transition === 'night-started') {
      for (const zombie of this.livingZombies)
        if (zombie.mode !== 'guard' && !zombie.id.startsWith('boss-minion-'))
          zombie.mode = 'siege';
      this.repath();
      this.events.push({ type: transition, day: this.cycle.state.day, waveSize: this.cycle.state.waveSize });
    }
    else if (transition === 'day-started') {
      this.skills.nextDay();
      // Siege enemies retreat at dawn; this grants no kills or rewards.
      this.zombies = this.zombies.filter(zombie => zombie.mode !== 'siege');
      for (const node of this.resourceNodes)
        node.respawn();
      this.refreshNavigation();
      this.events.push({ type: transition, day: this.cycle.state.day });
    }
    if (this.cycle.wantsSpawn(this.livingZombies.filter(z => z.mode !== 'guard').length)) {
      const zombie = this.spawner.spawn(this.refreshNavigation(), this.player.position, this.zombies, this.cycle.state.period === 'night' ? 'siege' : 'patrol', this.cycle.state.day);
      if (zombie) {
        this.zombies.push(zombie);
        this.cycle.spawned();
      }
      else {
        this.cycle.state.spawnCountdown = 1;
        this.cycle.state.patrolCountdown = 2;
      }
    }
    this.aiCountdown -= dt;
    const decide = this.aiCountdown <= 0;
    if (decide) {
      this.aiCountdown += CONFIG.aiInterval;
      this.refreshNavigation();
    }
    this.routeCountdown -= dt;
    if (this.routeCountdown <= 0) {
      this.routeCountdown = 2;
      this.repath();
    }
    const obstacles = this.obstacles;
    for (const zombie of this.zombies) {
      if (!zombie.alive) {
        zombie.deathAge += dt;
        continue;
      }
      zombie.previousPosition = { ...zombie.position };
      zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);
      zombie.slow = Math.max(0, zombie.slow - dt);
      if (zombie.mode === 'guard') {
        this.updateGuardian(zombie, dt, decide, obstacles);
        continue;
      }
      if (this.finalArenaActive && zombie.id.startsWith('boss-minion-')) {
        zombie.intent = this.abilities.cloak === 0 ? 'player' : 'patrol';
        const target = zombie.intent === 'player' ? this.player.position : zombie.origin;
        if (distance(zombie.position,this.player.position)<=CONFIG.zombie.attackRange && this.abilities.cloak===0 && hasLineOfSight(zombie.position,this.player.position,obstacles)) {
          if(zombie.attackCooldown===0){zombie.attackCooldown=zombie.stats.attackCooldown;this.hitPlayer(zombie.stats.damage);}
        } else {
          if(decide || !zombie.route.length){zombie.route=this.refreshNavigation().routeTo(zombie.position,target);zombie.routeIndex=0;}
          while(zombie.routeIndex<zombie.route.length-1 && distance(zombie.position,zombie.route[zombie.routeIndex])<.25)zombie.routeIndex++;
          const point=zombie.route[zombie.routeIndex];if(point)this.ai.move(zombie,point,dt,obstacles,this.cycle.state.period==='night',zombie.slow>0?1-this.skills.bonuses.slow:1);
        }
        continue;
      }
      if (decide) {
        if (zombie.mode === 'patrol' && distance(zombie.position, zombie.patrolTarget) < 0.3) {
          zombie.patrolTarget = this.spawner.patrolTarget(zombie, this.navigation!);
        }
        this.ai.decide(zombie, this.player, obstacles);
        if (this.abilities.cloak > 0 && zombie.intent === 'player')
          zombie.intent = zombie.mode === 'patrol' ? 'patrol' : 'shelter';
      }
      const attackingPlayer = this.abilities.cloak === 0 && zombie.intent === 'player' &&
        distance(zombie.position, this.player.position) <= CONFIG.zombie.attackRange &&
        hasLineOfSight(zombie.position, this.player.position, obstacles);
      const attackingShelter = zombie.intent === 'shelter' && this.shelter.distanceFrom(zombie.position) <= CONFIG.shelter.attackRange &&
        hasLineOfSight(zombie.position, this.shelter.contactPoint(zombie.position), obstacles);
      const attackedBuilding = !attackingPlayer && !attackingShelter ? this.buildingSystem.buildings.find(building => building.alive && building.distanceFrom(zombie.position) <= 1.1 && hasLineOfSight(zombie.position, building.contactPoint(zombie.position), [...obstacles.filter(area => area.x !== building.position.x || area.z !== building.position.z)])) : undefined;
      if (attackingPlayer || attackingShelter || attackedBuilding) {
        if (zombie.attackCooldown === 0) {
          zombie.attackCooldown = zombie.stats.attackCooldown;
          if (attackingPlayer) {
            this.hitPlayer(zombie.stats.damage);
          }
          else if (attackedBuilding) {
            attackedBuilding.damage(zombie.stats.shelterDamage);
            this.events.push({ type: 'building-hit', buildingId: attackedBuilding.id, damage: zombie.stats.shelterDamage });
          }
          else {
            const damage = this.shelter.damage(zombie.stats.shelterDamage);
            this.events.push({ type: 'shelter-hit', damage });
          }
        }
      }
      else {
        const target = zombie.intent === 'player' ? this.player.position : zombie.intent === 'patrol' ? zombie.patrolTarget : zombie.route[zombie.routeIndex];
        if (target)
          this.ai.move(zombie, target, dt, obstacles, this.cycle.state.period === 'night', zombie.slow > 0 ? 1 - this.skills.bonuses.slow : 1);
      }
      // Keep individuals visible instead of stacking all meshes on the same waypoint.
      for (const other of this.zombies) {
        if (other === zombie || !other.alive)
          continue;
        const d = distance(zombie.position, other.position);
        if (d <= 0 || d >= 0.65)
          continue;
        const push = Math.min(0.65 - d, dt * 0.8);
        const candidate = { x: zombie.position.x + (zombie.position.x - other.position.x) / d * push, z: zombie.position.z + (zombie.position.z - other.position.z) / d * push };
        if (!isBlocked(candidate, 0.35, obstacles))
          zombie.position = candidate;
      }
    }
    for (let i = this.buildingSystem.buildings.length - 1;i >= 0;i--)
      if (!this.buildingSystem.buildings[i].alive) {
        const [destroyed] = this.buildingSystem.buildings.splice(i, 1);
        this.towerSystem.towers.delete(destroyed.id);
        this.towerSystem.projectiles.splice(0, this.towerSystem.projectiles.length, ...this.towerSystem.projectiles.filter(shot => shot.sourceId !== destroyed.id));
        const before = { ...this.resources };
        this.resourceManager.setCapacity(this.buildingSystem.capacity);
        this.events.push({ type: 'building-destroyed', buildingId: destroyed.id, kind: destroyed.kind, lostResources: { wood: before.wood - this.resources.wood, iron: before.iron - this.resources.iron } });
      }
    this.towerSystem.update(dt, this.buildingSystem.buildings, this.zombies, this.buildingSystem.towerPowerBudget, (id, amount) => this.damageZombie(id, amount, 'tower'), this.resourceNodes.filter(node => !node.isDestroyed).map(node => node.footprint));
    this.zombies = this.zombies.filter(zombie => zombie.alive || zombie.deathAge < 3);
    if (this.player.hp === 0 || this.shelter.hp === 0) {
      this.phase = 'lost';
      this.towerSystem.projectiles.length = 0;
    }
  }
  isForgeResource(id: string): boolean { return id.startsWith('iron-ancient-forge-'); }
  resourceGuard(id: string): string | null {
    if (this.isForgeResource(id) && !this.encounters.forgeGuardianDefeated) return 'Ancient Forge · pokonaj Strażnika Kuźni';
    if (id.startsWith('wood-outskirts-') && !this.encounters.graveGuardianDefeated) return 'Katakumby · pokonaj Strażnika Katakumb';
    return null;
  }
  private ensureGuardian(): void {
    const definitions = [
      { spec: encounters.forgeGuardian, defeated: this.encounters.forgeGuardianDefeated, id: 'forge-guardian' },
      { spec: encounters.graveGuardian, defeated: this.encounters.graveGuardianDefeated, id: 'grave-guardian' },
      { spec: encounters.ravager, defeated: this.encounters.ravagerDefeated, id: 'city-ravager' },
      { spec: encounters.finalBoss, defeated: this.encounters.finalBossDefeated || !this.finalArenaActive, id: 'curse-overlord' },
    ];
    for (const { spec, defeated, id } of definitions) {
      if (defeated || this.zombies.some(z => z.kind === spec.kind) || distance(this.player.position, spec.position) > spec.triggerDistance)
        continue;
      const enemy = new Zombie(id, spec.position, spec.kind as 'guardian' | 'warden' | 'ravager' | 'overlord');
      enemy.mode = 'guard';
      enemy.intent = 'guard';
      this.zombies.push(enemy);
    }
  }
  private hitPlayer(amount: number, psyche = false): void {
    const damage = receivePlayerDamage(this, amount, psyche); if (damage > 0)
      this.events.push(psyche ? { type: 'corruption-hit', damage } : { type: 'player-hit', damage });
  }
  private updateBossHazards(dt: number): void {
    for (let i = this.bossHazards.length - 1;i >= 0;i--) {
      const hazard = this.bossHazards[i];
      hazard.remaining = Math.max(0, hazard.remaining - dt);
      if (hazard.remaining > 0)
        continue;
      if (distance(this.player.position, hazard.position) <= hazard.radius) {
        this.hitPlayer(hazard.damage);
      }
      this.events.push({ type: 'boss-slam', zombieId: 'curse-overlord', position: { ...hazard.position } });
      this.bossHazards.splice(i, 1);
    }
  }
  private updateGuardian(zombie: Zombie, dt: number, decide: boolean, obstacles: readonly Footprint[]): void {
    const final = zombie.kind === 'overlord', ravager = zombie.kind === 'ravager';
    const spec = final ? encounters.finalBoss : ravager ? encounters.ravager : zombie.kind === 'warden' ? encounters.graveGuardian : encounters.forgeGuardian;
    const enraged = final && zombie.hp / zombie.maxHp <= encounters.finalBoss.enrageThreshold;
    const chase = this.abilities.cloak === 0 && (final ? this.finalArenaActive : distance(this.player.position, zombie.origin) <= spec.leashRange && distance(zombie.position, this.player.position) <= spec.aggroRange);
    zombie.intent = chase ? 'player' : 'guard';
    if (final && zombie.chargeRemaining > 0 && zombie.chargeTarget) {
      zombie.chargeRemaining = Math.max(0, zombie.chargeRemaining - dt);
      this.ai.move(zombie, zombie.chargeTarget, dt, obstacles, false, encounters.finalBoss.chargeSpeed / zombie.stats.speed);
      if (!zombie.chargeHit && distance(zombie.position, this.player.position) <= 2.8 && hasLineOfSight(zombie.position, this.player.position, obstacles)) { this.hitPlayer(encounters.finalBoss.chargeDamage); zombie.chargeHit = true; }
      if (zombie.chargeRemaining === 0 || distance(zombie.position, zombie.chargeTarget) < .2) { zombie.chargeRemaining = 0; zombie.chargeTarget = null; }
      return;
    }
    if (zombie.windup > 0) {
      zombie.windup = Math.max(0, zombie.windup - dt);
      if (zombie.windup === 0) {
        if (zombie.chargeTarget) { zombie.chargeRemaining = encounters.finalBoss.chargeDuration; zombie.windupTarget = null; return; }
        const target = zombie.windupTarget;
        if (target) {
          if (!ravager && !final) this.events.push({ type: 'boss-slam', zombieId: zombie.id, position: target });
          const range = ravager ? spec.attackRange + .2 : spec.slamRadius;
          if (distance(this.player.position, target) <= range && distance(zombie.position, this.player.position) <= spec.attackRange + .4 && hasLineOfSight(zombie.position, this.player.position, obstacles)) this.hitPlayer(zombie.stats.damage);
        }
        zombie.windupTarget = null;
      }
      return;
    }
    if (final && chase) {
      zombie.chargeCooldown = Math.max(0, zombie.chargeCooldown - dt);
      zombie.summonCooldown = Math.max(0, zombie.summonCooldown - dt);
      if (zombie.chargeCooldown === 0 && distance(zombie.position, this.player.position) > 5 && hasLineOfSight(zombie.position, this.player.position, obstacles)) {
        zombie.chargeCooldown = encounters.finalBoss.chargeInterval;
        zombie.chargeTarget = { ...this.player.position }; zombie.chargeHit = false;
        zombie.windup = encounters.finalBoss.chargeWindup; zombie.windupTarget = { ...this.player.position };
        this.events.push({ type: 'action-blocked', message: 'SZARŻA · uskok w bok!' }); return;
      }
      if (zombie.summonCooldown === 0) {
        zombie.summonCooldown = encounters.finalBoss.summonInterval;
        let available = encounters.finalBoss.minionLimit - this.zombies.filter(z => z.alive && z.id.startsWith('boss-minion-')).length, summoned = 0;
        for (let i = 0; i < 12 && available > 0 && summoned < 2; i++) {
          const angle = this.spawner.random() * Math.PI * 2, point = { x: zombie.position.x + Math.sin(angle) * 4, z: zombie.position.z + Math.cos(angle) * 4 };
          if (!inFinalArena(point, 1) || isBlocked(point, .4, obstacles) || distance(point, this.player.position) < 2) continue;
          const minion = new Zombie('boss-minion-' + this.spawner.nextId++, point, 'fast'); minion.mode = 'patrol'; this.zombies.push(minion); available--; summoned++;
        }
      }
    }
    if (chase && distance(zombie.position, this.player.position) <= spec.attackRange && hasLineOfSight(zombie.position, this.player.position, obstacles)) {
      if (zombie.attackCooldown === 0) {
        zombie.attackCooldown = zombie.stats.attackCooldown * (enraged ? encounters.finalBoss.enrageCooldown : 1);
        zombie.windup = spec.windup; zombie.windupTarget = { ...this.player.position };
        if (!ravager && !final) this.events.push({ type: 'boss-windup', zombieId: zombie.id, position: { ...zombie.windupTarget } });
      }
      return;
    }
    const target = chase ? this.player.position : zombie.origin;
    if (decide || !zombie.route.length) { zombie.route = this.refreshNavigation().routeTo(zombie.position, target); zombie.routeIndex = 0; }
    while (zombie.routeIndex < zombie.route.length - 1 && distance(zombie.position, zombie.route[zombie.routeIndex]) < .25) zombie.routeIndex++;
    const waypoint = zombie.route[zombie.routeIndex];
    if (waypoint) this.ai.move(zombie, waypoint, dt, obstacles, false, (enraged ? encounters.finalBoss.enrageSpeed : 1) * (zombie.slow > 0 ? 1 - this.skills.bonuses.slow : 1));
  }
  purchaseSkill(id: string): string {
    if (!['playing', 'paused'].includes(this.phase))
      return 'Rozwijaj umiejętności podczas runu';
    const reason = this.skills.reason(id);
    if (reason)
      return reason;
    const before = this.skills.bonuses;
    this.skills.buy(id);
    this.swordCooldown *= before.attackSpeed / this.skills.bonuses.attackSpeed;
    this.swordCooldownDuration *= before.attackSpeed / this.skills.bonuses.attackSpeed;
    this.repairCooldown *= before.repairSpeed / this.skills.bonuses.repairSpeed;
    this.applySkillBonuses();
    return `${PERKS.find(perk => perk.id === id)!.name} · ranga ${this.skills.levels[id]}`;
  }
  applySkillBonuses(): void {
    const oldHp = this.player.maxHp;
    this.player.healthMultiplier = this.skills.bonuses.maxHealth;
    this.player.hp += this.player.maxHp - oldHp;
    this.buildingSystem.costMultiplier = this.skills.bonuses.buildingCost;
    this.buildingSystem.healthMultiplier = this.skills.bonuses.buildingHealth;
    const bonuses = this.skills.bonuses;
    this.carriedManager.setCapacity({ wood: CONFIG.resources.carriedCapacity.wood + bonuses.carryWood, iron: CONFIG.resources.carriedCapacity.iron + bonuses.carryIron });
    this.buildingSystem.powerOutputMultiplier = bonuses.powerOutput;
    this.buildingSystem.powerDemandMultiplier = bonuses.powerDemand;
    this.towerSystem.damageMultiplier = bonuses.towerDamage;
    this.towerSystem.speedMultiplier = bonuses.towerSpeed;
    this.towerSystem.demand = this.buildingSystem.demand('magic-tower');
    for (const b of this.buildingSystem.buildings) {
      const next = Math.round(BUILDINGS[b.kind].maxHp * this.skills.bonuses.buildingHealth);
      b.hp += next - b.maxHp;
      b.maxHp = next;
    }
  }
  repairBuilding(id: string): string {
    const b = this.buildingSystem.buildings.find(value => value.id === id);
    if (!b || !b.alive || this.phase !== 'playing' || !inBase(this.player.position) || b.distanceFrom(this.player.position) > CONFIG.sword.range || !hasLineOfSight(this.player.position, b.contactPoint(this.player.position), this.obstacles.filter(area => area.x !== b.position.x || area.z !== b.position.z)))
      return 'Podejdź do konstrukcji';
    if (b.hp >= b.maxHp)
      return 'Konstrukcja nie wymaga naprawy';
    if (this.repairCooldown > 0)
      return 'Zaczekaj na zakończenie naprawy';
    if (!this.resourceManager.spend(SHELTER_REPAIR.cost))
      return 'Naprawa wymaga 2 Wood i 1 Iron w Shelterze';
    const amount = Math.min(Math.round(SHELTER_REPAIR.amount * this.repairMultiplier), b.maxHp - b.hp);
    b.hp += amount;
    this.repairCooldown = SHELTER_REPAIR.cooldown / this.skills.bonuses.repairSpeed;
    return 'Naprawiono konstrukcję · +' + amount + ' HP';
  }
  depositResources(): ResourceCounts {
    const deposited = { wood: 0, iron: 0 };
    if (this.phase !== 'playing' || !inHall(this.player.position) || distance(this.player.position, SHELTER_DEPOSIT) > SHELTER_DEPOSIT.range || !hasLineOfSight(this.player.position, { x: SHELTER_DEPOSIT.x, z: SHELTER_DEPOSIT.z - SHELTER_DEPOSIT.depth / 2 - .05 }, this.obstacles))
      return deposited;
    return this.transferResources();
  }
  private transferResources(): ResourceCounts {
    const deposited = { wood: 0, iron: 0 };
    for (const kind of ['wood', 'iron'] as const) {
      deposited[kind] = this.resourceManager.add(kind, this.carried[kind]);
      this.carried[kind] -= deposited[kind];
    }
    if (deposited.wood || deposited.iron)
      this.events.push({ type: 'resources-deposited', amount: deposited });
    return deposited;
  }
  interact(targetId: string | null): string {
    if (this.skills.bonuses.transport > 0 && (this.carried.wood >= this.carriedManager.capacity.wood || this.carried.iron >= this.carriedManager.capacity.iron) && this.phase === 'playing' && targetId !== SHELTER_DEPOSIT_ID) {
      const amount = this.transferResources();
      return amount.wood || amount.iron ? 'Zdalny transport materiałów wykonany' : 'Magazyn pełny';
    }
    if (targetId !== SHELTER_DEPOSIT_ID)
      return 'Podejdź do skrzyni DEPOSIT w Shelterze i naciśnij E';
    const deposited = this.depositResources();
    return deposited.wood || deposited.iron ? 'Zdeponowano materiały' : this.carried.wood || this.carried.iron ? 'Magazyn pełny albo punkt depozytu poza zasięgiem' : 'Plecak jest pusty';
  }
  emit(event: GameEvent): void { this.events.push(event); }
  useAbility(kind: 'barrage' | 'cloak' | 'demolition', target: Position): string { return useAbility(this, kind, target); }
  get repairMultiplier(): number { const rank = this.skills.levels['construction-master']; return this.skills.bonuses.repairAmount - (this.corruption.value >= 50 && rank ? [0, .1, .2, .3][rank] : 0); }
  drainEvents(): GameEvent[] { const events = this.events; this.events = []; return events; }
}
