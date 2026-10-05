import { CONFIG } from '../domain/config';
import type { Position } from '../domain/types';

export class Shelter {
  readonly maxHp = CONFIG.shelter.hp;
  hp: number = this.maxHp;
  readonly position: Position = { ...CONFIG.shelter.position };

  damage(amount: number): void { this.hp = Math.max(0, this.hp - amount); }

  distanceFrom(position: Position): number {
    const dx = Math.max(0, Math.abs(position.x - this.position.x) - CONFIG.shelter.halfWidth);
    const dz = Math.max(0, Math.abs(position.z - this.position.z) - CONFIG.shelter.halfDepth);
    return Math.hypot(dx, dz);
  }
}
