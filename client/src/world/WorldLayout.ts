import type { Position } from '../domain/types';
import { BASE_WALLS, SHELTER_WALLS } from './ShelterLayout';

export interface Footprint { x: number; z: number; width: number; depth: number }
export interface Block extends Footprint { height: number }

export const WORLD_BOUNDS = { minX: -48, maxX: 48, minZ: -46, maxZ: 52 } as const;

export interface Sector { id: string; name: string; position: Position }
export const SECTORS: readonly Sector[] = [
  { id: 'shelter', name: 'Schronienie', position: { x: 1.5, z: 4 } },
  { id: 'cemetery', name: 'Cmentarz', position: { x: -31, z: 35 } },
  { id: 'old-town', name: 'Stare Miasto', position: { x: -31, z: 14 } },
  { id: 'market', name: 'Rynek', position: { x: 0, z: 29 } },
  { id: 'temple', name: 'Świątynia', position: { x: 31, z: 33 } },
  { id: 'slums', name: 'Slumsy', position: { x: -31, z: -8 } },
  { id: 'forge', name: 'Kuźnia', position: { x: 31, z: 0 } },
  { id: 'forest', name: 'Las', position: { x: -31, z: -31 } },
  { id: 'gate', name: 'Brama', position: { x: 0, z: -32 } },
  { id: 'mines', name: 'Kopalnie', position: { x: 31, z: -32 } },
];

export function sectorAt(position: Position): Sector {
  return SECTORS.reduce((nearest, sector) => Math.hypot(position.x - sector.position.x, position.z - sector.position.z) <
    Math.hypot(position.x - nearest.position.x, position.z - nearest.position.z) ? sector : nearest);
}

/** Authored city lots. Their arrangement creates connected streets and side passages. */
export const CITY_RUINS: Block[] = [
  { x: -15.5, z: -14, width: 5, depth: 5, height: 4.2 },
  { x: 1, z: -18, width: 9, depth: 5, height: 5.5 },
  { x: 20, z: -15, width: 6, depth: 7, height: 6 },
  { x: -17, z: 0, width: 6, depth: 8, height: 5.7 },
  { x: 20, z: 0, width: 6, depth: 8, height: 4.5 },
  { x: -16, z: 15, width: 5, depth: 6, height: 6.4 },
  { x: 1, z: 18, width: 9, depth: 5, height: 7.6 },
  { x: 18.5, z: 15, width: 3, depth: 4, height: 4.8 },
  { x: -3, z: 23, width: 5, depth: 2, height: 4 },
  // Western streets: Slums, Old Town and cemetery approaches.
  { x: -30, z: -8, width: 10, depth: 9, height: 4.6 },
  { x: -42, z: -8, width: 8, depth: 8, height: 3.6 },
  { x: -30, z: 6, width: 10, depth: 10, height: 5.5 },
  { x: -43, z: 19, width: 7, depth: 13, height: 6.2 },
  { x: -30, z: 20, width: 9, depth: 6, height: 6 },
  { x: -21, z: 13, width: 4, depth: 9, height: 5 },
  { x: -40, z: 39, width: 6, depth: 7, height: 5.2 },
  { x: -25, z: 45, width: 9, depth: 5, height: 4 },
  { x: -42, z: 48, width: 8, depth: 4, height: 5 },
  // Northern market: an enclosed square with several exits.
  { x: -13, z: 39, width: 9, depth: 10, height: 6.4 },
  { x: 13, z: 39, width: 9, depth: 10, height: 6.8 },
  { x: -13, z: 26, width: 9, depth: 10, height: 5.7 },
  { x: 13, z: 26, width: 9, depth: 10, height: 5 },
  { x: 0, z: 47, width: 9, depth: 5, height: 4 },
  // Temple and eastern residential/forge streets.
  { x: 34, z: 42, width: 14, depth: 10, height: 8 },
  { x: 24, z: 26, width: 6, depth: 9, height: 5.4 },
  { x: 43, z: 26, width: 6, depth: 9, height: 5.8 },
  { x: 39, z: 5, width: 10, depth: 12, height: 5.5 },
  { x: 24, z: 11, width: 7, depth: 7, height: 4.5 },
  { x: 43, z: 16, width: 6, depth: 5, height: 6 },
  { x: 24, z: -8, width: 7, depth: 7, height: 5.1 },
  { x: 40, z: -18, width: 10, depth: 8, height: 4.5 },
  // Southern ring: forest clearing, gate street and mining quarter.
  { x: -30, z: -20, width: 10, depth: 6, height: 4.3 },
  { x: -43, z: -30, width: 7, depth: 15, height: 3.8 },
  { x: -21, z: -31, width: 6, depth: 11, height: 4 },
  { x: -37, z: -43, width: 10, depth: 4, height: 3 },
  { x: -11, z: -30, width: 10, depth: 9, height: 5.2 },
  { x: 12, z: -30, width: 10, depth: 9, height: 4.8 },
  { x: -13, z: -42, width: 7, depth: 4, height: 4 },
  { x: 14, z: -42, width: 7, depth: 4, height: 4 },
  { x: 24, z: -25, width: 6, depth: 10, height: 4.2 },
  { x: 38, z: -39, width: 12, depth: 7, height: 6.5 },
  { x: 25, z: -39, width: 6, depth: 7, height: 4.5 },
];

