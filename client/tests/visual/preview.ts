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
import { DepositPanel } from '../../src/ui/DepositPanel';
import { ImpactEffects } from '../../src/rendering/ImpactEffects';
import { AudioFeedback } from '../../src/core/AudioFeedback';
import { Sword } from '../../src/player/Sword';
import { isBlocked } from '../../src/world/WorldLayout';
import { BuildingView } from '../../src/building/BuildingView';
import { PlayerController } from '../../src/player/PlayerController';
import { Zombie } from '../../src/enemies/Zombie';
import { combatTarget } from '../../src/player/CombatTarget';
import { ShelterDeathCamera } from '../../src/player/ShelterDeathCamera';
import { GENERATOR_PADS, SHELTER_DEPOSIT } from '../../src/world/ShelterLayout';

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
const deposit=new DepositPanel(document.querySelector<HTMLElement>('#app')!);deposit.onClose=()=>{deposit.hide();sim.start();};
const arena=new ArenaView(scenes.scene);
const deathCamera=new ShelterDeathCamera(scenes.scene,camera);
const impacts = new ImpactEffects(scenes.scene), audio = new AudioFeedback();
const sword = new Sword(scenes.scene, camera);
sim.start();
const pose = (x: number, y: number, z: number, target: Vector3) => {
  mapOverhead = y > 100;
  sim.player.position = { x, z }; sim.player.height = y < 0 ? y - 1.7 : 0; sim.player.verticalVelocity = 0; controller.restore(sim.player);
  camera.position.set(x, y, z); camera.setTarget(target); sim.player.yaw = camera.rotation.y; sword.setVisible(y < 3);
};
const base = () => pose(1.5, 1.7, -11, new Vector3(1.5, 2.5, 4));
const ore = () => { const n=sim.resourceNodes.find(n=>n.resourceType==='iron')!; pose(n.position.x,1.7,n.position.z-2.8,new Vector3(n.position.x,.5,n.position.z)); };
const advance = (seconds: number) => { for (let i = 0; i < seconds * 30; i++) sim.update(1 / 30); };

