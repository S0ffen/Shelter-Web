import encounters from '../../../shared/encounters.json';
import type { Position } from '../domain/types';
import type { Block } from './WorldLayout';
export const FINAL_ARENA=encounters.finalArena;
const {minX,maxX,minZ,maxZ}=FINAL_ARENA.bounds;
export const inFinalArena=(point:Position,inset=0):boolean=>point.x>minX+inset&&point.x<maxX-inset&&point.z>minZ+inset&&point.z<maxZ-inset;
export const ARENA_GATES:Block[]=[
 ...[minX,maxX].map(x=>({x,z:(minZ+maxZ)/2,width:FINAL_ARENA.gateThickness,depth:maxZ-minZ+FINAL_ARENA.gateThickness,height:FINAL_ARENA.gateHeight})),
 ...[minZ,maxZ].map(z=>({x:(minX+maxX)/2,z,width:maxX-minX+FINAL_ARENA.gateThickness,depth:FINAL_ARENA.gateThickness,height:FINAL_ARENA.gateHeight})),
];
