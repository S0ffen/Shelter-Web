import { CONFIG } from '../domain/config';
import defense from '../../../shared/defense.json';
import type { Position } from '../domain/types';

export const SHELTER_LEVELS = defense.levels;
export const SHELTER_REPAIR = defense.repair;
export class Shelter {
  level = 1;
  get maxHp(): number { return SHELTER_LEVELS[this.level - 1].maxHp; }
  get armor(): number { return SHELTER_LEVELS[this.level - 1].armor; }
  hp: number = this.maxHp;
  readonly position: Position = { ...CONFIG.shelter.position };
  damage(amount: number): number {
    const actual = Math.min(this.hp, Math.ceil(amount * (1 - this.armor)));
    this.hp -= actual; return actual;
  }
  upgrade(): void {
    const oldMaximum = this.maxHp;
    this.level = Math.min(SHELTER_LEVELS.length, this.level + 1);
    this.hp += this.maxHp - oldMaximum;
  }
  /** Closest surface point lets melee line-of-sight stop at the pillar, rather than pass through it. */
  contactPoint(from: Position): Position {
    return { x: Math.max(this.position.x - CONFIG.shelter.halfWidth, Math.min(this.position.x + CONFIG.shelter.halfWidth, from.x)),
      z: Math.max(this.position.z - CONFIG.shelter.halfDepth, Math.min(this.position.z + CONFIG.shelter.halfDepth, from.z)) };
  }
  distanceFrom(position: Position): number {
    const dx = Math.max(0, Math.abs(position.x - this.position.x) - CONFIG.shelter.halfWidth);
    const dz = Math.max(0, Math.abs(position.z - this.position.z) - CONFIG.shelter.halfDepth);
    return Math.hypot(dx, dz);
  }
}
