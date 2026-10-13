import { inFinalArena } from '../world/ArenaLayout';
import encounters from '../../../shared/encounters.json';
import { SKILL_SETTINGS, SKILL_BRANCHES, branchSpent, validSkillLevels, skillBonuses } from '../domain/SkillTree';
import type { SkillLevels } from '../domain/SkillTree';
import { CORRUPTION_SETTINGS } from '../domain/Corruption';
import checkpoint from '../../../shared/checkpoint.json';
export const SAVE_VERSION = checkpoint.version;
const MIGRATIONS = [checkpoint.migration, ...checkpoint.legacyMigrations];
export const SUPPORTED_SAVE_VERSIONS = [SAVE_VERSION, ...MIGRATIONS.map(migration => migration.previousVersion)];
import type { Simulation } from '../domain/Simulation';
import type { Position, ResourceCounts, ZombieIntent } from '../domain/types';
import { SurvivalCycle, SURVIVAL_SETTINGS } from '../domain/SurvivalCycle';
import type { CycleState, SurvivalSettings } from '../domain/SurvivalCycle';
import { Zombie } from '../enemies/Zombie';
import { BUILDINGS, Building, buildingMaxHp, GENERATOR_LEVELS } from '../building/Building';
import type { BuildingKind } from '../building/Building';
import type { MagicProjectile, TowerState } from '../building/MagicTowerSystem';
import { createResourceNodes } from '../resources/ResourceNode';
import { CITY_BARRICADES, WORLD_BOUNDS } from '../world/WorldLayout';
import { SHELTER_LEVELS, SHELTER_REPAIR } from '../shelter/Shelter';
import { ZOMBIE_TYPES } from '../enemies/ZombieTypes';
import type { ZombieKind } from '../enemies/ZombieTypes';
import { CONFIG } from '../domain/config';
import { PLAYER_SETTINGS } from '../player/Player';
import { fitsBase, generatorPadAt, SHELTER_DEPOSIT } from '../world/ShelterLayout';
import { footprint } from '../building/Building';

export interface RunSnapshot {
  abilities: Simulation['abilities'];
  bossHazards: Simulation['bossHazards'];
  encounters: Simulation['encounters'];
  finalArenaActive: boolean;
  skills: { points: number; levels: SkillLevels };
  corruption: { value: number; damageElapsed: number };
  outcome: 'active' | 'won' | 'lost';
  version: number; runId: string; savedAt: string; elapsed: number; totalKills: number; swordCooldown: number; swordCooldownDuration: number;
  player: { hp: number; position: Position; yaw: number; height: number; verticalVelocity: number; respawnRemaining: number; protectionRemaining: number }; shelterHp: number; shelterLevel: number; repairCooldown: number; resources: ResourceCounts; carried: ResourceCounts;
  settings: SurvivalSettings; cycle: CycleState; spawner: { seed: number; nextId: number };
  nodes: { id: string; health: number }[];
  buildings: { id: string; kind: BuildingKind; position: Position; rotation: number; hp: number; level: number }[];
  zombies: { id: string; kind: ZombieKind; hp: number; position: Position; origin: Position; patrolTarget: Position; mode: 'patrol' | 'siege' | 'guard'; chargeCooldown:number; chargeRemaining:number; chargeTarget:Position|null; chargeHit:boolean; specialCooldown:number; summonCooldown:number; retreatTimer:number; pursuitElapsed:number; returning:boolean; slow:number; windup: number; windupTarget: Position | null; intent: ZombieIntent; attackCooldown: number; deathAge: number }[];
  towers: TowerState[]; projectiles: MagicProjectile[];
}

