import { CONFIG } from '../domain/config';
import type { Position } from '../domain/types';

/** Gameplay state: no renderer, camera, DOM or networking dependency. */
export class Player {
  readonly maxHp = CONFIG.player.hp;
  hp: number = this.maxHp;
  position: Position = { ...CONFIG.player.spawn };
  yaw = 0;

  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }
}
