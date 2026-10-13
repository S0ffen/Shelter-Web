import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building } from '../src/building/Building';
import { GENERATOR_PADS } from '../src/world/ShelterLayout';
import { resourceFunding } from '../src/resources/ResourceBudget';

it.each([
  [{ wood: 10, iron: 10 }, { wood: 0, iron: 0 }, { wood: 5, iron: 5 }, { wood: 0, iron: 0 }],
  [{ wood: 0, iron: 0 }, { wood: 10, iron: 10 }, { wood: 0, iron: 0 }, { wood: 5, iron: 5 }],
  [{ wood: 2, iron: 5 }, { wood: 10, iron: 10 }, { wood: 0, iron: 0 }, { wood: 7, iron: 10 }],
])('builds atomically from the backpack, bank, or their combined materials', (carried, bank, afterCarried, afterBank) => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
  sim.start(); Object.assign(sim.carried, carried); Object.assign(sim.resources, bank);
  sim.player.position = { x: GENERATOR_PADS[0].x + 3, z: GENERATOR_PADS[0].z };
  expect(resourceFunding({ wood: 5, iron: 5 }, sim.resourceManager, sim.carriedManager).affordable).toBe(true);
  expect(sim.placeBuilding('arcane-core', GENERATOR_PADS[0], 0).ok).toBe(true);
  expect(sim.carried).toEqual(afterCarried); expect(sim.resources).toEqual(afterBank);
  const held = { ...sim.carried }, stored = { ...sim.resources };
  expect(sim.placeBuilding('arcane-core', GENERATOR_PADS[0], 0).ok).toBe(false);
  expect(sim.carried).toEqual(held); expect(sim.resources).toEqual(stored);
});

it('keeps both inventories intact when one material is missing or power is insufficient', () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
  sim.start(); sim.carried.wood = 4; sim.resources.wood = 10; sim.carried.iron = 1; sim.resources.iron = 2;
  sim.player.position = { x: GENERATOR_PADS[0].x + 3, z: GENERATOR_PADS[0].z };
  const before = [{ ...sim.carried }, { ...sim.resources }];
  expect(sim.placeBuilding('arcane-core', GENERATOR_PADS[0], 0).ok).toBe(false);
  expect([sim.carried, sim.resources]).toEqual(before);
  sim.carried.iron = 10; sim.player.position = { x: -15, z: 3 };
  const enough = [{ ...sim.carried }, { ...sim.resources }];
  expect(sim.placeBuilding('magic-tower', { x: -13, z: 6 }, 0).ok).toBe(false);
  expect([sim.carried, sim.resources]).toEqual(enough);
});

describe('upgrade material sources', () => {
  it.each([
    [{ wood: 9, iron: 9 }, { wood: 0, iron: 0 }, { wood: 0, iron: 0 }],
    [{ wood: 0, iron: 0 }, { wood: 9, iron: 9 }, { wood: 0, iron: 0 }],
    [{ wood: 3, iron: 4 }, { wood: 10, iron: 10 }, { wood: 4, iron: 5 }],
  ])('pays the full generator tier from personal materials before the warehouse', (carried, bank, afterBank) => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
    sim.start(); sim.shelter.level = 2; sim.applySkillBonuses();
    const generator = new Building('generator', 'arcane-core', GENERATOR_PADS[0], 0);
    sim.buildingSystem.buildings.push(generator);
    sim.player.position = { x: generator.position.x + 3, z: generator.position.z };
    Object.assign(sim.carried, carried); Object.assign(sim.resources, bank);
    sim.upgradeGenerator(generator.id);
    expect(generator.level).toBe(2);
    expect(sim.carried).toEqual({ wood: 0, iron: 0 });
    expect(sim.resources).toEqual(afterBank);
  });

  it('does not partially pay an unaffordable generator upgrade', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
    sim.start(); sim.shelter.level = 2; sim.applySkillBonuses();
    const generator = new Building('generator', 'arcane-core', GENERATOR_PADS[0], 0);
    sim.buildingSystem.buildings.push(generator);
    sim.player.position = { x: generator.position.x + 3, z: generator.position.z };
    Object.assign(sim.carried, { wood: 3, iron: 4 }); Object.assign(sim.resources, { wood: 10, iron: 4 });
    const before = [{ ...sim.carried }, { ...sim.resources }];
    sim.upgradeGenerator(generator.id);
    expect([generator.level, generator.hp, generator.maxHp]).toEqual([1, 1000, 1000]);
    expect([sim.carried, sim.resources]).toEqual(before);
  });

  it('pays a core upgrade from the combined backpack and bank only when both materials suffice', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
    for (let index = 0; index < 2; index++)
      sim.buildingSystem.buildings.push(new Building('generator-' + index, 'arcane-core', GENERATOR_PADS[index], 0));
    sim.player.position = { x: 1.5, z: 1.5 };
    Object.assign(sim.carried, { wood: 30, iron: 20 }); Object.assign(sim.resources, { wood: 15, iron: 14 });
    const before = [{ ...sim.carried }, { ...sim.resources }];
    sim.improveShelter();
    expect(sim.shelter.level).toBe(1);
    expect([sim.carried, sim.resources]).toEqual(before);
    sim.resources.iron = 20;
    sim.improveShelter();
    expect(sim.shelter.level).toBe(2);
    expect(sim.carried).toEqual({ wood: 0, iron: 0 });
    expect(sim.resources).toEqual({ wood: 5, iron: 5 });
    expect(sim.buildingSystem.power).toEqual({ generated: 20, used: 15, available: 5 });
  });
});