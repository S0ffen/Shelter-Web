import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building } from '../src/building/Building';
import { captureRun, restoreRun } from '../src/persistence/RunSnapshot';

it('respawns partial and depleted nodes once at dawn, preserving the rest of the run and saving the new state', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  sim.resourceNodes[0].damage(1000); sim.resourceNodes[1].damage(34);
  sim.resources.wood = 45; sim.carried.iron = 7; sim.totalKills = 12;
  sim.player.position = { x: -31, z: 14 };
  sim.shelter.upgrade(); sim.shelter.hp = 450;
  sim.buildingSystem.buildings.push(new Building('generator', 'arcane-core', { x: -13, z: -13 }, 0));
  sim.cycle.state.period = 'night'; sim.cycle.state.pendingSpawns = 0;
  sim.cycle.state.periodElapsed = sim.cycle.settings.nightDuration;
  sim.update(.01);
  expect(sim.cycle.state.day).toBe(2); expect(sim.resourceNodes.every(node => node.health === node.maxHealth)).toBe(true);
  expect(sim.resources.wood).toBe(45); expect(sim.carried.iron).toBe(7); expect(sim.totalKills).toBe(12);
  expect(sim.shelter.level).toBe(2); expect(sim.shelter.hp).toBe(450); expect(sim.buildingSystem.buildings).toHaveLength(1);
  sim.resourceNodes[0].damage(34); sim.update(.01); expect(sim.resourceNodes[0].health).toBe(66);
  const restored = new Simulation(); restoreRun(restored, captureRun(sim));
  expect(restored.resourceNodes[0].health).toBe(66); expect(restored.carried.iron).toBe(7);
});
