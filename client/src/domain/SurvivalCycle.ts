import { nightModifierForDay } from './NightModifier';
import defaults from '../../../shared/survival.json';

export interface SurvivalSettings {
  miniWaveCount: number;
  miniWaveSpawnFraction: number;
  warningSeconds: number[];
  dayDuration: number;
  nightDuration: number;
  baseWaveSize: number;
  waveGrowth: number;
  maxWaveSize: number;
  spawnInterval: number;
  maxAliveZombies: number;
  dayPatrolCount: number;
  patrolRespawnInterval: number;
}

export const SURVIVAL_SETTINGS: SurvivalSettings = defaults;

export interface CycleState {
  day: number; period: 'day' | 'night'; periodElapsed: number;
  pendingSpawns: number; waveSize: number; spawnCountdown: number; patrolCountdown: number;
}

/** Fixed length phases; increasing bursts leave breathing room between mini-waves. */
export class SurvivalCycle {
  state: CycleState = { day: 1, period: 'day', periodElapsed: 0, pendingSpawns: 0, waveSize: 0, spawnCountdown: 0, patrolCountdown: 0 };
  constructor(readonly settings: SurvivalSettings = { ...SURVIVAL_SETTINGS }) {}
  get modifier() { return nightModifierForDay(this.state.day); }
  get secondsRemaining(): number {
    return Math.max(0, (this.state.period === 'day' ? this.settings.dayDuration : this.settings.nightDuration) - this.state.periodElapsed);
  }
  update(dt: number, _alive: number): 'night-started' | 'day-started' | null {
    this.state.periodElapsed += dt;
    this.state.spawnCountdown = Math.max(0, this.state.spawnCountdown - dt);
    this.state.patrolCountdown = Math.max(0, this.state.patrolCountdown - dt);
    if (this.state.period === 'day' && this.secondsRemaining === 0) {
      this.state.period = 'night';
      this.state.periodElapsed = 0;
      this.state.waveSize = Math.min(this.settings.maxWaveSize, Math.ceil((this.settings.baseWaveSize + (this.state.day - 1) * this.settings.waveGrowth) * (this.modifier?.waveMultiplier ?? 1)));
      // Each night brings a new horde. Survivors still occupy the active-enemy cap,
      // but do not consume the new night's first mini-wave quota.
      this.state.pendingSpawns = this.state.waveSize;
      this.state.spawnCountdown = 0;
      return 'night-started';
    }
    if (this.state.period === 'night' && this.secondsRemaining === 0) {
      this.state.period = 'day';
      this.state.day++;
      this.state.pendingSpawns = 0;
      this.state.waveSize = 0;
      this.state.periodElapsed = 0;
      this.state.patrolCountdown = this.settings.patrolRespawnInterval;
      return 'day-started';
    }
    return null;
  }
  get miniWaveIndex(): number { return Math.min(this.settings.miniWaveCount - 1, Math.floor(this.state.periodElapsed / (this.settings.nightDuration / this.settings.miniWaveCount))); }
  private get inSpawnWindow(): boolean { return this.state.periodElapsed % (this.settings.nightDuration / this.settings.miniWaveCount) < this.settings.nightDuration / this.settings.miniWaveCount * this.settings.miniWaveSpawnFraction; }
  private get releasedQuota(): number {
    const wave = this.miniWaveIndex + 1;
    return Math.ceil(this.state.waveSize * wave * (wave + 1) / (this.settings.miniWaveCount * (this.settings.miniWaveCount + 1)));
  }
  wantsSpawn(alive: number): boolean {
    if (alive >= this.settings.maxAliveZombies) return false;
    return this.state.period === 'night'
      ? this.state.pendingSpawns > 0 && this.state.spawnCountdown === 0 && this.inSpawnWindow && this.state.waveSize - this.state.pendingSpawns < this.releasedQuota
      : alive < this.settings.dayPatrolCount && this.state.patrolCountdown === 0;
  }
  spawned(): void {
    if (this.state.period === 'night') {
      if (this.state.pendingSpawns === 0) return;
      this.state.pendingSpawns--;
      const segment = this.settings.nightDuration / this.settings.miniWaveCount;
      const remainingWindow = Math.max(0, segment * this.settings.miniWaveSpawnFraction - this.state.periodElapsed % segment);
      const remainingQuota = Math.max(0, this.releasedQuota - (this.state.waveSize - this.state.pendingSpawns));
      // Recalculate from time left rather than adding rounded frame delays: dense
      // late-game bursts must still finish before their scheduled breathing gap.
      this.state.spawnCountdown = Math.min(this.settings.spawnInterval, remainingWindow / (remainingQuota + 1));
    } else this.state.patrolCountdown = this.settings.patrolRespawnInterval;
  }
}
