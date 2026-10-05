import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { SceneManager } from '../src/core/SceneManager';
import { PlayerController } from '../src/player/PlayerController';
import { Player } from '../src/player/Player';
import { Zombie } from '../src/enemies/Zombie';
import { ZombieView } from '../src/enemies/ZombieView';
import { HordeView } from '../src/enemies/HordeView';
import { Sword } from '../src/player/Sword';
import { Vector3 } from '../src/rendering/babylon';
import { Simulation } from '../src/domain/Simulation';
import { BuildingController } from '../src/building/BuildingController';
import { ResourceView } from '../src/resources/ResourceView';
import { ResourceType } from '../src/resources/ResourceType';
import { ProjectileView } from '../src/building/ProjectileView';
import { Building } from '../src/building/Building';

describe('Babylon adapters', () => {
  it('physically walks through the open Shelter entrance, stays inside its walls and exits again', () => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      let key = 'KeyW';
      const controller = new PlayerController(manager.scene, { consumeLook: () => ({ x: 0, y: 0 }), down: candidate => candidate === key });
      controller.camera.rotation.set(0, 0, 0);
      const player = new Player(); manager.scene.render();
      for (let step = 0; step < 80; step++) { controller.update(1 / 30, player); manager.scene.render(); }
      expect(player.position.z).toBeGreaterThan(3);
      expect(player.position.z).toBeLessThan(5);
      key = 'KeyA';
      for (let step = 0; step < 60; step++) { controller.update(1 / 30, player); manager.scene.render(); }
      expect(player.position.x).toBeGreaterThan(-2.1);
      controller.restore({ ...player, position: { x: 1.5, z: 4 } } as Player);
      controller.camera.rotation.set(0, 0, 0); key = 'KeyS';
      for (let step = 0; step < 140; step++) { controller.update(1 / 30, player); manager.scene.render(); }
      expect(player.position.z).toBeLessThan(-13.5);
    } finally { engine.dispose(); }
  });
  it('picks distinct horde members, ignores corpses and disposes removed rigs', () => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      const controller = new PlayerController(manager.scene, { consumeLook: () => ({ x: 0, y: 0 }), down: () => false });
      const horde = new HordeView(manager.scene);
      const first = new Zombie('first', { x: -6, z: 13 });
      const second = new Zombie('second', { x: -6, z: 15 });
      const player = new Player();
      horde.update([first, second], player, 1, 0, 0);
      controller.camera.position.set(-6, 1.7, 10.5);
      controller.camera.setTarget(new Vector3(-6, 1.7, 15));
      manager.scene.render();
      const pick = () => manager.scene.pickWithRay(controller.camera.getForwardRay(7), mesh => mesh.isEnabled() && mesh.isPickable);
      expect(pick()?.pickedMesh?.metadata?.zombieId).toBe('first');
      first.damage(1000);
      horde.update([first, second], player, 1, 0.1, 1);
      manager.scene.render();
      expect(pick()?.pickedMesh?.metadata?.zombieId).toBe('second');
      horde.update([], player, 1, 0.1, 2);
      expect(manager.scene.getTransformNodeByName('first-rig')).toBeNull();
      expect(manager.scene.getTransformNodeByName('second-rig')).toBeNull();
    } finally { engine.dispose(); }
  });

  it.each(Object.values(ResourceType))('raycasts and harvests %s with the sword, then clears its physical collider', type => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      let walking = true;
      const input = { consumeLook: () => ({ x: 0, y: 0 }), down: (key: string) => walking && key === 'KeyW' };
      const controller = new PlayerController(manager.scene, input);
      const sim = new Simulation();
      sim.start();
      const resources = new ResourceView(manager.scene, sim.resourceNodes);
      const node = sim.resourceNodes.find(candidate => candidate.resourceType === type)!;
      const body = manager.scene.getMeshByName('player-collider')!;
      body.position.set(node.position.x, 0.85, node.position.z - 2.6);
      controller.camera.rotation.set(0, 0, 0);
      controller.update(0, sim.player);
      controller.camera.setTarget(new Vector3(node.position.x, node.definition.height / 2, node.position.z));
      manager.scene.render();
      const pick = manager.scene.pickWithRay(controller.camera.getForwardRay(3), mesh => mesh.isEnabled() && mesh.isPickable);
      expect(pick?.pickedMesh?.metadata?.resourceNodeId).toBe(node.id);
      sim.attack(pick!.pickedMesh!.metadata.resourceNodeId);
      expect(node.health).toBe(node.maxHealth - 34);
      controller.camera.rotation.set(0, 0, 0);
      for (let step = 0; step < 30; step++) { controller.update(1 / 30, sim.player); manager.scene.render(); }
      const stoppedZ = sim.player.position.z;
      expect(stoppedZ).toBeLessThan(node.position.z - node.definition.depth / 2);
      expect(stoppedZ).toBeGreaterThan(node.position.z - node.definition.depth / 2 - 0.4);
      walking = false;
      for (let hit = 0; !node.isDestroyed && hit < 6; hit++) {
        for (let step = 0; step < 22; step++) sim.update(1 / 30);
        sim.attack(node.id);
      }
      expect(node.isDestroyed).toBe(true);
      resources.update(sim.resourceNodes, 1);
      manager.scene.render();
      const cleared = manager.scene.pickWithRay(controller.camera.getForwardRay(1), mesh => mesh.isEnabled() && mesh.isPickable);
      expect(cleared?.pickedMesh?.metadata?.resourceNodeId).not.toBe(node.id);
      walking = true;
      for (let step = 0; step < 15; step++) { controller.update(1 / 30, sim.player); manager.scene.render(); }
      expect(sim.player.position.z).toBeGreaterThan(node.position.z);
    } finally { engine.dispose(); }
  });

  it('creates the scene and blocks player movement at a real map wall', () => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      const input = { consumeLook: () => ({ x: 0, y: 0 }), down: (key: string) => key === 'KeyD' };
      const controller = new PlayerController(manager.scene, input);
      const player = new Player();
      controller.camera.rotation.set(0, 0, 0);
      new Sword(manager.scene, controller.camera);
      const view = new ZombieView(manager.scene);
      view.update(new Zombie(), player, 1, 0, 0);
      manager.scene.render();
      for (let step = 0; step < 180; step++) { controller.update(1 / 30, player); manager.scene.render(); }
      // The larger courtyard ends at the solid eastern base wall.
      expect(player.position.x).toBeGreaterThan(14.8);
      expect(player.position.x).toBeLessThan(15.2);
      expect(player.position.z).toBeCloseTo(-7);
      expect(manager.scene.meshes.length).toBeGreaterThan(150);
    } finally { engine.dispose(); }
  });

  it('raycasts the zombie body and returns a nearer wall instead when occluded', () => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      const input = { consumeLook: () => ({ x: 0, y: 0 }), down: () => false };
      const controller = new PlayerController(manager.scene, input);
      const view = new ZombieView(manager.scene);
      const zombie = new Zombie();
      const player = new Player();
      controller.camera.position.set(-6, 1.7, 13.5);
      controller.camera.setTarget(new Vector3(-6, 1.7, 16));
      view.update(zombie, player, 1, 0, 0);
      manager.scene.render();
      const pick = manager.scene.pickWithRay(controller.camera.getForwardRay(3), mesh => mesh.isPickable);
      expect(pick?.pickedMesh?.metadata?.zombieId).toBe(zombie.id);

      zombie.position = zombie.previousPosition = { x: 6, z: 4 };
      view.update(zombie, player, 1, 0, 0);
      controller.camera.position.set(-4, 1.7, 4);
      controller.camera.setTarget(new Vector3(6, 1.7, 4));
      manager.scene.render();
      const blocked = manager.scene.pickWithRay(controller.camera.getForwardRay(12), mesh => mesh.isPickable);
      expect(blocked?.hit).toBe(true);
      expect(blocked?.pickedMesh?.metadata?.zombieId).toBeUndefined();
      expect(blocked?.pickedMesh?.name).toBe('shelter-wall-0');
    } finally { engine.dispose(); }
  });

  it('previews on the ground, places a colliding building, rotates it and cleans up on restart', () => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      const input = { consumeLook: () => ({ x: 0, y: 0 }), down: (key: string) => key === 'KeyA' };
      const controller = new PlayerController(manager.scene, input);
      const sim = new Simulation();
      sim.start();
      sim.resourceManager.add('wood', 100);
      sim.resourceManager.add('iron', 50);
      sim.buildingSystem.buildings.push(new Building('fixture-generator', 'arcane-core', { x: 10, z: 10 }, 0));
      const building = new BuildingController(manager.scene, controller.camera);
      controller.camera.setTarget(new Vector3(-4, -0.02, -7));
      manager.scene.render();
      building.select('storehouse');
      building.rotate();
      building.update(sim);
      expect(building.position).toEqual({ x: -4, z: -7 });
      expect(building.reason).toBeNull();
      expect(building.confirm(sim)).toBe('Zbudowano Storehouse');
      building.update(sim);
      expect(manager.scene.getMeshByName('building-1-collider')?.checkCollisions).toBe(true);
      building.cancel();
      controller.camera.rotation.set(0, 0, 0);
      for (let i = 0; i < 90; i++) { controller.update(1 / 30, sim.player); manager.scene.render(); }
      expect(sim.player.position.x).toBeLessThan(-2.3);
      expect(sim.player.position.x).toBeGreaterThan(-3);
      building.reset();
      expect(manager.scene.getMeshByName('building-1-collider')).toBeNull();
    } finally { engine.dispose(); }
  });

  it('hides destroyed resources, restores them on a new run and removes expired projectile meshes', () => {
    const engine = new NullEngine();
    try {
      const manager = new SceneManager(engine);
      const sim = new Simulation();
      const resources = new ResourceView(manager.scene, sim.resourceNodes);
      resources.update(sim.resourceNodes, 0);
      expect(manager.scene.getTransformNodeByName('resource-wood-01')?.isEnabled()).toBe(true);
      sim.resourceNodes[0].damage(1000);
      resources.update(sim.resourceNodes, 1);
      expect(manager.scene.getTransformNodeByName('resource-wood-01')?.isEnabled()).toBe(false);
      expect(manager.scene.getMeshByName('resource-collider-wood-01')?.checkCollisions).toBe(false);
      expect(manager.scene.getMeshByName('resource-collider-wood-01')?.isPickable).toBe(false);
      sim.reset();
      resources.update(sim.resourceNodes, 2);
      expect(manager.scene.getTransformNodeByName('resource-wood-01')?.isEnabled()).toBe(true);
      const projectiles = new ProjectileView(manager.scene);
      projectiles.update([{ id: 1, sourceId: 'tower', targetId: 'zombie-01', position: { x: -6, y: 2, z: 3 }, lifetime: 2 }]);
      expect(manager.scene.getMeshByName('magic-shot-1')?.position.y).toBe(2);
      projectiles.update([]);
      expect(manager.scene.getMeshByName('magic-shot-1')).toBeNull();
    } finally { engine.dispose(); }
  });
});
