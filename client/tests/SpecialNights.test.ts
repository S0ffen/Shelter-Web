import { expect, it } from 'vitest';
import { nightModifierForDay } from '../src/domain/NightModifier';
import { SurvivalCycle } from '../src/domain/SurvivalCycle';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, restoreRun } from '../src/persistence/RunSnapshot';

it('selects Blood Moon every fifth day and increases its horde without removing mini-wave limits', () => {
  expect(nightModifierForDay(4)).toBeNull(); expect(nightModifierForDay(5)?.id).toBe('bloodMoon'); expect(nightModifierForDay(10)?.id).toBe('bloodMoon');
  const cycle = new SurvivalCycle(); cycle.state.day = 5; cycle.update(180, 4);
  expect(cycle.state.waveSize).toBe(36); expect(cycle.state.pendingSpawns).toBe(32);
  expect(cycle.wantsSpawn(cycle.settings.maxAliveZombies)).toBe(false);
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start(); sim.cycle = cycle;
  const restored = new Simulation(); restoreRun(restored, captureRun(sim));
  expect(restored.cycle.modifier?.label).toBe('BLOOD MOON'); expect(restored.cycle.state.waveSize).toBe(36);
});
