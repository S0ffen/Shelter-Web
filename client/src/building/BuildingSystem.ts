import type { Position, ResourceCounts } from '../domain/types';
import { CONFIG } from '../domain/config';
import { distance } from '../domain/types';
import type { ResourceManager } from '../resources/ResourceManager';
import type { ResourceNode } from '../resources/ResourceNode';
import { CITY_BLOCKS, WORLD_BOUNDS } from '../world/WorldLayout';
import type { Footprint } from '../world/WorldLayout';
import { BASE_PASSAGES, SHELTER_HALL, fitsBase, inBase, GENERATOR_PADS, generatorPadAt } from '../world/ShelterLayout';
import { NavigationGrid, SPAWN_AREAS } from '../world/NavigationGrid';
import { Building, BUILDINGS, footprint } from './Building';
import type { BuildingKind } from './Building';

export interface BuildContext {
  player: Position;
  zombies: readonly Position[];
  resources: ResourceManager;
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
  costFor(kind: BuildingKind): ResourceCounts { const c = BUILDINGS[kind].cost; return { wood: Math.ceil(c.wood * this.costMultiplier), iron: Math.ceil(c.iron * this.costMultiplier) }; }
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
    const generated = this.buildings.filter(building => building.kind === 'arcane-core').length * Math.round(CONFIG.power.coreOutput * this.powerOutputMultiplier);
    const used = this.buildings.reduce((sum, building) => sum + this.demand(building.kind), 0);
    return { generated, used, available: generated - used };
  }
  demand(kind: BuildingKind): number {
    return Math.ceil((kind === 'magic-tower' ? CONFIG.power.towerDemand : kind === 'storehouse' ? CONFIG.power.storehouseDemand : 0) * this.powerDemandMultiplier);
  }
  get towerPowerBudget(): number {
    return Math.max(0, this.power.generated - this.buildings.filter(building => building.kind === 'storehouse').length * this.demand('storehouse'));
  }

  validate(kind: BuildingKind, position: Position, rotation: number, context: BuildContext): string | null {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(rotation)) return 'Nieprawidłowa pozycja';
    if (distance(context.player, position) > 6) return 'Podejdź bliżej miejsca budowy';
    const area = footprint(kind, position, rotation);
    if (!inBase(context.player) || !fitsBase(area)) return 'Budować można tylko na terenie Shelteru';
    if (area.x - area.width / 2 < WORLD_BOUNDS.minX + 0.7 || area.x + area.width / 2 > WORLD_BOUNDS.maxX - 0.7 ||
      area.z - area.depth / 2 < WORLD_BOUNDS.minZ + 0.7 || area.z + area.depth / 2 > WORLD_BOUNDS.maxZ - 0.7) return 'Poza granicami miasta';
    if (CITY_BLOCKS.some(block => overlaps(area, block))) return 'Miejsce zajęte przez ruiny lub Shelter';
    if (kind === 'arcane-core' && !generatorPadAt(position)) return 'Generator Arcane buduj na oznaczonym stanowisku';
    if (kind !== 'arcane-core' && GENERATOR_PADS.some(pad => overlaps(area, { ...pad, width: 2.4, depth: 2.4 }))) return 'Stanowisko zarezerwowane dla generatora Arcane';
    if (overlaps(area, SHELTER_HALL)) return 'Wnętrze Shelteru musi pozostać dostępne';
    if (this.footprints.some(block => overlaps(area, block))) return 'Miejsce zajęte przez konstrukcję';
    if (BASE_PASSAGES.some(block => overlaps(area, block))) return 'Zostaw przejście między bramami i wejściem do Shelteru';
    if (overlaps(area, { ...context.player, width: 0.65, depth: 0.65 }, 0.3)) return 'Nie buduj pod swoimi stopami';
    if (context.zombies.some(zombie => overlaps(area, { ...zombie, width: 0.8, depth: 0.8 }))) return 'Nieumarły blokuje miejsce';
    if (context.nodes.some(node => !node.isDestroyed && overlaps(area, node.footprint))) return 'Najpierw zniszcz obiekt zasobowy w tym miejscu';
    if (!context.resources.canAfford(this.costFor(kind))) return 'Za mało zasobów';
    if (this.demand(kind) > 0 && this.power.available < this.demand(kind)) return 'Brak mocy Arcane — najpierw zbuduj generator';
    const obstacles = [...this.footprints, ...context.nodes.filter(node => !node.isDestroyed).map(node => node.footprint), area];
    const key = obstacles.map(block => [block.x, block.z, block.width, block.depth].join(',')).join('|');
    if (this.navigationCheck?.key !== key) {
      const navigation = new NavigationGrid(obstacles);
      this.navigationCheck = { key, valid: SPAWN_AREAS.every(point => navigation.routeFrom(point).length > 0) };
    }
    if (!this.navigationCheck.valid) return 'Zostaw drogi między dzielnicami i Shelterem';
    return null;
  }

  place(kind: BuildingKind, position: Position, rotation: number, context: BuildContext): PlacementResult {
    const reason = this.validate(kind, position, rotation, context);
    if (reason) return { ok: false, reason };
    if (!context.resources.spend(this.costFor(kind))) return { ok: false, reason: 'Za mało zasobów' };
    const building = new Building(`building-${this.nextId++}`, kind, { ...position }, rotation, this.healthMultiplier);
    this.buildings.push(building);
    return { ok: true, building };
  }
}
