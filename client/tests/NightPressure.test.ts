import { describe, expect, it } from 'vitest';
import { SurvivalCycle } from '../src/domain/SurvivalCycle';

function startNight(day = 1, survivors = 0): SurvivalCycle {
  const cycle = new SurvivalCycle();
  cycle.state.day = day;
  expect(cycle.update(cycle.settings.dayDuration, survivors)).toBe('night-started');
  return cycle;
}

function releaseNight(cycle: SurvivalCycle, fps: number): { times: number[]; bursts: number[] } {
  const times: number[] = [], bursts = [0, 0, 0, 0];
  while (cycle.state.period === 'night') {
    if (cycle.wantsSpawn(0)) {
      times.push(cycle.state.periodElapsed);
      bursts[cycle.miniWaveIndex]++;
      cycle.spawned();
    }
    cycle.update(1 / fps, 0);
  }
  return { times, bursts };
}

describe('night pressure and breathing room', () => {
  it('brings 24 new attackers even when patrols survived into the first night', () => {
    const cycle = startNight(1, 4);
    expect(cycle.state.waveSize).toBe(24);
    expect(cycle.state.pendingSpawns).toBe(24);
    expect(cycle.wantsSpawn(4)).toBe(true);
    const result = releaseNight(cycle, 30);
    expect(result.bursts).toEqual([3, 5, 7, 9]);
    expect(result.times).toHaveLength(24);
    for (const time of result.times) expect(time % 22.5).toBeLessThan(13.5);
    expect(cycle.state.pendingSpawns).toBe(0);
    expect(cycle.state.day).toBe(2);
  });

  it.each([15, 30, 60])('can release all 128 queued attackers at %s fps without losing the final push', fps => {
    const cycle = startNight(14);
    expect(cycle.state.waveSize).toBe(128);
    const result = releaseNight(cycle, fps);
    expect(result.times).toHaveLength(128);
    expect(result.bursts).toEqual([13, 26, 38, 51]);
    for (const time of result.times) expect(time % 22.5).toBeLessThan(13.5);
    expect(result.bursts[3]).toBeGreaterThan(result.bursts[0] * 3);
  });

  it('retains the capped queue and resumes one-for-one when a slot becomes free', () => {
    const cycle = startNight(14);
    let alive = 0;
    while (cycle.state.periodElapsed < 69) {
      if (cycle.wantsSpawn(alive)) { cycle.spawned(); alive++; }
      cycle.update(1 / 30, alive);
    }
    expect(alive).toBe(48);
    expect(cycle.state.pendingSpawns).toBe(80);
    expect(cycle.wantsSpawn(alive)).toBe(false);
    expect(cycle.wantsSpawn(alive - 1)).toBe(true);
    cycle.spawned();
    expect(cycle.state.pendingSpawns).toBe(79);
    expect(cycle.wantsSpawn(alive)).toBe(false);
  });

  it('increases Blood Moon hordes but always respects the queued and alive caps', () => {
    const regular = startNight(4), moon = startNight(5), lateMoon = startNight(10);
    expect(regular.state.waveSize).toBe(48);
    expect(moon.state.waveSize).toBe(84);
    expect(lateMoon.state.waveSize).toBe(128);
    expect(moon.wantsSpawn(48)).toBe(false);
    expect(releaseNight(moon, 30).times).toHaveLength(84);
    expect(releaseNight(lateMoon, 30).times).toHaveLength(128);
  });

  it('restores the remaining burst cadence from its public checkpoint state', () => {
    const cycle = startNight(5);
    for (let frame = 0; frame < 47 * 30; frame++) {
      if (cycle.wantsSpawn(0)) cycle.spawned();
      cycle.update(1 / 30, 0);
    }
    const restored = new SurvivalCycle(cycle.settings);
    restored.state = structuredClone(cycle.state);
    expect(releaseNight(restored, 30)).toEqual(releaseNight(cycle, 30));
  });
});
