import encounters from '../../shared/encounters.json';
import { CITY_BARRICADES, isBlocked } from '../src/world/WorldLayout';
import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building } from '../src/building/Building';
import { Zombie } from '../src/enemies/Zombie';
import { GENERATOR_PADS, SHELTER_DEPOSIT } from '../src/world/ShelterLayout';
import { captureRun, parseRun, restoreRun, SAVE_VERSION } from '../src/persistence/RunSnapshot';

function previous(version: 14 | 15, tier = 1) {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
  sim.start(); sim.shelter.level = tier; sim.resources.wood = 45; sim.carried.iron = 9;
  sim.buildingSystem.buildings.push(new Building('generator-1', 'arcane-core', GENERATOR_PADS[0], 0));
  sim.zombies.push(new Zombie('survivor-1', { x: -6, z: 13 }, 'tank'));
  sim.zombies[0].hp = 137; sim.zombies[0].mode = 'siege'; sim.totalKills = 12;
  const saved = captureRun(sim);
  saved.version = version;
  saved.shelterHp = (version === 14 ? [300, 500, 750] : [1000, 2000, 3500])[tier - 1] / 2;
  saved.buildings[0].hp = (version === 14 ? 200 : 800) / 4;
  delete (saved.buildings[0] as Partial<typeof saved.buildings[0]>).level;
  delete (saved.player as Partial<typeof saved.player>).height; delete (saved.player as Partial<typeof saved.player>).verticalVelocity;
  for (const zombie of saved.zombies) { delete (zombie as Partial<typeof zombie>).pursuitElapsed; delete (zombie as Partial<typeof zombie>).returning; }
  return saved;
}

it.each([14, 15] as const)('migrates v%s without modifying source or losing progress and damage percentages', version => {
  const old = previous(version), original = structuredClone(old), saved = parseRun(old)!;
  expect(saved).not.toBeNull(); expect(old).toEqual(original); expect(saved.version).toBe(SAVE_VERSION);
  expect(saved.shelterHp).toBe(625); expect(saved.buildings[0].hp).toBe(250); expect(saved.buildings[0].level).toBe(1);
  expect(saved.resources).toEqual(old.resources); expect(saved.carried).toEqual(old.carried);
  expect(saved.totalKills).toBe(12); expect(saved.zombies.map(({ pursuitElapsed: _p, returning: _r, ...z }) => z)).toEqual(old.zombies); expect(saved.spawner).toEqual(old.spawner);
  expect(saved.cycle).toEqual(old.cycle); expect(saved.skills).toEqual(old.skills); expect(saved.nodes).toEqual(old.nodes);
  const sim = new Simulation(); restoreRun(sim, saved);
  expect(sim.shelter.hp / sim.shelter.maxHp).toBe(.5);
  expect(sim.buildingSystem.buildings[0].hp / sim.buildingSystem.buildings[0].maxHp).toBe(.25);
  expect(parseRun(captureRun(sim))).not.toBeNull();
});

it.each([14, 15] as const)('preserves legacy v%s automatically boosted generators as independent tier III generators', version => {
  const old = previous(version, 3), saved = parseRun(old)!;
  expect(saved.buildings[0].level).toBe(3); expect(saved.buildings[0].hp).toBe(500);
  const sim = new Simulation(); restoreRun(sim, saved);
  expect(sim.buildingSystem.generatorOutputFor(sim.buildingSystem.buildings[0].level)).toBe(25);
  expect(sim.shelter.maxHp).toBe(2750); expect(sim.shelter.hp).toBe(1375);
});

it('preserves Engineer health bonuses when migrating damaged independent generators', () => {
  const old = previous(15, 3);
  old.skills.levels['beginner-engineer'] = 2; old.skills.points = 1;
  old.buildings[0].hp = 480;
  const sim = new Simulation(); restoreRun(sim, parseRun(old)!);
  expect(sim.buildingSystem.buildings[0].maxHp).toBe(2400);
  expect(sim.buildingSystem.buildings[0].hp).toBe(1200);
});

