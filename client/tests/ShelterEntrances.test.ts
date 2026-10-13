import { expect,it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { SceneManager } from '../src/core/SceneManager';
import { Player } from '../src/player/Player';
import { PlayerController } from '../src/player/PlayerController';
import { inHall, SHELTER_HALL } from '../src/world/ShelterLayout';

it.each([['front',-2,0],['rear',10,Math.PI]] as const)('walks through the %s entrance and out again using real player collisions',(_,z,yaw)=>{
 const engine=new NullEngine();try{
  const scenes=new SceneManager(engine),player=new Player();let key='KeyW';player.position={x:SHELTER_HALL.x,z};player.yaw=yaw;
  const controller=new PlayerController(scenes.scene,{consumeLook:()=>({x:0,y:0}),down:code=>code===key});controller.restore(player);
  for(let i=0;i<18;i++){controller.update(1/30,player);scenes.scene.render();}
  expect(inHall(player.position)).toBe(true);expect(player.position.x).toBeCloseTo(SHELTER_HALL.x);
  key='KeyS';for(let i=0;i<18;i++){controller.update(1/30,player);scenes.scene.render();}
  expect(inHall(player.position)).toBe(false);expect(Math.abs(player.position.z-z)).toBeLessThan(.25);
 }finally{engine.dispose();}
});