export function captureRun(sim: Simulation): RunSnapshot {
  return structuredClone({
    outcome: sim.phase === 'won' ? 'won' : sim.phase === 'lost' ? 'lost' : 'active',
    version: SAVE_VERSION, runId: sim.runId, savedAt: new Date().toISOString(), elapsed: sim.elapsed,
    totalKills: sim.totalKills, swordCooldown: sim.swordCooldown, swordCooldownDuration: sim.swordCooldownDuration,
    player: { hp: sim.player.hp, position: sim.player.position, yaw: sim.player.yaw, height: sim.player.height, verticalVelocity: sim.player.verticalVelocity, respawnRemaining: sim.player.respawnRemaining, protectionRemaining: sim.player.protectionRemaining }, shelterHp: sim.shelter.hp, shelterLevel: sim.shelter.level, repairCooldown: sim.repairCooldown,
    encounters: { ...sim.encounters }, finalArenaActive:sim.finalArenaActive,
    abilities: sim.abilities, bossHazards:sim.bossHazards,
    skills: { points: sim.skills.points, levels: sim.skills.levels },
    corruption: { value: sim.corruption.value, damageElapsed: sim.corruption.damageElapsed },
    resources: sim.resources, carried: sim.carried, settings: sim.cycle.settings, cycle: sim.cycle.state,
    spawner: { seed: sim.spawner.seed, nextId: sim.spawner.nextId },
    nodes: sim.resourceNodes.map(node => ({ id: node.id, health: node.health })),
    buildings: sim.buildingSystem.buildings.map(building => ({ id: building.id, kind: building.kind, position: building.position, rotation: building.rotation, hp: building.hp, level: building.level })),
    zombies: sim.zombies.map(zombie => ({ id: zombie.id, kind: zombie.kind, hp: zombie.hp, position: zombie.position, origin: zombie.origin, patrolTarget: zombie.patrolTarget, mode: zombie.mode, intent: zombie.intent, chargeCooldown:zombie.chargeCooldown,chargeRemaining:zombie.chargeRemaining,chargeTarget:zombie.chargeTarget,chargeHit:zombie.chargeHit,specialCooldown:zombie.specialCooldown,summonCooldown:zombie.summonCooldown,retreatTimer:zombie.retreatTimer,pursuitElapsed:zombie.pursuitElapsed,returning:zombie.returning,slow:zombie.slow,windup: zombie.windup, windupTarget: zombie.windupTarget, attackCooldown: zombie.attackCooldown, deathAge: zombie.deathAge })),
    towers: [...sim.towerSystem.towers.values()], projectiles: sim.towerSystem.projectiles,
  });
}

type Data = Record<string, unknown>;
const object = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number => number(value, min, max) && Number.isInteger(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value);
const position = (value: unknown): value is Position => object(value) && number(value.x, WORLD_BOUNDS.minX + 0.3, WORLD_BOUNDS.maxX - 0.3) && number(value.z, WORLD_BOUNDS.minZ + 0.3, WORLD_BOUNDS.maxZ - 0.3);
const array = (value: unknown, limit: number): value is Data[] => Array.isArray(value) && value.length <= limit && value.every(object);
const jumpApex = PLAYER_SETTINGS.jumpSpeed ** 2 / (2 * PLAYER_SETTINGS.gravity);
const uniqueIds = (values: Data[]): boolean => new Set(values.map(value => value.id)).size === values.length;

function allowedAttackDurations(skills: unknown): number[] {
  if (!object(skills) || !object(skills.levels)) return [];
  const speed = validSkillLevels(skills.levels) ? skillBonuses(skills.levels).attackSpeed : 1;
  return [CONFIG.sword.cooldown / speed, CONFIG.sword.heavy.cooldown / speed];
}
export function parseSettings(value: unknown): SurvivalSettings | null {
  if (!object(value)) return null;
  for (const key of Object.keys(SURVIVAL_SETTINGS)) {
    if (key === 'warningSeconds') { if (!Array.isArray(value[key]) || value[key].length > 8 || !value[key].every(second => number(second, 1, 3600))) return null; continue; }
    const minimum = ['dayPatrolCount', 'waveGrowth'].includes(key) ? 0 : 0.01;
    if (!number(value[key], minimum, ['dayDuration', 'nightDuration', 'patrolRespawnInterval'].includes(key) ? 3600 : ['baseWaveSize', 'waveGrowth', 'maxWaveSize'].includes(key) ? 128 : 64)) return null;
  }
  for (const key of ['miniWaveCount', 'dayPatrolCount', 'baseWaveSize', 'waveGrowth', 'maxWaveSize', 'maxAliveZombies']) if (!Number.isInteger(value[key])) return null;
  if (!integer(value.miniWaveCount, 1, 8) || !number(value.miniWaveSpawnFraction, .1, .9)) return null;
  if ((value.baseWaveSize as number) > (value.maxWaveSize as number) || (value.dayPatrolCount as number) > (value.maxAliveZombies as number)) return null;
  return value as unknown as SurvivalSettings;
}

