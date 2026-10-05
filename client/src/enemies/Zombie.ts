import { CONFIG } from '../domain/config';
import type { Position, ZombieIntent } from '../domain/types';

export class Zombie {
  constructor(readonly id = 'zombie-01', position: Position = { x: -6, z: 16 }) {
    this.position = { ...position };
    this.previousPosition = { ...position };
    this.origin = { ...position };
    this.patrolTarget = { ...position };
  }
  readonly maxHp = CONFIG.zombie.hp;
  hp: number = this.maxHp;
  position: Position;
  previousPosition: Position;
  origin: Position;
  patrolTarget: Position;
  mode: 'patrol' | 'siege' = 'siege';
  deathAge = 0;
  intent: ZombieIntent = 'shelter';
  routeIndex = 0;
  attackCooldown = 0;
  route: Position[] = [];

  get alive(): boolean { return this.hp > 0; }
  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }
}
