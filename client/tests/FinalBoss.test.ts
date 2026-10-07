import { expect,it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { CONFIG } from '../src/domain/config';
import encounters from '../../shared/encounters.json';
import { captureRun,parseRun,restoreRun } from '../src/persistence/RunSnapshot';
import { ARENA_GATES, inFinalArena } from '../src/world/ArenaLayout';
import { NavigationGrid } from '../src/world/NavigationGrid';
const origin=encounters.finalBoss.position;
function arena() {const sim=new Simulation({settings:{dayPatrolCount:0,dayDuration:3600},seed:42});sim.start();sim.player.position={x:origin.x,z:origin.z-10};sim.update(.01);return {sim,boss:sim.zombies.find(z=>z.kind==='overlord')!};}
const advance=(sim:Simulation,seconds:number)=>{for(let i=0;i<Math.ceil(seconds/CONFIG.simulationStep);i++)sim.update(CONFIG.simulationStep)};
it('seals all four sides only after entry, leaving the approach open beforehand',()=>{
 const sim=new Simulation({settings:{dayPatrolCount:0}});sim.start();const b=encounters.finalArena.bounds,from={x:102,z:b.minZ-2},to={x:102,z:b.minZ+2};
 expect(new NavigationGrid(sim.obstacles).canWalk(from,to)).toBe(true);sim.player.position=to;sim.update(.01);expect(sim.finalArenaActive).toBe(true);expect(sim.obstacles).toEqual(expect.arrayContaining(ARENA_GATES));expect(new NavigationGrid(sim.obstacles).canWalk(to,from)).toBe(false);
});
it('requires a developed fighter and shields Psyche during the arena fight',()=>{
 const{sim,boss}=arena();sim.player.position={x:origin.x,z:origin.z-2.5};sim.attack(boss.id,'heavy');expect(boss.hp).toBe(15936);expect(boss.maxHp/(CONFIG.sword.heavy.damage*(1-encounters.finalBoss.resistance)/CONFIG.sword.heavy.cooldown)).toBeGreaterThan(300);sim.corruption.value=80;sim.update(.5);expect(sim.corruption.value).toBeLessThan(80);
});
it('charges toward a captured position, allowing a sideways dodge and hurting a stationary target',()=>{
 const{sim,boss}=arena();boss.chargeCooldown=0;sim.update(.01);expect(boss.chargeTarget).toEqual(sim.player.position);sim.player.position.x+=7;advance(sim,1.9);expect(sim.player.hp).toBe(100);expect(sim.bossHazards).toHaveLength(0);
 const second=arena();second.boss.chargeCooldown=0;second.sim.update(.01);advance(second.sim,1.9);expect(second.sim.player.hp).toBe(45);
});
it('enrages, caps reinforcements and keeps them inside the sealed arena',()=>{
 const{sim,boss}=arena();for(let i=0;i<4;i++){boss.summonCooldown=0;sim.update(.01);}const minions=sim.zombies.filter(z=>z.id.startsWith('boss-minion-'));expect(minions).toHaveLength(6);expect(minions.every(z=>inFinalArena(z.position,1))).toBe(true);boss.hp=boss.maxHp*.5;boss.attackCooldown=0;sim.player.position={x:boss.position.x,z:boss.position.z-2};sim.update(.01);expect(boss.attackCooldown).toBeCloseTo(boss.stats.attackCooldown*encounters.finalBoss.enrageCooldown);
});
it('persists arena gates and pending charge, pauses timers and rejects escape checkpoints',()=>{
 const{sim,boss}=arena();boss.chargeCooldown=0;sim.update(.01);const saved=captureRun(sim),restored=new Simulation();restoreRun(restored,saved);expect(restored.finalArenaActive).toBe(true);const windup=restored.zombies[0].windup;restored.update(20);expect(restored.zombies[0].windup).toBe(windup);restored.start();restored.player.position.x+=7;advance(restored,1.9);expect(restored.player.hp).toBe(100);saved.player.position={x:1.5,z:-7};expect(parseRun(saved)).toBeNull();saved.player.position={...sim.player.position};saved.finalArenaActive=false;expect(parseRun(saved)).toBeNull();
});
