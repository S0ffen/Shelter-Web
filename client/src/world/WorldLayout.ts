import world from '../../../shared/world.json';
import type { Position } from '../domain/types';
import { BASE_WALLS, SHELTER_WALLS, SHELTER_CORE, SHELTER_DEPOSIT, BASE_BOUNDS } from './ShelterLayout';
export interface Footprint { x: number; z: number; width: number; depth: number }
export interface WindowOpening extends Footprint { bottom: number; top: number }
export interface Block extends Footprint { height: number; windows?: readonly WindowOpening[] }
export const WORLD_BOUNDS = world.bounds;
export const RISK_AREAS = world.areas;
export const OUTER_PATROL_AREAS = world.patrolAreas;
export const MAP_REFERENCE = world.reference;
export function referenceToWorld(x: number,y: number): Position { return { x: MAP_REFERENCE.originWorld.x+(x-MAP_REFERENCE.originPixel.x)*MAP_REFERENCE.metersPerPixel,z: MAP_REFERENCE.originWorld.z+(MAP_REFERENCE.originPixel.y-y)*MAP_REFERENCE.metersPerPixel }; }
export function worldToReference(point:Position) { return { x: (point.x-MAP_REFERENCE.originWorld.x)/MAP_REFERENCE.metersPerPixel+MAP_REFERENCE.originPixel.x,y: MAP_REFERENCE.originPixel.y-(point.z-MAP_REFERENCE.originWorld.z)/MAP_REFERENCE.metersPerPixel }; }
const walkable = new Uint8Array(MAP_REFERENCE.width*MAP_REFERENCE.height);
MAP_REFERENCE.walkableRows.forEach((spans,y)=>spans.forEach(([start,end])=>walkable.fill(1,y*MAP_REFERENCE.width+start,y*MAP_REFERENCE.width+end)));
export function referenceFloorOpen(point:Position,radius=0):boolean {
  const pixel=worldToReference(point), spread=radius/MAP_REFERENCE.metersPerPixel;
  const minX=Math.floor(pixel.x-spread+.5),maxX=Math.floor(pixel.x+spread+.5),minY=Math.floor(pixel.y-spread+.5),maxY=Math.floor(pixel.y+spread+.5);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(x<0||y<0||x>=MAP_REFERENCE.width||y>=MAP_REFERENCE.height||!walkable[y*MAP_REFERENCE.width+x])return false;
  return true;
}
export interface Sector { id:string; name:string; position:Position; risk?:number }
export const SECTORS:readonly Sector[]=[
 {id:'shelter',name:'Schronienie',position:{x:1.5,z:4}},
 ...Object.entries(RISK_AREAS).map(([id,area])=>({id,name:area.name,position:{x:area.x,z:area.z},risk:area.risk})),
 ...OUTER_PATROL_AREAS.map((position,index)=>({id:'district-'+index,name:['Stare Miasto','Zachodnia alejka','Katakumby','Północne ruiny','Wschodnie przejście','Kopalnie','Dzielnica magazynów'][index%7],position,risk:2})),
];
export function sectorAt(position:Position):Sector{return SECTORS.reduce((nearest,sector)=>Math.hypot(position.x-sector.position.x,position.z-sector.position.z)<Math.hypot(position.x-nearest.position.x,position.z-nearest.position.z)?sector:nearest);}
export const SHELTER_CLEARING:Footprint={x:1.5,z:2,width:70,depth:56};
export const CITY_RUINS:Block[]=world.solidLots;
export const WORLD_BOUNDARIES:Block[]=world.boundaryLots;
export const MAP_FLOOR_TILES:Footprint[]=world.floorTiles;
export const GATE_PILLARS:Block[]=[];
export const FOREST_TREES:Block[]=[];
const baseSolids:Block[]=[...BASE_WALLS,...SHELTER_WALLS,SHELTER_CORE,SHELTER_DEPOSIT];
export const CITY_BLOCKS:Block[]=[...CITY_RUINS,...WORLD_BOUNDARIES,...baseSolids];
export function isBlocked(position:Position,radius=.35,extra:readonly Footprint[]=[]):boolean {
 return !referenceFloorOpen(position,radius)||baseSolids.some(b=>Math.abs(position.x-b.x)<b.width/2+radius&&Math.abs(position.z-b.z)<b.depth/2+radius)||extra.some(b=>Math.abs(position.x-b.x)<b.width/2+radius&&Math.abs(position.z-b.z)<b.depth/2+radius);
}
export function hasLineOfSight(from:Position&{y?:number},to:Position&{y?:number},extra:readonly Footprint[]=[]):boolean {
 const obstacles=[...baseSolids,...extra], steps=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.2);
 for(let i=1;i<steps;i++){
  const t=i/steps,px=from.x+(to.x-from.x)*t,pz=from.z+(to.z-from.z)*t,y=(from.y??1.2)+((to.y??1.2)-(from.y??1.2))*t;
  if(y<=7.2&&!referenceFloorOpen({x:px,z:pz}))return false;
  if(obstacles.some(b=>Math.abs(px-b.x)<b.width/2&&Math.abs(pz-b.z)<b.depth/2&&(!('height'in b)||y<=Number(b.height))&&!('windows'in b&&(b.windows as readonly WindowOpening[]|undefined)?.some(w=>y>w.bottom&&y<w.top&&Math.abs(px-w.x)<w.width/2&&Math.abs(pz-w.z)<w.depth/2))))return false;
 }
 return true;
}
export const baseRectangle={x:(BASE_BOUNDS.minX+BASE_BOUNDS.maxX)/2,z:(BASE_BOUNDS.minZ+BASE_BOUNDS.maxZ)/2,width:BASE_BOUNDS.maxX-BASE_BOUNDS.minX,depth:BASE_BOUNDS.maxZ-BASE_BOUNDS.minZ};
