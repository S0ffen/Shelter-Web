import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { Zombie } from '../src/enemies/Zombie';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';
it('keeps living siege attackers and their wounds/cooldowns at dawn, without rewarding phantom kills',()=>{
 const sim=new Simulation({settings:{dayPatrolCount:0}});sim.start();sim.player.position={x:-20,z:15};
 const zombie=new Zombie('zombie-1',{x:1.5,z:6.2},'tank');zombie.hp=137;zombie.attackCooldown=1;zombie.mode='siege';zombie.intent='shelter';sim.zombies=[zombie];sim.spawner.nextId=2;
 sim.totalKills=7;sim.carried.wood=3;sim.resources.iron=4;sim.cycle.state.period='night';sim.cycle.state.periodElapsed=sim.cycle.settings.nightDuration;sim.cycle.state.pendingSpawns=3;
 const before=sim.shelter.hp;sim.update(1/30);
 expect(sim.cycle.state.day).toBe(2);expect(sim.cycle.state.pendingSpawns).toBe(0);expect(sim.zombies).toContain(zombie);expect(zombie.hp).toBe(137);expect(zombie.mode).toBe('siege');expect(zombie.attackCooldown).toBeCloseTo(1-1/30);
 expect(sim.totalKills).toBe(7);expect(sim.carried.wood).toBe(3);expect(sim.resources.iron).toBe(4);expect(sim.skills.points).toBe(4);
 const saved=parseRun(captureRun(sim))!;expect(saved).not.toBeNull();const restored=new Simulation();restoreRun(restored,saved);restored.start();
 for(let i=0;i<40;i++)restored.update(1/30);
 expect(restored.zombies.some(z=>z.id===zombie.id&&z.hp===137)).toBe(true);expect(restored.shelter.hp).toBeLessThan(before);
});

it('preserves every surviving night archetype at dawn while cancelling only unspawned reserves', () => {
 const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start(); sim.player.position = { x: -20, z: 15 };
 const normal = new Zombie('zombie-1', { x: -6, z: -10 }, 'normal'); normal.hp = 78;
 const fast = new Zombie('zombie-2', { x: 4, z: -4 }, 'fast'); fast.hp = 59;
 const tank = new Zombie('zombie-3', { x: 1.5, z: 6.2 }, 'tank'); tank.hp = 211;
 sim.zombies = [normal, fast, tank]; sim.spawner.nextId = 4;
 sim.cycle.state.period = 'night'; sim.cycle.state.periodElapsed = sim.cycle.settings.nightDuration;
 sim.cycle.state.waveSize = 128; sim.cycle.state.pendingSpawns = 80; sim.totalKills = 4;
 sim.update(1 / 30);
 expect(sim.cycle.state.period).toBe('day'); expect(sim.cycle.state.pendingSpawns).toBe(0);
 expect(sim.zombies.map(z => [z.id, z.kind, z.hp, z.mode])).toEqual([
   ['zombie-1', 'normal', 78, 'siege'], ['zombie-2', 'fast', 59, 'siege'], ['zombie-3', 'tank', 211, 'siege'],
 ]);
 expect(sim.totalKills).toBe(4);
 const saved = parseRun(captureRun(sim)); expect(saved).not.toBeNull();
 const restored = new Simulation(); restoreRun(restored, saved!);
 expect(restored.zombies.map(z => [z.id, z.kind, z.hp, z.mode])).toEqual(sim.zombies.map(z => [z.id, z.kind, z.hp, z.mode]));
});
