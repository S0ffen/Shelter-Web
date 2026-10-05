import type { Position, ResourceCounts } from '../domain/types';
import type { Footprint } from '../world/WorldLayout';

export type BuildingKind = 'storehouse' | 'arcane-core' | 'magic-tower';
export interface BuildingDefinition {
  label: string;
  cost: ResourceCounts;
  width: number;
  depth: number;
  height: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDefinition> = {
  storehouse: { label: 'Storehouse', cost: { wood: 30, iron: 10 }, width: 2.8, depth: 2.2, height: 2.2 },
  'arcane-core': { label: 'Generator Arcane', cost: { wood: 20, iron: 15 }, width: 1.8, depth: 1.8, height: 2.4 },
  'magic-tower': { label: 'Magic Tower', cost: { wood: 20, iron: 15 }, width: 1.6, depth: 1.6, height: 3.2 },
};

export class Building {
  constructor(readonly id: string, readonly kind: BuildingKind, readonly position: Position, readonly rotation: number) {}

  get footprint(): Footprint { return footprint(this.kind, this.position, this.rotation); }
}

export function footprint(kind: BuildingKind, position: Position, rotation: number): Footprint {
  const definition = BUILDINGS[kind];
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  return { ...position, width: definition.width * cos + definition.depth * sin, depth: definition.depth * cos + definition.width * sin };
}
