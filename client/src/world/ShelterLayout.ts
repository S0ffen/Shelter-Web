import layout from '../../../shared/shelter.json';
import type { Position } from '../domain/types';
import type { Block, Footprint } from './WorldLayout';

export const BASE_BOUNDS = layout.bounds;
export const SHELTER_HALL = layout.hall;
export const SHELTER_CORE = layout.core;
export const SHELTER_CORE_ID = "shelter-core";
export const SHELTER_DEPOSIT = layout.deposit;
export const SHELTER_DEPOSIT_ID = "shelter-deposit";
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
export const SHELTER_WINDOWS = [
  ...[-1, 1].flatMap(side => [-1.8, 1.8].map(offset => ({
    x: x + side * width / 2, z: z + offset, width: t + 0.2, depth: 1.45, bottom: 1.15, top: 2.7,
  }))),
  ...[-2.1, 2.1].map(offset => ({ x: x + offset, z: z + depth / 2, width: 1.6, depth: t + 0.2, bottom: 1.15, top: 2.7 })),
];
for (const wall of SHELTER_WALLS) wall.windows = SHELTER_WINDOWS.filter(window =>
  Math.abs(window.x - wall.x) < (window.width + wall.width) / 2 && Math.abs(window.z - wall.z) < (window.depth + wall.depth) / 2);

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
  { x, z: (minZ + z - depth / 2) / 2, width: 4.8, depth: z - depth / 2 - minZ + 1 },
  { x, z: layout.sideGateZ, width: maxX - minX + 1, depth: 4 },
  { x, z: (maxZ + z + depth / 2) / 2, width: 4.8, depth: maxZ - z - depth / 2 + 1 },
];
/** Every siege route ends inside the hall, at a reachable face of its central core. */
export const SHELTER_GOALS: Position[] = [
  { x: layout.core.x - 1.9, z: layout.core.z }, { x: layout.core.x + 1.9, z: layout.core.z },
  { x: layout.core.x, z: layout.core.z - 1.9 }, { x: layout.core.x, z: layout.core.z + 1.9 },
];
export const GENERATOR_PADS: readonly Position[] = layout.generatorPads;
export const generatorPadAt = (position: Position, radius = 0.05): Position | undefined => GENERATOR_PADS.find(pad => Math.hypot(pad.x - position.x, pad.z - position.z) <= radius);
export const SHELTER_ENTRY = { x, z: z - depth / 2 - 1 };
export const inBase = (position: Position): boolean => position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ;
export const inHall = (position: Position): boolean => Math.abs(position.x - x) < width / 2 - t && Math.abs(position.z - z) < depth / 2 - t;
export function fitsBase(area: Footprint): boolean {
  return area.x - area.width / 2 >= minX + t && area.x + area.width / 2 <= maxX - t &&
    area.z - area.depth / 2 >= minZ + t && area.z + area.depth / 2 <= maxZ - t;
}
