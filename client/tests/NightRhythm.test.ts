import { expect, it } from 'vitest';
import { SurvivalCycle, SURVIVAL_SETTINGS } from '../src/domain/SurvivalCycle';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, restoreRun } from '../src/persistence/RunSnapshot';

it('uses configurable 180/90 phases and four increasingly strong bursts with gaps', () => {
  const cycle = new SurvivalCycle(); expect(cycle.settings.nightDuration * 2).toBe(cycle.settings.dayDuration);
  cycle.update(180, 0); const spawns: number[] = [];
  for (let second = 0; second < 90; second++) {
    if (cycle.wantsSpawn(0)) { spawns.push(second); cycle.spawned(); }
    cycle.update(1, 0);
  }
  expect(spawns).toHaveLength(8);
  expect(spawns.some(second => second > 13 && second < 22)).toBe(false);
  expect(spawns.filter(second => second >= 67.5).length).toBeGreaterThan(spawns.filter(second => second < 22.5).length);
  expect(cycle.state.day).toBe(2); expect(cycle.secondsRemaining).toBe(180);
  const alternate = new SurvivalCycle({ ...SURVIVAL_SETTINGS, dayDuration: 120, nightDuration: 60 });
  alternate.update(120, 0); expect(alternate.secondsRemaining).toBe(60); alternate.update(60, 12); expect(alternate.state.day).toBe(2);
});
it('emits warnings once per threshold and does not replay them after loading', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  sim.cycle.state.periodElapsed = 119; sim.update(1);
  expect(sim.drainEvents()).toContainEqual({ type: 'night-warning', seconds: 60 });
  const restored = new Simulation(); restoreRun(restored, captureRun(sim)); restored.start(); restored.update(1);
  expect(restored.drainEvents().filter(event => event.type === 'night-warning')).toHaveLength(0);
  restored.cycle.state.periodElapsed = 149; restored.update(1);
  expect(restored.drainEvents()).toContainEqual({ type: 'night-warning', seconds: 30 });
  restored.cycle.state.periodElapsed = 169; restored.update(1);
  expect(restored.drainEvents()).toContainEqual({ type: 'night-warning', seconds: 10 });
});
