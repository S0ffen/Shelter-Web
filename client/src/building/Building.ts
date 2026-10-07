import definitions from '../../../shared/buildings.json';
import type { Position, ResourceCounts } from '../domain/types';
import type { Footprint } from '../world/WorldLayout';

export type BuildingKind = 'storehouse' | 'arcane-core' | 'magic-tower';
export interface BuildingDefinition {
  label: string;
  cost: ResourceCounts;
  width: number;
  depth: number;
  height: number;
  maxHp: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDefinition> = definitions;

export class Building {
  maxHp: number;
  hp: number;
  constructor(readonly id: string, readonly kind: BuildingKind, readonly position: Position, public rotation: number, healthMultiplier = 1) { this.maxHp = this.hp = Math.round(BUILDINGS[kind].maxHp * healthMultiplier); }
  get alive(): boolean { return this.hp > 0; }
  distanceFrom(from: Position): number { return Math.hypot(Math.max(0, Math.abs(from.x - this.position.x) - this.footprint.width / 2), Math.max(0, Math.abs(from.z - this.position.z) - this.footprint.depth / 2)); }
  contactPoint(from: Position): Position { const a = this.footprint; return { x: Math.max(a.x - a.width / 2, Math.min(a.x + a.width / 2, from.x)), z: Math.max(a.z - a.depth / 2, Math.min(a.z + a.depth / 2, from.z)) }; }
  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }

  get footprint(): Footprint { return footprint(this.kind, this.position, this.rotation); }
}

export function footprint(kind: BuildingKind, position: Position, rotation: number): Footprint {
  const definition = BUILDINGS[kind];
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  return { ...position, width: definition.width * cos + definition.depth * sin, depth: definition.depth * cos + definition.width * sin };
}