it.each([14, 15] as const)('preserves destruction and rejects invalid legacy v%s HP', version => {
  const old = previous(version); old.outcome = 'lost'; old.shelterHp = 0;
  const lost = parseRun(old)!; expect(lost.outcome).toBe('lost'); expect(lost.shelterHp).toBe(0);
  old.shelterHp = version === 14 ? 301 : 1001; expect(parseRun(old)).toBeNull();
  old.outcome = 'active'; old.shelterHp = 150; old.buildings[0].hp = version === 14 ? 201 : 801;
  expect(parseRun(old)).toBeNull();
});

it('keeps a barely surviving v15 tower alive when its maximum HP becomes smaller', () => {
  const old = previous(15);
  old.buildings = [{ id: 'tower-1', kind: 'magic-tower', position: { x: -13, z: 6 }, rotation: 0, hp: 1 } as typeof old.buildings[0]];
  const saved = parseRun(old)!; expect(saved).not.toBeNull(); expect(saved.buildings[0].hp).toBeCloseTo(550 / 600);
  const sim = new Simulation(); restoreRun(sim, saved);
  expect(sim.buildingSystem.buildings[0].alive).toBe(true);
  expect(parseRun(captureRun(sim))).not.toBeNull();
});

it('moves only a v14 actor out of the relocated deposit cabinet', () => {
  const old = previous(14); old.player.position = { x: SHELTER_DEPOSIT.x, z: SHELTER_DEPOSIT.z };
  expect(parseRun(old)!.player.position.z).toBeLessThan(SHELTER_DEPOSIT.z - SHELTER_DEPOSIT.depth / 2);
});

it('roundtrips independently upgraded tier IV generators and rejects invalid tier or HP', () => {
  const sim = new Simulation(); sim.start(); sim.shelter.level = 4;
  sim.buildingSystem.buildings.push(new Building('generator-1', 'arcane-core', GENERATOR_PADS[0], 0, 1, 4));
  const saved = captureRun(sim); expect(parseRun(saved)).not.toBeNull();
  const restored = new Simulation(); restoreRun(restored, saved);
  expect(restored.buildingSystem.buildings[0].level).toBe(4); expect(restored.buildingSystem.buildings[0].maxHp).toBe(2500);
  expect(restored.buildingSystem.power.generated).toBe(130);
  saved.buildings[0].hp = 2501; expect(parseRun(saved)).toBeNull();
  saved.buildings[0].hp = 2500; saved.buildings[0].level = 5; expect(parseRun(saved)).toBeNull();
  saved.buildings[0].level = 4; saved.shelterLevel = 1; expect(parseRun(saved)).toBeNull();
});

it('migrates v16 independent generator tiers, exact HP and pressure without resetting the ongoing wave', () => {
  const sim = new Simulation(); sim.start(); sim.shelter.level = 4; sim.shelter.hp = 2200;
  sim.buildingSystem.buildings.push(new Building('generator-1', 'arcane-core', GENERATOR_PADS[0], 0, 1, 2));
  sim.buildingSystem.buildings.push(new Building('generator-2', 'arcane-core', GENERATOR_PADS[1], 0, 1, 1));
  sim.buildingSystem.buildings[0].hp = 1200.5; sim.buildingSystem.buildings[1].hp = .5;
  sim.cycle.state = { day: 6, period: 'night', periodElapsed: 20, pendingSpawns: 5, waveSize: 28, spawnCountdown: 1, patrolCountdown: 0 };
  const old = captureRun(sim); old.version = 16;
  Object.assign(old.settings, { baseWaveSize: 8, waveGrowth: 4, maxWaveSize: 64, spawnInterval: 2, maxAliveZombies: 24 });
  delete (old.player as Partial<typeof old.player>).height; delete (old.player as Partial<typeof old.player>).verticalVelocity;
  const original = structuredClone(old), saved = parseRun(old)!;
  expect(saved).not.toBeNull(); expect(old).toEqual(original); expect(saved.buildings).toEqual(old.buildings); expect(saved.shelterHp).toBe(2200);
  expect(saved.settings).toMatchObject({ baseWaveSize: 24, waveGrowth: 8, maxWaveSize: 128, spawnInterval: .55, maxAliveZombies: 48, dayDuration: 180, nightDuration: 90 });
  expect(saved.cycle).toEqual(old.cycle); expect(saved.player.height).toBe(0); expect(saved.player.verticalVelocity).toBe(0);
  const restored = new Simulation(); restoreRun(restored, saved);
  expect(restored.buildingSystem.buildings.map(b => b.level)).toEqual([2, 1]);
  expect(restored.buildingSystem.power.generated).toBe(25); expect(parseRun(captureRun(restored))).not.toBeNull();
});

