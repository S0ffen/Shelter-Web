import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Zombie } from '../src/enemies/Zombie';
import { ZombieAI } from '../src/enemies/ZombieAI';
import { ZombieSpawner } from '../src/enemies/ZombieSpawner';
import { NavigationGrid } from '../src/world/NavigationGrid';
import { SHELTER_WINDOWS, GENERATOR_PADS } from '../src/world/ShelterLayout';
import { hasLineOfSight, isBlocked } from '../src/world/WorldLayout';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';
import { SceneManager } from '../src/core/SceneManager';
import { PlayerController } from '../src/player/PlayerController';
import { BuildingController } from '../src/building/BuildingController';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '../src/rendering/babylon';
import { ZombieView } from '../src/enemies/ZombieView';
import { Building } from '../src/building/Building';

function prepared() {
  const sim = new Simulation({ settings: { dayPatrolCount: 0 }, seed: 42 });
  sim.start(); sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
  return sim;
}
describe('Shelter defense expansion', () => {
  it('reserves stations for generators while allowing towers at different free courtyard positions', () => {
    const sim = prepared(); sim.player.position = { x: -10, z: -13 };
    const funds = { ...sim.resources };
    expect(sim.placeBuilding('arcane-core', { x: -8, z: -13 }, 0).ok).toBe(false);
    expect(sim.placeBuilding('magic-tower', GENERATOR_PADS[0], 0).ok).toBe(false);
    expect(sim.placeBuilding('storehouse', GENERATOR_PADS[0], 0).ok).toBe(false);
    expect(sim.resources).toEqual(funds);
    expect(sim.placeBuilding('arcane-core', GENERATOR_PADS[0], 0).ok).toBe(true);
    expect(sim.placeBuilding('arcane-core', GENERATOR_PADS[0], 0).ok).toBe(false);
    for (const point of [{ x: -7, z: -12 }, { x: 10, z: -12 }]) {
      sim.player.position = { x: point.x, z: point.z + 2.5 };
      expect(sim.placeBuilding('magic-tower', point, 0).ok).toBe(true);
    }
  });
  it('snaps the real generator preview to its station and validates the same position on click', () => {
    const engine = new NullEngine();
    try {
      const scene = new SceneManager(engine).scene, sim = prepared();
      sim.player.position = { x: -10, z: -13 };
      const player = new PlayerController(scene, { down: () => false, consumeLook: () => ({ x: 0, y: 0 }) });
      player.restore(sim.player); player.camera.setTarget(new Vector3(-12.65, 0.07, -12.8)); scene.render();
      const build = new BuildingController(scene, player.camera); build.select('arcane-core'); build.update(sim);
      expect(build.position).toEqual(GENERATOR_PADS[0]); expect(build.reason).toBeNull();
      expect(build.confirm(sim)).toBe('Zbudowano Generator Arcane');
    } finally { engine.dispose(); }
  });
  it('opens six actual windows for sight while keeping movement below their sills blocked', () => {
    expect(SHELTER_WINDOWS).toHaveLength(6);
    const engine = new NullEngine();
    try {
      const scene = new SceneManager(engine).scene;
      const player = new PlayerController(scene, { down: () => false, consumeLook: () => ({ x: 0, y: 0 }) });
      const window = SHELTER_WINDOWS[0];
      const enemy = new Zombie('window-target', { x: 1.5, z: window.z });
      const view = new ZombieView(scene, enemy.id); view.update(enemy, prepared().player, 1, 0, 0);
      player.camera.position.set(window.x-1.5, 1.7, window.z); player.camera.setTarget(new Vector3(1.5, 1.7, window.z)); scene.render();
      expect(scene.pickWithRay(player.camera.getForwardRay(14), mesh => mesh.isPickable)?.pickedMesh?.metadata?.zombieId).toBe(enemy.id);
      expect(hasLineOfSight({ x: window.x-1.5, z: window.z, y: 1.7 }, { x: 1.5, z: window.z, y: 1.7 })).toBe(true);
      expect(hasLineOfSight({ x: window.x-1.5, z: window.z, y: 0.8 }, { x: 1.5, z: window.z, y: 0.8 })).toBe(false);
      expect(isBlocked({ x: window.x, z: window.z })).toBe(true);
    } finally { engine.dispose(); }
  });
  it('keeps attacking Shelter when a visible player is unreachable behind a window sill', () => {
    const sim = prepared(), ai = new ZombieAI(), window = SHELTER_WINDOWS[0];
    const enemy = new Zombie('outside-window', { x: window.x-1, z: window.z });
    sim.player.position = { x: -1.5, z: window.z };
    expect(hasLineOfSight(enemy.position, sim.player.position)).toBe(true);
    ai.decide(enemy, sim.player);
    expect(enemy.intent).toBe('shelter');
    sim.player.position.x = window.x+.5; ai.decide(enemy, sim.player);
    expect(enemy.intent).toBe('player');
  });
  it('makes every kind faster at night without changing day speed or HP', () => {
    const ai = new ZombieAI();
    for (const kind of ['normal', 'fast', 'tank'] as const) {
      const day = new Zombie('day', { x: 1.5, z: -8 }, kind), night = new Zombie('night', { x: 1.5, z: -8 }, kind);
      ai.move(day, { x: 1.5, z: -6 }, 0.2); ai.move(night, { x: 1.5, z: -6 }, 0.2, [], true);
      expect((night.position.z + 8) / (day.position.z + 8)).toBeCloseTo(1.65);
      expect(night.hp).toBe(day.maxHp);
    }
    expect(new Zombie('runner', undefined, 'fast').maxHp).toBe(70);
    expect(new Zombie('tank', undefined, 'tank').maxHp).toBe(300);
  });
  it('spawns varied kinds reproducibly from the first night and gives tanks stronger attacks', () => {
    const first = new ZombieSpawner(42), second = new ZombieSpawner(42), grid = new NavigationGrid([]);
    const kinds = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const a = first.spawn(grid, { x: 1.5, z: -7 }, [], 'siege')!;
      const b = second.spawn(grid, { x: 1.5, z: -7 }, [], 'siege')!;
      expect({ kind: a.kind, position: a.position }).toEqual({ kind: b.kind, position: b.position }); kinds.add(a.kind);
    }
    expect([...kinds].sort()).toEqual(['fast', 'normal', 'tank']);
    const sim = prepared(); sim.player.position = { x: -6, z: 14 };
    sim.zombies.push(new Zombie('tank', { x: -6, z: 15 }, 'tank')); sim.update(1 / 30);
    expect(sim.player.hp).toBe(78);
  });
  it('renders distinct silhouettes for runner and armored tank', () => {
    const engine = new NullEngine();
    try {
      const scene = new SceneManager(engine).scene;
      new ZombieView(scene, 'fast', 'fast'); new ZombieView(scene, 'tank', 'tank');
      expect(scene.getTransformNodeByName('tank-rig')!.scaling.x).toBeGreaterThan(scene.getTransformNodeByName('fast-rig')!.scaling.x);
      expect(scene.getMeshByName('tank-tank-chest-plate')).not.toBeNull();
      expect(scene.getMeshByName('fast-runner-rib')).not.toBeNull();
    } finally { engine.dispose(); }
  });
  it('charges for day-only Shelter upgrades, preserves existing damage, and applies armor', () => {
    const sim = prepared(); const funds = { ...sim.resources };
    sim.improveShelter(); expect(sim.resources).toEqual(funds);
    sim.player.position = { x: 1.5, z: 1.5 }; sim.shelter.hp = 250;
    sim.improveShelter(); expect(sim.shelter.level).toBe(2); expect(sim.shelter.hp).toBe(450);
    expect(sim.resources).toEqual({ wood: 50, iron: 25 });
    expect(sim.shelter.damage(20)).toBe(18);
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    sim.cycle.state.period = 'night'; sim.improveShelter(); expect(sim.shelter.level).toBe(2);
    sim.cycle.state.period = 'day'; sim.improveShelter(); expect(sim.shelter.maxHp).toBe(750);
    expect(sim.shelter.damage(20)).toBe(16);
    const maxed = { ...sim.resources }; sim.improveShelter(); expect(sim.resources).toEqual(maxed);
  });
  it('repairs with finite materials and a paused cooldown, allowing repairs during siege', () => {
    const sim = prepared(); sim.player.position = { x: 1.5, z: 1.5 }; sim.shelter.hp = 260; sim.cycle.state.period = 'night';
    sim.repairShelter(); expect(sim.shelter.hp).toBe(285); expect(sim.resources).toEqual({ wood: 98, iron: 49 });
    sim.repairShelter(); expect(sim.shelter.hp).toBe(285);
    sim.pause(); sim.update(10); expect(sim.repairCooldown).toBe(1.5);
    sim.start(); sim.cycle.state.pendingSpawns = 0;
    for (let i = 0; i < 46; i++) sim.update(1 / 30);
    sim.repairShelter(); expect(sim.shelter.hp).toBe(300);
    const full = { ...sim.resources }; sim.repairShelter(); expect(sim.resources).toEqual(full);
    sim.reset(); expect(sim.shelter.level).toBe(1); expect(sim.repairCooldown).toBe(0);
  });
  it('roundtrips upgrades, repair timing and all kinds and rejects incompatible state', () => {
    const sim = prepared(); sim.player.position = { x: 1.5, z: 1.5 }; sim.improveShelter(); sim.shelter.hp = 440; sim.repairShelter();
    sim.zombies.push(new Zombie('tank', { x: -6, z: 16 }, 'tank'), new Zombie('runner', { x: 18, z: 20 }, 'fast'));
    const saved = captureRun(sim); const restored = prepared(); restoreRun(restored, saved);
    expect(restored.shelter.level).toBe(2); expect(restored.shelter.hp).toBe(465); expect(restored.repairCooldown).toBe(1.5);
    expect(restored.zombies.map(z => [z.kind, z.maxHp])).toEqual([['tank', 300], ['fast', 70]]);
    const bad = structuredClone(saved); bad.zombies[1].hp = 100; expect(parseRun(bad)).toBeNull();
    const offPad = structuredClone(saved); offPad.buildings.push(new Building('bad-generator', 'arcane-core', { x: -4, z: -7 }, 0)); expect(parseRun(offPad)).toBeNull();
  });
});
