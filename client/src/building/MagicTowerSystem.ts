import { CONFIG } from '../domain/config';
import type { Position } from '../domain/types';
import { distance } from '../domain/types';
import type { Zombie } from '../enemies/Zombie';
import { hasLineOfSight } from '../world/WorldLayout';
import type { Footprint } from '../world/WorldLayout';
import type { Building } from './Building';

export interface TowerState { buildingId: string; targetId: string | null; yaw: number; cooldown: number; powered: boolean }
export interface MagicProjectile {
  id: number;
  sourceId: string;
  targetId: string;
  position: Position & { y: number };
  lifetime: number;
}

/** Target decisions at 5 Hz; projectile flight and cooldowns use the fixed step. */
export class MagicTowerSystem {
  readonly towers = new Map<string, TowerState>();
  readonly projectiles: MagicProjectile[] = [];
  private scanCountdown = 0;
  private nextProjectileId = 1;
  restoreNextId(): void { this.nextProjectileId = Math.max(0, ...this.projectiles.map(projectile => projectile.id)) + 1; }

  update(dt: number, buildings: readonly Building[], enemies: readonly Zombie[], generatedPower: number,
    damage: (targetId: string, amount: number) => void, resourceObstacles: readonly Footprint[] = []): void {
    const constructions = buildings.filter(building => building.kind === 'magic-tower');
    for (const id of this.towers.keys()) if (!constructions.some(building => building.id === id)) this.towers.delete(id);
    this.scanCountdown -= dt;
    const scan = this.scanCountdown <= 0;
    if (scan) this.scanCountdown += CONFIG.tower.scanInterval;
    let allocatedPower = 0;
    for (const building of constructions) {
      let tower = this.towers.get(building.id);
      if (!tower) {
        tower = { buildingId: building.id, targetId: null, yaw: building.rotation, cooldown: 0, powered: false };
        this.towers.set(building.id, tower);
      }
      tower.powered = allocatedPower + CONFIG.power.towerDemand <= generatedPower;
      if (tower.powered) allocatedPower += CONFIG.power.towerDemand;
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      const obstacles = [...buildings.filter(other => other.id !== building.id).map(other => other.footprint), ...resourceObstacles];
      const visible = (enemy: Zombie): boolean => enemy.alive && distance(building.position, enemy.position) <= CONFIG.tower.range &&
        hasLineOfSight({ ...building.position, y: 2.9 }, { ...enemy.position, y: 1.15 }, obstacles);
      if (scan) {
        tower.targetId = tower.powered ? enemies.filter(visible)
          .sort((a, b) => distance(building.position, a.position) - distance(building.position, b.position))[0]?.id ?? null : null;
      }
      const target = enemies.find(enemy => enemy.id === tower.targetId);
      if (!tower.powered || !target || !visible(target)) { tower.targetId = null; continue; }
      tower.yaw = Math.atan2(target.position.x - building.position.x, target.position.z - building.position.z);
      if (tower.cooldown > 0) continue;
      tower.cooldown = CONFIG.tower.cooldown;
      this.projectiles.push({
        id: this.nextProjectileId++, sourceId: building.id, targetId: target.id, lifetime: CONFIG.tower.projectileLifetime,
        position: { x: building.position.x + Math.sin(tower.yaw) * 0.5, y: 2.9, z: building.position.z + Math.cos(tower.yaw) * 0.5 },
      });
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.lifetime -= dt;
      const target = enemies.find(enemy => enemy.id === projectile.targetId && enemy.alive);
      if (!target || projectile.lifetime <= 0) { this.projectiles.splice(i, 1); continue; }
      const dx = target.position.x - projectile.position.x;
      const dy = 1.15 - projectile.position.y;
      const dz = target.position.z - projectile.position.z;
      const d = Math.hypot(dx, dy, dz);
      const step = Math.min(d, CONFIG.tower.projectileSpeed * dt);
      const next = { x: projectile.position.x + dx / Math.max(d, 0.001) * step, y: projectile.position.y + dy / Math.max(d, 0.001) * step, z: projectile.position.z + dz / Math.max(d, 0.001) * step };
      const obstacles = [...buildings.filter(building => building.id !== projectile.sourceId).map(building => building.footprint), ...resourceObstacles];
      if (!hasLineOfSight(projectile.position, next, obstacles)) { this.projectiles.splice(i, 1); continue; }
      projectile.position = next;
      if (d <= step + 0.3) { damage(target.id, CONFIG.tower.damage); this.projectiles.splice(i, 1); }
    }
  }
}
