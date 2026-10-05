import { parseRun } from './RunSnapshot';
import type { RunSnapshot } from './RunSnapshot';

const KEY = 'fantasy-shelter.run.v2';
const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5080';

/** Local fallback plus serialized SQLite writes; the latest checkpoint never races an older write. */
export class SaveService {
  private queue: Promise<unknown> = Promise.resolve();
  private local: RunSnapshot | null = null;
  online = false;
  incompatibleSave = false;
  constructor() {
    try {
      this.local = parseRun(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
      this.incompatibleSave = !this.local && localStorage.getItem('fantasy-shelter.run.v1') !== null;
    } catch { /* Corrupt storage is ignored. */ }
  }
  get latest(): RunSnapshot | null { return this.local ? structuredClone(this.local) : null; }
  async initialize(): Promise<RunSnapshot | null> {
    try {
      const health = await fetch(API + '/api/health', { signal: AbortSignal.timeout(2000) });
      if (!health.ok) return this.latest;
      this.online = true;
      const response = await fetch(API + '/api/checkpoint', { signal: AbortSignal.timeout(2000) });
      if (response.status === 200) {
        const raw = await response.json();
        const remote = parseRun(raw);
        if (raw?.version === 1) this.incompatibleSave = true;
        if (remote && (!this.local || Date.parse(remote.savedAt) > Date.parse(this.local.savedAt))) this.remember(remote);
      }
    } catch { this.online = false; }
    return this.latest;
  }
  private remember(snapshot: RunSnapshot): boolean {
    this.local = structuredClone(snapshot);
    try { localStorage.setItem(KEY, JSON.stringify(snapshot)); return true; } catch { return false; }
  }
  save(snapshot: RunSnapshot): Promise<'sqlite' | 'local' | 'memory'> {
    const persistent = this.remember(snapshot);
    const localResult = persistent ? 'local' : 'memory';
    const operation = this.queue.then(async (): Promise<'sqlite' | 'local' | 'memory'> => {
      try {
        const response = await fetch(API + '/api/checkpoint', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), signal: AbortSignal.timeout(2500),
        });
        this.online = response.ok;
        return response.ok ? 'sqlite' : localResult;
      } catch { this.online = false; return localResult; }
    });
    this.queue = operation;
    return operation;
  }
  async recordResult(snapshot: { runId: string; day: number; kills: number; elapsed: number }): Promise<void> {
    try {
      const response = await fetch(API + '/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), signal: AbortSignal.timeout(2500) });
      this.online = response.ok;
    } catch { this.online = false; }
  }
}
