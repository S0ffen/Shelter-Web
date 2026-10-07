import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building } from '../src/building/Building';
import { createResourceNodes } from '../src/resources/ResourceNode';

describe('Arcane is generator power', () => {
  it('has no collectible Arcane and powers storage and towers without draining on shots or time', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
    sim.start(); sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    expect(createResourceNodes().every(node => ['wood','iron'].includes(node.resourceType))).toBe(true);
    expect(Object.keys(sim.resources)).toEqual(['wood','iron']);
    sim.player.position = { x: -6, z: -7 };
    expect(sim.placeBuilding('magic-tower', { x: -9, z: -9 }, 0)).toEqual({ ok: false, reason: 'Brak mocy Arcane — najpierw zbuduj generator' });
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(false);
    expect(sim.resources.wood).toBe(100);
    expect((sim.player.position = { x: -10, z: -13 }, sim.placeBuilding('arcane-core', { x: -13, z: -13 }, 0)).ok).toBe(true);
    expect(sim.buildingSystem.power).toEqual({ generated: 40, used: 0, available: 40 });
    sim.player.position = { x: -15, z: 3 };
    expect(sim.placeBuilding('magic-tower', { x: -13, z: 6 }, 0).ok).toBe(true);
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    sim.player.position = { x: -4, z: -8 };
    expect(sim.placeBuilding('storehouse', { x: -4, z: -10 }, 0).ok).toBe(true);
    expect(sim.buildingSystem.power).toEqual({ generated: 40, used: 15, available: 25 });
    for (let i = 0; i < 120; i++) sim.update(1 / 30);
    expect(sim.buildingSystem.power.available).toBe(25);
    sim.reset(); expect(sim.buildingSystem.power.generated).toBe(0);
  });

  it('refuses another powered construction when generation is fully allocated', () => {
    const sim = new Simulation(); sim.start();
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    sim.buildingSystem.buildings.push(new Building('core', 'arcane-core', { x: 10, z: 10 }, 0));
    for (let i = 0; i < 4; i++) sim.buildingSystem.buildings.push(new Building(`tower-${i}`, 'magic-tower', { x: 12, z: i * 3 }, 0));
    expect(sim.buildingSystem.power.available).toBe(0);
    expect(sim.placeBuilding('magic-tower', { x: -4, z: -7 }, 0).ok).toBe(false);
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(false);
    expect(sim.resources.wood).toBe(100);
  });
});