export const WORLD_BOUNDARIES: Block[] = [
  { x: -48, z: 3, width: 1, depth: 99, height: 6 },
  { x: 48, z: 3, width: 1, depth: 99, height: 6 },
  { x: 0, z: -46, width: 96, depth: 1, height: 6 },
  { x: 0, z: 52, width: 96, depth: 1, height: 6 },
];
export const GATE_PILLARS: Block[] = [
  { x: -3.5, z: -35, width: 0.9, depth: 1.2, height: 5.5 },
  { x: 3.5, z: -35, width: 0.9, depth: 1.2, height: 5.5 },
];
export const FOREST_TREES: Block[] = [
  { x: -38, z: -40, width: 0.7, depth: 0.7, height: 5.5 },
  { x: -38, z: -33, width: 0.7, depth: 0.7, height: 5 },
  { x: -38, z: -25, width: 0.7, depth: 0.7, height: 6 },
  { x: -25, z: -43, width: 0.7, depth: 0.7, height: 5.5 },
  { x: -26, z: -26, width: 0.7, depth: 0.7, height: 5 },
];

/** Shared solid footprints for rendering, placement validation and gameplay. */
export const CITY_BLOCKS: Block[] = [
  ...CITY_RUINS,
  ...BASE_WALLS, ...SHELTER_WALLS,
  ...WORLD_BOUNDARIES, ...GATE_PILLARS, ...FOREST_TREES,
];

export function isBlocked(position: Position, radius = 0.35, extra: readonly Footprint[] = []): boolean {
  const contains = (block: Footprint): boolean =>
    Math.abs(position.x - block.x) < block.width / 2 + radius &&
    Math.abs(position.z - block.z) < block.depth / 2 + radius;
  return CITY_BLOCKS.some(contains) || extra.some(contains);
}

export function hasLineOfSight(from: Position & { y?: number }, to: Position & { y?: number }, extra: readonly Footprint[] = []): boolean {
  const obstacles = [...CITY_BLOCKS, ...extra];
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = from.x + (to.x - from.x) * t, pz = from.z + (to.z - from.z) * t;
    const y = (from.y ?? 1.2) + ((to.y ?? 1.2) - (from.y ?? 1.2)) * t;
    if (obstacles.some(block => Math.abs(px - block.x) < block.width / 2 &&
      Math.abs(pz - block.z) < block.depth / 2 && (!('height' in block) || y <= Number(block.height)))) return false;
  }
  return true;
}
