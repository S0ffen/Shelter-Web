import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Building, buildingMaxHp } from '../src/building/Building';
import { GENERATOR_PADS } from '../src/world/ShelterLayout';
import { createResourceNodes } from '../src/resources/ResourceNode';

const start = () => {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } });
  sim.start();
  Object.assign(sim.resources, { wood: 500, iron: 500 });
  return sim;
};
const generator = (sim: Simulation, index: number, level = 1) => {
  const building = new Building('generator-' + index, 'arcane-core', GENERATOR_PADS[index], 0, 1, level);
  sim.buildingSystem.buildings.push(building);
  return building;
};
const approach = (sim: Simulation, building: Building) => {
  sim.player.position = { x: building.position.x + 3, z: building.position.z };
};

describe('original Shelter electricity and generator tiers', () => {
  it('reserves twelve Power per tower and ten per warehouse before spending materials', () => {
    const sim = start();
    expect(createResourceNodes().every(node => ['wood', 'iron'].includes(node.resourceType))).toBe(true);
    sim.player.position = { x: -15, z: 3 };
    expect(sim.placeBuilding('magic-tower', { x: -13, z: 6 }, 0).ok).toBe(false);
    for (const [index, pad] of GENERATOR_PADS.slice(0, 3).entries()) {
      sim.player.position = { x: pad.x + 3, z: pad.z };
      expect(sim.placeBuilding('arcane-core', pad, 0).ok).toBe(true);
      expect(sim.buildingSystem.power.generated).toBe((index + 1) * 10);
    }
    sim.player.position = { x: -15, z: 3 };
    expect(sim.placeBuilding('magic-tower', { x: -13, z: 6 }, 0).ok).toBe(true);
    sim.player.position = { x: 1.5, z: -7 };
    expect(sim.placeBuilding('storehouse', { x: -4, z: -7 }, 0).ok).toBe(true);
    expect(sim.buildingSystem.power).toEqual({ generated: 30, used: 22, available: 8 });
    sim.player.position = { x: -15, z: 3 };
    const funds = [{ ...sim.resources }, { ...sim.carried }];
    expect(sim.placeBuilding('magic-tower', { x: -17, z: 6 }, 0).ok).toBe(false);
    expect([sim.resources, sim.carried]).toEqual(funds);
    sim.reset();
    expect(sim.buildingSystem.power).toEqual({ generated: 0, used: 0, available: 0 });
  });

  it('charges each generator its next tier and preserves wounds without upgrading its neighbours', () => {
    const sim = start();
    sim.shelter.level = 4;
    sim.applySkillBonuses();
    const first = generator(sim, 0), second = generator(sim, 1);
    first.damage(125);
    approach(sim, first);
    expect(first.maxHp).toBe(1000);
    expect(sim.buildingSystem.costFor('arcane-core')).toEqual({ wood: 5, iron: 5 });
    for (const [level, cost, maxHp, output] of [
      [2, { wood: 9, iron: 9 }, 1500, 15],
      [3, { wood: 15, iron: 13 }, 2000, 25],
      [4, { wood: 20, iron: 22 }, 2500, 130],
    ] as const) {
      const before = { ...sim.resources };
      sim.upgradeGenerator(first.id);
      expect(first.level).toBe(level);
      expect(first.maxHp).toBe(maxHp);
      expect(first.hp).toBe(maxHp - 125);
      expect(buildingMaxHp('arcane-core', level)).toBe(maxHp);
      expect(sim.resources).toEqual({ wood: before.wood - cost.wood, iron: before.iron - cost.iron });
      expect(sim.buildingSystem.power.generated).toBe(output + 10);
      expect(second.level).toBe(1);
      expect(second.maxHp).toBe(1000);
    }
    const funds = { ...sim.resources };
    sim.upgradeGenerator(first.id);
    expect(first.level).toBe(4);
    expect(sim.resources).toEqual(funds);
  });

  it('unlocks technology with the core while requiring each generator to be upgraded deliberately', () => {
    const sim = start(), first = generator(sim, 0), second = generator(sim, 1);
    sim.player.position = { x: 1.5, z: 1.5 };
    sim.improveShelter();
    expect(sim.shelter.level).toBe(2);
    expect(sim.buildingSystem.generatorLevel).toBe(2);
    expect([first.level, second.level]).toEqual([1, 1]);
    expect(sim.buildingSystem.power.generated).toBe(20);
    approach(sim, first);
    sim.upgradeGenerator(first.id);
    expect([first.level, second.level]).toEqual([2, 1]);
    expect(sim.buildingSystem.power.generated).toBe(25);
    const before = [{ ...sim.resources }, { ...sim.carried }];
    sim.upgradeGenerator(first.id);
    expect(first.level).toBe(2);
    expect([sim.resources, sim.carried]).toEqual(before);
    sim.player.position = { x: GENERATOR_PADS[2].x + 3, z: GENERATOR_PADS[2].z };
    const placed = sim.placeBuilding('arcane-core', GENERATOR_PADS[2], 0);
    expect(placed.ok).toBe(true);
    if (placed.ok) expect([placed.building.level, placed.building.maxHp]).toEqual([1, 1000]);
  });

  it.each(['far', 'paused', 'dead', 'outside', 'wrong-kind', 'missing', 'destroyed'] as const)(
    'rejects a generator upgrade when the target is %s without charging either inventory', mode => {
      const sim = start();
      sim.shelter.level = 2;
      sim.applySkillBonuses();
      const building = generator(sim, 0);
      approach(sim, building);
      let target: string | null = building.id;
      if (mode === 'far') sim.player.position = { x: building.position.x + 5, z: building.position.z };
      if (mode === 'outside') sim.player.position = { x: -28, z: building.position.z };
      if (mode === 'paused') sim.pause();
      if (mode === 'dead') sim.player.hp = 0;
      if (mode === 'destroyed') building.hp = 0;
      if (mode === 'missing') target = null;
      if (mode === 'wrong-kind') {
        const tower = new Building('tower', 'magic-tower', { x: -13, z: 6 }, 0);
        sim.buildingSystem.buildings.push(tower);
        approach(sim, tower);
        target = tower.id;
      }
      Object.assign(sim.carried, { wood: 3, iron: 4 });
      const before = [{ ...sim.resources }, { ...sim.carried }];
      sim.upgradeGenerator(target);
      expect(building.level).toBe(1);
      expect([sim.resources, sim.carried]).toEqual(before);
    },
  );

  it('keeps core upgrades atomic when reserved consumers leave too little Power', () => {
    const sim = start();
    for (let index = 0; index < 3; index++) generator(sim, index);
    sim.buildingSystem.buildings.push(new Building('warehouse', 'storehouse', { x: -4, z: -7 }, 0));
    sim.buildingSystem.buildings.push(new Building('tower', 'magic-tower', { x: -13, z: 6 }, 0));
    sim.player.position = { x: 1.5, z: 1.5 };
    sim.shelter.damage(250);
    Object.assign(sim.carried, { wood: 7, iron: 11 });
    const before = [{ ...sim.resources }, { ...sim.carried }];
    expect(sim.buildingSystem.power.available).toBe(8);
    sim.improveShelter();
    expect([sim.shelter.level, sim.shelter.hp, sim.shelter.maxHp]).toEqual([1, 1000, 1250]);
    expect([sim.resources, sim.carried]).toEqual(before);
    generator(sim, 3);
    sim.improveShelter();
    expect([sim.shelter.level, sim.shelter.hp, sim.shelter.maxHp]).toEqual([2, 1850, 2100]);
    expect(sim.carried).toEqual({ wood: 0, iron: 0 });
    expect(sim.resources).toEqual({ wood: 467, iron: 476 });
    expect(sim.buildingSystem.power).toEqual({ generated: 40, used: 37, available: 3 });
  });

  it('checks only the additional core demand when expanding an already powered core', () => {
    const sim = start();
    sim.shelter.level = 2;
    sim.applySkillBonuses();
    generator(sim, 0, 2); generator(sim, 1, 2); generator(sim, 2, 2);
    sim.buildingSystem.buildings.push(new Building('warehouse', 'storehouse', { x: -4, z: -7 }, 0));
    sim.buildingSystem.buildings.push(new Building('tower', 'magic-tower', { x: -13, z: 6 }, 0));
    sim.player.position = { x: 1.5, z: 1.5 };
    expect(sim.buildingSystem.power).toEqual({ generated: 45, used: 37, available: 8 });
    sim.improveShelter();
    expect(sim.shelter.level).toBe(3);
    expect(sim.resources).toEqual({ wood: 430, iron: 430 });
    expect(sim.buildingSystem.power).toEqual({ generated: 45, used: 42, available: 3 });
  });

  it('reserves core and warehouse Power before tower shots during a blackout', () => {
    const sim = start();
    sim.shelter.level = 3;
    sim.applySkillBonuses();
    const first = generator(sim, 0, 3), second = generator(sim, 1, 3);
    const warehouse = new Building('warehouse', 'storehouse', { x: -4, z: -7 }, 0);
    const tower = new Building('tower', 'magic-tower', { x: -13, z: 6 }, 0);
    sim.buildingSystem.buildings.push(warehouse, tower);
    expect(sim.buildingSystem.towerPowerBudget).toBe(20);
    sim.update(1 / 30);
    expect(sim.towerSystem.towers.get(tower.id)?.powered).toBe(true);
    second.damage(second.maxHp);
    sim.update(1 / 30);
    expect(first.alive).toBe(true);
    expect(sim.buildingSystem.power).toEqual({ generated: 25, used: 42, available: -17 });
    expect(sim.buildingSystem.towerPowerBudget).toBe(0);
    expect(sim.towerSystem.towers.get(tower.id)?.powered).toBe(false);
    expect(sim.resourceManager.capacity).toEqual({ wood: 150, iron: 75 });
  });
  it('applies Engineer bonuses to the actual generator tier without changing core demand or healing wounds', () => {
    const sim = start();
    sim.shelter.level = 2; sim.shelter.hp = 2100; sim.applySkillBonuses();
    const first = generator(sim, 0, 2), second = generator(sim, 1);
    first.damage(100); second.damage(100);
    sim.buildingSystem.buildings.push(
      new Building('warehouse', 'storehouse', { x: -4, z: -7 }, 0),
      new Building('tower', 'magic-tower', { x: -13, z: 6 }, 0),
    );
    sim.cycle.state.day = 100; sim.skills.points = 102;
    for (const id of ['beginner-engineer', 'blueprint', 'intermediate-engineer', 'electrical', 'expert-engineer'])
      for (let rank = 1; rank <= 3; rank++) {
        sim.purchaseSkill(id);
        expect(sim.skills.levels[id]).toBe(rank);
      }
    expect([first.maxHp, first.hp, second.maxHp, second.hp]).toEqual([2850, 2750, 1900, 1800]);
    expect([sim.shelter.maxHp, sim.shelter.hp]).toEqual([2100, 2100]);
    expect(sim.buildingSystem.costFor('arcane-core', 3)).toEqual({ wood: 13, iron: 12 });
    expect(sim.buildingSystem.costFor('storehouse')).toEqual({ wood: 11, iron: 6 });
    expect(sim.buildingSystem.power).toEqual({ generated: 29, used: 31, available: -2 });
    expect(sim.buildingSystem.coreDemand()).toBe(15);
    expect(sim.buildingSystem.demand('storehouse')).toBe(7);
    expect(sim.buildingSystem.demand('magic-tower')).toBe(9);
    sim.shelter.level = 3; sim.applySkillBonuses();
    Object.assign(sim.resources, { wood: 100, iron: 100 }); approach(sim, first);
    sim.upgradeGenerator(first.id);
    expect([first.level, first.maxHp, first.hp]).toEqual([3, 3800, 3700]);
    expect([second.level, second.maxHp, second.hp]).toEqual([1, 1900, 1800]);
    expect(sim.resources).toEqual({ wood: 87, iron: 88 });
    expect(sim.buildingSystem.power).toEqual({ generated: 41, used: 36, available: 5 });
  });

});