import { CONFIG } from '../domain/config';
import { distance } from '../domain/types';
import type { Position } from '../domain/types';
import type { Player } from '../player/Player';
import { hasLineOfSight, isBlocked } from '../world/WorldLayout';
import type { Zombie } from './Zombie';
import type { Footprint } from '../world/WorldLayout';

export class ZombieAI {
  /** Decisions run at 5 Hz. Movement is stepped separately at 30 Hz. */
  decide(zombie: Zombie, player: Player, obstacles: readonly Footprint[] = []): void {
    zombie.intent = distance(zombie.position, player.position) <= CONFIG.zombie.aggroRange &&
      hasLineOfSight(zombie.position, player.position, obstacles) ? 'player' : zombie.mode === 'patrol' ? 'patrol' : 'shelter';

    if (zombie.intent === 'shelter' && zombie.route.length > 0) {
      // Rejoin the nearest authored waypoint after losing a pursuing target.
      let nearest = zombie.routeIndex;
      let best = distance(zombie.position, zombie.route[nearest]);
      for (let i = nearest + 1; i < zombie.route.length; i++) {
        const d = distance(zombie.position, zombie.route[i]);
        if (d < best && hasLineOfSight(zombie.position, zombie.route[i], obstacles)) { nearest = i; best = d; }
      }
      zombie.routeIndex = nearest;
      if (best < 0.2 && zombie.routeIndex < zombie.route.length - 1) zombie.routeIndex++;
    }
  }

  move(zombie: Zombie, target: Position, dt: number, obstacles: readonly Footprint[] = []): void {
    const d = distance(zombie.position, target);
    if (d < 0.05) return;
    const step = Math.min(CONFIG.zombie.speed * dt, d);
    const dx = (target.x - zombie.position.x) / d * step;
    const dz = (target.z - zombie.position.z) / d * step;
    if (!isBlocked({ x: zombie.position.x + dx, z: zombie.position.z }, 0.35, obstacles)) zombie.position.x += dx;
    if (!isBlocked({ x: zombie.position.x, z: zombie.position.z + dz }, 0.35, obstacles)) zombie.position.z += dz;
  }
}
