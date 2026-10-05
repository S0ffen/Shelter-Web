import layout from '../../../shared/shelter.json';
import type { Position } from '../domain/types';
import type { Block, Footprint } from './WorldLayout';

export const BASE_BOUNDS = layout.bounds;
export const SHELTER_HALL = layout.hall;
export const BASE_POWER = { generatorOutput: layout.generatorOutput, towerDemand: layout.towerDemand, storehouseDemand: layout.storehouseDemand };
const { minX, maxX, minZ, maxZ } = BASE_BOUNDS;
const { x, z, width, depth, height, doorWidth } = SHELTER_HALL;
const t = layout.wallThickness;

/** Walls have real openings. The floor and roof do not obstruct horizontal navigation. */
export const SHELTER_WALLS: Block[] = [
  { x: x - width / 2, z, width: t, depth, height },
  { x: x + width / 2, z, width: t, depth, height },
  { x, z: z + depth / 2, width, depth: t, height },
  ...[-1, 1].map(side => ({ x: x + side * (width + doorWidth) / 4, z: z - depth / 2,
    width: (width - doorWidth) / 2, depth: t, height })),
];
export const BASE_WALLS: Block[] = [
  ...[minZ, maxZ].flatMap(edgeZ => [-1, 1].map(side => ({
    x: x + side * ((maxX - minX) + layout.gateWidth) / 4, z: edgeZ,
    width: ((maxX - minX) - layout.gateWidth) / 2, depth: t, height: 1.55,
  }))),
  ...[minX, maxX].flatMap(edgeX => [
    { x: edgeX, z: (minZ + layout.sideGateZ - layout.gateWidth / 2) / 2, width: t,
      depth: layout.sideGateZ - layout.gateWidth / 2 - minZ, height: 1.55 },
    { x: edgeX, z: (maxZ + layout.sideGateZ + layout.gateWidth / 2) / 2, width: t,
      depth: maxZ - layout.sideGateZ - layout.gateWidth / 2, height: 1.55 },
  ]),
];
export const BASE_PASSAGES: Footprint[] = [
  { x, z: (minZ + z - depth / 2) / 2, width: 3.2, depth: z - depth / 2 - minZ + 1 },
  { x, z: layout.sideGateZ, width: maxX - minX + 1, depth: 2.8 },
  { x, z: (maxZ + z + depth / 2) / 2, width: 3.2, depth: maxZ - z - depth / 2 + 1 },
];
export const SHELTER_GOALS: Position[] = [
  { x: x - width / 2 - 1.25, z }, { x: x + width / 2 + 1.25, z },
  { x, z: z - depth / 2 - 1.25 }, { x, z: z + depth / 2 + 1.25 },
];
export const TOWER_PADS: Position[] = [-9, 12].flatMap(padX => [-9, 0, 4, 8, 10.5].map(padZ => ({ x: padX, z: padZ })));
export const SHELTER_ENTRY = { x, z: z - depth / 2 - 1 };
export const inBase = (position: Position): boolean => position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ;
export const inHall = (position: Position): boolean => Math.abs(position.x - x) < width / 2 - t && Math.abs(position.z - z) < depth / 2 - t;
export function fitsBase(area: Footprint): boolean {
  return area.x - area.width / 2 >= minX + t && area.x + area.width / 2 <= maxX - t &&
    area.z - area.depth / 2 >= minZ + t && area.z + area.depth / 2 <= maxZ - t;
}
