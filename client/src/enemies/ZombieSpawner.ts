import type { Position } from '../domain/types';
import { distance } from '../domain/types';
import { Zombie } from './Zombie';
import { NavigationGrid, SPAWN_AREAS } from '../world/NavigationGrid';

export class ZombieSpawner {
  seed: number;
  nextId = 1;
  constructor(seed = Math.floor(Math.random() * 0xffffffff)) { this.seed = seed >>> 0; }
  random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
  spawn(navigation: NavigationGrid, player: Position, enemies: readonly Zombie[], mode: 'patrol' | 'siege'): Zombie | null {
    for (let attempt = 0; attempt < 80; attempt++) {
      const area = SPAWN_AREAS[Math.floor(this.random() * SPAWN_AREAS.length)];
      const point = { x: area.x + (this.random() - 0.5) * 5, z: area.z + (this.random() - 0.5) * 5 };
      if (distance(point, player) < 10 || enemies.some(enemy => enemy.alive && distance(point, enemy.position) < 1.2)) continue;
      const route = navigation.routeFrom(point);
      if (!route.length) continue;
      const zombie = new Zombie(`zombie-${this.nextId++}`, point);
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
