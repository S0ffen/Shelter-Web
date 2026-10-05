import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/domain/config';
import { Simulation } from '../src/domain/Simulation';
import { Zombie } from '../src/enemies/Zombie';
import { hasLineOfSight, isBlocked } from '../src/world/WorldLayout';

function advance(sim: Simulation, seconds: number): void {
  for (let step = 0; step < Math.ceil(seconds / CONFIG.simulationStep); step++) sim.update(CONFIG.simulationStep);
}
function isolated(): Simulation { return new Simulation({ settings: { dayPatrolCount: 0, dayDuration: 3600 }, seed: 1 }); }

describe('survival gameplay', () => {
  it('starts with a preparation day and pauses the clock and every enemy', () => {
    const sim = new Simulation({ seed: 1 });
    advance(sim, 10);
    expect(sim.zombies).toHaveLength(0);
    expect(sim.cycle.secondsRemaining).toBe(150);
    sim.start();
    expect(sim.livingZombies).toHaveLength(4);
    expect(sim.livingZombies.every(zombie => zombie.mode === 'patrol')).toBe(true);
    advance(sim, 1);
    sim.pause();
    const positions = sim.zombies.map(zombie => ({ ...zombie.position }));
    advance(sim, 20);
    expect(sim.zombies.map(zombie => zombie.position)).toEqual(positions);
    expect(sim.elapsed).toBeCloseTo(1);
    expect(sim.cycle.secondsRemaining).toBeCloseTo(149);
    sim.start();
    expect(sim.livingZombies).toHaveLength(4);
  });

  it('routes a siege zombie to Shelter and loses when the base is destroyed', () => {
    const sim = isolated();
    sim.start();
    const enemy = new Zombie('siege');
    sim.zombies.push(enemy);
    advance(sim, 80);
    expect(sim.shelter.hp).toBe(0);
    expect(sim.player.hp).toBe(100);
    expect(sim.phase).toBe('lost');
    expect(isBlocked(enemy.position)).toBe(false);
  });

  it('lets a daytime patrol chase and kill a nearby player without attacking Shelter', () => {
    const sim = isolated();
    sim.player.position = { x: -6, z: 14 };
    sim.start();
    const enemy = new Zombie('patrol');
    enemy.mode = 'patrol';
    sim.zombies.push(enemy);
    advance(sim, 20);
    expect(enemy.intent).toBe('player');
    expect(sim.player.hp).toBe(0);
    expect(sim.shelter.hp).toBe(300);
    expect(sim.phase).toBe('lost');
  });

  it('damages the selected enemy, enforces cooldown, and keeps playing after a kill', () => {
    const sim = isolated();
    sim.player.position = { x: -6, z: 13.5 };
    sim.start();
    const target = new Zombie('target');
    const other = new Zombie('other', { x: 18, z: 20 });
    sim.zombies.push(target, other);
    expect(sim.attack(target.id)).toBe(true);
    expect(target.hp).toBe(66);
    expect(other.hp).toBe(100);
    expect(sim.attack(target.id)).toBe(false);
    advance(sim, 0.7);
    sim.attack(target.id);
    expect(target.hp).toBe(32);
    advance(sim, 0.7);
    sim.attack(target.id);
    expect(target.hp).toBe(0);
    expect(sim.totalKills).toBe(1);
    expect(sim.phase).toBe('playing');
    advance(sim, 0.7);
    sim.attack(target.id);
    expect(sim.totalKills).toBe(1);
    expect(sim.livingZombies).toHaveLength(1);
  });

  it('rejects out-of-range attacks and hits through walls', () => {
    const sim = isolated();
    sim.start();
    const enemy = new Zombie('target');
    sim.zombies.push(enemy);
    sim.attack(enemy.id);
    expect(enemy.hp).toBe(100);
    advance(sim, 0.7);
    enemy.position = { x: -1.5, z: 4 };
    sim.player.position = { x: -3.5, z: 4 };
    expect(hasLineOfSight(sim.player.position, enemy.position)).toBe(false);
    sim.attack(enemy.id);
    expect(enemy.hp).toBe(100);
  });

  it('resets the entire run to day one without an enemy or a finished-match screen', () => {
    const sim = isolated();
    sim.start();
    sim.zombies.push(new Zombie('siege'));
    advance(sim, 80);
    sim.reset();
    expect(sim.phase).toBe('ready');
    expect(sim.player.hp).toBe(100);
    expect(sim.shelter.hp).toBe(300);
    expect(sim.zombies).toHaveLength(0);
    expect(sim.cycle.state.day).toBe(1);
    expect(sim.cycle.state.period).toBe('day');
    expect(sim.swordCooldown).toBe(0);
    expect(sim.totalKills).toBe(0);
    expect(sim.drainEvents()).toEqual([]);
  });
});
