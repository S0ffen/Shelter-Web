import encounters from '../../../shared/encounters.json';
import { ArenaView } from '../../src/world/ArenaView';
import '../../src/style.css';
import { Engine, Vector3 } from '../../src/rendering/babylon';
import { SceneManager } from '../../src/core/SceneManager';
import { Simulation } from '../../src/domain/Simulation';
import { ResourceView } from '../../src/resources/ResourceView';
import { HordeView } from '../../src/enemies/HordeView';
import { Hud } from '../../src/ui/Hud';
import { SkillPanel } from '../../src/ui/SkillPanel';
import { ImpactEffects } from '../../src/rendering/ImpactEffects';
import { AudioFeedback } from '../../src/core/AudioFeedback';
import { Sword } from '../../src/player/Sword';
import { isBlocked } from '../../src/world/WorldLayout';
import { BuildingView } from '../../src/building/BuildingView';
import { PlayerController } from '../../src/player/PlayerController';
import { Zombie } from '../../src/enemies/Zombie';
import { combatTarget } from '../../src/player/CombatTarget';
import { BossHazardView } from '../../src/enemies/BossHazardView';
import { GENERATOR_PADS } from '../../src/world/ShelterLayout';

// Separate development fixture. Production uses Game and normal pointer-lock controls.
const engine = new Engine(document.querySelector<HTMLCanvasElement>('#game-canvas')!, true);
const scenes = new SceneManager(engine);
const sim = new Simulation({ seed: 42 });
let pressed: string | null = null;
const controller = new PlayerController(scenes.scene, { consumeLook: () => ({ x: 0, y: 0 }), down: key => key === pressed });
const camera = controller.camera;
let mapOverhead = false;
const resources = new ResourceView(scenes.scene, sim.resourceNodes);
const horde = new HordeView(scenes.scene);
const buildings = new BuildingView(scenes.scene);
const hud = new Hud(document.querySelector<HTMLElement>('#app')!);
const skills = new SkillPanel(document.querySelector<HTMLElement>('#app')!);
skills.onClose = () => skills.hide(); skills.onBuy = branch => { hud.notify(sim.purchaseSkill(branch)); skills.update(sim); };
const arena=new ArenaView(scenes.scene);
const hazards=new BossHazardView(scenes.scene);
const impacts = new ImpactEffects(scenes.scene), audio = new AudioFeedback();
const sword = new Sword(scenes.scene, camera);
sim.start();
const pose = (x: number, y: number, z: number, target: Vector3) => {
  mapOverhead = y > 100;
  sim.player.position = { x, z }; controller.restore(sim.player);
  camera.position.set(x, y, z); camera.setTarget(target); sim.player.yaw = camera.rotation.y; sword.setVisible(y < 3);
};
const base = () => pose(1.5, 1.7, -11, new Vector3(1.5, 2.5, 4));
const ore = () => { const n=sim.resourceNodes.find(n=>n.resourceType==='iron')!; pose(n.position.x,1.7,n.position.z-2.8,new Vector3(n.position.x,.5,n.position.z)); };
const advance = (seconds: number) => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };

