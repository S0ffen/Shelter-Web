import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { TOWER_PADS, SHELTER_HALL, SHELTER_ENTRY, inHall } from '../src/world/ShelterLayout';
import { isBlocked, hasLineOfSight } from '../src/world/WorldLayout';
import { shelterGuide } from '../src/ui/ShelterGuide';
import { MagicTowerSystem } from '../src/building/MagicTowerSystem';
import { Building } from '../src/building/Building';
import { Zombie } from '../src/enemies/Zombie';

describe('Shelter courtyard and guidance', () => {
  it('keeps the full entrance and interior walkable while walls block the player', () => {
    for (let z = -15; z <= 6; z += 0.25) expect(isBlocked({ x: 1.5, z }, 0.32)).toBe(false);
    expect(inHall({ x: 1.5, z: 4 })).toBe(true);
    expect(isBlocked({ x: SHELTER_HALL.x - SHELTER_HALL.width / 2, z: 4 }, 0.32)).toBe(true);
    expect(isBlocked({ x: 15.5, z: -8 }, 0.32)).toBe(true);
  });
  it('can build ten defense towers on both sides without blocking city routes', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
    for (const point of [{ x: -6, z: -10 }, { x: -3.5, z: -10 }, { x: 7, z: -10 }]) {
      sim.player.position = { x: point.x, z: point.z + 2.5 };
      sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
      expect(sim.placeBuilding('arcane-core', point, 0).ok, JSON.stringify(point)).toBe(true);
    }
    for (const pad of TOWER_PADS) {
      sim.player.position = { x: pad.x - 2.5, z: pad.z };
      sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
      expect(sim.placeBuilding('magic-tower', pad, 0).ok, JSON.stringify(pad)).toBe(true);
    }
    expect(sim.buildingSystem.buildings.filter(building => building.kind === 'magic-tower')).toHaveLength(10);
    expect(sim.buildingSystem.power).toEqual({ generated: 120, used: 100, available: 20 });
  });
  it('lets tower shots clear a low perimeter wall while it still blocks movement and eye-level sight', () => {
    const tower = new Building('tower', 'magic-tower', { x: 12, z: 8 }, 0);
    const enemy = new Zombie('outside', { x: 18, z: 8 });
    expect(hasLineOfSight(tower.position, enemy.position)).toBe(false);
    const system = new MagicTowerSystem();
    system.update(1 / 30, [tower], [enemy], 40, () => {});
    expect(system.towers.get('tower')!.targetId).toBe(enemy.id);
    expect(system.projectiles).toHaveLength(1);
  });
  it('points toward the entrance relative to the camera, including when the base is behind', () => {
    expect(shelterGuide({ x: SHELTER_ENTRY.x, z: -20 }, 0).angle).toBeCloseTo(0);
    expect(Math.abs(shelterGuide({ x: SHELTER_ENTRY.x, z: -20 }, Math.PI).angle)).toBeCloseTo(180);
    const east = shelterGuide({ x: -20, z: SHELTER_ENTRY.z }, 0);
    expect(east.angle).toBeCloseTo(90); expect(east.meters).toBe(22);
    expect(east.hint).toContain('Wróć do bazy');
  });
  it('identifies the courtyard separately from the accessible Shelter interior', () => {
    expect(shelterGuide({ x: 1.5, z: -7 }, 0).hint).toContain('Teren bazy');
    const inside = shelterGuide({ x: 1.5, z: 4 }, 0);
    expect(inside.inside).toBe(true); expect(inside.meters).toBe(0);
    expect(inside.label).toBe('WEWNĄTRZ SHELTERU');
  });
});