it('preserves explicitly configured survival values while upgrading matching old defaults', () => {
  const sim = new Simulation({ settings: { dayDuration: 120, nightDuration: 60, baseWaveSize: 12, waveGrowth: 2, maxWaveSize: 40, maxAliveZombies: 20, spawnInterval: 1 } });
  sim.start(); const old = captureRun(sim); old.version = 16;
  expect(parseRun(old)!.settings).toEqual(old.settings);
});

it('moves only legacy actors embedded in newly added physical barricades to a nearby clear position', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  const north = CITY_BARRICADES[0], south = CITY_BARRICADES[1];
  sim.player.position = { x: north.x, z: north.z }; sim.abilities.lastPosition = { ...sim.player.position };
  sim.zombies.push(new Zombie('survivor-1', { x: south.x, z: south.z }));
  const old = captureRun(sim); old.version = 16; const original = structuredClone(old), saved = parseRun(old)!;
  expect(saved).not.toBeNull(); expect(old).toEqual(original);
  expect(isBlocked(saved.player.position)).toBe(false); expect(isBlocked(saved.zombies[0].position)).toBe(false);
  expect(Math.hypot(saved.player.position.x - old.player.position.x, saved.player.position.z - old.player.position.z)).toBeLessThan(2);
  expect(saved.resources).toEqual(old.resources); expect(saved.carried).toEqual(old.carried); expect(saved.nodes).toEqual(old.nodes);
});

it('migrates an ongoing v16 boss fight onto the lowered arena floor and preserves boss health', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  sim.player.position = { ...encounters.finalBoss.position }; sim.player.height = encounters.finalArena.floorY;
  sim.update(.01); const boss = sim.zombies.find(z => z.kind === 'overlord')!;
  expect(boss).toBeDefined(); boss.hp = 13000;
  const old = captureRun(sim); old.version = 16;
  delete (old.player as Partial<typeof old.player>).height; delete (old.player as Partial<typeof old.player>).verticalVelocity;
  const saved = parseRun(old)!; expect(saved).not.toBeNull(); expect(saved.finalArenaActive).toBe(true);
  expect(saved.player.height).toBe(encounters.finalArena.floorY); expect(saved.zombies.find(z => z.kind === 'overlord')!.hp).toBe(13000);
  const restored = new Simulation(); restoreRun(restored, saved); expect(restored.player.height).toBe(-4); expect(restored.finalArenaActive).toBe(true);
  expect(parseRun(captureRun(restored))).not.toBeNull();
});

it('roundtrips a physical fall and Ravager return cooldown in v17', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  sim.player.position = { ...encounters.finalBoss.position }; sim.player.height = -2; sim.player.verticalVelocity = -8;
  const ravager = new Zombie('city-ravager', encounters.ravager.position, 'ravager');
  ravager.mode = 'guard'; ravager.intent = 'guard'; ravager.pursuitElapsed = 8; ravager.returning = true; sim.zombies.push(ravager);
  const saved = captureRun(sim), restored = new Simulation(); restoreRun(restored, saved);
  expect(restored.player.height).toBe(-2); expect(restored.player.verticalVelocity).toBe(-8); expect(restored.finalArenaActive).toBe(false);
  expect(restored.zombies[0].returning).toBe(true); expect(restored.zombies[0].pursuitElapsed).toBe(8);
  for (const bad of [() => saved.player.height = -5, () => saved.player.verticalVelocity = -21, () => saved.zombies[0].pursuitElapsed = 8.1]) {
    const good = structuredClone(saved); bad(); expect(parseRun(saved)).toBeNull(); Object.assign(saved, good);
  }
});
