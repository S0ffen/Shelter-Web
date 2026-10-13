import { GENERATOR_PADS } from '../src/world/ShelterLayout';
import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building } from '../src/building/Building';
import { shelterHudState } from '../src/ui/HudState';

it('presents capacity above stored resources, free power below total, phase and run kills', () => {
  const sim = new Simulation();
  sim.resourceManager.add('wood', 45);
  sim.buildingSystem.buildings.push(new Building('g', 'arcane-core', GENERATOR_PADS[0], 0), new Building('g2', 'arcane-core', GENERATOR_PADS[1], 0), new Building('t', 'magic-tower', { x: -9, z: -13 }, 0));
  sim.totalKills = 17; sim.cycle.state.day = 2; sim.cycle.state.periodElapsed = 94;
  expect(shelterHudState(sim)).toMatchObject({ wood: { maximum: 100, current: 45 }, power: { maximum: 20, current: 8 }, day: 2, night: false, kills: 17, remaining: '1:26 remaining' });
});