document.querySelector('#ore')!.addEventListener('click', ore);
document.querySelector('#types')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start(); sim.zombies = [];
  for (const [index, kind] of (['normal', 'fast', 'tank'] as const).entries())
    { const enemy = new Zombie(kind, { x: -2 + index * 3.5, z: -5 }, kind); enemy.intent = 'player'; sim.zombies.push(enemy); }
  pose(1.5, 1.7, -11, new Vector3(1.5, 1.25, -5)); sword.setVisible(false);
});
document.querySelector('#windows')!.addEventListener('click', () => pose(-10, 1.7, -2, new Vector3(-4.5, 2, 4)));
document.querySelector('#upgrade')!.addEventListener('click', () => {
  resetFixture();
  for (const pad of GENERATOR_PADS.slice(0, 2)) {
    sim.player.position = { x: pad.x + 2.5, z: pad.z };
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    const result = sim.placeBuilding('arcane-core', pad, 0); if (!result.ok) throw Error(result.reason);
  }
  sim.player.position = { x: 1.5, z: 1.5 }; hud.notify(sim.improveShelter());
  pose(-10, 1.7, -2, new Vector3(-4.5, 2, 4));
});
document.querySelector('#core')!.addEventListener('click', () => pose(-1.2, 1.7, 1.1, new Vector3(1.5, 1.55, 4)));
document.querySelector('#siege-core')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start(); sim.zombies = [];
  sim.player.position = { x: -40, z: -40 };
  sim.zombies.push(new Zombie('core-attacker', { x: 1.5, z: 9.8 }));
  for (let i = 0; i < 2700 && sim.shelter.hp === sim.shelter.maxHp; i++) sim.update(1 / 30);
  if (sim.shelter.hp === sim.shelter.maxHp) throw new Error('Zombie nie dotarł do słupa');
  pose(-1.2, 1.7, 1.1, new Vector3(1.5, 1.55, 4)); hud.notify('Zombie wszedł do Shelteru i uderzył słup');
});
document.querySelector('#repair')!.addEventListener('click', () => {
  pose(-1.2, 1.7, 1.1, new Vector3(1.5, 1.55, 4)); sim.shelter.damage(40);
  sim.resourceManager.add('wood', 10); sim.resourceManager.add('iron', 5);
  scenes.scene.render();
  const target = combatTarget(scenes.scene, camera, 3);
  sim.attack(target); sword.swing('quick');
  for (const event of sim.drainEvents()) if (event.type === 'shelter-repaired') hud.notify(`Uderzenie LPM · naprawiono +${event.amount} HP`);
});
document.querySelector('#heavy')!.addEventListener('click', () => {
  sim.reset(); horde.reset(); buildings.reset(); sim.start(); sim.zombies = [];
  const enemy = new Zombie('heavy-target', { x: -6, z: 14 }); sim.zombies.push(enemy);
  pose(-6, 1.7, 11.5, new Vector3(-6, 1.7, 14));
  horde.update(sim.zombies, sim.player, 1, 0, 0); scenes.scene.render();
  sim.attack(combatTarget(scenes.scene, camera, 3), 'heavy'); sword.swing('heavy'); hud.notify('PPM · mocny atak: 80 obrażeń / 1,4 s');
});
document.querySelector('#base')!.addEventListener('click', base);
document.querySelector('#medieval-street')!.addEventListener('click', () => {
  resetFixture();pose(13,1.7,32,new Vector3(23,4,45));collapseTools();
});
document.querySelector('#conduit-close')!.addEventListener('click', () => {
  resetFixture();const pad=GENERATOR_PADS[0];sim.player.position={x:pad.x+2.5,z:pad.z};
  sim.resourceManager.add('wood',100);sim.resourceManager.add('iron',50);
  const result=sim.placeBuilding('arcane-core',pad,0);if(!result.ok)throw Error(result.reason);
  pose(pad.x,1.7,pad.z-2.8,new Vector3(pad.x,1.25,pad.z));collapseTools();
});
document.querySelector('#tower-close')!.addEventListener('click', () => {
  resetFixture();const pad=GENERATOR_PADS[0];
  for(const [kind,p]of [['arcane-core',pad],['arcane-core',GENERATOR_PADS[1]],['magic-tower',{x:-7,z:12}]] as const){
    sim.player.position={x:p.x+2.5,z:p.z};sim.resourceManager.add('wood',100);sim.resourceManager.add('iron',50);
    const result=sim.placeBuilding(kind,p,0);if(!result.ok)throw Error(result.reason);
  }
  pose(-7,1.7,9,new Vector3(-7,2,12));collapseTools();
});
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
  const towerPositions = [{x:-7,z:12},{x:-7,z:15},{x:-10,z:-6.5},{x:-6,z:-6.5},{x:9,z:-6.5},{x:13,z:-6.5},{x:10,z:11},{x:10,z:15},{x:-17,z:7},{x:20,z:7}];
  sim.shelter.level=3;sim.applySkillBonuses();
  for (const point of [...GENERATOR_PADS, ...towerPositions]) {
    sim.player.position = { x: point.x + 2.5, z: point.z };
    sim.resourceManager.add('wood', 100); sim.resourceManager.add('iron', 50);
    const result = sim.placeBuilding(GENERATOR_PADS.includes(point) ? 'arcane-core' : 'magic-tower', point, 0);
    if (!result.ok) throw new Error(result.reason);
    if (result.building.kind === 'arcane-core') {
      while (result.building.level < 3) {
        const before = result.building.level;
        const message = sim.upgradeGenerator(result.building.id);
        if (result.building.level === before) throw new Error(message);
      }
    }
  }
  pose(-25, 22, -31, new Vector3(1.5, 0.5, 1));
});
document.querySelector('#rear-entry')!.addEventListener('click',()=>{resetFixture();pose(1.5,1.7,12,new Vector3(1.5,2,4));collapseTools();});
document.querySelector('#dawn-survivors')!.addEventListener('click',()=>{
 resetFixture();sim.zombies=[];const enemy=new Zombie('zombie-1',{x:1.5,z:6.2},'tank');enemy.mode='siege';enemy.intent='shelter';enemy.hp=137;sim.zombies=[enemy];sim.spawner.nextId=2;
 sim.cycle.state.period='night';sim.cycle.state.periodElapsed=sim.cycle.settings.nightDuration;sim.cycle.state.pendingSpawns=0;sim.player.position={x:-20,z:15};sim.update(1/30);pose(-1.4,1.7,5.9,new Vector3(1.5,1.7,6.2));hud.notify('Dzień 2 · nocny nieumarły pozostał przy rdzeniu');collapseTools();
});
document.querySelector('#siren')!.addEventListener('click',async()=>{await audio.unlock();audio.play('siren');hud.notify('Oryginalna syrena alarmowa CSNZ');collapseTools();});
document.querySelector('#night')!.addEventListener('click', () => { pose(1.5, 1.7, -7, new Vector3(1.5, 2, 4)); sim.beginNight(); advance(1); });
document.querySelector('#advance')!.addEventListener('click', () => advance(10));
document.querySelector('#horde')!.addEventListener('click', () => {
  const enemy = sim.livingZombies.find(zombie => !isBlocked({ x: zombie.position.x, z: zombie.position.z - 3 }, 0.3, sim.obstacles));
  if (enemy) pose(enemy.position.x, 1.7, enemy.position.z - 3, new Vector3(enemy.position.x, 1.5, enemy.position.z));
});
document.querySelector('#day')!.addEventListener('click', () => { sim.reset(); sim.spawner.seed = 42; horde.reset(); buildings.reset(); sim.start(); base(); });
const resetFixture = () => { sim.reset(); horde.reset(); buildings.reset(); impacts.reset(); skills.hide(); deposit.hide(); sim.start(); };
const collapseTools = () => { document.querySelector<HTMLDetailsElement>('#qa-tools')!.open = false; };
document.querySelector('#expedition')!.addEventListener('click', async () => {
  resetFixture(); sim.resourceManager.add('wood',45); sim.resourceManager.add('iron',15);
  const node = sim.resourceNodes[0]; pose(node.position.x,1.7,node.position.z-1.8,new Vector3(node.position.x,.55,node.position.z));
  resources.update(sim.resourceNodes,0); scenes.scene.render(); await audio.unlock();
  const id = combatTarget(scenes.scene,camera,3); if (id !== node.id) throw new Error('Harvest ray missed');
  sim.attack(id,'heavy'); advance(1.5); sim.corruption.value = 35; collapseTools();
});
document.querySelector('#deposit')!.addEventListener('click',()=>{if(!sim.carried.wood&&!sim.carried.iron){sim.carried.wood=9;sim.carried.iron=1;}pose(SHELTER_DEPOSIT.x,1.7,SHELTER_DEPOSIT.z-2,new Vector3(SHELTER_DEPOSIT.x,1.3,SHELTER_DEPOSIT.z));sim.update(.01);collapseTools();});
document.querySelector('#deposit-e')!.addEventListener('click',()=>{scenes.scene.render();const id=combatTarget(scenes.scene,camera,3);if(id!=='shelter-deposit')throw Error('Deposit ray missed: '+id);sim.pause();deposit.show(sim);collapseTools();});
document.querySelector('#skills-night')!.addEventListener('click',()=>{resetFixture();sim.cycle.state.period='night';sim.cycle.state.periodElapsed=15;pose(-22,1.7,-16,new Vector3(-22,1,-14));skills.show(sim);collapseTools();});
document.querySelector('#corruption')!.addEventListener('click', () => { resetFixture(); pose(-22,1.7,-16,new Vector3(-22,1,-14)); sim.corruption.value=99.8; advance(3.2); collapseTools(); });
document.querySelector('#skills')!.addEventListener('click', () => { resetFixture(); base(); skills.show(sim); collapseTools(); });
document.querySelector('#blood-moon')!.addEventListener('click', () => { resetFixture(); base(); sim.cycle.state.day=5; sim.beginNight(); advance(1); collapseTools(); });
document.querySelector('#reference-map')!.addEventListener('click',()=>{resetFixture();pose(29,240,67,new Vector3(29,0,67.01));scenes.scene.fogDensity=0;collapseTools();});
document.querySelector('#player-death')!.addEventListener('click',()=>{resetFixture();base();sim.player.damage(100);sim.update(.01);collapseTools();});
document.querySelector('#respawn-step')!.addEventListener('click',()=>{advance(1);collapseTools();});
document.querySelector('#ravager')!.addEventListener('click',()=>{resetFixture();const p=encounters.ravager.position;pose(p.x,1.7,p.z-10,new Vector3(p.x,2.8,p.z));sim.update(.01);collapseTools();});
document.querySelector('#warden')!.addEventListener('click',()=>{resetFixture();const p=encounters.graveGuardian.position;pose(p.x,1.7,p.z-7,new Vector3(p.x,2.5,p.z));sim.update(.01);collapseTools();});
document.querySelector('#forge')!.addEventListener('click', () => { resetFixture(); pose(encounters.forgeGuardian.position.x,1.7,encounters.forgeGuardian.position.z-10,new Vector3(encounters.forgeGuardian.position.x,2,encounters.forgeGuardian.position.z)); sim.update(.01); collapseTools(); });
document.querySelector('#guardian')!.addEventListener('click', () => { resetFixture(); pose(encounters.forgeGuardian.position.x,1.7,encounters.forgeGuardian.position.z-2.2,new Vector3(encounters.forgeGuardian.position.x,2,encounters.forgeGuardian.position.z)); sim.update(.01); collapseTools(); });
document.querySelector('#final-boss')!.addEventListener('click',()=>{resetFixture();const p=encounters.finalBoss.position;pose(p.x,encounters.finalArena.floorY+1.7,p.z-10,new Vector3(p.x,encounters.finalArena.floorY+3,p.z));sim.update(.01);hud.notify('OTCHŁAŃ CYTADELI · 16000 HP · szarża i przywołania');collapseTools();});
document.querySelector('#victory')!.addEventListener('click', () => { resetFixture(); pose(encounters.finalBoss.position.x,encounters.finalArena.floorY+1.7,encounters.finalBoss.position.z-2.5,new Vector3(encounters.finalBoss.position.x,encounters.finalArena.floorY+3,encounters.finalBoss.position.z)); sim.update(.01); const boss=sim.zombies.find(z=>z.kind==='overlord')!; boss.hp=64; horde.update(sim.zombies,sim.player,1,0,0); scenes.scene.render(); const id=combatTarget(scenes.scene,camera,3); if(id!==boss.id)throw new Error('Boss ray missed'); sim.attack(id,'heavy'); collapseTools(); });
base();
window.addEventListener('resize', () => engine.resize());
engine.runRenderLoop(() => {
  const dt = Math.min(0.1, engine.getDeltaTime() / 1000);
  for(const event of sim.drainEvents()) {
    if(event.type==='shelter-hit'||event.type==='building-hit'){audio.play('siren');hud.flashShelter();}
    if(event.type==='swing')sword.swing(event.kind);
    if(event.type==='player-respawned'){controller.restore(sim.player);camera.setTarget(new Vector3(1.5,1.5,4));sword.setVisible(true);}
    if(event.type==='resource-hit'){const n=sim.resourceNodes.find(n=>n.id===event.nodeId)!;impacts.burst(n.position,n.resourceType);}
    if(event.type==='resource-gained'){audio.play('resource');hud.floatingGain('+'+event.amount+' '+event.kind.toUpperCase());}
    if(event.type==='resources-deposited')hud.notify('Zdeponowano '+event.amount.wood+' Wood / '+event.amount.iron+' Iron');
    if(event.type==='zombie-hit'){horde.hit(event.zombieId);hud.hitMarker();audio.play('flesh');}
  }
  impacts.update(dt); skills.update(sim);deposit.update(sim);deathCamera.update(!sim.player.alive&&sim.player.respawnRemaining>0);arena.update(sim.finalArenaActive);
  if(!sim.player.alive)sword.setVisible(false);
  scenes.updateLighting(sim.cycle, dt);
  if (mapOverhead) { scenes.scene.fogDensity=0; scenes.scene.clearColor.set(.015,.02,.025,1); }
  scenes.world.update(sim.elapsed, sim.shelter.hp / sim.shelter.maxHp, sim.shelter.level, sim.buildingSystem.buildings,sim.skills.bonuses.campfire>0);
  resources.update(sim.resourceNodes, sim.elapsed);
  horde.update(sim.zombies, sim.player, 1, 0, sim.elapsed);
  buildings.sync(sim.buildingSystem.buildings);
  buildings.updateTowers(sim.towerSystem.towers, dt);
  const pick = sim.player.alive ? scenes.scene.pickWithRay(camera.getForwardRay(12), mesh => mesh.isEnabled() && mesh.isPickable) : null;
  hud.update(sim, pick?.pickedMesh?.metadata?.resourceNodeId ?? pick?.pickedMesh?.metadata?.zombieId ?? pick?.pickedMesh?.metadata?.shelterCoreId ?? pick?.pickedMesh?.metadata?.depositId ?? null);
  sword.update(dt, sim.elapsed, false);
  scenes.scene.render();
});
window.addEventListener('pagehide', () => engine.dispose(), { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => engine.dispose());
