import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { SurvivalCycle, SURVIVAL_SETTINGS } from '../src/domain/SurvivalCycle';
import { NavigationGrid, SPAWN_AREAS } from '../src/world/NavigationGrid';
import { createResourceNodes } from '../src/resources/ResourceNode';
import { ZombieSpawner } from '../src/enemies/ZombieSpawner';
import { Shelter } from '../src/shelter/Shelter';
import { isBlocked } from '../src/world/WorldLayout';
import { Building } from '../src/building/Building';

describe('day, night and random hordes', () => {
  it.each([1, 42, 987])('keeps a randomly spawned night moving until undefended players or Shelter lose (seed %s)', seed => {
    const sim = new Simulation({ seed, settings: { dayDuration: 0.1, dayPatrolCount: 0 } });
    sim.start();
    for (let step = 0; step < 9000 && sim.phase === 'playing'; step++) sim.update(1 / 30);
    expect(sim.phase).toBe('lost');
    expect(sim.player.hp === 0 || sim.shelter.hp === 0).toBe(true);
    expect(sim.livingZombies.length).toBeGreaterThan(1);
    for (const zombie of sim.livingZombies) expect(isBlocked(zombie.position, 0.34, sim.obstacles)).toBe(false);
  });

  it('waits for both the queued spawns and living enemies before dawn, then grows the next wave', () => {
    const cycle = new SurvivalCycle({ ...SURVIVAL_SETTINGS, dayDuration: 1, nightMinimumDuration: 1 });
    expect(cycle.update(1, 2)).toBe('night-started');
    expect(cycle.state.waveSize).toBe(8);
    expect(cycle.state.pendingSpawns).toBe(6);
    expect(cycle.update(10, 0)).toBeNull();
    cycle.state.pendingSpawns = 0;
    expect(cycle.update(1, 1)).toBeNull();
    expect(cycle.update(1, 0)).toBe('day-started');
    expect(cycle.state.day).toBe(2);
    expect(cycle.update(1, 0)).toBe('night-started');
    expect(cycle.state.waveSize).toBe(12);
    cycle.state.day = 100;
    cycle.state.period = 'day';
    cycle.update(1, 0);
    expect(cycle.state.waveSize).toBe(64);
  });

  it('limits active enemies, retains the remaining queue, and pauses spawns', () => {
    const sim = new Simulation({ seed: 2, settings: { dayDuration: 0.1, dayPatrolCount: 0, spawnInterval: 0.1, maxAliveZombies: 2 } });
    sim.start();
    for (let i = 0; i < 60; i++) sim.update(1 / 30);
    expect(sim.cycle.state.period).toBe('night');
    expect(sim.livingZombies).toHaveLength(2);
    expect(sim.cycle.state.pendingSpawns).toBe(6);
    sim.pause();
    const elapsed = sim.cycle.state.periodElapsed;
    sim.update(30);
    expect(sim.cycle.state.periodElapsed).toBe(elapsed);
    expect(sim.livingZombies).toHaveLength(2);
  });

  it('supports early night near Shelter and preserves harvested objects and buildings across days', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
    sim.start();
    sim.player.position = { x: -31, z: 14 };
    expect(sim.beginNight()).toBe(false);
    sim.player.position = { x: 1.5, z: -7 };
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    const node = sim.resourceNodes[0];
    node.damage(1000);
    sim.buildingSystem.buildings.push(new Building('fixture-generator', 'arcane-core', { x: 10, z: 10 }, 0));
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(true);
    expect(sim.beginNight()).toBe(true);
    sim.update(1 / 30);
    expect(sim.cycle.state.period).toBe('night');
    sim.zombies.forEach(zombie => zombie.damage(1000));
    sim.cycle.state.pendingSpawns = 0;
    sim.cycle.state.periodElapsed = 45;
    sim.update(1 / 30);
    expect(sim.cycle.state.day).toBe(2);
    expect(sim.phase).toBe('playing');
    expect(sim.resourceNodes[0].isDestroyed).toBe(true);
    expect(sim.buildingSystem.buildings).toHaveLength(2);
    expect(sim.resourceManager.capacity.wood).toBe(150);
    expect(sim.resources.wood).toBe(70);
  });

  it('spawns reproducible but varied, reachable enemies away from the player', () => {
    const nodes = createResourceNodes();
    const obstacles = nodes.map(node => node.footprint);
    const navigation = new NavigationGrid(obstacles);
    for (const area of SPAWN_AREAS) expect(navigation.routeFrom(area).length, JSON.stringify(area)).toBeGreaterThan(0);
    const first = new ZombieSpawner(42);
    const second = new ZombieSpawner(42);
    const player = { x: -6, z: -8 };
    const positions: string[] = [];
    for (let i = 0; i < 20; i++) {
      const enemy = first.spawn(navigation, player, [], 'siege')!;
      expect(enemy.position).toEqual(second.spawn(navigation, player, [], 'siege')!.position);
      expect(isBlocked(enemy.position, 0.35, obstacles)).toBe(false);
      expect(Math.hypot(enemy.position.x - player.x, enemy.position.z - player.z)).toBeGreaterThanOrEqual(10);
      expect(new Shelter().distanceFrom(enemy.route.at(-1)!)).toBeLessThanOrEqual(1.35);
      let previous = enemy.position;
      for (const point of enemy.route) { expect(navigation.canWalk(previous, point)).toBe(true); previous = point; }
      positions.push(JSON.stringify(enemy.position));
    }
    expect(new Set(positions).size).toBe(20);
    expect(first.nextId).toBe(21);
  });
});
