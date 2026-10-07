import type { Simulation } from './Simulation';
import { distance } from './types';
import type { Position } from './types';
import { inBase, inHall } from '../world/ShelterLayout';
import { hasLineOfSight } from '../world/WorldLayout';
export const CAMPFIRE_POSITION = { x: -2, z: 7 };
export const freshAbilities = () => ({ cloak: 0, cloakCooldown: 0, barrageCooldown: 0, demolitionCooldown: 0, shield: 0, shieldCooldown: 0, sinceDamage: 0, idle: 0, lastPosition: { x: 1.5, z: -7 } });
export function receivePlayerDamage(sim: Simulation, amount: number, psyche = false): number {
  if (sim.abilities.shield > 0)
    return 0;
  sim.abilities.cloak = 0;
  sim.abilities.sinceDamage = 0;
  const previousHp = sim.player.hp;
  sim.player.damage(psyche ? amount : Math.max(1, Math.round(amount * (1 - sim.skills.bonuses.armor))));
  const rank = sim.skills.bonuses.combatMaster;
  if (rank && sim.player.hp > 0 && sim.player.hp / sim.player.maxHp <= (rank === 1 ? .14 : .2) && sim.abilities.shieldCooldown === 0) {
    sim.abilities.shield = rank === 1 ? 4 : 5;
    sim.abilities.shieldCooldown = 90;
    sim.emit({ type: 'action-blocked', message: 'COMBAT MASTER · osłona awaryjna' });
  }
  return previousHp - sim.player.hp;
}
export function updatePassives(sim: Simulation, dt: number): void {
  const a = sim.abilities, b = sim.skills.bonuses;
  for (const key of ['cloak', 'cloakCooldown', 'barrageCooldown', 'demolitionCooldown', 'shield', 'shieldCooldown'] as const)
    a[key] = Math.max(0, a[key] - dt);
  a.sinceDamage = Math.min(3600, a.sinceDamage + dt);
  a.idle = distance(sim.player.position, a.lastPosition) < .01 && sim.swordCooldown === 0 ? Math.min(3600, a.idle + dt) : 0;
  a.lastPosition = { ...sim.player.position };
  const campfire = b.campfire && inHall(sim.player.position) && distance(sim.player.position, CAMPFIRE_POSITION) < 3.5;
  if (campfire) {
    sim.player.hp = Math.min(sim.player.maxHp, sim.player.hp + 2 * dt);
    sim.corruption.value = Math.max(0, sim.corruption.value - 4 * dt);
  }
  if (b.enduranceRegen && sim.corruption.value < 50 && a.sinceDamage > 5)
    sim.player.hp = Math.min(sim.player.maxHp, sim.player.hp + b.enduranceRegen * dt);
  if (b.autoRepair && a.idle > 1 && inBase(sim.player.position)) {
    const nearby = sim.buildingSystem.buildings.filter(building => building.alive && building.hp < building.maxHp && building.distanceFrom(sim.player.position) < 5 && hasLineOfSight(sim.player.position, building.contactPoint(sim.player.position), sim.obstacles.filter(area => area.x !== building.position.x || area.z !== building.position.z)));
    const core = sim.shelter.hp > 0 && sim.shelter.hp < sim.shelter.maxHp && sim.shelter.distanceFrom(sim.player.position) < 5 && hasLineOfSight(sim.player.position, sim.shelter.contactPoint(sim.player.position), sim.obstacles);
    // Repairs consume the same shared Wood/Iron as manual repairs, once per second.
    const previous = Math.floor(a.idle - dt), current = Math.floor(a.idle);
    if (current > previous && (nearby.length || core) && sim.resourceManager.spend({ wood: 2, iron: 1 })) {
      if (core)
        sim.shelter.hp = Math.min(sim.shelter.maxHp, sim.shelter.hp + sim.shelter.maxHp * b.autoRepair);
      for (const building of nearby)
        building.hp = Math.min(building.maxHp, building.hp + building.maxHp * b.autoRepair);
      sim.emit({ type: 'action-blocked', message: 'AUTO REPAIR · naprawa infrastruktury' });
    }
  }
}
export function useAbility(sim: Simulation, kind: 'barrage' | 'cloak' | 'demolition', target: Position): string {
  if (sim.phase !== 'playing')
    return 'Użyj podczas rozgrywki';
  if (!sim.skills.bonuses[kind])
    return 'Najpierw odblokuj umiejętność w Skill Tree';
  const cooldown = `${kind}Cooldown` as 'barrageCooldown' | 'cloakCooldown' | 'demolitionCooldown';
  if (sim.abilities[cooldown] > 0)
    return `Odnowienie · ${Math.ceil(sim.abilities[cooldown])} s`;
  if (kind === 'cloak') {
    sim.abilities.cloak = 15;
    sim.abilities.cloakCooldown = 90;
    return 'CLOAK · 15 s · pierwszy cios ×2';
  }
  if (!Number.isFinite(target.x) || !Number.isFinite(target.z) || distance(sim.player.position, target) > 20 || !hasLineOfSight(sim.player.position, target, sim.obstacles))
    return 'Cel poza zasięgiem lub za przeszkodą';
  sim.abilities[cooldown] = 90;
  const radius = kind === 'barrage' ? 7 : 5, damage = kind === 'barrage' ? 600 : 800;
  for (const zombie of sim.livingZombies)
    if (distance(zombie.position, target) < radius && hasLineOfSight(target, zombie.position, sim.obstacles))
      sim.damageZombie(zombie.id, damage, 'tower');
  sim.emit({ type: 'boss-slam', zombieId: kind, position: { ...target } });
  return kind === 'barrage' ? 'ARCANE BARRAGE' : 'WRECKING TEAM';
}
