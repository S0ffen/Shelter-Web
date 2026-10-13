import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Simulation } from '../src/domain/Simulation';
import { ZombieView } from '../src/enemies/ZombieView';
import { Scene } from '../src/rendering/babylon';
import encounters from '../../shared/encounters.json';

it.each(['forgeGuardian','graveGuardian','ravager','finalBoss'] as const)('%s attacks only in melee range and creates no floor markers',key=>{
  const spec=encounters[key],sim=new Simulation({settings:{dayPatrolCount:0,dayDuration:3600}});sim.start();
  sim.player.position={x:spec.position.x,z:spec.position.z-2};if(key==='finalBoss')sim.player.height=encounters.finalArena.floorY;sim.update(.01);
  const boss=sim.zombies.find(z=>z.kind===spec.kind)!;boss.chargeCooldown=boss.summonCooldown=100;
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine),view=new ZombieView(scene,boss.id,boss.kind);view.update(boss,sim.player,1,0,sim.elapsed);
    expect(scene.meshes.some(mesh=>/telegraph|boss-danger|warning-rune/.test(mesh.name))).toBe(false);
    for(let i=0;i<Math.ceil((spec.windup+.1)*30);i++)sim.update(1/30);
    expect(sim.player.hp).toBe(100-boss.stats.damage);expect(sim.bossHazards).toHaveLength(0);
    expect(sim.drainEvents().some(event=>event.type==='boss-slam')).toBe(false);
    boss.attackCooldown=0;boss.windup=0;sim.update(.01);sim.player.position.z-=8;
    const hp=sim.player.hp;for(let i=0;i<Math.ceil((spec.windup+.1)*30);i++)sim.update(1/30);
    expect(sim.player.hp).toBe(hp);
    view.dispose();
  } finally {engine.dispose();}
});
