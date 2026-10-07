import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { ResourceNode } from '../src/resources/ResourceNode';
import { ResourceType } from '../src/resources/ResourceType';

function advance(sim: Simulation): void { for (let i = 0; i < 22; i++) sim.update(1 / 30); }

describe('milestone 6.5 harvesting', () => {
  it('reduces node health, clamps it to zero, and rejects damage after destruction', () => {
    const node = new ResourceNode('wood', ResourceType.Wood, { x: 0, z: 0 });
    node.damage(34);
    expect(node.health).toBe(66);
    expect(node.damage(1000).destroyed).toBe(true);
    expect(node.health).toBe(0);
    expect(node.damage(34)).toEqual({ damage: 0, reward: 0, destroyed: true });
  });

  it('rewards each threshold once, including the destruction reward', () => {
    const node = new ResourceNode('wood', ResourceType.Wood, { x: 0, z: 0 });
    expect(node.damage(24).reward).toBe(0);
    expect(node.damage(1).reward).toBe(3);
    expect(node.damage(1).reward).toBe(0);
    expect(node.damage(24).reward).toBe(3);
    expect(node.damage(25).reward).toBe(3);
    expect(node.damage(100).reward).toBe(5);
    expect(node.damage(100).reward).toBe(0);
    expect(node.health).toBe(0);
  });

  it('accounts for multiple crossed thresholds and rejects invalid damage', () => {
    const node = new ResourceNode('wood', ResourceType.Wood, { x: 0, z: 0 });
    for (const amount of [-1, 0, NaN, Infinity]) expect(node.damage(amount).damage).toBe(0);
    expect(node.health).toBe(100);
    expect(node.previewDamage(1000).reward).toBe(14);
    expect(node.health).toBe(100);
    expect(node.damage(1000).reward).toBe(14);
    expect(node.damage(1000).reward).toBe(0);
  });

  it.each([[ResourceType.Wood, 14], [ResourceType.Iron, 8]] as const)
  ('routes %s to its own counter over multiple sword hits', (type, total) => {
    const sim = new Simulation();
    const node = sim.resourceNodes.find(candidate => candidate.resourceType === type)!;
    sim.player.position = { x: node.position.x, z: node.position.z - node.definition.depth / 2 - 0.8 };
    sim.start();
    sim.attack(node.id);
    expect(node.isDestroyed).toBe(false);
    expect(sim.attack(node.id)).toBe(false);
    advance(sim);
    for (let i = 0; !node.isDestroyed && i < 10; i++) { sim.attack(node.id); advance(sim); }
    expect(node.isDestroyed).toBe(true);
    expect(sim.carried[type]).toBe(total);
    for (const other of Object.values(ResourceType)) if (other !== type) expect(sim.carried[other]).toBe(0);
    sim.attack(node.id);
    expect(sim.carried[type]).toBe(total);
    expect(sim.buildingSystem.power.generated).toBe(0);
  });

  it('rejects attacks outside play, outside melee range, or through a wall', () => {
    const sim = new Simulation();
    const node = sim.resourceNodes[0];
    expect(sim.attack(node.id)).toBe(false);
    sim.start();
    sim.attack('iron-forge-01');
    expect(sim.resourceNodes.find(candidate => candidate.id === 'iron-forge-01')!.health).toBe(160);
    advance(sim);
    sim.pause();
    expect(sim.attack(node.id)).toBe(false);
    sim.start();
    node.position.x = -18.5;
    node.position.z = -12;
    sim.player.position = { x: -16.5, z: -12 };
    sim.attack(node.id);
    expect(node.health).toBe(100);
    expect(sim.resources.wood).toBe(0);
  });

  it('respawns only nodes when a night ends and the next preparation day starts', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
    sim.start();
    const node = sim.resourceNodes[0];
    node.damage(1000);
    sim.resourceManager.add('wood', 14);
    sim.cycle.state.period = 'night';
    sim.cycle.state.pendingSpawns = 0;
    sim.cycle.state.periodElapsed = sim.cycle.settings.nightDuration;
    advance(sim);
    expect(sim.cycle.state.day).toBe(2);
    expect(sim.phase).toBe('playing');
    expect(node.health).toBe(100);
    expect(sim.resources.wood).toBe(14);
    expect(sim.zombies).toHaveLength(0);
    sim.pause(); sim.start();
    expect(node.health).toBe(100);
    sim.reset();
    expect(sim.resourceNodes[0].health).toBe(100);
    expect(sim.resources.wood).toBe(0);
  });
});
