import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building, footprint } from '../src/building/Building';
import { ResourceNode } from '../src/resources/ResourceNode';
import { ResourceType } from '../src/resources/ResourceType';

function prepared(): Simulation {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
  sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
  sim.resourceNodes.forEach(node => node.damage(node.maxHealth)); sim.start();
  sim.buildingSystem.buildings.push(new Building('fixture-generator', 'arcane-core', { x: 10, z: 10 }, 0));
  return sim;
}
describe('construction confined to Shelter', () => {
  it('spends once on a valid base placement and rejects overlap without charging', () => {
    const sim = prepared();
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(true);
    expect(sim.resources).toEqual({ wood: 70, iron: 40 });
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(false);
    expect(sim.resources.wood).toBe(70);
    expect(sim.buildingSystem.buildings).toHaveLength(2);
  });
  it('rejects outside territory, footprint crossing its border, and a builder outside the base', () => {
    const sim = prepared();
    sim.player.position = { x: 15, z: -4 };
    expect(sim.placeBuilding('arcane-core', { x: 18, z: -4 }, 0).ok).toBe(false);
    expect(sim.placeBuilding('arcane-core', { x: 15, z: -7 }, 0).ok).toBe(false);
    sim.player.position = { x: 16, z: -4 };
    expect(sim.placeBuilding('arcane-core', { x: 12, z: -1 }, 0).ok).toBe(false);
    expect(sim.resources).toEqual({ wood: 100, iron: 50 });
  });
  it('protects hall interior, entrance and all gate passages', () => {
    const sim = prepared();
    for (const position of [{ x: 1.5, z: 4 }, { x: 1.5, z: -1 }, { x: 1.5, z: -11 }, { x: -10, z: -4 }, { x: 13, z: -4 }, { x: 1.5, z: 11 }]) {
      sim.player.position = { x: position.x + 2, z: position.z };
      expect(sim.placeBuilding('arcane-core', position, 0).ok, JSON.stringify(position)).toBe(false);
    }
    expect(sim.resources.wood).toBe(100);
  });
  it('rejects player, zombie, resource, distance, insufficient funds and pause', () => {
    const sim = prepared();
    expect(sim.placeBuilding('storehouse', sim.player.position, 0).ok).toBe(false);
    sim.zombies.push({ position: { x: -4, z: -7 }, alive: true } as never);
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(false);
    sim.zombies = [];
    sim.resourceNodes[0] = new ResourceNode('blocking-wood', ResourceType.Wood, { x: -4, z: -7 });
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(false);
    sim.resourceNodes[0].damage(1000);
    expect(sim.placeBuilding('storehouse', { x: 12, z: 8 }, 0).ok).toBe(false);
    sim.resources.wood = 0;
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(false);
    sim.pause();
    expect(sim.placeBuilding('arcane-core', { x: -4, z: -7 }, 0).ok).toBe(false);
    expect(sim.resources.iron).toBe(50);
  });
  it('rotates footprints and removes the entire infrastructure on restart', () => {
    expect(footprint('storehouse', { x: 0, z: 0 }, Math.PI / 2).width).toBeCloseTo(2.2);
    expect(footprint('storehouse', { x: 0, z: 0 }, Math.PI / 2).depth).toBeCloseTo(2.8);
    const sim = prepared(); sim.placeBuilding('storehouse', { x: -4, z: -7 }, Math.PI / 2);
    sim.reset(); expect(sim.buildingSystem.buildings).toHaveLength(0); expect(sim.resources.wood).toBe(0);
  });
});

