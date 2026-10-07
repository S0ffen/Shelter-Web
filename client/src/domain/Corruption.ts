import settings from '../../../shared/corruption.json';

export const CORRUPTION_SETTINGS = settings;
export class Corruption {
  value = 0;
  damageElapsed = 0;
  get maximum(): boolean { return this.value >= settings.maximum; }
  get movementMultiplier(): number { return this.maximum ? settings.movementAtMaximum : 1; }
  update(dt: number, protectedByShelter: boolean, exposureMultiplier = 1): number {
    if (protectedByShelter) {
      this.value = Math.max(0, this.value - settings.recoveryPerSecond * dt);
      this.damageElapsed = 0;
      return 0;
    }
    const rate = settings.outsidePerSecond * exposureMultiplier;
    const timeUntilFull = rate > 0 ? Math.max(0, (settings.maximum - this.value) / rate) : Infinity;
    this.value = Math.min(settings.maximum, this.value + rate * dt);
    if (!this.maximum) { this.damageElapsed = 0; return 0; }
    this.damageElapsed += Math.max(0, dt - timeUntilFull);
    const ticks = Math.floor((this.damageElapsed + 1e-9) / settings.damageInterval);
    this.damageElapsed = Math.max(0, this.damageElapsed - ticks * settings.damageInterval);
    return ticks * settings.damage;
  }
}