/** Reject corrupt or incompatible checkpoints before touching the current run. */
export function parseRun(value: unknown): RunSnapshot | null {
  const migration = object(value) ? MIGRATIONS.find(spec => spec.previousVersion === value.version) : undefined;
  if (object(value) && migration) {
    const migrated = migratePreviousRun(value, migration);
    return migrated ? parseRun(migrated) : null;
  }
  if (!object(value) || value.version !== SAVE_VERSION || typeof value.runId !== 'string' ||
    !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value.runId) || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) ||
    !number(value.elapsed, 0, 1e9) || !integer(value.totalKills, 0, 1e8) || !number(value.swordCooldown, 0, CONFIG.sword.heavy.cooldown) || !allowedAttackDurations(value.skills).some(duration => Math.abs(duration - (value.swordCooldownDuration as number)) < 1e-8) || (value.swordCooldown as number) > (value.swordCooldownDuration as number) ||
    !object(value.player) || !number(value.player.hp, 0, 200) || !number(value.player.respawnRemaining, 0, PLAYER_SETTINGS.respawnDelay) || !number(value.player.protectionRemaining, 0, PLAYER_SETTINGS.respawnProtection) || !position(value.player.position) || !number(value.player.yaw, -1e6, 1e6) || !number(value.player.height, encounters.finalArena.floorY, encounters.finalArena.surfaceY + jumpApex + .05) || !number(value.player.verticalVelocity, -PLAYER_SETTINGS.terminalVelocity, PLAYER_SETTINGS.jumpSpeed) ||
    !integer(value.shelterLevel, 1, SHELTER_LEVELS.length) || !number(value.shelterHp, 0, SHELTER_LEVELS[(value.shelterLevel as number) - 1].maxHp) || !number(value.repairCooldown, 0, SHELTER_REPAIR.cooldown) || !object(value.resources) || !object(value.carried) || !parseSettings(value.settings)) return null;
  if (!object(value.encounters) || typeof value.encounters.forgeGuardianDefeated !== 'boolean' || !['forgeGuardianDefeated','graveGuardianDefeated','ravagerDefeated','finalBossDefeated'].every(key=>typeof (value.encounters as Data)[key]==='boolean') || typeof value.finalArenaActive!=='boolean') return null;
  if (!['active', 'won', 'lost'].includes(String(value.outcome)) || (value.outcome === 'lost' ? value.shelterHp !== 0 : (value.shelterHp as number) <= 0) || (value.outcome === 'won') !== value.encounters.finalBossDefeated) return null;
  if (value.outcome === 'active' ? value.player.hp > 0 ? value.player.respawnRemaining !== 0 : (value.player.respawnRemaining as number) <= 0 : value.player.respawnRemaining !== 0) return null;
  if (value.player.hp === 0 && (value.player.protectionRemaining !== 0 || value.finalArenaActive)) return null;
  if (!object(value.corruption) || !number(value.corruption.value, 0, CORRUPTION_SETTINGS.maximum) || !number(value.corruption.damageElapsed, 0, CORRUPTION_SETTINGS.damageInterval - 1e-9)) return null;
  if (!object(value.cycle) || !integer(value.cycle.day, 1, 100000) || !['day', 'night'].includes(String(value.cycle.period)) ||
    !number(value.cycle.periodElapsed, 0, 1e9) || !integer(value.cycle.pendingSpawns, 0, 128) || !integer(value.cycle.waveSize, 0, 128) ||
    !number(value.cycle.spawnCountdown, 0, 64) || !number(value.cycle.patrolCountdown, 0, 3600) ||
    !object(value.spawner) || !integer(value.spawner.seed, 0, 0xffffffff) || !integer(value.spawner.nextId, 1, 1e9)) return null;
  if (!object(value.skills) || !validSkillLevels(value.skills.levels) || !integer(value.skills.points, 0, 100003)) return null;
  const levels = value.skills.levels as unknown as SkillLevels;
  if (value.skills.points + SKILL_BRANCHES.reduce((sum, branch) => sum + branchSpent(levels,branch), 0) > SKILL_SETTINGS.initialPoints + ((value.cycle.day as number) - 1) * SKILL_SETTINGS.pointsPerDay || value.player.hp > Math.round(CONFIG.player.hp * skillBonuses(levels).maxHealth)) return null;
  if (!object(value.abilities) || !position(value.abilities.lastPosition) || !['cloak','cloakCooldown','barrageCooldown','demolitionCooldown','shield','shieldCooldown'].every(key=>number((value.abilities as Data)[key],0,key==='cloak'?15:key==='shield'?5:90)) || !number(value.abilities.sinceDamage,0,3600) || !number(value.abilities.idle,0,3600)) return null;
  if (!array(value.bossHazards,0)) return null;
  const bonuses=skillBonuses(levels);
  if ((value.abilities.cloak as number)>0&&!bonuses.cloak || (value.abilities.shield as number)>0&&!bonuses.combatMaster || (value.bossHazards.length && value.encounters.finalBossDefeated)) return null;
  const definitions = createResourceNodes();
  if (!array(value.nodes, definitions.length) || value.nodes.length !== definitions.length || !uniqueIds(value.nodes) ||
    !array(value.buildings, 200) || !uniqueIds(value.buildings) || !array(value.zombies, 128) || !uniqueIds(value.zombies) ||
    !array(value.towers, 200) || !array(value.projectiles, 400)) return null;
  for (const node of value.nodes) {
    const definition = definitions.find(candidate => candidate.id === node.id);
    if (!definition || !number(node.health, 0, definition.maxHealth)) return null;
  }
  for (const building of value.buildings) if (!id(building.id) || typeof building.kind !== 'string' || !Object.hasOwn(BUILDINGS, building.kind) || !position(building.position) || !number(building.rotation, 0, Math.PI * 2) || !integer(building.level, 1, building.kind === 'arcane-core' ? Math.min(GENERATOR_LEVELS.length, value.shelterLevel as number) : 1) || !number(building.hp, Number.MIN_VALUE, Math.round(buildingMaxHp(building.kind as BuildingKind, building.level as number) * bonuses.buildingHealth)) || !fitsBase(footprint(building.kind as BuildingKind, building.position, building.rotation)) || (building.kind === 'arcane-core' && !generatorPadAt(building.position))) return null;
  const stores = value.buildings.filter(building => building.kind === 'storehouse').length;
  if (Object.keys(value.resources).length !== 2 || !integer(value.resources.wood, 0, CONFIG.resources.capacity.wood + stores * CONFIG.resources.storehouseBonus.wood) || !integer(value.resources.iron, 0, CONFIG.resources.capacity.iron + stores * CONFIG.resources.storehouseBonus.iron)) return null;
  if (Object.keys(value.carried).length !== 2 || !integer(value.carried.wood, 0, CONFIG.resources.carriedCapacity.wood + bonuses.carryWood) || !integer(value.carried.iron, 0, CONFIG.resources.carriedCapacity.iron + bonuses.carryIron)) return null;
  for (const zombie of value.zombies) if (!id(zombie.id) || typeof zombie.kind !== 'string' || !Object.hasOwn(ZOMBIE_TYPES, zombie.kind) || !number(zombie.hp, 0, ZOMBIE_TYPES[zombie.kind as ZombieKind].hp) || !position(zombie.position) || !position(zombie.origin) || !position(zombie.patrolTarget) ||
    !number(zombie.chargeCooldown,0,encounters.finalBoss.chargeInterval)||!number(zombie.chargeRemaining,0,encounters.finalBoss.chargeDuration)||(zombie.chargeTarget!==null&&!position(zombie.chargeTarget))||typeof zombie.chargeHit!=='boolean'||(zombie.kind!=='overlord'&&(zombie.chargeRemaining!==0||zombie.chargeTarget!==null))||(zombie.chargeRemaining as number>0&&zombie.chargeTarget===null)||!number(zombie.specialCooldown,0,60)||!number(zombie.summonCooldown,0,60)||!number(zombie.retreatTimer,0,encounters.finalBoss.resetAfter)||!number(zombie.pursuitElapsed,0,encounters.ravager.pursuitTimeout)||typeof zombie.returning!=='boolean'||!number(zombie.slow,0,2)||!['patrol', 'siege', 'guard'].includes(String(zombie.mode)) || !number(zombie.windup, 0, 2) || (zombie.windupTarget !== null && !position(zombie.windupTarget)) || (zombie.windup > 0 && zombie.windupTarget === null) || (['guardian', 'warden', 'ravager', 'overlord'].includes(String(zombie.kind)) ? zombie.mode !== 'guard' : zombie.mode === 'guard') || !['patrol', 'shelter', 'player', 'guard'].includes(String(zombie.intent)) || !number(zombie.attackCooldown, 0, ZOMBIE_TYPES[zombie.kind as ZombieKind].attackCooldown) || !number(zombie.deathAge, 0, 3)) return null;
  if (value.zombies.filter(z => z.kind === 'guardian').length > 1 || (value.encounters.forgeGuardianDefeated && value.zombies.some(z => z.kind === 'guardian' && (z.hp as number) > 0))) return null;
  if (value.zombies.filter(z => z.kind === 'overlord').length > 1 || (value.encounters.finalBossDefeated && value.zombies.some(z => z.kind === 'overlord' && (z.hp as number) > 0))) return null;
  for (const [kind, flag] of [['warden','graveGuardianDefeated'],['ravager','ravagerDefeated']]) {
    if (value.zombies.filter(z=>z.kind===kind).length>1 || (value.encounters[flag] && value.zombies.some(z=>z.kind===kind && (z.hp as number)>0))) return null;
  }
  if ((value.player.height as number) < encounters.finalArena.surfaceY && !inFinalArena(value.player.position, 0)) return null;
  const finalAlive=value.zombies.some(z=>z.kind==='overlord' && (z.hp as number)>0);
  if (value.finalArenaActive !== finalAlive || value.finalArenaActive && (!inFinalArena(value.player.position, .5) || (value.player.height as number) > encounters.finalArena.floorY + jumpApex + .05 || value.encounters.finalBossDefeated || value.zombies.some(z=>z.kind==='overlord' && !inFinalArena(z.position as Position,.3)))) return null;
  const constructionIds = new Set(value.buildings.map(building => building.id));
  for (const tower of value.towers) if (!constructionIds.has(tower.buildingId) || (tower.targetId !== null && !id(tower.targetId)) || !number(tower.yaw, -Math.PI, Math.PI) || !number(tower.cooldown, 0, 1.2) || typeof tower.powered !== 'boolean') return null;
  for (const shot of value.projectiles) if (!integer(shot.id, 1, 1e9) || !constructionIds.has(shot.sourceId) || !id(shot.targetId) || !object(shot.position) || !number(shot.position.y, 0, 5) || !position(shot.position) || !number(shot.lifetime, 0, 3)) return null;
  return structuredClone(value) as unknown as RunSnapshot;
}

