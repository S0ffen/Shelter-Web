import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene, Vector3 } from '../src/rendering/babylon';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { BASE_BOUNDARY, BASE_FLOOR_TILES, inBase, fitsBase, GENERATOR_PADS } from '../src/world/ShelterLayout';
import { World } from '../src/world/World';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';

it('uses the yellow outline rather than the bounding rectangle for protection and building',()=>{
  for(const point of [{x:0,z:22},{x:-29,z:-10},{x:8,z:-11}]) {
    expect(inBase(point)).toBe(true);expect(fitsBase({...point,width:1.6,depth:1.6})).toBe(true);
  }
  for(const point of [{x:-30,z:15},{x:25,z:-11},{x:0,z:-14}]) {
    expect(inBase(point)).toBe(false);expect(fitsBase({...point,width:1.6,depth:1.6})).toBe(false);
  }
  expect(fitsBase({x:-10.55,z:-10.5,width:2.8,depth:2.2})).toBe(true);
  expect(fitsBase({x:-10.55,z:-12.4,width:2.8,depth:2.2})).toBe(false);
  for(const point of GENERATOR_PADS) expect(fitsBase({...point,width:1.8,depth:1.8})).toBe(true);
});

it('has no internal boundary lines and renders the full courtyard without blocking movement or picking',()=>{
  for(const edge of BASE_BOUNDARY) {
    const x=(edge.from.x+edge.to.x)/2,z=(edge.from.z+edge.to.z)/2;
    const vertical=edge.from.x===edge.to.x;
    expect(inBase({x:x+(vertical?.02:0),z:z+(vertical?0:.02)})).not.toBe(inBase({x:x-(vertical?.02:0),z:z-(vertical?0:.02)}));
  }
  for(let i=0;i<BASE_FLOOR_TILES.length;i++)for(let j=0;j<i;j++) {
    const a=BASE_FLOOR_TILES[i],b=BASE_FLOOR_TILES[j];
    expect(Math.abs(a.x-b.x)<(a.width+b.width)/2-1e-8&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2-1e-8).toBe(false);
  }
  const engine=new NullEngine();try {
    const scene=new Scene(engine);new World(scene);
    const lines=scene.meshes.filter(mesh=>mesh.metadata?.baseBoundary);
    expect(lines).toHaveLength(BASE_BOUNDARY.length);
    lines.forEach(line=>{expect(line.isPickable).toBe(false);expect(line.checkCollisions).toBe(false);});
    for(const point of [{x:0,z:22},{x:-29,z:-10},{x:8,z:-11}]) {
      const hit=scene.pickWithRay(new Ray(new Vector3(point.x,2,point.z),new Vector3(0,-1,0),3),mesh=>mesh.name==='base-floor');
      expect(hit?.hit,JSON.stringify(point)).toBe(true);
    }
  }finally{engine.dispose();}
});

it('builds, protects Psyche and round-trips a v17 checkpoint in the western extension',()=>{
  const sim=new Simulation({settings:{dayPatrolCount:0}});sim.start();
  sim.resourceManager.add('wood',100);sim.resourceManager.add('iron',50);
  sim.player.position={x:-26,z:-10};sim.corruption.value=50;
  for(const point of GENERATOR_PADS.slice(0,2)) {
    sim.player.position={x:point.x+2.5,z:point.z};
    expect(sim.placeBuilding('arcane-core',point,0).ok).toBe(true);
  }
  sim.player.position={x:-26,z:-10};
  const built=sim.placeBuilding('magic-tower',{x:-29,z:-10},0);
  expect(built.ok,built.ok?'':built.reason).toBe(true);
  sim.update(1);expect(sim.corruption.value).toBeLessThan(50);
  const saved=parseRun(captureRun(sim));expect(saved).not.toBeNull();
  const restored=new Simulation();restoreRun(restored,saved!);
  expect(restored.buildingSystem.buildings.some(building=>building.position.x===-29)).toBe(true);
});
