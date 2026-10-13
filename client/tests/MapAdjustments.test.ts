import { inBase } from '../src/world/ShelterLayout';
import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '../src/rendering/babylon';
import { SceneManager } from '../src/core/SceneManager';
import { Player } from '../src/player/Player';
import { PlayerController } from '../src/player/PlayerController';
import { World } from '../src/world/World';
import { NavigationGrid } from '../src/world/NavigationGrid';
import { CITY_BARRICADES, WESTERN_COURT, MAP_REFERENCE, referenceFloorOpen, referenceToWorld, isBlocked, hasLineOfSight } from '../src/world/WorldLayout';

it('opens only the authorized west-edge and Shelter pixels and keeps the exterior rampart',()=>{
 let added=0;
 for(let y=0;y<MAP_REFERENCE.height;y++)for(let x=0;x<MAP_REFERENCE.width;x++){
  const original=MAP_REFERENCE.walkableRows[y].some(([a,b])=>x>=a&&x<b);
  const actual=referenceFloorOpen(referenceToWorld(x,y));
  expect(original&&!actual).toBe(false);
  if(actual&&!original&&!inBase(referenceToWorld(x,y)))added++;
 }
 expect(added).toBe(792);
 expect(WESTERN_COURT.width).toBeCloseTo(7.7);
 for(const y of [95,112,140,155])expect(isBlocked(referenceToWorld(12,y),.38)).toBe(false);
 expect(isBlocked(referenceToWorld(5,112),.38)).toBe(true);
});

it('seals both marked central passages for movement and sight, while retaining a street detour',()=>{
 const navigation=new NavigationGrid([]);
 for(const block of CITY_BARRICADES){
  const from={x:block.x,z:block.z-3},to={x:block.x,z:block.z+3};
  expect(isBlocked(block,.35),block.id).toBe(true);
  expect(hasLineOfSight({...from,y:1.6},{...to,y:1.6}),block.id).toBe(false);
  expect(navigation.canWalk(from,to),block.id).toBe(false);
  const route=navigation.routeTo(from,to);
  expect(route.length,block.id).toBeGreaterThan(1);
  let previous=from;for(const point of route){expect(navigation.canWalk(previous,point),block.id).toBe(true);previous=point;}
 }
});

it('renders two permanent physical barricades on the same footprints used by navigation',()=>{
 const engine=new NullEngine();try{
  const scene=new Scene(engine);new World(scene);
  for(const block of CITY_BARRICADES){
   const collider=scene.getMeshByName('city-barricade-'+block.id)!;
   expect(collider.checkCollisions).toBe(true);expect(collider.isPickable).toBe(true);
   expect(collider.isEnabled()).toBe(true);expect(collider.metadata).toEqual({mapBarricade:block.id});
   collider.computeWorldMatrix(true);const bounds=collider.getBoundingInfo().boundingBox;
   expect(bounds.maximumWorld.x-bounds.minimumWorld.x).toBeCloseTo(block.width);
   expect(bounds.maximumWorld.z-bounds.minimumWorld.z).toBeCloseTo(block.depth);
   expect(bounds.minimumWorld.y).toBeCloseTo(0);expect(bounds.maximumWorld.y).toBeCloseTo(block.height);
  }
 }finally{engine.dispose();}
});

it.each(CITY_BARRICADES)('stops the actual player at $id even while jumping',block=>{
 const engine=new NullEngine();try{
  const scenes=new SceneManager(engine),player=new Player();player.position={x:block.x,z:block.z-3};player.yaw=0;
  const controller=new PlayerController(scenes.scene,{consumeLook:()=>({x:0,y:0}),down:code=>code==='KeyW'||code==='Space'});controller.restore(player);
  for(let i=0;i<60;i++){controller.update(1/30,player);scenes.scene.render();}
  expect(player.position.z).toBeLessThan(block.z-block.depth/2-.25);
  expect(player.position.z).toBeGreaterThan(block.z-2);
 }finally{engine.dispose();}
});

it('lets the actual player use the widened west lane and stops them at the retained exterior wall',()=>{
 const engine=new NullEngine();try{
  const scenes=new SceneManager(engine),player=new Player();player.position={x:-45.05,z:77.85};player.yaw=-Math.PI/2;
  const controller=new PlayerController(scenes.scene,{consumeLook:()=>({x:0,y:0}),down:code=>code==='KeyW'});controller.restore(player);
  for(let i=0;i<80;i++){controller.update(1/30,player);scenes.scene.render();}
  expect(player.position.x).toBeLessThan(-54.5);
  expect(player.position.x).toBeGreaterThan(-55.65);
 }finally{engine.dispose();}
});
