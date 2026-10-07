import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { MagicTowerSystem } from '../src/building/MagicTowerSystem';
import { Building } from '../src/building/Building';
import { Zombie } from '../src/enemies/Zombie';

describe('milestone 6 Magic Tower', () => {
  it('fires travelling projectiles, kills enemies and keeps the survival run active', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
    sim.start();
    sim.resourceManager.add('wood', 100);
    sim.resourceManager.add('iron', 50);
    (sim.player.position = { x: -10, z: -13 }, sim.placeBuilding('arcane-core', { x: -13, z: -13 }, 0));
    sim.player.position = { x: -15, z: 3 };
    sim.placeBuilding('magic-tower', { x: -13, z: 6 }, 0);
    const enemy = new Zombie('tower-target', { x: -13, z: 3 });
    sim.zombies.push(enemy);
    sim.update(1 / 30);
    expect(sim.towerSystem.projectiles).toHaveLength(1);
    expect(enemy.hp).toBe(100);
    for (let i = 0; i < 300; i++) sim.update(1 / 30);
    expect(sim.phase).toBe('playing');
    expect(enemy.hp).toBe(0);
    expect(sim.totalKills).toBe(1);
    expect(sim.drainEvents().some(event => event.type === 'zombie-hit' && event.source === 'tower')).toBe(true);
    expect(sim.buildingSystem.power.available).toBe(30);
    sim.reset();
    expect(sim.towerSystem.towers.size).toBe(0);
    expect(sim.towerSystem.projectiles).toHaveLength(0);
  });

  it('selects the nearest living visible target, honours power, and respects walls and range', () => {
    const system = new MagicTowerSystem();
    const building = new Building('tower', 'magic-tower', { x: -7, z: -8 }, 0);
    const near = new Zombie('near');
    near.position = { x: -6, z: -6 };
    const far = new Zombie('far');
    far.position = { x: -6, z: -2 };
    system.update(1 / 30, [building], [far, near], 0, () => {});
    expect(system.projectiles).toHaveLength(0);
    for (let i = 0; i < 7; i++) system.update(1 / 30, [building], [far, near], 50, () => {});
    expect(system.towers.get('tower')?.targetId).toBe('near');

    const blocked = new MagicTowerSystem();
    const behindWall = new Zombie('behind-wall');
    behindWall.position = { x: 6, z: 4 };
    blocked.update(1 / 30, [new Building('tower', 'magic-tower', { x: -4, z: 4 }, 0)], [behindWall], 40, () => {});
    expect(blocked.projectiles).toHaveLength(0);
    const outOfRange = new MagicTowerSystem();
    far.position = { x: -6, z: 20 };
    outOfRange.update(1 / 30, [building], [far], 50, () => {});
    expect(outOfRange.projectiles).toHaveLength(0);
  });
});
