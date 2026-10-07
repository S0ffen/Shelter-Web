import { expect, it } from 'vitest';
import { Corruption } from '../src/domain/Corruption';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';

it('accumulates outside, recovers in the base and applies timed damage only after reaching maximum', () => {
  const curse = new Corruption();
  expect(curse.update(99, false)).toBe(0); expect(curse.value).toBe(99);
  expect(curse.update(3, false)).toBe(0); expect(curse.damageElapsed).toBe(2);
  expect(curse.update(1, false)).toBe(5); expect(curse.movementMultiplier).toBe(.8);
  expect(curse.update(1, true)).toBe(0); expect(curse.value).toBe(96); expect(curse.movementMultiplier).toBe(1);
  curse.update(30, true); expect(curse.value).toBe(0);
});
it('freezes exposure and damage while paused and restores the partial damage interval', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  sim.player.position = { x: -31, z: 14 }; sim.corruption.value = 100; sim.update(2);
  expect(sim.player.hp).toBe(100); expect(sim.movementSpeed).toBeCloseTo(4.16);
  const saved = captureRun(sim), restored = new Simulation(); restoreRun(restored, saved);
  restored.update(10); expect(restored.player.hp).toBe(100);
  restored.start(); restored.update(1); expect(restored.player.hp).toBe(95);
  restored.player.position = { x: 1.5, z: -7 }; restored.update(1);
  expect(restored.corruption.value).toBe(96); expect(restored.movementSpeed).toBe(5.2);
  saved.corruption.value = 101; expect(parseRun(saved)).toBeNull();
});
