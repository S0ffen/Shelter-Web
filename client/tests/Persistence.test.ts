import { afterEach, describe, expect, it, vi } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Zombie } from '../src/enemies/Zombie';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';
import { SaveService } from '../src/persistence/SaveService';
import { Building } from '../src/building/Building';

function prepared(): Simulation {
  const sim = new Simulation({ seed: 5, settings: { dayPatrolCount: 0 } });
  sim.start();
  return sim;
}
afterEach(() => vi.unstubAllGlobals());

describe('complete run checkpoints', () => {
  it('roundtrips a live night without losing resources, depleted nodes, construction, health or RNG state', () => {
    const sim = prepared();
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    sim.buildingSystem.buildings.push(new Building('fixture-generator', 'arcane-core', { x: 10, z: 10 }, 0));
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(true);
    sim.player.position = { x: -15, z: -9.4 };
    sim.attack('wood-01');
    sim.player.hp = 87; sim.shelter.hp = 245;
    sim.cycle.state = { day: 3, period: 'night', periodElapsed: 17, pendingSpawns: 5, waveSize: 16, spawnCountdown: 1, patrolCountdown: 0 };
    sim.zombies.push(new Zombie('zombie-1', { x: -6, z: 13 }));
    sim.spawner.nextId = 2;
    const saved = captureRun(sim);
    sim.resources.wood = 0;
    expect(saved.resources.wood).toBe(73);
    const parsed = parseRun(JSON.parse(JSON.stringify(saved)))!;
    expect(parsed).not.toBeNull();
    const restored = new Simulation();
    restoreRun(restored, parsed);
    expect(restored.phase).toBe('paused');
    expect(restored.runId).toBe(saved.runId);
    expect(restored.player.hp).toBe(87);
    expect(restored.shelter.hp).toBe(245);
    expect(restored.resources).toEqual(saved.resources);
    expect(restored.resourceNodes[0].health).toBe(66);
    expect(restored.buildingSystem.capacity.wood).toBe(150);
    expect(restored.cycle.state).toEqual(saved.cycle);
    expect(restored.spawner.seed).toBe(saved.spawner.seed);
    const elapsed = restored.elapsed;
    restored.update(30);
    expect(restored.elapsed).toBe(elapsed);
    restored.start();
    expect(restored.zombies).toHaveLength(1);
    restored.player.position = { x: -4, z: -3 };
    expect(restored.placeBuilding('arcane-core', { x: -7, z: -1 }, 0).ok).toBe(true);
    expect(restored.buildingSystem.buildings.at(-1)!.id).toBe('building-2');
  });

  it('restores projectiles and tower cooldowns without granting another immediate shot', () => {
    const sim = prepared();
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    sim.placeBuilding('arcane-core', { x: -4, z: -7 }, 0);
    sim.player.position = { x: -6, z: -4 };
    sim.placeBuilding('magic-tower', { x: -4, z: -1 }, 0);
    sim.zombies.push(new Zombie('zombie-1', { x: -6, z: 0 }));
    sim.spawner.nextId = 2;
    sim.update(1 / 30);
    const saved = captureRun(sim);
    expect(saved.projectiles).toHaveLength(1);
    const restored = prepared();
    restoreRun(restored, saved);
    expect(restored.towerSystem.projectiles).toEqual(saved.projectiles);
    restored.start(); restored.update(1 / 30);
    expect(restored.towerSystem.projectiles).toHaveLength(1);
    expect(restored.towerSystem.towers.get('building-2')!.cooldown).toBeGreaterThan(1);
  });

  it.each(['version', 'node', 'capacity', 'duplicate', 'health', 'position', 'timer', 'arcane-currency', 'outside-base'] as const)
  ('rejects corrupt %s data before modifying the current run', field => {
    const sim = prepared();
    const saved = captureRun(sim);
    if (field === 'version') (saved as { version: number }).version = 1;
    if (field === 'node') saved.nodes[0].id = 'wood-invented';
    if (field === 'capacity') saved.resources.wood = 101;
    if (field === 'duplicate') saved.nodes[1].id = saved.nodes[0].id;
    if (field === 'health') saved.player.hp = 0;
    if (field === 'position') saved.player.position.z = 1000;
    if (field === 'timer') saved.cycle.periodElapsed = NaN;
    if (field === 'arcane-currency') Object.assign(saved.resources, { arcane: 10 });
    if (field === 'outside-base') saved.buildings.push({ id: 'building-1', kind: 'arcane-core', position: { x: 25, z: 20 }, rotation: 0 });
    expect(parseRun(saved)).toBeNull();
    const runId = sim.runId;
    expect(() => restoreRun(sim, saved)).toThrow();
    expect(sim.runId).toBe(runId);
    expect(sim.phase).toBe('playing');
  });
});

describe('SQLite connection and local fallback', () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  }
  it('retains an offline checkpoint across service recreation', async () => {
    memoryStorage();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const saved = captureRun(prepared());
    const service = new SaveService();
    expect(await service.save(saved)).toBe('local');
    const reopened = new SaveService();
    expect(await reopened.initialize()).toEqual(saved);
    expect(reopened.online).toBe(false);
  });
  it('preserves an old layout save and reports that a fresh run is needed', async () => {
    memoryStorage();
    const legacy = JSON.stringify({ version: 1 });
    localStorage.setItem('fantasy-shelter.run.v1', legacy);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(legacy)));
    const service = new SaveService();
    expect(await service.initialize()).toBeNull();
    expect(service.incompatibleSave).toBe(true);
    expect(localStorage.getItem('fantasy-shelter.run.v1')).toBe(legacy);
  });

  it('accepts an empty SQLite database and prefers a newer valid server checkpoint', async () => {
    memoryStorage();
    const saved = captureRun(prepared());
    const fetch = vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const empty = new SaveService();
    expect(await empty.initialize()).toBeNull();
    expect(empty.online).toBe(true);
    fetch.mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify(saved)));
    expect(await new SaveService().initialize()).toEqual(saved);
  });

  it('writes checkpoints in order so an older request cannot overwrite the latest one', async () => {
    memoryStorage();
    let finishFirst: (response: Response) => void = () => {};
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const service = new SaveService();
    const older = captureRun(prepared());
    const newer = structuredClone(older); newer.cycle.day = 2;
    const first = service.save(older);
    const second = service.save(newer);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    finishFirst(new Response('{}'));
    expect(await first).toBe('sqlite');
    expect(await second).toBe('sqlite');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).cycle.day).toBe(2);
    expect(service.latest?.cycle.day).toBe(2);
  });

  it('reports memory-only storage when both disk storage and the server are unavailable', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await new SaveService().save(captureRun(prepared()))).toBe('memory');
  });
});