document.querySelector('#ore')!.addEventListener('click', ore);
document.querySelector('#types')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start(); sim.zombies = [];
  for (const [index, kind] of (['normal', 'fast', 'tank'] as const).entries())
    { const enemy = new Zombie(kind, { x: -2 + index * 3.5, z: -8 }, kind); enemy.intent = 'player'; sim.zombies.push(enemy); }
  pose(1.5, 1.7, -12, new Vector3(1.5, 1.25, -8)); sword.setVisible(false);
});
document.querySelector('#windows')!.addEventListener('click', () => pose(-10, 1.7, -2, new Vector3(-4.5, 2, 4)));
document.querySelector('#upgrade')!.addEventListener('click', () => {
  sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
  sim.player.position = { x: 1.5, z: 1.5 }; hud.notify(sim.improveShelter());
  pose(-10, 1.7, -2, new Vector3(-4.5, 2, 4));
});
document.querySelector('#core')!.addEventListener('click', () => pose(-1.2, 1.7, 1.1, new Vector3(1.5, 1.55, 4)));
document.querySelector('#siege-core')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start(); sim.zombies = [];
  sim.player.position = { x: -40, z: -40 };
  sim.zombies.push(new Zombie('core-attacker', { x: 1.5, z: 9.8 }));
  for (let i = 0; i < 2700 && sim.shelter.hp === 300; i++) sim.update(1 / 30);
  if (sim.shelter.hp === 300) throw new Error('Zombie nie dotarł do słupa');
  pose(-1.2, 1.7, 1.1, new Vector3(1.5, 1.55, 4)); hud.notify('Zombie wszedł do Shelteru i uderzył słup');
});
document.querySelector('#repair')!.addEventListener('click', () => {
  pose(-1.2, 1.7, 1.1, new Vector3(1.5, 1.55, 4)); sim.shelter.damage(40);
  sim.resourceManager.add('wood', 10); sim.resourceManager.add('iron', 5);
  scenes.scene.render();
  const target = combatTarget(scenes.scene, camera, 3);
  sim.attack(target); sword.swing('quick');
  for (const event of sim.drainEvents()) if (event.type === 'shelter-repaired') hud.notify('Uderzenie LPM · naprawiono +25 HP');
});
document.querySelector('#heavy')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start(); sim.zombies = [];
  const enemy = new Zombie('heavy-target', { x: -6, z: 14 }); sim.zombies.push(enemy);
  pose(-6, 1.7, 11.5, new Vector3(-6, 1.7, 14));
  horde.update(sim.zombies, sim.player, 1, 0, 0); scenes.scene.render();
  sim.attack(combatTarget(scenes.scene, camera, 3), 'heavy'); sword.swing('heavy'); hud.notify('PPM · mocny atak: 80 obrażeń / 1,4 s');
});
document.querySelector('#base')!.addEventListener('click', base);
document.querySelector('#inside')!.addEventListener('click', () => {
  pose(1.5, 1.7, -7, new Vector3(1.5, 1.7, 4));
  pressed = 'KeyW';
  for (let i = 0; i < 80; i++) { controller.update(1 / 30, sim.player); scenes.scene.render(); }
  pressed = null;
  camera.setTarget(new Vector3(1.5, 1.7, 4)); sim.player.yaw = camera.rotation.y;
});
document.querySelector('#outside')!.addEventListener('click', () => pose(-24, 1.7, -24, new Vector3(-30, 1.7, -30)));
document.querySelector('#courtyard')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start();
  // Fixture funding only; each placement uses the real construction validator.
  const towerPositions = [{x:-7,z:12},{x:-7,z:15},{x:-7,z:-12},{x:-7,z:-8},{x:10,z:-12},{x:10,z:-8},{x:10,z:11},{x:10,z:15},{x:-13,z:-6},{x:16,z:-6}];
  for (const point of [...GENERATOR_PADS.slice(0, 3), ...towerPositions]) {
    sim.player.position = { x: point.x + 2.5, z: point.z };
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    const result = sim.placeBuilding(GENERATOR_PADS.includes(point) ? 'arcane-core' : 'magic-tower', point, 0);
    if (!result.ok) throw new Error(result.reason);
  }
  pose(-25, 22, -31, new Vector3(1.5, 0.5, 1));
});
document.querySelector('#night')!.addEventListener('click', () => { pose(1.5, 1.7, -7, new Vector3(1.5, 2, 4)); sim.beginNight(); advance(1); });
document.querySelector('#advance')!.addEventListener('click', () => advance(10));
document.querySelector('#horde')!.addEventListener('click', () => {
  const enemy = sim.livingZombies.find(zombie => !isBlocked({ x: zombie.position.x, z: zombie.position.z - 3 }, 0.3, sim.obstacles));
  if (enemy) pose(enemy.position.x, 1.7, enemy.position.z - 3, new Vector3(enemy.position.x, 1.5, enemy.position.z));
});
document.querySelector('#day')!.addEventListener('click', () => { sim.reset(); sim.spawner.seed = 42; horde.reset(); buildings.reset(); sim.start(); base(); });
const resetFixture = () => { sim.reset(); horde.reset(); buildings.reset(); impacts.reset(); skills.hide(); sim.start(); };
const collapseTools = () => { document.querySelector<HTMLDetailsElement>('#qa-tools')!.open = false; };
document.querySelector('#expedition')!.addEventListener('click', async () => {
  resetFixture(); sim.resourceManager.add('wood',45); sim.resourceManager.add('iron',15);
  const node = sim.resourceNodes[0]; pose(node.position.x,1.7,node.position.z-1.8,new Vector3(node.position.x,.55,node.position.z));
  resources.update(sim.resourceNodes,0); scenes.scene.render(); await audio.unlock();
  const id = combatTarget(scenes.scene,camera,3); if (id !== node.id) throw new Error('Harvest ray missed');
  sim.attack(id,'heavy'); advance(1.5); sim.corruption.value = 35; collapseTools();
});
document.querySelector('#deposit')!.addEventListener('click',()=>{if(!sim.carried.wood&&!sim.carried.iron){sim.carried.wood=9;sim.carried.iron=1;}pose(6,1.7,4.1,new Vector3(6,1.3,6.8));sim.update(.01);collapseTools();});
document.querySelector('#deposit-e')!.addEventListener('click',()=>{scenes.scene.render();const id=combatTarget(scenes.scene,camera,3);if(id!=='shelter-deposit')throw Error('Deposit ray missed: '+id);hud.notify(sim.interact(id));collapseTools();});
document.querySelector('#skills-night')!.addEventListener('click',()=>{resetFixture();sim.cycle.state.period='night';sim.cycle.state.periodElapsed=15;pose(-22,1.7,-16,new Vector3(-22,1,-14));skills.show(sim);collapseTools();});
document.querySelector('#corruption')!.addEventListener('click', () => { resetFixture(); pose(-22,1.7,-16,new Vector3(-22,1,-14)); sim.corruption.value=99.8; advance(3.2); collapseTools(); });
document.querySelector('#skills')!.addEventListener('click', () => { resetFixture(); base(); skills.show(sim); collapseTools(); });
document.querySelector('#blood-moon')!.addEventListener('click', () => { resetFixture(); base(); sim.cycle.state.day=5; sim.beginNight(); advance(1); collapseTools(); });
document.querySelector('#reference-map')!.addEventListener('click',()=>{resetFixture();pose(48,410,112,new Vector3(48,0,112.01));scenes.scene.fogDensity=0;collapseTools();});
document.querySelector('#ravager')!.addEventListener('click',()=>{resetFixture();const p=encounters.ravager.position;pose(p.x,1.7,p.z-10,new Vector3(p.x,2.8,p.z));sim.update(.01);collapseTools();});
document.querySelector('#warden')!.addEventListener('click',()=>{resetFixture();const p=encounters.graveGuardian.position;pose(p.x,1.7,p.z-7,new Vector3(p.x,2.5,p.z));sim.update(.01);collapseTools();});
document.querySelector('#forge')!.addEventListener('click', () => { resetFixture(); pose(encounters.forgeGuardian.position.x,1.7,encounters.forgeGuardian.position.z-10,new Vector3(encounters.forgeGuardian.position.x,2,encounters.forgeGuardian.position.z)); sim.update(.01); collapseTools(); });
document.querySelector('#guardian')!.addEventListener('click', () => { resetFixture(); pose(encounters.forgeGuardian.position.x,1.7,encounters.forgeGuardian.position.z-2.2,new Vector3(encounters.forgeGuardian.position.x,2,encounters.forgeGuardian.position.z)); sim.update(.01); collapseTools(); });
document.querySelector('#final-boss')!.addEventListener('click',()=>{resetFixture();const p=encounters.finalBoss.position;pose(p.x,1.7,p.z-10,new Vector3(p.x,3,p.z));sim.update(.01);hud.notify('ARENA ZAMKNIĘTA · 16000 HP · szarża i przywołania');collapseTools();});
document.querySelector('#victory')!.addEventListener('click', () => { resetFixture(); pose(encounters.finalBoss.position.x,1.7,encounters.finalBoss.position.z-2.5,new Vector3(encounters.finalBoss.position.x,3,encounters.finalBoss.position.z)); sim.update(.01); const boss=sim.zombies.find(z=>z.kind==='overlord')!; boss.hp=64; horde.update(sim.zombies,sim.player,1,0,0); scenes.scene.render(); const id=combatTarget(scenes.scene,camera,3); if(id!==boss.id)throw new Error('Boss ray missed'); sim.attack(id,'heavy'); collapseTools(); });
base();
window.addEventListener('resize', () => engine.resize());
engine.runRenderLoop(() => {
  const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
  for(const event of sim.drainEvents()) {
    if(event.type==='swing')sword.swing(event.kind);
    if(event.type==='resource-hit'){const n=sim.resourceNodes.find(n=>n.id===event.nodeId)!;impacts.burst(n.position,n.resourceType);}
    if(event.type==='resource-gained'){audio.play('resource');hud.floatingGain('+'+event.amount+' '+event.kind.toUpperCase());}
    if(event.type==='resources-deposited')hud.notify('Zdeponowano '+event.amount.wood+' Wood / '+event.amount.iron+' Iron');
    if(event.type==='zombie-hit'){horde.hit(event.zombieId);hud.hitMarker();audio.play('flesh');}
  }
  impacts.update(dt); skills.update(sim);hazards.update(sim);arena.update(sim.finalArenaActive);
  scenes.updateLighting(sim.cycle, dt);
  if (mapOverhead) { scenes.scene.fogDensity=0; scenes.scene.clearColor.set(.015,.02,.025,1); }
  scenes.world.update(sim.elapsed, sim.shelter.hp / sim.shelter.maxHp, sim.shelter.level, sim.buildingSystem.buildings,sim.skills.bonuses.campfire>0);
  resources.update(sim.resourceNodes, sim.elapsed);
  horde.update(sim.zombies, sim.player, 1, 0, sim.elapsed);
  buildings.sync(sim.buildingSystem.buildings);
  buildings.updateTowers(sim.towerSystem.towers, dt);
  const pick = scenes.scene.pickWithRay(camera.getForwardRay(12), mesh => mesh.isEnabled() && mesh.isPickable);
  hud.update(sim, pick?.pickedMesh?.metadata?.resourceNodeId ?? pick?.pickedMesh?.metadata?.zombieId ?? pick?.pickedMesh?.metadata?.shelterCoreId ?? pick?.pickedMesh?.metadata?.depositId ?? null);
  sword.update(dt, sim.elapsed, false);
  scenes.scene.render();
});
window.addEventListener('pagehide', () => engine.dispose(), { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => engine.dispose());
