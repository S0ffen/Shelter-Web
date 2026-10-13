import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { lightingTarget } from '../src/rendering/LightingProfile';
import { SurvivalCycle } from '../src/domain/SurvivalCycle';
import { SceneManager } from '../src/core/SceneManager';
import { PointLight } from '../src/rendering/babylon';

it('makes dusk foggier and softer, then night darker with stronger shadow contrast',()=>{
  const cycle=new SurvivalCycle(),day=lightingTarget(cycle);
  cycle.state.periodElapsed=cycle.settings.dayDuration;const dusk=lightingTarget(cycle);
  cycle.state.period='night';cycle.state.periodElapsed=30;const night=lightingTarget(cycle);
  expect(dusk.fog).toBeGreaterThan(day.fog);expect(dusk.contrast).toBeLessThan(day.contrast);
  expect(night.ambient).toBeLessThan(dusk.ambient);expect(night.ambient).toBeGreaterThan(0);
  expect(night.sunColor.b).toBeGreaterThan(night.sunColor.r);expect(night.shadowDarkness).toBeLessThan(day.shadowDarkness);
  cycle.state.period='day';cycle.state.day=2;cycle.state.periodElapsed=0;
  expect(lightingTarget(cycle).ambient).toBeCloseTo(night.ambient);
  cycle.state.periodElapsed=12;expect(lightingTarget(cycle).ambient).toBeCloseTo(day.ambient);
});

it('keeps a bounded local-light budget, warm protected ground and stronger cyan lights at night',()=>{
  const engine=new NullEngine();try {
    const manager=new SceneManager(engine),cycle=new SurvivalCycle();
    expect(manager.scene.lights).toHaveLength(8);
    const warm=manager.scene.lights.filter(light=>light.name.startsWith('shelter-warm')) as PointLight[];
    const arcane=manager.scene.lights.filter(light=>light.name.startsWith('street-arcane')) as PointLight[];
    expect(warm).toHaveLength(4);expect(arcane).toHaveLength(2);
    const dayWarm=warm[0].intensity,dayArcane=arcane[0].intensity,dayAmbient=manager.scene.getLightByName('night-ambient')!.intensity;
    cycle.state.period='night';cycle.state.periodElapsed=30;manager.updateLighting(cycle,30);
    expect(warm[0].intensity).toBeGreaterThan(dayWarm);expect(warm[0].diffuse.r).toBeGreaterThan(warm[0].diffuse.b);
    expect(arcane[0].intensity).toBeGreaterThan(dayArcane);expect(arcane[0].diffuse.b).toBeGreaterThan(arcane[0].diffuse.r);
    expect(manager.scene.getLightByName('night-ambient')!.intensity).toBeLessThan(dayAmbient);
    for(const light of [...warm,...arcane]) expect(light.range).toBeLessThanOrEqual(23);
    const material=manager.scene.getMaterialByName('environment-paving')!;
    expect('maxSimultaneousLights' in material && material.maxSimultaneousLights).toBe(8);
  }finally{engine.dispose();}
});
