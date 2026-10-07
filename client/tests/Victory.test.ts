import encounters from '../../shared/encounters.json';
import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';

it.each([1, 4, 12])('lets the player challenge the final boss on day %s and completes the run only after its death', day => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start(); sim.cycle.state.day = day;
  expect(sim.phase).toBe('playing'); sim.player.position = { x: encounters.finalBoss.position.x, z: encounters.finalBoss.position.z-2.5 }; sim.update(.01);
  const boss = sim.zombies.find(z => z.kind === 'overlord')!;
  expect(boss.maxHp).toBe(16000); expect(sim.encounters.finalBossDefeated).toBe(false);
  boss.hp = 64; sim.attack(boss.id, 'heavy');
  expect(sim.phase).toBe('won'); expect(sim.totalKills).toBe(1); expect(sim.encounters.finalBossDefeated).toBe(true);
  const elapsed = sim.elapsed; sim.update(50); expect(sim.elapsed).toBe(elapsed); expect(sim.attack(boss.id)).toBe(false);
  const saved = captureRun(sim); expect(saved.outcome).toBe('won'); expect(parseRun(saved)).not.toBeNull();
  const restored = new Simulation(); restoreRun(restored, saved); restored.start();
  expect(restored.phase).toBe('won'); expect(restored.totalKills).toBe(1);
  restored.reset(); expect(restored.encounters.finalBossDefeated).toBe(false); expect(restored.phase).toBe('ready');
});
it('rejects a false victory and records terminal loss without letting a reload resume a dead run', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  const fake = captureRun(sim); fake.outcome = 'won'; expect(parseRun(fake)).toBeNull();
  sim.player.damage(100); sim.update(.01); const lost = captureRun(sim); expect(lost.outcome).toBe('lost');
  const restored = new Simulation(); restoreRun(restored, lost); restored.start(); expect(restored.phase).toBe('lost');
});
