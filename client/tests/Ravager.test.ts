import {expect,it} from 'vitest';
import {Simulation} from '../src/domain/Simulation';
import encounters from '../../shared/encounters.json';
import {captureRun,restoreRun} from '../src/persistence/RunSnapshot';
const origin=encounters.ravager.position;
function approach(){const sim=new Simulation({settings:{dayPatrolCount:0,dayDuration:3600}});sim.start();sim.player.position={x:origin.x,z:origin.z-12};sim.update(.01);return sim;}
it('runs down the square and hits in melee without casting circles',()=>{
 const sim=approach(),boss=sim.zombies.find(z=>z.kind==='ravager')!,initial=boss.position.z;for(let i=0;i<30;i++)sim.update(1/30);expect(boss.position.z).toBeLessThan(initial-4);expect(boss.maxHp).toBe(4500);sim.player.position={x:boss.position.x,z:boss.position.z-2};sim.update(.01);for(let i=0;i<8;i++)sim.update(1/30);expect(sim.player.hp).toBe(68);expect(sim.bossHazards).toHaveLength(0);expect(sim.drainEvents().some(e=>e.type==='boss-windup')).toBe(false);
});
it('killing the central boss preserves the run and persists its defeat',()=>{
 const sim=approach(),boss=sim.zombies.find(z=>z.kind==='ravager')!;sim.damageZombie(boss.id,4500,'sword');expect(sim.encounters.ravagerDefeated).toBe(true);expect(sim.phase).toBe('playing');const restored=new Simulation();restoreRun(restored,captureRun(sim));restored.start();restored.update(.1);expect(restored.zombies.some(z=>z.kind==='ravager'&&z.alive)).toBe(false);
});
it('adds a second independent guardian at the marked western location',()=>{
 const sim=approach();sim.player.position={...encounters.graveGuardian.position,z:encounters.graveGuardian.position.z-2};sim.update(.01);const warden=sim.zombies.find(z=>z.kind==='warden')!;expect(warden.maxHp).toBe(2100);sim.damageZombie(warden.id,2100,'sword');expect(sim.encounters.graveGuardianDefeated).toBe(true);expect(sim.encounters.forgeGuardianDefeated).toBe(false);expect(sim.phase).toBe('playing');
});
