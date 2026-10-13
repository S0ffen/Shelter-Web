import encounters from '../../../shared/encounters.json';
import type { Position } from '../domain/types';
import type { Block, Footprint } from './WorldLayout';

export const FINAL_ARENA = encounters.finalArena;
const { minX, maxX, minZ, maxZ } = FINAL_ARENA.bounds;
export const inFinalArena = (point: Position, inset = 0): boolean =>
  point.x > minX + inset && point.x < maxX - inset &&
  point.z > minZ + inset && point.z < maxZ - inset;

/** Permanent retaining walls are below street level: players can jump in from the rim. */
export const ARENA_WALLS: Block[] = [
  ...[minX, maxX].map(x => ({ x, z: (minZ + maxZ) / 2, width: FINAL_ARENA.gateThickness,
    depth: maxZ - minZ + FINAL_ARENA.gateThickness, height: FINAL_ARENA.surfaceY - FINAL_ARENA.floorY })),
  ...[minZ, maxZ].map(z => ({ x: (minX + maxX) / 2, z, width: maxX - minX + FINAL_ARENA.gateThickness,
    depth: FINAL_ARENA.gateThickness, height: FINAL_ARENA.surfaceY - FINAL_ARENA.floorY })),
];
/** Legacy name used by older fixture imports; these are now static masonry, never gates. */
export const ARENA_GATES = ARENA_WALLS;
export const PIT_OPENING: Footprint = {
  x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
  width: maxX - minX - FINAL_ARENA.gateThickness,
  depth: maxZ - minZ - FINAL_ARENA.gateThickness,
};
export const terrainHeight = (point: Position): number =>
  inFinalArena(point, FINAL_ARENA.gateThickness / 2) ? FINAL_ARENA.floorY : FINAL_ARENA.surfaceY;
export const arenaEnemyHeight = (id: string, kind: string): number =>
  kind === 'overlord' || id.startsWith('boss-minion-') ? FINAL_ARENA.floorY : FINAL_ARENA.surfaceY;

/** Cut the real opening out of street paving; no invisible ground remains over the pit. */
export function subtractPitFloor(tiles: readonly Footprint[]): Footprint[] {
  const left = PIT_OPENING.x - PIT_OPENING.width / 2, right = PIT_OPENING.x + PIT_OPENING.width / 2;
  const south = PIT_OPENING.z - PIT_OPENING.depth / 2, north = PIT_OPENING.z + PIT_OPENING.depth / 2;
  const result: Footprint[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number): void => {
    if (x1 - x0 > 1e-6 && z1 - z0 > 1e-6) result.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: x1 - x0, depth: z1 - z0 });
  };
  for (const tile of tiles) {
    const x0 = tile.x - tile.width / 2, x1 = tile.x + tile.width / 2, z0 = tile.z - tile.depth / 2, z1 = tile.z + tile.depth / 2;
    if (x1 <= left || x0 >= right || z1 <= south || z0 >= north) { result.push({ ...tile }); continue; }
    add(x0, Math.min(x1, left), z0, z1);
    add(Math.max(x0, right), x1, z0, z1);
    add(Math.max(x0, left), Math.min(x1, right), z0, Math.min(z1, south));
    add(Math.max(x0, left), Math.min(x1, right), Math.max(z0, north), z1);
  }
  return result;
}
