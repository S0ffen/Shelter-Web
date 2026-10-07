import { expect,it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { SceneManager } from '../src/core/SceneManager';
import { PlayerController } from '../src/player/PlayerController';
import { combatTarget } from '../src/player/CombatTarget';
import { Simulation } from '../src/domain/Simulation';
import { Vector3 } from '../src/rendering/babylon';
import { SHELTER_DEPOSIT_ID } from '../src/world/ShelterLayout';
it('raycasts the actual deposit cabinet, keeps carried materials on entry and transfers only through interaction',()=>{
 const engine=new NullEngine();try{
  const scenes=new SceneManager(engine),sim=new Simulation({settings:{dayPatrolCount:0}});sim.start();sim.player.position={x:6,z:4.9};sim.carried.wood=9;sim.carried.iron=1;
  const controller=new PlayerController(scenes.scene,{consumeLook:()=>({x:0,y:0}),down:()=>false});controller.restore(sim.player);controller.camera.setTarget(new Vector3(6,1.2,6.8));scenes.scene.render();
  const target=combatTarget(scenes.scene,controller.camera,3);expect(target).toBe(SHELTER_DEPOSIT_ID);sim.update(.01);expect(sim.carried).toEqual({wood:9,iron:1});
  sim.interact(target);expect(sim.resources).toEqual({wood:9,iron:1});expect(sim.carried).toEqual({wood:0,iron:0});
  sim.carried.wood=5;sim.player.position={x:6,z:9.5};expect(sim.depositResources()).toEqual({wood:0,iron:0});
 }finally{engine.dispose()}
});
