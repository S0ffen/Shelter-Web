import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building } from '../src/building/Building';
import { shelterHudState } from '../src/ui/HudState';

it('presents capacity above stored resources, free power below total, phase and run kills', () => {
  const sim = new Simulation();
  sim.resourceManager.add('wood', 45);
  sim.buildingSystem.buildings.push(new Building('g', 'arcane-core', { x: -13, z: -13 }, 0), new Building('t', 'magic-tower', { x: -9, z: -13 }, 0));
  sim.totalKills = 17; sim.cycle.state.day = 2; sim.cycle.state.periodElapsed = 94;
  expect(shelterHudState(sim)).toMatchObject({ wood: { maximum: 100, current: 45 }, power: { maximum: 40, current: 30 }, day: 2, night: false, kills: 17, remaining: '1:26 remaining' });
});
