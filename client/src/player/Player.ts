import { CONFIG } from '../domain/config';
import settings from '../../../shared/player.json';
export const PLAYER_SETTINGS = settings;
import type { Position } from '../domain/types';

/** Gameplay state: no renderer, camera, DOM or networking dependency. */
export class Player {
  healthMultiplier = 1;
  get maxHp(): number { return Math.round(CONFIG.player.hp * this.healthMultiplier); }
  hp: number = this.maxHp;
  position: Position = { ...CONFIG.player.spawn };
  yaw = 0;
  /** Feet height relative to city streets; the final boss pit is below zero. */
  height = 0;
  verticalVelocity = 0;
  respawnRemaining = 0;
  protectionRemaining = 0;
  get alive(): boolean { return this.hp > 0; }

  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }
}
