import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Simulation } from '../src/domain/Simulation';
import { CONFIG } from '../src/domain/config';
import { Zombie } from '../src/enemies/Zombie';
import { SceneManager } from '../src/core/SceneManager';
import { InputManager } from '../src/core/InputManager';
import { PlayerController } from '../src/player/PlayerController';
import { combatTarget } from '../src/player/CombatTarget';
import { Vector3 } from '../src/rendering/babylon';
import { NavigationGrid, SPAWN_AREAS } from '../src/world/NavigationGrid';
import { BASE_BOUNDS, SHELTER_CORE, SHELTER_CORE_ID, inHall } from '../src/world/ShelterLayout';
import { CITY_RUINS, SHELTER_CLEARING, isBlocked } from '../src/world/WorldLayout';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';

const advance = (sim: Simulation, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 30); i++) sim.update(1 / 30);
};
const prepared = () => {
  const sim = new Simulation({ seed: 42, settings: { dayPatrolCount: 0, dayDuration: 3600 } });
  sim.start(); return sim;
};
afterEach(() => vi.unstubAllGlobals());

describe('central Shelter core and two melee attacks', () => {
  it('routes all spawn areas through the entrance to a reachable face of the pillar', () => {
    const sim = prepared(), grid = new NavigationGrid(sim.obstacles);
    for (const point of SPAWN_AREAS) {
      const route = grid.routeFrom(point);
      expect(route.length, JSON.stringify(point)).toBeGreaterThan(0);
      expect(inHall(route.at(-1)!)).toBe(true);
      expect(sim.shelter.distanceFrom(route.at(-1)!)).toBeLessThanOrEqual(CONFIG.shelter.attackRange);
      let previous = point;
      for (const waypoint of route) {
        expect(grid.canWalk(previous, waypoint)).toBe(true); previous = waypoint;
      }
    }
  });

  it('does not damage the hall from outside and only attacks after reaching the pillar inside', () => {
    const sim = prepared(); sim.player.position = { x: 16, z: -13 };
    const enemy = new Zombie('siege', { x: 1.5, z: 9.8 }); sim.zombies.push(enemy);
    advance(sim, 1); expect(sim.shelter.hp).toBe(300);
    let hits = 0;
    for (let i = 0; i < 2700 && sim.phase === 'playing'; i++) {
      sim.update(1 / 30);
      for (const event of sim.drainEvents()) if (event.type === 'shelter-hit') {
        hits++; expect(inHall(enemy.position)).toBe(true);
        expect(sim.shelter.distanceFrom(enemy.position)).toBeLessThanOrEqual(CONFIG.shelter.attackRange);
      }
    }
    expect(hits).toBeGreaterThan(0); expect(sim.shelter.hp).toBe(0);
    expect(sim.player.hp).toBe(100); expect(isBlocked(enemy.position)).toBe(false);
  });

  it('raycasts the actual pillar and repairs it with a quick strike instead of an arbitrary click', () => {
    const engine = new NullEngine();
    try {
      const sim = prepared(), scenes = new SceneManager(engine);
      sim.player.position = { x: 1.5, z: 1.5 }; sim.shelter.hp = 260;
      sim.resourceManager.add('wood', 10); sim.resourceManager.add('iron', 5);
      const controller = new PlayerController(scenes.scene, { down: () => false, consumeLook: () => ({ x: 0, y: 0 }) });
      controller.restore(sim.player); controller.camera.setTarget(new Vector3(1.5, 1.7, 4)); scenes.scene.render();
      const target = combatTarget(scenes.scene, controller.camera, CONFIG.sword.range);
      expect(target).toBe(SHELTER_CORE_ID);
      expect(scenes.world.shelterCore.checkCollisions).toBe(true);
      sim.attack(target); expect(sim.shelter.hp).toBe(285); expect(sim.resources).toEqual({ wood: 8, iron: 4 });
      expect(sim.attack(target)).toBe(false);
      advance(sim, .7); sim.attack(null); expect(sim.shelter.hp).toBe(285);
      advance(sim, .85); sim.attack(target); expect(sim.shelter.hp).toBe(300);
      expect(sim.resources).toEqual({ wood: 6, iron: 3 });
      advance(sim, 1.6); sim.attack(target); expect(sim.resources).toEqual({ wood: 6, iron: 3 });
    } finally { engine.dispose(); }
  });

  it('requires repair range, materials and the left attack, including during a night', () => {
    const sim = prepared(); sim.shelter.hp = 200; sim.cycle.state.period = 'night';
    sim.player.position = { x: 1.5, z: 1.5 };
    sim.attack(SHELTER_CORE_ID); expect(sim.shelter.hp).toBe(200);
    sim.resourceManager.add('wood', 10); sim.resourceManager.add('iron', 5);
    advance(sim, .7); sim.attack(SHELTER_CORE_ID, 'heavy'); expect(sim.shelter.hp).toBe(200);
    expect(sim.attack(SHELTER_CORE_ID)).toBe(false);
    advance(sim, 1.5); sim.player.position = { x: 1.5, z: -3 };
    sim.attack(SHELTER_CORE_ID); expect(sim.shelter.hp).toBe(200);
    advance(sim, .7); sim.player.position = { x: 1.5, z: 1.5 };
    sim.attack(SHELTER_CORE_ID); expect(sim.shelter.hp).toBe(225);
    expect(sim.resources).toEqual({ wood: 8, iron: 4 });
    sim.pause(); expect(sim.attack(SHELTER_CORE_ID)).toBe(false);
  });

  it('gives the heavy attack more damage and shares its longer cooldown with the quick attack', () => {
    const sim = prepared(); sim.player.position = { x: -6, z: 12 };
    const target = new Zombie('target', { x: -6, z: 14 }); sim.zombies.push(target);
    sim.attack(target.id, 'heavy'); expect(target.hp).toBe(20);
    expect(sim.swordCooldown).toBe(1.4);
    expect(sim.attack(target.id)).toBe(false); advance(sim, .7);
    expect(sim.attack(target.id)).toBe(false);
    sim.pause(); const remaining = sim.swordCooldown; sim.update(3); expect(sim.swordCooldown).toBe(remaining);
    sim.start(); advance(sim, .75); sim.attack(target.id);
    expect(target.hp).toBe(0); expect(sim.swordCooldownDuration).toBe(.65);
  });

  it('uses heavy damage for harvesting without losing rewards when storage is full', () => {
    const sim = prepared(), node = sim.resourceNodes[0];
    sim.player.position = { x: node.position.x, z: node.position.z - 1.5 };
    sim.carried.wood = 28; sim.attack(node.id, 'heavy'); expect(node.health).toBe(100);
    advance(sim, 1.5); sim.carried.wood = 20; sim.attack(node.id, 'heavy');
    expect(node.health).toBe(20); expect(sim.carried.wood).toBe(29);
    advance(sim, 1.5); sim.attack(node.id, 'heavy'); expect(node.health).toBe(20);
    advance(sim, 1.5); sim.carried.wood = 25; sim.attack(node.id, 'heavy');
    expect(node.health).toBe(0); expect(sim.carried.wood).toBe(30);
  });

  it('maps real mouse-down events to quick and heavy attacks and ignores them without pointer lock', () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    const documentMock = Object.assign(new EventTarget(), { pointerLockElement: canvas, hidden: false });
    vi.stubGlobal('document', documentMock); vi.stubGlobal('window', new EventTarget());
    const input = new InputManager(canvas), attack = vi.fn(); input.onAttack = attack;
    const click = (button: number) => { const event = new Event('mousedown'); Object.defineProperty(event, 'button', { value: button }); documentMock.dispatchEvent(event); };
    click(0); click(2); expect(attack.mock.calls).toEqual([['quick'], ['heavy']]);
    documentMock.pointerLockElement = null as unknown as HTMLCanvasElement;
    click(0); click(2); expect(attack).toHaveBeenCalledTimes(2);
    const context = new Event('contextmenu', { cancelable: true }); canvas.dispatchEvent(context);
    expect(context.defaultPrevented).toBe(true); input.dispose();
  });

  it('persists an unfinished heavy cooldown and rejects older layout saves', () => {
    const sim = prepared(); sim.attack(null, 'heavy'); advance(sim, .2);
    const saved = captureRun(sim), restored = prepared(); restoreRun(restored, saved);
    restored.start(); expect(restored.attack(null)).toBe(false); advance(restored, 1.25);
    expect(restored.attack(null)).toBe(true);
    const bad = structuredClone(saved); bad.swordCooldownDuration = .65; expect(parseRun(bad)).toBeNull();
    const legacy = { ...saved, version: 3 }; expect(parseRun(legacy)).toBeNull();
  });

  it('keeps a broad open plaza and clear approaches beyond all four perimeter gates', () => {
    expect(BASE_BOUNDS.maxX - BASE_BOUNDS.minX).toBe(38);
    expect(BASE_BOUNDS.maxZ - BASE_BOUNDS.minZ).toBe(36);
    for (const ruin of CITY_RUINS) expect(
      Math.abs(ruin.x - SHELTER_CLEARING.x) < (ruin.width + SHELTER_CLEARING.width) / 2 &&
      Math.abs(ruin.z - SHELTER_CLEARING.z) < (ruin.depth + SHELTER_CLEARING.depth) / 2,
    ).toBe(false);
    const obstacles = prepared().obstacles;
    for (let offset = 1; offset <= 5; offset += .25) {
      for (const point of [{ x: BASE_BOUNDS.minX - offset, z: -2.5 }, { x: BASE_BOUNDS.maxX + offset, z: -2.5 },
        { x: 1.5, z: BASE_BOUNDS.minZ - offset }, { x: 1.5, z: BASE_BOUNDS.maxZ + offset }]) {
        expect(isBlocked(point, .32, obstacles), JSON.stringify(point)).toBe(false);
      }
    }
    expect(isBlocked(SHELTER_CORE)).toBe(true);
  });
});
