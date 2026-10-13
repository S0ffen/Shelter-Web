import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { CONFIG } from '../src/domain/config';
import { Zombie } from '../src/enemies/Zombie';
import { receivePlayerDamage } from '../src/domain/SkillRuntime';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';
import { SHELTER_GOALS, inHall } from '../src/world/ShelterLayout';
import encounters from '../../shared/encounters.json';

const start = () => { const sim = new Simulation({ seed: 42, settings: { dayPatrolCount: 0, dayDuration: 3600 } }); sim.start(); return sim; };
const advance = (sim: Simulation, seconds: number) => { for (let i=0;i<Math.ceil(seconds/CONFIG.simulationStep);i++) sim.update(CONFIG.simulationStep); };

it('continues the siege, forfeits carried loot and respawns with the same run, bank and skills', () => {
  const sim=start(); sim.player.position={x:-20,z:20};sim.carried.wood=9;sim.resources.wood=45;
  sim.purchaseSkill('health-up');const runId=sim.runId, points=sim.skills.points;
  const enemy=new Zombie('siege',SHELTER_GOALS[0]);sim.zombies.push(enemy);
  sim.player.damage(200);sim.update(.01);
  expect(sim.phase).toBe('playing');expect(sim.player.respawnRemaining).toBe(5);expect(sim.carried.wood).toBe(0);
  const hp=sim.shelter.hp,elapsed=sim.elapsed;advance(sim,4);
  expect(sim.player.hp).toBe(0);expect(sim.shelter.hp).toBeLessThan(hp);expect(sim.elapsed).toBeGreaterThan(elapsed+3.9);
  advance(sim,1);expect(sim.player.hp).toBe(110);expect(inHall(sim.player.position)).toBe(true);
  expect(sim.runId).toBe(runId);expect(sim.resources.wood).toBe(45);expect(sim.skills.points).toBe(points);
  expect(sim.drainEvents().filter(e=>e.type==='player-died')).toHaveLength(1);
  expect(sim.player.protectionRemaining).toBeGreaterThan(0);
  expect(receivePlayerDamage(sim,100)).toBe(0);advance(sim,3.1);expect(receivePlayerDamage(sim,10)).toBe(10);
});

it('saves and restores a pending respawn without restarting or skipping its timer', () => {
  const sim=start();sim.player.damage(100);sim.update(.01);advance(sim,2);
  const saved=captureRun(sim);expect(saved.outcome).toBe('active');expect(parseRun(saved)).not.toBeNull();
  const restored=start();restoreRun(restored,saved);const remaining=restored.player.respawnRemaining;
  restored.update(20);expect(restored.player.respawnRemaining).toBe(remaining);
  restored.start();advance(restored,remaining+.1);expect(restored.player.hp).toBe(100);expect(restored.runId).toBe(sim.runId);
  const protectedSave=captureRun(restored);expect(parseRun(protectedSave)).not.toBeNull();
  saved.player.respawnRemaining=0;expect(parseRun(saved)).toBeNull();
  saved.player.respawnRemaining=6;expect(parseRun(saved)).toBeNull();
  const living=captureRun(start());living.player.respawnRemaining=1;expect(parseRun(living)).toBeNull();
});

it('cannot heal, fight or build while dead, even when buying a health perk', () => {
  const sim=start();sim.player.damage(100);sim.update(.01);sim.purchaseSkill('health-up');
  expect(sim.player.hp).toBe(0);expect(sim.attack(null)).toBe(false);
  expect(sim.placeBuilding('magic-tower',{x:10,z:14},0).ok).toBe(false);
  expect(sim.useAbility('cloak',sim.player.position)).toContain('respawn');
  expect(sim.interact(null)).toContain('respawn');expect(parseRun(captureRun(sim))).not.toBeNull();
});

it('ends permanently when the core is destroyed during the respawn countdown', () => {
  const sim=start();sim.player.damage(100);sim.update(.01);sim.shelter.damage(sim.shelter.maxHp);sim.update(.01);
  expect(sim.phase).toBe('lost');expect(sim.player.respawnRemaining).toBe(0);
  const restored=start();restoreRun(restored,captureRun(sim));restored.start();advance(restored,10);
  expect(restored.phase).toBe('lost');expect(restored.player.hp).toBe(0);
  const fake=captureRun(start());fake.outcome='lost';expect(parseRun(fake)).toBeNull();
});

it('forfeits a failed final arena attempt and starts a fresh boss after returning', () => {
  const sim=start();const origin=encounters.finalBoss.position;
  sim.player.position={x:origin.x,z:origin.z-3};sim.player.height=encounters.finalArena.floorY;sim.update(.01);
  const boss=sim.zombies.find(z=>z.kind==='overlord')!;boss.hp=1000;
  sim.player.damage(100);sim.update(.01);expect(sim.finalArenaActive).toBe(false);expect(sim.encounters.finalBossDefeated).toBe(false);
  expect(sim.zombies.some(z=>z.kind==='overlord'||z.id.startsWith('boss-minion-'))).toBe(false);
  expect(parseRun(captureRun(sim))).not.toBeNull();advance(sim,5.1);expect(sim.player.height).toBe(0);expect(sim.player.verticalVelocity).toBe(0);
  sim.player.position={x:origin.x,z:origin.z-3};sim.player.height=encounters.finalArena.floorY;sim.update(.01);
  expect(sim.zombies.find(z=>z.kind==='overlord')!.hp).toBe(16000);expect(sim.finalArenaActive).toBe(true);
});
