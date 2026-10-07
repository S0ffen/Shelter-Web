import { CONFIG } from '../domain/config';
import type { Position } from '../domain/types';

/** Gameplay state: no renderer, camera, DOM or networking dependency. */
export class Player {
  healthMultiplier = 1;
  get maxHp(): number { return Math.round(CONFIG.player.hp * this.healthMultiplier); }
  hp: number = this.maxHp;
  position: Position = { ...CONFIG.player.spawn };
  yaw = 0;

  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }
}
