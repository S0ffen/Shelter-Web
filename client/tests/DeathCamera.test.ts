import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene, Vector3 } from '../src/rendering/babylon';
import { Player } from '../src/player/Player';
import { PlayerController } from '../src/player/PlayerController';
import { ShelterDeathCamera } from '../src/player/ShelterDeathCamera';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, restoreRun } from '../src/persistence/RunSnapshot';
import { SHELTER_HALL } from '../src/world/ShelterLayout';

it('spectates the Shelter while dead, preserving checkpoint location and returning to first person after respawn', () => {
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine),controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:()=>false});
    const view=new ShelterDeathCamera(scene,controller.camera),sim=new Simulation({settings:{dayPatrolCount:0}});
    sim.start();sim.player.position={x:30,z:30};sim.player.damage(100);sim.update(.01);
    const position={...sim.player.position};view.update(true);scene.render();
    expect(scene.activeCamera).toBe(view.camera);expect(view.camera.position.y).toBeGreaterThan(15);
    const direction=new Vector3(SHELTER_HALL.x,1.8,5.05).subtract(view.camera.position).normalize();
    expect(Vector3.Dot(view.camera.getForwardRay().direction,direction)).toBeGreaterThan(.999);
    expect(captureRun(sim).player.position).toEqual(position);
    const restored=new Simulation();restoreRun(restored,captureRun(sim));restored.start();
    for(let i=0;i<150;i++)restored.update(1/30);
    controller.restore(restored.player);view.update(false);scene.render();
    expect(scene.activeCamera).toBe(controller.camera);expect(controller.camera.position.y).toBe(1.7);
    expect(controller.camera.position.x).toBe(restored.player.position.x);expect(restored.player.alive).toBe(true);
  } finally { engine.dispose(); }
});

it('keeps living player view active until spectating is requested',()=>{
  const engine=new NullEngine();
  try { const scene=new Scene(engine),controller=new PlayerController(scene,{consumeLook:()=>({x:0,y:0}),down:()=>false});
    const view=new ShelterDeathCamera(scene,controller.camera),player=new Player();controller.restore(player);view.update(false);
    expect(scene.activeCamera).toBe(controller.camera);
  } finally { engine.dispose(); }
});