/** Migrate known legacy budgets while keeping damage percentages and all run progress. */
function migratePreviousRun(value: Data, migration: typeof MIGRATIONS[number]): Data | null {
  if (!integer(value.shelterLevel, 1, migration.shelterMaxHp.length) || !object(value.skills) || !validSkillLevels(value.skills.levels) || !array(value.buildings, 200)) return null;
  const preserveLevels = 'preserveBuildingLevels' in migration && migration.preserveBuildingLevels;
  const level = value.shelterLevel as number, previousMax = migration.shelterMaxHp[level - 1];
  if (!number(value.shelterHp, 0, previousMax)) return null;
  const migrated = structuredClone(value);
  migrated.version = SAVE_VERSION;
  migrated.shelterHp = preserveLevels ? value.shelterHp : (value.shelterHp as number) / previousMax * SHELTER_LEVELS[level - 1].maxHp;
  const healthBonus = skillBonuses(value.skills.levels).buildingHealth;
  for (const building of migrated.buildings as Data[]) {
    const kind = building.kind as BuildingKind;
    if (!Object.prototype.hasOwnProperty.call(migration.buildingMaxHp, kind)) return null;
    if (preserveLevels && !integer(building.level, 1, kind === 'arcane-core' ? Math.min(GENERATOR_LEVELS.length, level) : 1)) return null;
    const previousBuildingMax = preserveLevels && kind === 'arcane-core' && 'generatorMaxHp' in migration ? migration.generatorMaxHp[(building.level as number) - 1] : migration.buildingMaxHp[kind];
    const oldMax = Math.round(previousBuildingMax * healthBonus);
    if (!number(building.hp, Number.MIN_VALUE, oldMax)) return null;
    // Legacy generators were boosted automatically by the Shelter tier. Keep that existing output.
    if (!preserveLevels) {
      building.level = kind === 'arcane-core' ? level : 1;
      building.hp = (building.hp as number) / oldMax * Math.round(buildingMaxHp(kind, building.level as number) * healthBonus);
    }
  }
  if ('relocateDeposit' in migration && migration.relocateDeposit) {
    const moveOutOfCabinet = (point: unknown) => {
      if (!position(point)) return;
      if (Math.abs(point.x-SHELTER_DEPOSIT.x) < SHELTER_DEPOSIT.width/2+.4 && Math.abs(point.z-SHELTER_DEPOSIT.z) < SHELTER_DEPOSIT.depth/2+.4)
        point.z = SHELTER_DEPOSIT.z-SHELTER_DEPOSIT.depth/2-.5;
    };
    if (object(migrated.player)) moveOutOfCabinet(migrated.player.position);
    if (array(migrated.zombies,128)) for (const zombie of migrated.zombies) moveOutOfCabinet(zombie.position);
  }
  if (!object(migrated.player) || !array(migrated.zombies, 128)) return null;
  migrated.player.height = migrated.finalArenaActive ? encounters.finalArena.floorY : encounters.finalArena.surfaceY;
  migrated.player.verticalVelocity = 0;
  for (const zombie of migrated.zombies) { zombie.pursuitElapsed = 0; zombie.returning = false; }
  // Upgrade previous default pressure without replacing intentional run configuration or an ongoing wave.
  if (object(migrated.settings)) for (const [key, previous] of Object.entries({ baseWaveSize: 8, waveGrowth: 4, maxWaveSize: 64, spawnInterval: 2, maxAliveZombies: 24 })) {
    if (migrated.settings[key] === previous) migrated.settings[key] = SURVIVAL_SETTINGS[key as keyof SurvivalSettings];
  }
  const clearBarricade = (point: unknown) => {
    if (!position(point)) return;
    for (const wall of CITY_BARRICADES) if (Math.abs(point.x - wall.x) < wall.width / 2 + .8 && Math.abs(point.z - wall.z) < wall.depth / 2 + .8)
      point.z = wall.z + (point.z >= wall.z ? 1 : -1) * (wall.depth / 2 + .85);
  };
  clearBarricade(migrated.player.position);
  if (object(migrated.abilities)) clearBarricade(migrated.abilities.lastPosition);
  for (const zombie of migrated.zombies) for (const key of ['position','origin','patrolTarget','chargeTarget','windupTarget']) clearBarricade(zombie[key]);
  return migrated;
}

