import type { Position, ResourceCounts } from '../domain/types';
import { CONFIG } from '../domain/config';
import { distance } from '../domain/types';
import type { ResourceManager } from '../resources/ResourceManager';
import { resourceFunding, spendResources } from '../resources/ResourceBudget';
import type { ResourceNode } from '../resources/ResourceNode';
import { CITY_BLOCKS, WORLD_BOUNDS } from '../world/WorldLayout';
import type { Footprint } from '../world/WorldLayout';
import { BASE_PASSAGES, SHELTER_HALL, fitsBase, inBase, GENERATOR_PADS, generatorPadAt } from '../world/ShelterLayout';
import { NavigationGrid, SPAWN_AREAS } from '../world/NavigationGrid';
import { Building, BUILDINGS, GENERATOR_LEVELS, footprint } from './Building';
import { SHELTER_LEVELS } from '../shelter/Shelter';
import type { BuildingKind } from './Building';

export interface BuildContext {
  player: Position;
  zombies: readonly Position[];
  resources: ResourceManager;
  carried?: ResourceManager;
  nodes: readonly ResourceNode[];
}
export type PlacementResult = { ok: true; building: Building } | { ok: false; reason: string };

const overlaps = (a: Footprint, b: Footprint, margin = 0.18): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin;

export class BuildingSystem {
  readonly buildings: Building[] = [];
  private nextId = 1;
  costMultiplier = 1;
  healthMultiplier = 1;
  powerOutputMultiplier = 1;
  powerDemandMultiplier = 1;
  /** Shelter technology unlocks generator upgrades; each generator retains its own level. */
  generatorLevel = 1;
  get generatorOutput(): number { return this.generatorOutputFor(1); }
  generatorOutputFor(level = 1): number { return Math.round(CONFIG.power.generatorOutputs[level - 1] * this.powerOutputMultiplier); }
  costFor(kind: BuildingKind, level = 1): ResourceCounts {
    const c = kind === 'arcane-core' ? GENERATOR_LEVELS[level - 1].cost : BUILDINGS[kind].cost;
    return { wood: Math.ceil(c.wood * this.costMultiplier), iron: Math.ceil(c.iron * this.costMultiplier) };
  }
  coreDemand(level = this.generatorLevel): number { return SHELTER_LEVELS[level - 1].powerDemand; }
  private navigationCheck: { key: string; valid: boolean } | null = null;
  restoreNextId(): void {
    this.nextId = Math.max(0, ...this.buildings.map(building => Number(building.id.split('-').at(-1)) || 0)) + 1;
  }
  get footprints(): Footprint[] { return this.buildings.map(building => building.footprint); }
  get capacity(): ResourceCounts {
    const count = this.buildings.filter(building => building.kind === 'storehouse').length;
    return {
      wood: CONFIG.resources.capacity.wood + count * CONFIG.resources.storehouseBonus.wood,
      iron: CONFIG.resources.capacity.iron + count * CONFIG.resources.storehouseBonus.iron,
    };
  }
  get power(): { generated: number; used: number; available: number } {
    const generated = this.buildings.filter(building => building.kind === 'arcane-core' && building.alive).reduce((sum, building) => sum + this.generatorOutputFor(building.level), 0);
    const used = this.coreDemand() + this.buildings.filter(building => building.alive).reduce((sum, building) => sum + this.demand(building.kind), 0);
    return { generated, used, available: generated - used };
  }
  demand(kind: BuildingKind): number {
    return Math.ceil((kind === 'magic-tower' ? CONFIG.power.towerDemand : kind === 'storehouse' ? CONFIG.power.storehouseDemand : 0) * this.powerDemandMultiplier);
  }
  get towerPowerBudget(): number {
    return Math.max(0, this.power.generated - this.coreDemand() - this.buildings.filter(building => building.kind === 'storehouse' && building.alive).length * this.demand('storehouse'));
  }

  validate(kind: BuildingKind, position: Position, rotation: number, context: BuildContext): string | null {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(rotation)) return 'Invalid position';
    if (distance(context.player, position) > 6) return 'Move closer to the build site';
    const area = footprint(kind, position, rotation);
    if (!inBase(context.player) || !fitsBase(area)) return 'Build only within Shelter grounds';
    if (area.x - area.width / 2 < WORLD_BOUNDS.minX + 0.7 || area.x + area.width / 2 > WORLD_BOUNDS.maxX - 0.7 ||
      area.z - area.depth / 2 < WORLD_BOUNDS.minZ + 0.7 || area.z + area.depth / 2 > WORLD_BOUNDS.maxZ - 0.7) return 'Outside city bounds';
    if (CITY_BLOCKS.some(block => overlaps(area, block))) return 'Ruins or the Shelter occupy this space';
    if (kind === 'arcane-core' && !generatorPadAt(position)) return 'Build an Arcane Generator on a marked pad';
    if (kind !== 'arcane-core' && GENERATOR_PADS.some(pad => overlaps(area, { ...pad, width: 2.4, depth: 2.4 }))) return 'Pad reserved for an Arcane Generator';
    if (overlaps(area, SHELTER_HALL)) return 'Keep the Shelter interior accessible';
    if (this.footprints.some(block => overlaps(area, block))) return 'A structure occupies this space';
    if (BASE_PASSAGES.some(block => overlaps(area, block))) return 'Keep passages to Shelter entrances clear';
    if (overlaps(area, { ...context.player, width: 0.65, depth: 0.65 }, 0.3)) return 'Do not build under your feet';
    if (context.zombies.some(zombie => overlaps(area, { ...zombie, width: 0.8, depth: 0.8 }))) return 'An undead blocks this space';
    if (context.nodes.some(node => !node.isDestroyed && overlaps(area, node.footprint))) return 'Harvest the resource node here first';
    if (!resourceFunding(this.costFor(kind), context.resources, context.carried).affordable) return 'Not enough materials in backpack and storage';
    if (this.demand(kind) > 0 && this.power.available < this.demand(kind)) return 'Not enough Arcane Power — build a generator first';
    const obstacles = [...this.footprints, ...context.nodes.filter(node => !node.isDestroyed).map(node => node.footprint), area];
    const key = obstacles.map(block => [block.x, block.z, block.width, block.depth].join(',')).join('|');
    if (this.navigationCheck?.key !== key) {
      const navigation = new NavigationGrid(obstacles);
      this.navigationCheck = { key, valid: SPAWN_AREAS.every(point => navigation.routeFrom(point).length > 0) };
    }
    if (!this.navigationCheck.valid) return 'Keep routes between districts and the Shelter open';
    return null;
  }

  place(kind: BuildingKind, position: Position, rotation: number, context: BuildContext): PlacementResult {
    const reason = this.validate(kind, position, rotation, context);
    if (reason) return { ok: false, reason };
    if (!spendResources(this.costFor(kind), context.resources, context.carried)) return { ok: false, reason: 'Not enough materials' };
    const building = new Building(`building-${this.nextId++}`, kind, { ...position }, rotation, this.healthMultiplier);
    this.buildings.push(building);
    return { ok: true, building };
  }
}
