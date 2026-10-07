import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { GENERATOR_PADS, BASE_BOUNDS, SHELTER_CORE, SHELTER_HALL, SHELTER_ENTRY, inHall } from '../src/world/ShelterLayout';
import { isBlocked, hasLineOfSight } from '../src/world/WorldLayout';
import { shelterGuide } from '../src/ui/ShelterGuide';
import { MagicTowerSystem } from '../src/building/MagicTowerSystem';
import { Building } from '../src/building/Building';
import { Zombie } from '../src/enemies/Zombie';

describe('Shelter courtyard and guidance', () => {
  it('keeps the entrance and a path around the central pillar walkable while walls and the pillar stay solid', () => {
    for (let z = -19; z <= 2.5; z += .25) expect(isBlocked({ x: 1.5, z }, .32)).toBe(false);
    expect(inHall({ x: 1.5, z: 1.5 })).toBe(true);
    expect(isBlocked(SHELTER_CORE, .32)).toBe(true);
    expect(isBlocked({ x: SHELTER_HALL.x - SHELTER_HALL.width / 2, z: 4 }, .32)).toBe(true);
    expect(isBlocked({ x: BASE_BOUNDS.maxX, z: -12 }, .32)).toBe(true);
    for (let z = 1.5; z <= 7; z += .25) expect(isBlocked({ x: -1, z }, .32)).toBe(false);
  });
  it('can freely build ten defense towers around the enlarged hall without blocking routes to its pillar', () => {
    const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
    for (const point of GENERATOR_PADS.slice(0, 3)) {
      sim.player.position = { x: point.x + 2.5, z: point.z };
      sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
      expect(sim.placeBuilding('arcane-core', point, 0).ok, JSON.stringify(point)).toBe(true);
    }
    for (const point of [{x:-7,z:12},{x:-7,z:15},{x:-7,z:-12},{x:-7,z:-8},{x:10,z:-12},{x:10,z:-8},{x:10,z:11},{x:10,z:15},{x:-13,z:-6},{x:16,z:-6}]) {
      sim.player.position = { x: point.x + 2.5, z: point.z };
      sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
      expect(sim.placeBuilding('magic-tower', point, 0).ok, JSON.stringify(point)).toBe(true);
    }
    expect(sim.buildingSystem.buildings.filter(building => building.kind === 'magic-tower')).toHaveLength(10);
    expect(sim.buildingSystem.power).toEqual({ generated: 120, used: 100, available: 20 });
  });
  it('lets tower shots clear a low perimeter wall while it still blocks movement and eye-level sight', () => {
    const tower = new Building('tower', 'magic-tower', { x: 17, z: 8 }, 0);
    const enemy = new Zombie('outside', { x: 23, z: 8 });
    expect(hasLineOfSight(tower.position, enemy.position)).toBe(false);
    const system = new MagicTowerSystem();
    system.update(1 / 30, [tower], [enemy], 40, () => {});
    expect(system.towers.get('tower')!.targetId).toBe(enemy.id);
    expect(system.projectiles).toHaveLength(1);
  });
  it('points toward the entrance relative to the camera, including when the base is behind', () => {
    expect(shelterGuide({ x: SHELTER_ENTRY.x, z: -20 }, 0).angle).toBeCloseTo(0);
    expect(Math.abs(shelterGuide({ x: SHELTER_ENTRY.x, z: -20 }, Math.PI).angle)).toBeCloseTo(180);
    const east = shelterGuide({ x: -25, z: SHELTER_ENTRY.z }, 0);
    expect(east.angle).toBeCloseTo(90); expect(east.meters).toBe(27);
    expect(east.hint).toContain('Wróć do bazy');
  });
  it('identifies the courtyard separately from the accessible Shelter interior', () => {
    expect(shelterGuide({ x: 1.5, z: -7 }, 0).hint).toContain('Teren bazy');
    const inside = shelterGuide({ x: 1.5, z: 4 }, 0);
    expect(inside.inside).toBe(true); expect(inside.meters).toBe(0);
    expect(inside.label).toBe('WEWNĄTRZ SHELTERU');
  });
});
