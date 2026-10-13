import layout from '../../../shared/shelter.json';
import type { Position } from '../domain/types';
import type { Block, Footprint } from './WorldLayout';

export const BASE_BOUNDS = layout.bounds;
export const BASE_ZONES = layout.buildZones;
const baseXs = [...new Set(BASE_ZONES.flatMap(zone => [zone.minX, zone.maxX]))].sort((a,b)=>a-b);
const baseZs = [...new Set(BASE_ZONES.flatMap(zone => [zone.minZ, zone.maxZ]))].sort((a,b)=>a-b);
export const inBase = (point: Position): boolean => BASE_ZONES.some(zone =>
  point.x > zone.minX && point.x < zone.maxX && point.z > zone.minZ && point.z < zone.maxZ);
/** Disjoint cells avoid coplanar overlapping floors at the joins of the three zones. */
export const BASE_FLOOR_TILES: Footprint[] = baseXs.slice(0,-1).flatMap((left,i)=>baseZs.slice(0,-1).flatMap((bottom,j)=> {
  const right=baseXs[i+1], top=baseZs[j+1], point={x:(left+right)/2,z:(bottom+top)/2};
  return inBase(point) ? [{...point,width:right-left,depth:top-bottom}] : [];
}));
export interface BaseBoundary { from: Position; to: Position }
/** Only external edges: shared edges between zones never create a line or a build restriction. */
export const BASE_BOUNDARY: BaseBoundary[] = [];
function addBoundary(from: Position, to: Position): void {
  const previous=BASE_BOUNDARY.at(-1);
  if (previous && previous.to.x===from.x && previous.to.z===from.z &&
    (previous.from.x===from.x && from.x===to.x || previous.from.z===from.z && from.z===to.z)) previous.to=to;
  else BASE_BOUNDARY.push({from,to});
}
for (const x of baseXs) for (let j=0;j<baseZs.length-1;j++) {
  const minZ=baseZs[j],maxZ=baseZs[j+1],z=(minZ+maxZ)/2;
  if (inBase({x:x-.001,z}) !== inBase({x:x+.001,z})) addBoundary({x,z:minZ},{x,z:maxZ});
}
for (const z of baseZs) for (let i=0;i<baseXs.length-1;i++) {
  const minX=baseXs[i],maxX=baseXs[i+1],x=(minX+maxX)/2;
  if (inBase({x,z:z-.001}) !== inBase({x,z:z+.001})) addBoundary({x:minX,z},{x:maxX,z});
}
export const SHELTER_HALL = layout.hall;
export const SHELTER_CORE = layout.core;
export const SHELTER_CORE_ID = "shelter-core";
export const SHELTER_DEPOSIT = layout.deposit;
export const SHELTER_DEPOSIT_ID = "shelter-deposit";
export const BASE_POWER = { generatorOutput: layout.generatorOutput, generatorOutputs: layout.generatorOutputs, towerDemand: layout.towerDemand, storehouseDemand: layout.storehouseDemand };
const { minX, maxX, minZ, maxZ } = BASE_BOUNDS;
const { x, z, width, depth, height, doorWidth } = SHELTER_HALL;
const t = layout.wallThickness;

/** Walls have real openings. The floor and roof do not obstruct horizontal navigation. */
export const SHELTER_WALLS: Block[] = [
  { x: x - width / 2, z, width: t, depth, height },
  { x: x + width / 2, z, width: t, depth, height },
  ...[-1, 1].flatMap(face => [-1, 1].map(side => ({ x: x + side * (width + doorWidth) / 4, z: z + face * depth / 2,
    width: (width - doorWidth) / 2, depth: t, height }))),
];
export const SHELTER_WINDOWS = [
  ...[-1, 1].flatMap(side => [-1.8, 1.8].map(offset => ({
    x: x + side * width / 2, z: z + offset, width: t + 0.2, depth: 1.45, bottom: 1.15, top: 2.7,
  }))),
  ...[-1, 1].map(side => ({ x: x + side * (width + doorWidth) / 4, z: z + depth / 2, width: 1.6, depth: t + 0.2, bottom: 1.15, top: 2.7 })),
];
for (const wall of SHELTER_WALLS) wall.windows = SHELTER_WINDOWS.filter(window =>
  Math.abs(window.x - wall.x) < (window.width + wall.width) / 2 && Math.abs(window.z - wall.z) < (window.depth + wall.depth) / 2);

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
export const SHELTER_ENTRIES = [SHELTER_ENTRY, { x, z: z + depth / 2 + 1 }];
export const inHall = (position: Position): boolean => Math.abs(position.x - x) < width / 2 - t && Math.abs(position.z - z) < depth / 2 - t;
export function fitsBase(area: Footprint): boolean {
  const left=area.x-area.width/2-t,right=area.x+area.width/2+t,bottom=area.z-area.depth/2-t,top=area.z+area.depth/2+t;
  const xs=[left,...baseXs.filter(x=>x>left&&x<right),right];
  for(let i=0;i<xs.length-1;i++) {
    const x=(xs[i]+xs[i+1])/2;
    const spans=BASE_ZONES.filter(zone=>x>=zone.minX&&x<=zone.maxX).map(zone=>[zone.minZ,zone.maxZ]).sort((a,b)=>a[0]-b[0]);
    let covered=bottom;
    for(const [lo,hi]of spans) { if(lo>covered+1e-8) break; covered=Math.max(covered,hi); }
    if(covered<top-1e-8)return false;
  }
  return true;
}
