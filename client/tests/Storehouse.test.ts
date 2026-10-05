import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { ResourceType } from '../src/resources/ResourceType';
import { Building } from '../src/building/Building';

describe('milestone 4 storehouse', () => {
  it.each(Object.values(ResourceType))('retains %s in its node when that resource storage is full', type => {
    const sim = new Simulation();
    sim.start();
    const node = sim.resourceNodes.find(candidate => candidate.resourceType === type)!;
    sim.resourceManager.add(type, sim.resourceManager.capacity[type]);
    sim.player.position = { x: node.position.x, z: node.position.z - node.definition.depth / 2 - 0.8 };
    // Iron's first sword hit does not cross a threshold; the second must remain pending.
    if (type === ResourceType.Iron) node.damage(34);
    const health = node.health;
    sim.attack(node.id);
    expect(node.health).toBe(health);
    expect(sim.resources[type]).toBe(sim.resourceManager.capacity[type]);
    expect(sim.drainEvents()).toContainEqual({ type: 'storage-full', kind: type, needed: type === ResourceType.Wood ? 3 : 2 });
  });

  it('blocks reward-bearing hits when full and resumes harvesting after building storage', () => {
    const sim = new Simulation();
    sim.start();
    sim.resourceManager.add('wood', 97);
    sim.resourceManager.add('iron', 50);
    const node = sim.resourceNodes[0];
    sim.player.position = { x: node.position.x, z: node.position.z - 1.4 };
    sim.attack(node.id);
    expect(sim.resources.wood).toBe(100);
    expect(node.health).toBe(66);
    for (let i = 0; i < 22; i++) sim.update(1 / 30);
    sim.attack(node.id);
    expect(node.health).toBe(66);
    expect(sim.resources.wood).toBe(100);
    expect(sim.drainEvents()).toContainEqual({ type: 'storage-full', kind: 'wood', needed: 3 });
    sim.player.position = { x: 1.5, z: -7 };
    sim.buildingSystem.buildings.push(new Building('fixture-generator', 'arcane-core', { x: 10, z: 10 }, 0));
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(true);
    expect(sim.resourceManager.capacity).toEqual({ wood: 150, iron: 75 });
    expect(sim.resources.wood).toBe(70);
    sim.player.position = { x: node.position.x, z: node.position.z - 1.4 };
    for (let i = 0; i < 2; i++) { for (let step = 0; step < 22; step++) sim.update(1 / 30); sim.attack(node.id); }
    expect(sim.resources.wood).toBe(81);
    expect(node.isDestroyed).toBe(true);
    sim.reset();
    expect(sim.resourceManager.capacity.wood).toBe(100);
  });

  it('does not consume a partial destruction reward when the remaining capacity is too small', () => {
    const sim = new Simulation();
    sim.start();
    const node = sim.resourceNodes[0];
    node.damage(68);
    sim.resourceManager.add('wood', 95);
    sim.player.position = { x: node.position.x, z: node.position.z - 1.4 };
    sim.attack(node.id);
    expect(node.health).toBe(32);
    expect(sim.resources.wood).toBe(95);
    expect(sim.drainEvents()).toContainEqual({ type: 'storage-full', kind: 'wood', needed: 8 });
  });
});
