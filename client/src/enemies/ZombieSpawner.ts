import type { Position } from '../domain/types';
import { distance } from '../domain/types';
import { OUTER_PATROL_AREAS, sectorAt } from '../world/WorldLayout';
import { Zombie } from './Zombie';
import type { ZombieKind } from './ZombieTypes';
import { NavigationGrid, SPAWN_AREAS } from '../world/NavigationGrid';

export class ZombieSpawner {
  seed: number;
  nextId = 1;
  constructor(seed = Math.floor(Math.random() * 0xffffffff)) { this.seed = seed >>> 0; }
  random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
  spawn(navigation: NavigationGrid, player: Position, enemies: readonly Zombie[], mode: 'patrol' | 'siege', day = 1): Zombie | null {
    for (let attempt = 0; attempt < 80; attempt++) {
      const areas = mode === 'patrol' ? [...SPAWN_AREAS, ...OUTER_PATROL_AREAS, ...OUTER_PATROL_AREAS] : SPAWN_AREAS;
      const area = areas[Math.floor(this.random() * areas.length)];
      const point = { x: area.x + (this.random() - 0.5) * 5, z: area.z + (this.random() - 0.5) * 5 };
      if (distance(point, player) < 10 || enemies.some(enemy => enemy.alive && distance(point, enemy.position) < 1.2)) continue;
      const route = navigation.routeFrom(point);
      if (!route.length) continue;
      const roll = this.random();
      const tankChance = Math.min(0.32, 0.15 + (day - 1) * 0.02);
      const kind: ZombieKind = mode === 'patrol' && day === 1 && (sectorAt(point).risk ?? 1) < 2 ? 'normal' : mode === 'siege' && this.nextId % 4 === 1 ? 'fast' : mode === 'siege' && this.nextId % 4 === 2 ? 'tank' : roll < tankChance ? 'tank' : roll < tankChance + 0.3 ? 'fast' : 'normal';
      const zombie = new Zombie(`zombie-${this.nextId++}`, point, kind);
      zombie.mode = mode;
      zombie.route = route;
      return zombie;
    }
    return null;
  }
  patrolTarget(zombie: Zombie, navigation: NavigationGrid): Position {
    for (let attempt = 0; attempt < 12; attempt++) {
      const target = { x: zombie.origin.x + (this.random() - 0.5) * 8, z: zombie.origin.z + (this.random() - 0.5) * 8 };
      if (navigation.canWalk(zombie.position, target)) return target;
    }
    return { ...zombie.origin };
  }
}
