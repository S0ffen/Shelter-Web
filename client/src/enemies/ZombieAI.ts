import { CONFIG } from '../domain/config';
import { NIGHT_SPEED_MULTIPLIER } from './ZombieTypes';
import { distance } from '../domain/types';
import type { Position } from '../domain/types';
import type { Player } from '../player/Player';
import { hasLineOfSight, isBlocked } from '../world/WorldLayout';
import type { Zombie } from './Zombie';
import type { Footprint } from '../world/WorldLayout';

export class ZombieAI {
  private walkable(from:Position,to:Position,obstacles:readonly Footprint[]):boolean {
    const steps=Math.max(1,Math.ceil(distance(from,to)/.25));
    for(let i=0;i<=steps;i++){const t=i/steps;if(isBlocked({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t},.35,obstacles))return false;}
    return true;
  }
  /** Decisions run at 5 Hz. Movement is stepped separately at 30 Hz. */
  decide(zombie: Zombie, player: Player, obstacles: readonly Footprint[] = []): void {
    const range = distance(zombie.position, player.position);
    let chase = range <= CONFIG.zombie.aggroRange && hasLineOfSight(zombie.position, player.position, obstacles);
    // Seeing through a window must not make a distant zombie run forever into its sill.
    if (chase && range > CONFIG.zombie.attackRange) {
      const steps = Math.max(1, Math.ceil(range / 0.25));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (isBlocked({ x: zombie.position.x + (player.position.x - zombie.position.x) * t,
          z: zombie.position.z + (player.position.z - zombie.position.z) * t }, 0.35, obstacles)) { chase = false; break; }
      }
    }
    zombie.intent = chase ? 'player' : zombie.mode === 'patrol' ? 'patrol' : 'shelter';

    if (zombie.intent === 'shelter' && zombie.route.length > 0) {
      // Rejoin the nearest authored waypoint after losing a pursuing target.
      let nearest = zombie.routeIndex;
      let best = distance(zombie.position, zombie.route[nearest]);
      for (let i = nearest + 1; i < zombie.route.length; i++) {
        const d = distance(zombie.position, zombie.route[i]);
        if (d < best && this.walkable(zombie.position, zombie.route[i], obstacles)) { nearest = i; best = d; }
      }
      zombie.routeIndex = nearest;
      if (best < 0.2 && zombie.routeIndex < zombie.route.length - 1) zombie.routeIndex++;
    }
  }

  move(zombie: Zombie, target: Position, dt: number, obstacles: readonly Footprint[] = [], night = false, multiplier = 1): void {
    const d = distance(zombie.position, target);
    if (d < 0.05) return;
    const step = Math.min(zombie.stats.speed * (night ? NIGHT_SPEED_MULTIPLIER : 1) * multiplier * dt, d);
    const dx = (target.x - zombie.position.x) / d * step;
    const dz = (target.z - zombie.position.z) / d * step;
    if (!isBlocked({ x: zombie.position.x + dx, z: zombie.position.z }, 0.35, obstacles)) zombie.position.x += dx;
    if (!isBlocked({ x: zombie.position.x, z: zombie.position.z + dz }, 0.35, obstacles)) zombie.position.z += dz;
  }
}
