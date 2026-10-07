import { describe,expect,it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { CONFIG } from '../src/domain/config';
import { SkillTree,PERKS,validSkillLevels } from '../src/domain/SkillTree';
import { receivePlayerDamage } from '../src/domain/SkillRuntime';
import { Zombie } from '../src/enemies/Zombie';
import { Building } from '../src/building/Building';
import { captureRun,parseRun,restoreRun } from '../src/persistence/RunSnapshot';
const start=()=>{const sim=new Simulation({settings:{dayPatrolCount:0}});sim.start();return sim;};
const fund=(sim:Simulation)=>{sim.cycle.state.day=100;sim.skills.points=102;};
const buy=(sim:Simulation,id:string,times=1)=>{for(let i=0;i<times;i++){sim.purchaseSkill(id);expect(sim.skills.levels[id]).toBe(i+1)}};
const unlockSurvival=(sim:Simulation)=>{fund(sim);buy(sim,'beginner-harvest',3);buy(sim,'speed-up',3);buy(sim,'advance-harvest',3);};
const unlockEngineer=(sim:Simulation)=>{fund(sim);buy(sim,'beginner-engineer',3);buy(sim,'blueprint',3);buy(sim,'intermediate-engineer',3);};
describe('expanded Shelter skill trees',()=>{
 it('spends points anywhere, at night and paused; dawn grants exactly one and terminal runs cannot purchase',()=>{
  const sim=start();expect(sim.skills.points).toBe(3);sim.player.position={x:-31,z:14};sim.cycle.state.period='night';
  buy(sim,'speed-up');sim.pause();buy(sim,'blueprint');expect(sim.skills.points).toBe(1);sim.start();
  sim.cycle.state.periodElapsed=sim.cycle.settings.nightDuration;sim.update(.01);expect(sim.skills.points).toBe(2);sim.update(.01);expect(sim.skills.points).toBe(2);
  sim.phase='lost';sim.purchaseSkill('health-up');expect(sim.skills.levels['health-up']).toBe(0);
 });
 it('enforces specialization tiers, mastery prerequisites, ranks and unique perk IDs',()=>{
  const tree=new SkillTree();tree.points=50;expect(tree.buy('armor')).toBe(false);for(let i=0;i<3;i++)tree.buy('health-up');
  expect(tree.buy('armor')).toBe(true);expect(tree.buy('weapon-mastery-ii')).toBe(false);expect(tree.buy('health-up')).toBe(false);
  const corrupt={...tree.levels,'weapon-mastery-iii':1};expect(validSkillLevels(corrupt)).toBe(false);expect(new Set(PERKS.map(p=>p.id)).size).toBe(33);
 });
 it('Combat changes real damage, HP and shared attack cooldown and checkpoints its speed',()=>{
  const sim=start();buy(sim,'weapon-mastery');buy(sim,'health-up');buy(sim,'battle-tempo');
  expect(sim.player.hp).toBe(110);expect(sim.skills.points).toBe(0);
  const enemy=new Zombie('test-enemy',{x:-6,z:-8});sim.zombies=[enemy];sim.player.position={x:-6,z:-10};sim.attack(enemy.id,'heavy');
  expect(enemy.hp).toBe(14);expect(sim.swordCooldown).toBeCloseTo(1.4/1.05);sim.attack(enemy.id);expect(enemy.hp).toBe(14);
  const loaded=start();restoreRun(loaded,captureRun(sim));expect(loaded.player.maxHp).toBe(110);expect(loaded.swordCooldown).toBeCloseTo(sim.swordCooldown);
 });
 it('Survival expands the actual backpack, boosts every harvest threshold and slows Psyche exhaustion',()=>{
  const sim=start();unlockSurvival(sim);buy(sim,'endurance',3);
  expect(sim.movementSpeed).toBeCloseTo(CONFIG.player.speed*1.2);expect(sim.carriedManager.capacity).toEqual({wood:60,iron:38});
  const node=sim.resourceNodes[0];sim.player.position={x:node.position.x,z:node.position.z-1.4};sim.attack(node.id,'heavy');
  expect(node.isDestroyed).toBe(true);expect(sim.carried.wood).toBe(26);sim.update(10);expect(sim.corruption.value).toBeCloseTo(6.5);
  expect(parseRun(captureRun(sim))).not.toBeNull();
 });
 it('Engineer discounts costs, preserves building wounds, boosts repairs and changes real power demand',()=>{
  const sim=start();const existing=new Building('existing','magic-tower',{x:-13,z:6},0);existing.hp=190;sim.buildingSystem.buildings.push(existing);
  unlockEngineer(sim);buy(sim,'engineer-crafting');buy(sim,'electrical',3);buy(sim,'expert-engineer',3);
  expect(sim.buildingSystem.costFor('arcane-core')).toEqual({wood:17,iron:13});expect(existing.maxHp).toBe(456);expect(existing.hp).toBe(406);
  sim.resources.wood=100;sim.resources.iron=50;sim.player.position={x:-10,z:-13};const result=sim.placeBuilding('arcane-core',{x:-13,z:-13},0);
  expect(result.ok).toBe(true);expect(sim.buildingSystem.power).toEqual({generated:46,used:7,available:39});expect(sim.towerSystem.demand).toBe(7);
  sim.player.position={x:-11,z:6};sim.attack(existing.id);expect(existing.hp).toBe(439);expect(sim.repairCooldown).toBeCloseTo(1.5/1.5);
  expect(parseRun(captureRun(sim))).not.toBeNull();
 });
 it('Campfire heals near its brazier and endurance regen waits until recent damage ends',()=>{
  const sim=start();unlockSurvival(sim);buy(sim,'campfire');buy(sim,'endurance');sim.player.hp=50;sim.player.position={x:-2,z:7};sim.corruption.value=40;
  sim.update(1);expect(sim.player.hp).toBe(52);expect(sim.corruption.value).toBe(32);
  sim.player.position={x:-31,z:14};receivePlayerDamage(sim,10);sim.update(4);expect(sim.player.hp).toBe(42);sim.update(2);expect(sim.player.hp).toBeGreaterThan(42);
 });
 it('Auto Repair needs idling, reachable infrastructure and Shelter materials',()=>{
  const sim=start();buy(sim,'auto-repair');sim.shelter.damage(50);sim.player.position={x:1.5,z:1.5};sim.update(.01);sim.update(1.1);expect(sim.shelter.hp).toBe(250);
  sim.resources.wood=10;sim.resources.iron=5;sim.update(1);expect(sim.shelter.hp).toBe(253);expect(sim.resources).toEqual({wood:8,iron:4});
 });
 it('Armor reduces enemy hits and Combat Master grants a bounded emergency shield',()=>{
  const sim=start();fund(sim);buy(sim,'health-up',3);buy(sim,'armor',3);buy(sim,'combat-master');sim.player.hp=23;
  receivePlayerDamage(sim,10);expect(sim.player.hp).toBe(15);expect(sim.abilities.shield).toBe(4);receivePlayerDamage(sim,100);expect(sim.player.hp).toBe(15);
  const restored=start();restoreRun(restored,captureRun(sim));expect(restored.abilities.shield).toBe(4);restored.update(10);expect(restored.abilities.shield).toBe(4);restored.start();restored.update(4.1);receivePlayerDamage(restored,10);expect(restored.player.hp).toBe(7);
 });
 it('Cloak prevents normal detection, doubles first hit and starts a saved cooldown; Hunter slows targets',()=>{
  const sim=start();unlockSurvival(sim);buy(sim,'cloak');buy(sim,'hunter',3);
  sim.player.position={x:-6,z:-10};const enemy=new Zombie('target',{x:-6,z:-8},'tank');enemy.mode='patrol';sim.zombies=[enemy];
  expect(sim.useAbility('cloak',sim.player.position)).toContain('CLOAK');sim.update(.01);expect(enemy.intent).toBe('patrol');
  sim.attack(enemy.id,'heavy');expect(enemy.hp).toBe(140);expect(enemy.slow).toBe(2);expect(sim.abilities.cloak).toBe(0);expect(sim.useAbility('cloak',sim.player.position)).toContain('Odnowienie');
  expect(parseRun(captureRun(sim))).not.toBeNull();
 });
 it('Barrage and Wrecking deal real area damage, respect walls and cooldowns',()=>{
  const sim=start();fund(sim);buy(sim,'weapon-mastery',3);buy(sim,'health-up',3);buy(sim,'battle-tempo',3);buy(sim,'barrage');
  sim.player.position={x:-6,z:-10};const enemy=new Zombie('target',{x:-6,z:-8},'tank');sim.zombies=[enemy];
  expect(sim.useAbility('barrage',enemy.position)).toBe('ARCANE BARRAGE');expect(enemy.alive).toBe(false);expect(sim.totalKills).toBe(1);
  expect(sim.useAbility('barrage',enemy.position)).toContain('Odnowienie');unlockEngineer(sim);buy(sim,'wrecking-team');
  const boss=new Zombie('forge-guardian',{x:56,z:0},'guardian');boss.mode='guard';sim.zombies=[boss];sim.player.position={x:56,z:-2.2};
  expect(sim.useAbility('demolition',boss.position)).toBe('WRECKING TEAM');expect(boss.hp).toBe(1000);
 });
 it('Recycle refunds shared resources and Tower Moving preserves health and cooldown without payment',()=>{
  const sim=start();unlockEngineer(sim);buy(sim,'recycle',3);buy(sim,'turret-moving');
  const tower=new Building('tower','magic-tower',{x:-13,z:6},0,sim.skills.bonuses.buildingHealth);tower.hp=100;sim.buildingSystem.buildings.push(tower);
  sim.buildingSystem.buildings.push(new Building('g','arcane-core',{x:-13,z:-13},0));sim.player.position={x:-15,z:6};
  sim.towerSystem.towers.set(tower.id,{buildingId:tower.id,targetId:null,yaw:0,cooldown:.7,powered:true});
  expect(sim.moveTower(tower.id,{x:-13,z:9},Math.PI/2)).toBe('Wieża przeniesiona');expect(tower.hp).toBe(100);expect(sim.resources.wood).toBe(0);expect(sim.towerSystem.towers.get(tower.id)!.cooldown).toBe(.7);
  sim.player.position={x:-15,z:9};expect(sim.demolishBuilding(tower.id)).toContain('RECYCLE');expect(sim.resources.wood).toBe(12);expect(sim.towerSystem.towers.has(tower.id)).toBe(false);
 });
 it('only the transport perk allows deliberate remote deposit of a full backpack',()=>{
  const sim=start();unlockSurvival(sim);buy(sim,'resource-transport');sim.player.position={x:-31,z:14};sim.carried.wood=sim.carriedManager.capacity.wood;
  sim.update(.01);expect(sim.resources.wood).toBe(0);expect(sim.interact(null)).toContain('transport');expect(sim.resources.wood).toBe(60);expect(sim.carried.wood).toBe(0);
 });
 it('rejects impossible ranks, tiers, budgets, oversized backpacks and unowned active abilities in checkpoints',()=>{
  const saved=captureRun(start());saved.skills.points=4;expect(parseRun(saved)).toBeNull();saved.skills.points=3;
  saved.skills.levels['armor']=1;saved.skills.points=2;expect(parseRun(saved)).toBeNull();saved.skills.levels['armor']=0;saved.skills.points=3;
  saved.abilities.cloak=10;expect(parseRun(saved)).toBeNull();saved.abilities.cloak=0;saved.carried.wood=31;expect(parseRun(saved)).toBeNull();
 });
});