export function restoreRun(sim: Simulation, snapshot: RunSnapshot): void {
  const saved = parseRun(snapshot);
  if (!saved) throw new Error('Invalid run checkpoint');
  sim.reset();
  sim.runId = saved.runId;
  sim.elapsed = saved.elapsed; sim.totalKills = saved.totalKills; sim.swordCooldown = saved.swordCooldown; sim.swordCooldownDuration = saved.swordCooldownDuration;
  Object.assign(sim.corruption, saved.corruption);
  sim.abilities=structuredClone(saved.abilities);sim.bossHazards=structuredClone(saved.bossHazards);
  Object.assign(sim.encounters, saved.encounters);
  sim.finalArenaActive=saved.finalArenaActive;
  Object.assign(sim.skills, saved.skills); sim.applySkillBonuses();
  sim.player.hp = saved.player.hp; sim.player.position = { ...saved.player.position }; sim.player.yaw = saved.player.yaw; sim.player.height = saved.player.height; sim.player.verticalVelocity = saved.player.verticalVelocity;
  sim.player.respawnRemaining = saved.player.respawnRemaining; sim.player.protectionRemaining = saved.player.protectionRemaining;
  sim.shelter.level = saved.shelterLevel; sim.shelter.hp = saved.shelterHp; sim.repairCooldown = saved.repairCooldown;
  sim.buildingSystem.generatorLevel = saved.shelterLevel;
  sim.buildingSystem.buildings.push(...saved.buildings.map(building => Object.assign(new Building(building.id, building.kind, building.position, building.rotation, sim.skills.bonuses.buildingHealth, building.level), { hp: building.hp })));
  sim.buildingSystem.restoreNextId();
  sim.resourceManager.setCapacity(sim.buildingSystem.capacity);
  Object.assign(sim.resources, saved.resources);
  Object.assign(sim.carried, saved.carried);
  for (const node of sim.resourceNodes) node.damage(node.maxHealth - saved.nodes.find(other => other.id === node.id)!.health);
  sim.cycle = new SurvivalCycle(saved.settings); sim.cycle.state = saved.cycle;
  sim.spawner.seed = saved.spawner.seed; sim.spawner.nextId = saved.spawner.nextId;
  sim.zombies = saved.zombies.map(state => {
    const zombie = new Zombie(state.id, state.position, state.kind);
    Object.assign(zombie, state);
    zombie.previousPosition = { ...state.position };
    zombie.route = [];
    return zombie;
  });
  for (const tower of saved.towers) sim.towerSystem.towers.set(tower.buildingId, tower);
  sim.towerSystem.projectiles.push(...saved.projectiles); sim.towerSystem.restoreNextId();
  sim.phase = saved.outcome === 'active' ? 'paused' : saved.outcome;
}
