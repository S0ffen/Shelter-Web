import { expect, it } from 'vitest';
import { SceneManager } from '../src/core/SceneManager';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '../src/rendering/babylon';
import { ArenaView } from '../src/world/ArenaView';
import { PlayerController } from '../src/player/PlayerController';
import { Player, PLAYER_SETTINGS } from '../src/player/Player';
import { FINAL_ARENA, inFinalArena, subtractPitFloor, PIT_OPENING } from '../src/world/ArenaLayout';
const b=FINAL_ARENA.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
it.each([
 ['west',{x:b.minX+2,z:cz},'KeyA'],['east',{x:b.maxX-2,z:cz},'KeyD'],
 ['south',{x:cx,z:b.minZ+2},'KeyS'],['north',{x:cx,z:b.maxZ-2},'KeyW'],
] as const)('physically prevents escape over the %s retaining wall, even by jumping',(_side,position,key)=>{
 const engine=new NullEngine();try{
  const scene=new Scene(engine);scene.collisionsEnabled=true;const arena=new ArenaView(scene);
  let jump=false;
  const controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:k=>k===key||(jump&&k==='Space')});
  const player=new Player();player.position={...position};player.height=FINAL_ARENA.floorY;controller.restore(player);controller.camera.rotation.set(0,0,0);scene.render();
  for(let i=0;i<50;i++){jump=i%30===0;controller.update(1/30,player);scene.render();}
  expect(inFinalArena(player.position,.3)).toBe(true);expect(player.height).toBeLessThan(FINAL_ARENA.surfaceY-2);
  arena.update(true);arena.update(false);
  for(let i=0;i<30;i++){controller.update(1/30,player);scene.render();}
  expect(inFinalArena(player.position,.3)).toBe(true);
 }finally{engine.dispose();}
});
it('allows a jump from the street rim and visibly drops the player to the actual pit floor',()=>{
 const engine=new NullEngine();try{
  const scene=new Scene(engine);scene.collisionsEnabled=true;new ArenaView(scene);let jump=true;
  const controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:k=>k==='KeyW'||k==='Space'&&jump});
  const player=new Player();player.position={x:cx,z:b.minZ-1};controller.restore(player);controller.camera.rotation.set(0,0,0);scene.render();
  let highest=0,sawFall=false;
  for(let i=0;i<90;i++){controller.update(1/30,player);scene.render();highest=Math.max(highest,player.height);if(player.verticalVelocity<0&&player.height<-.3)sawFall=true;jump=false;}
  expect(highest).toBeGreaterThan(.7);expect(highest).toBeLessThan(PLAYER_SETTINGS.jumpSpeed**2/(2*PLAYER_SETTINGS.gravity)+.05);
  expect(sawFall).toBe(true);expect(inFinalArena(player.position,1)).toBe(true);expect(player.height).toBeCloseTo(FINAL_ARENA.floorY);expect(player.verticalVelocity).toBe(0);
  expect(controller.camera.position.y).toBeCloseTo(FINAL_ARENA.floorY+1.7);
  expect(scene.getMeshByName('final-arena-pit-floor')!.getBoundingInfo().boundingBox.maximumWorld.y).toBeCloseTo(FINAL_ARENA.floorY);
 }finally{engine.dispose();}
});
it('keeps opaque stone walls enabled throughout the encounter and removes paving over the opening',()=>{
 const engine=new NullEngine();try{
  const scene=new Scene(engine),arena=new ArenaView(scene);
  const walls=scene.meshes.filter(m=>m.metadata?.retainingWall);expect(walls).toHaveLength(4);
  for(const active of [false,true,false]){arena.update(active);expect(walls.every(m=>m.isEnabled()&&m.checkCollisions&&m.material?.alpha===1)).toBe(true);}
  const tile={x:PIT_OPENING.x,z:PIT_OPENING.z,width:PIT_OPENING.width+4,depth:PIT_OPENING.depth+4},pieces=subtractPitFloor([tile]);
  expect(pieces).toHaveLength(4);
  expect(pieces.reduce((sum,p)=>sum+p.width*p.depth,0)).toBeCloseTo(tile.width*tile.depth-PIT_OPENING.width*PIT_OPENING.depth);
  expect(pieces.every(p=>Math.abs(p.x-PIT_OPENING.x)>=p.width/2+PIT_OPENING.width/2-.00001||Math.abs(p.z-PIT_OPENING.z)>=p.depth/2+PIT_OPENING.depth/2-.00001)).toBe(true);
 }finally{engine.dispose();}
});
it('restores a player in mid-fall without teleporting to street level',()=>{
 const engine=new NullEngine();try{
  const scene=new Scene(engine);scene.collisionsEnabled=true;new ArenaView(scene);
  const controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:()=>false});
  const player=new Player();player.position={x:cx,z:cz};player.height=-2;player.verticalVelocity=-5;controller.restore(player);scene.render();
  expect(controller.camera.position.y).toBeCloseTo(-.3);
  for(let i=0;i<30;i++){controller.update(1/30,player);scene.render();}
  expect(player.height).toBeCloseTo(FINAL_ARENA.floorY);expect(player.verticalVelocity).toBe(0);
 }finally{engine.dispose();}
});

it('preserves the physical drop and floor opening with the complete city scene loaded',()=>{
 const engine=new NullEngine();try{
  const scene=new SceneManager(engine).scene;new ArenaView(scene);let jump=true;
  const controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:k=>k==='KeyW'||k==='Space'&&jump});
  const player=new Player();player.position={x:cx,z:b.minZ-1};controller.restore(player);controller.camera.rotation.set(0,0,0);scene.render();
  for(let i=0;i<90;i++){controller.update(1/30,player);scene.render();jump=false;}
  expect(inFinalArena(player.position,1)).toBe(true);expect(player.height).toBeCloseTo(FINAL_ARENA.floorY);expect(controller.camera.position.y).toBeCloseTo(FINAL_ARENA.floorY+1.7);
  const floor=scene.getMeshByName('reference-city-floor')!;
  const hit=scene.pickWithRay(controller.camera.getForwardRay(20),mesh=>mesh===floor);
  expect(hit?.hit).toBe(false);
 }finally{engine.dispose();}
});
