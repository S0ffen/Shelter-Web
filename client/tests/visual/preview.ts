import '../../src/style.css';
import { Engine, Vector3 } from '../../src/rendering/babylon';
import { SceneManager } from '../../src/core/SceneManager';
import { Simulation } from '../../src/domain/Simulation';
import { ResourceView } from '../../src/resources/ResourceView';
import { HordeView } from '../../src/enemies/HordeView';
import { Hud } from '../../src/ui/Hud';
import { Sword } from '../../src/player/Sword';
import { isBlocked } from '../../src/world/WorldLayout';
import { BuildingView } from '../../src/building/BuildingView';
import { PlayerController } from '../../src/player/PlayerController';
import { TOWER_PADS } from '../../src/world/ShelterLayout';

// Separate development fixture. Production uses Game and normal pointer-lock controls.
const engine = new Engine(document.querySelector<HTMLCanvasElement>('#game-canvas')!, true);
const scenes = new SceneManager(engine);
const sim = new Simulation({ seed: 42 });
let pressed: string | null = null;
const controller = new PlayerController(scenes.scene, { consumeLook: () => ({ x: 0, y: 0 }), down: key => key === pressed });
const camera = controller.camera;
const resources = new ResourceView(scenes.scene, sim.resourceNodes);
const horde = new HordeView(scenes.scene);
const buildings = new BuildingView(scenes.scene);
const hud = new Hud(document.querySelector<HTMLElement>('#app')!);
const sword = new Sword(scenes.scene, camera);
sim.start();
const pose = (x: number, y: number, z: number, target: Vector3) => {
  sim.player.position = { x, z }; controller.restore(sim.player);
  camera.position.set(x, y, z); camera.setTarget(target); sim.player.yaw = camera.rotation.y; sword.setVisible(y < 3);
};
const base = () => pose(1.5, 1.7, -11, new Vector3(1.5, 2.5, 4));
const ore = () => pose(-10, 1.7, -17.8, new Vector3(-10, 0.5, -15));
const advance = (seconds: number) => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };

document.querySelector('#ore')!.addEventListener('click', ore);
document.querySelector('#base')!.addEventListener('click', base);
document.querySelector('#inside')!.addEventListener('click', () => {
  pose(1.5, 1.7, -7, new Vector3(1.5, 1.7, 4));
  pressed = 'KeyW';
  for (let i = 0; i < 80; i++) { controller.update(1 / 30, sim.player); scenes.scene.render(); }
  pressed = null;
  camera.setTarget(new Vector3(1.5, 1.7, -11)); sim.player.yaw = camera.rotation.y;
});
document.querySelector('#outside')!.addEventListener('click', () => pose(-24, 1.7, -24, new Vector3(-30, 1.7, -30)));
document.querySelector('#courtyard')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start();
  // Fixture funding only; each placement uses the real construction validator.
  for (const point of [{ x: -6, z: -10 }, { x: -3.5, z: -10 }, { x: 7, z: -10 }, ...TOWER_PADS]) {
    sim.player.position = { x: point.x - 2.5, z: point.z };
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    const result = sim.placeBuilding(TOWER_PADS.includes(point) ? 'magic-tower' : 'arcane-core', point, 0);
    if (!result.ok) throw new Error(result.reason);
  }
  pose(-14, 14, -19, new Vector3(1.5, 0.5, 1));
});
document.querySelector('#night')!.addEventListener('click', () => { sim.beginNight(); advance(1); });
document.querySelector('#advance')!.addEventListener('click', () => advance(10));
document.querySelector('#horde')!.addEventListener('click', () => {
  const enemy = sim.livingZombies.find(zombie => !isBlocked({ x: zombie.position.x, z: zombie.position.z - 3 }, 0.3, sim.obstacles));
  if (enemy) pose(enemy.position.x, 1.7, enemy.position.z - 3, new Vector3(enemy.position.x, 1.5, enemy.position.z));
});
document.querySelector('#day')!.addEventListener('click', () => { sim.reset(); sim.spawner.seed = 42; horde.reset(); buildings.reset(); sim.start(); base(); });
base();
window.addEventListener('resize', () => engine.resize());
engine.runRenderLoop(() => {
  const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
  scenes.updateLighting(sim.cycle, dt);
  scenes.world.update(sim.elapsed, sim.shelter.hp / sim.shelter.maxHp);
  resources.update(sim.resourceNodes, sim.elapsed);
  horde.update(sim.zombies, sim.player, 1, 0, sim.elapsed);
  buildings.sync(sim.buildingSystem.buildings);
  buildings.updateTowers(sim.towerSystem.towers, dt);
  const pick = scenes.scene.pickWithRay(camera.getForwardRay(12), mesh => mesh.isEnabled() && mesh.isPickable);
  hud.update(sim, pick?.pickedMesh?.metadata?.resourceNodeId ?? pick?.pickedMesh?.metadata?.zombieId ?? null);
  scenes.scene.render();
});
window.addEventListener('pagehide', () => engine.dispose(), { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => engine.dispose());