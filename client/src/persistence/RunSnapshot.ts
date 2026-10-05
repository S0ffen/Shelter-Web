import type { Simulation } from '../domain/Simulation';
import type { Position, ResourceCounts, ZombieIntent } from '../domain/types';
import { SurvivalCycle, SURVIVAL_SETTINGS } from '../domain/SurvivalCycle';
import type { CycleState, SurvivalSettings } from '../domain/SurvivalCycle';
import { Zombie } from '../enemies/Zombie';
import { BUILDINGS, Building } from '../building/Building';
import type { BuildingKind } from '../building/Building';
import type { MagicProjectile, TowerState } from '../building/MagicTowerSystem';
import { createResourceNodes } from '../resources/ResourceNode';
import { WORLD_BOUNDS } from '../world/WorldLayout';
import { fitsBase } from '../world/ShelterLayout';
import { footprint } from '../building/Building';

export interface RunSnapshot {
  version: 2; runId: string; savedAt: string; elapsed: number; totalKills: number; swordCooldown: number;
  player: { hp: number; position: Position; yaw: number }; shelterHp: number; resources: ResourceCounts;
  settings: SurvivalSettings; cycle: CycleState; spawner: { seed: number; nextId: number };
  nodes: { id: string; health: number }[];
  buildings: { id: string; kind: BuildingKind; position: Position; rotation: number }[];
  zombies: { id: string; hp: number; position: Position; origin: Position; patrolTarget: Position; mode: 'patrol' | 'siege'; intent: ZombieIntent; attackCooldown: number; deathAge: number }[];
  towers: TowerState[]; projectiles: MagicProjectile[];
}

