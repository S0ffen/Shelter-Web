import encounters from '../../shared/encounters.json';
import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, restoreRun } from '../src/persistence/RunSnapshot';
import { RISK_AREAS, WORLD_BOUNDS, isBlocked } from '../src/world/WorldLayout';
import { NavigationGrid } from '../src/world/NavigationGrid';

function approach() { const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start(); sim.player.position = { x: encounters.forgeGuardian.position.x, z: encounters.forgeGuardian.position.z-2 }; sim.update(.01); return sim; }
function step(sim: Simulation, seconds: number) { for (let i = 0; i < Math.ceil(seconds * 30); i++) sim.update(1 / 30); }
describe('Ancient Forge and territorial Guardian', () => {
  it('extends the connected city and doubles rewards of dangerous Forge sources', () => {
    const sim = approach(); expect(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX).toBe(309); expect(RISK_AREAS.ancientForge.risk).toBe(3);
    const nodes = sim.resourceNodes.filter(node => sim.isForgeResource(node.id)); expect(nodes).toHaveLength(6); expect(nodes.every(node => node.previewDamage(160).reward === 16)).toBe(true);
  });
  it('spawns once near the Forge, telegraphs a heavy attack and gives time to dodge', () => {
    const sim = approach(), guardian = sim.zombies.find(z => z.kind === 'guardian')!;
    expect(guardian.maxHp).toBe(1800); expect(guardian.windup).toBe(1); expect(sim.player.hp).toBe(100);
    sim.player.position = { x: encounters.forgeGuardian.position.x, z: encounters.forgeGuardian.position.z-9 }; step(sim, 1.1); expect(sim.player.hp).toBe(100);
    sim.player.position = { x: encounters.forgeGuardian.position.x, z: encounters.forgeGuardian.position.z-2 }; guardian.position = {...encounters.forgeGuardian.position}; guardian.attackCooldown = 0; step(sim, .1); step(sim, 1.1);
    expect(sim.player.hp).toBe(72); expect(sim.zombies.filter(z => z.kind === 'guardian')).toHaveLength(1);
  });
  it('locks rich Iron until defeated, leaves the run active, then preserves access across dawn and reload', () => {
    const sim = approach(), guardian = sim.zombies.find(z => z.kind === 'guardian')!;
    const node = sim.resourceNodes.find(node => sim.isForgeResource(node.id))!;
    sim.player.position = { x: node.position.x, z: node.position.z - 1.4 }; sim.attack(node.id, 'heavy'); expect(node.health).toBe(160);
    sim.player.position = { x: encounters.forgeGuardian.position.x, z: encounters.forgeGuardian.position.z-2 }; guardian.hp = 80; sim.swordCooldown = 0; sim.attack(guardian.id, 'heavy');
    expect(sim.encounters.forgeGuardianDefeated).toBe(true); expect(sim.totalKills).toBe(1); expect(sim.phase).toBe('playing');
    sim.player.position = { x: node.position.x, z: node.position.z - 1.4 }; sim.swordCooldown = 0; sim.attack(node.id, 'heavy'); expect(sim.carried.iron).toBe(8);
    const restored = new Simulation(); restoreRun(restored, captureRun(sim)); restored.start();
    restored.cycle.state.period = 'night'; restored.cycle.state.periodElapsed = restored.cycle.settings.nightDuration; restored.update(.01);
    expect(restored.encounters.forgeGuardianDefeated).toBe(true); expect(restored.resourceNodes.find(n => n.id === node.id)!.health).toBe(160);
    step(restored, 4); expect(restored.zombies.some(z => z.kind === 'guardian')).toBe(false);
  });
  it('saves an unfinished windup instead of granting another immediate boss attack on reload', () => {
    const sim = approach(); step(sim, .4); const saved = captureRun(sim), restored = new Simulation(); restoreRun(restored, saved);
    expect(restored.zombies[0].windup).toBeCloseTo(sim.zombies[0].windup);
    restored.update(3); expect(restored.player.hp).toBe(100); restored.start(); step(restored, .7); expect(restored.player.hp).toBe(72);
  });
  it('returns home when the player leaves its territory and routes around solid scenery', () => {
    const sim = approach(), guardian = sim.zombies[0]; guardian.windup = 0; guardian.windupTarget = null; guardian.position = { x: encounters.forgeGuardian.position.x+4, z: encounters.forgeGuardian.position.z };
    sim.player.position = { x: 1.5, z: -7 }; step(sim, 7);
    expect(guardian.intent).toBe('guard'); expect(guardian.position.x).toBeLessThan(encounters.forgeGuardian.position.x+1); expect(sim.shelter.hp).toBe(300);
    const nav = new NavigationGrid(sim.obstacles), from = { x: -7, z: 4 }, to = { x: 9, z: 4 }, route = nav.routeTo(from, to);
    expect(route.length).toBeGreaterThan(1); let previous = from;
    for (const point of route) { expect(nav.canWalk(previous, point)).toBe(true); expect(isBlocked(point, .35, sim.obstacles)).toBe(false); previous = point; }
  });
});
