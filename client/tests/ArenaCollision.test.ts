import {expect,it} from 'vitest';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {SceneManager} from '../src/core/SceneManager';
import {ArenaView} from '../src/world/ArenaView';
import {PlayerController} from '../src/player/PlayerController';
import {Player} from '../src/player/Player';
import {FINAL_ARENA,inFinalArena} from '../src/world/ArenaLayout';
const b=FINAL_ARENA.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
it.each([
 ['west',{x:b.minX+2,z:cz},'KeyA'],['east',{x:b.maxX-2,z:cz},'KeyD'],
 ['south',{x:cx,z:b.minZ+2},'KeyS'],['north',{x:cx,z:b.maxZ-2},'KeyW'],
] as const)('physically blocks the %s arena exit and opens it after victory',(_side,position,key)=>{
 const engine=new NullEngine();try{
  const scene=new SceneManager(engine).scene,arena=new ArenaView(scene);
  const controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:k=>k===key});
  const player=new Player();player.position={...position};controller.restore(player);controller.camera.rotation.set(0,0,0);arena.update(true);scene.render();
  for(let i=0;i<35;i++){controller.update(1/30,player);scene.render();}expect(inFinalArena(player.position,.3)).toBe(true);
  arena.update(false);for(let i=0;i<30;i++){controller.update(1/30,player);scene.render();}expect(inFinalArena(player.position)).toBe(false);
 }finally{engine.dispose();}
});