export function captureRun(sim: Simulation): RunSnapshot {
  return structuredClone({
    version: 2, runId: sim.runId, savedAt: new Date().toISOString(), elapsed: sim.elapsed,
    totalKills: sim.totalKills, swordCooldown: sim.swordCooldown,
    player: { hp: sim.player.hp, position: sim.player.position, yaw: sim.player.yaw }, shelterHp: sim.shelter.hp,
    resources: sim.resources, settings: sim.cycle.settings, cycle: sim.cycle.state,
    spawner: { seed: sim.spawner.seed, nextId: sim.spawner.nextId },
    nodes: sim.resourceNodes.map(node => ({ id: node.id, health: node.health })),
    buildings: sim.buildingSystem.buildings.map(building => ({ id: building.id, kind: building.kind, position: building.position, rotation: building.rotation })),
    zombies: sim.zombies.map(zombie => ({ id: zombie.id, hp: zombie.hp, position: zombie.position, origin: zombie.origin, patrolTarget: zombie.patrolTarget, mode: zombie.mode, intent: zombie.intent, attackCooldown: zombie.attackCooldown, deathAge: zombie.deathAge })),
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
const uniqueIds = (values: Data[]): boolean => new Set(values.map(value => value.id)).size === values.length;

export function parseSettings(value: unknown): SurvivalSettings | null {
  if (!object(value)) return null;
  for (const key of Object.keys(SURVIVAL_SETTINGS)) {
    const minimum = ['dayPatrolCount', 'waveGrowth'].includes(key) ? 0 : 0.01;
    if (!number(value[key], minimum, ['dayDuration', 'nightMinimumDuration', 'patrolRespawnInterval'].includes(key) ? 3600 : 64)) return null;
  }
  for (const key of ['dayPatrolCount', 'baseWaveSize', 'waveGrowth', 'maxWaveSize', 'maxAliveZombies']) if (!Number.isInteger(value[key])) return null;
  if ((value.baseWaveSize as number) > (value.maxWaveSize as number) || (value.dayPatrolCount as number) > (value.maxAliveZombies as number)) return null;
  return value as unknown as SurvivalSettings;
}

/** Reject corrupt or incompatible checkpoints before touching the current run. */
export function parseRun(value: unknown): RunSnapshot | null {
  if (!object(value) || value.version !== 2 || typeof value.runId !== 'string' ||
    !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value.runId) || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) ||
    !number(value.elapsed, 0, 1e9) || !integer(value.totalKills, 0, 1e8) || !number(value.swordCooldown, 0, 0.65) ||
    !object(value.player) || !number(value.player.hp, 1, 100) || !position(value.player.position) || !number(value.player.yaw, -1e6, 1e6) ||
    !number(value.shelterHp, 1, 300) || !object(value.resources) || !parseSettings(value.settings)) return null;
  if (!object(value.cycle) || !integer(value.cycle.day, 1, 100000) || !['day', 'night'].includes(String(value.cycle.period)) ||
    !number(value.cycle.periodElapsed, 0, 1e9) || !integer(value.cycle.pendingSpawns, 0, 64) || !integer(value.cycle.waveSize, 0, 64) ||
    !number(value.cycle.spawnCountdown, 0, 64) || !number(value.cycle.patrolCountdown, 0, 3600) ||
    !object(value.spawner) || !integer(value.spawner.seed, 0, 0xffffffff) || !integer(value.spawner.nextId, 1, 1e9)) return null;
  const definitions = createResourceNodes();
  if (!array(value.nodes, definitions.length) || value.nodes.length !== definitions.length || !uniqueIds(value.nodes) ||
    !array(value.buildings, 200) || !uniqueIds(value.buildings) || !array(value.zombies, 100) || !uniqueIds(value.zombies) ||
    !array(value.towers, 200) || !array(value.projectiles, 400)) return null;
  for (const node of value.nodes) {
    const definition = definitions.find(candidate => candidate.id === node.id);
    if (!definition || !number(node.health, 0, definition.maxHealth)) return null;
  }
  for (const building of value.buildings) if (!id(building.id) || typeof building.kind !== 'string' || !Object.hasOwn(BUILDINGS, building.kind) || !position(building.position) || !number(building.rotation, 0, Math.PI * 2) || !fitsBase(footprint(building.kind as BuildingKind, building.position, building.rotation))) return null;
  const stores = value.buildings.filter(building => building.kind === 'storehouse').length;
  if (Object.keys(value.resources).length !== 2 || !integer(value.resources.wood, 0, 100 + stores * 50) || !integer(value.resources.iron, 0, 50 + stores * 25)) return null;
  for (const zombie of value.zombies) if (!id(zombie.id) || !number(zombie.hp, 0, 100) || !position(zombie.position) || !position(zombie.origin) || !position(zombie.patrolTarget) ||
    !['patrol', 'siege'].includes(String(zombie.mode)) || !['patrol', 'shelter', 'player'].includes(String(zombie.intent)) || !number(zombie.attackCooldown, 0, 1.2) || !number(zombie.deathAge, 0, 3)) return null;
  const constructionIds = new Set(value.buildings.map(building => building.id));
  for (const tower of value.towers) if (!constructionIds.has(tower.buildingId) || (tower.targetId !== null && !id(tower.targetId)) || !number(tower.yaw, -Math.PI, Math.PI) || !number(tower.cooldown, 0, 1.2) || typeof tower.powered !== 'boolean') return null;
  for (const shot of value.projectiles) if (!integer(shot.id, 1, 1e9) || !constructionIds.has(shot.sourceId) || !id(shot.targetId) || !object(shot.position) || !number(shot.position.y, 0, 5) || !position(shot.position) || !number(shot.lifetime, 0, 3)) return null;
  return structuredClone(value) as unknown as RunSnapshot;
}

export function restoreRun(sim: Simulation, snapshot: RunSnapshot): void {
  const saved = parseRun(snapshot);
  if (!saved) throw new Error('Nieprawidłowy zapis próby');
  sim.reset();
  sim.runId = saved.runId;
  sim.elapsed = saved.elapsed; sim.totalKills = saved.totalKills; sim.swordCooldown = saved.swordCooldown;
  sim.player.hp = saved.player.hp; sim.player.position = { ...saved.player.position }; sim.player.yaw = saved.player.yaw;
  sim.shelter.hp = saved.shelterHp;
  sim.buildingSystem.buildings.push(...saved.buildings.map(building => new Building(building.id, building.kind, building.position, building.rotation)));
  sim.buildingSystem.restoreNextId();
  sim.resourceManager.setCapacity(sim.buildingSystem.capacity);
  Object.assign(sim.resources, saved.resources);
  for (const node of sim.resourceNodes) node.damage(node.maxHealth - saved.nodes.find(other => other.id === node.id)!.health);
  sim.cycle = new SurvivalCycle(saved.settings); sim.cycle.state = saved.cycle;
  sim.spawner.seed = saved.spawner.seed; sim.spawner.nextId = saved.spawner.nextId;
  sim.zombies = saved.zombies.map(state => {
    const zombie = new Zombie(state.id, state.position);
    Object.assign(zombie, state);
    zombie.previousPosition = { ...state.position };
    zombie.route = [];
    return zombie;
  });
  for (const tower of saved.towers) sim.towerSystem.towers.set(tower.buildingId, tower);
  sim.towerSystem.projectiles.push(...saved.projectiles); sim.towerSystem.restoreNextId();
  sim.phase = 'paused';
}
