import { ZOMBIE_TYPES } from './ZombieTypes';
import type { ZombieKind } from './ZombieTypes';
import type { Position, ZombieIntent } from '../domain/types';

export class Zombie {
  constructor(readonly id = 'zombie-01', position: Position = { x: -6, z: 16 }, readonly kind: ZombieKind = 'normal') {
    this.hp = this.maxHp;
    this.position = { ...position };
    this.previousPosition = { ...position };
    this.origin = { ...position };
    this.patrolTarget = { ...position };
  }
  get stats() { return ZOMBIE_TYPES[this.kind]; }
  get maxHp(): number { return this.stats.hp; }
  hp: number;
  position: Position;
  previousPosition: Position;
  origin: Position;
  patrolTarget: Position;
  mode: 'patrol' | 'siege' | 'guard' = 'siege';
  specialCooldown = 3;
  chargeCooldown = 4;
  chargeRemaining = 0;
  chargeTarget: Position | null = null;
  chargeHit = false;
  summonCooldown = 10;
  retreatTimer = 0;
  slow = 0;
  windup = 0;
  windupTarget: Position | null = null;
  deathAge = 0;
  intent: ZombieIntent = 'shelter';
  routeIndex = 0;
  attackCooldown = 0;
  route: Position[] = [];

  get alive(): boolean { return this.hp > 0; }
  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }
}
