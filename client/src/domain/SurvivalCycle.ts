import defaults from '../../../shared/survival.json';

export interface SurvivalSettings {
  dayDuration: number;
  nightMinimumDuration: number;
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

/** The night ends only after its spawn queue and all living enemies are cleared. */
export class SurvivalCycle {
  state: CycleState = { day: 1, period: 'day', periodElapsed: 0, pendingSpawns: 0, waveSize: 0, spawnCountdown: 0, patrolCountdown: 0 };
  constructor(readonly settings: SurvivalSettings = { ...SURVIVAL_SETTINGS }) {}
  get secondsRemaining(): number {
    return Math.max(0, (this.state.period === 'day' ? this.settings.dayDuration : this.settings.nightMinimumDuration) - this.state.periodElapsed);
  }
  update(dt: number, alive: number): 'night-started' | 'day-started' | null {
    this.state.periodElapsed += dt;
    this.state.spawnCountdown = Math.max(0, this.state.spawnCountdown - dt);
    this.state.patrolCountdown = Math.max(0, this.state.patrolCountdown - dt);
    if (this.state.period === 'day' && this.secondsRemaining === 0) {
      this.state.period = 'night';
      this.state.periodElapsed = 0;
      this.state.waveSize = Math.min(this.settings.maxWaveSize, this.settings.baseWaveSize + (this.state.day - 1) * this.settings.waveGrowth);
      this.state.pendingSpawns = Math.max(0, this.state.waveSize - alive);
      this.state.spawnCountdown = 0;
      return 'night-started';
    }
    if (this.state.period === 'night' && this.secondsRemaining === 0 && this.state.pendingSpawns === 0 && alive === 0) {
      this.state.period = 'day';
      this.state.day++;
      this.state.periodElapsed = 0;
      this.state.patrolCountdown = this.settings.patrolRespawnInterval;
      return 'day-started';
    }
    return null;
  }
  wantsSpawn(alive: number): boolean {
    if (alive >= this.settings.maxAliveZombies) return false;
    return this.state.period === 'night'
      ? this.state.pendingSpawns > 0 && this.state.spawnCountdown === 0
      : alive < this.settings.dayPatrolCount && this.state.patrolCountdown === 0;
  }
  spawned(): void {
    if (this.state.period === 'night') {
      this.state.pendingSpawns--;
      this.state.spawnCountdown = this.settings.spawnInterval;
    } else this.state.patrolCountdown = this.settings.patrolRespawnInterval;
  }
}
