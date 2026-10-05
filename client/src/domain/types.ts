export interface Position { x: number; z: number }
export type MatchPhase = 'ready' | 'playing' | 'paused' | 'lost';
export type ZombieIntent = 'shelter' | 'player' | 'patrol';
export interface ResourceCounts { wood: number; iron: number }
export type GameEvent =
  | { type: 'swing' }
  | { type: 'zombie-hit'; zombieId: string; damage: number; source: 'sword' | 'tower' }
  | { type: 'zombie-dead'; zombieId: string }
  | { type: 'night-started'; day: number; waveSize: number }
  | { type: 'day-started'; day: number }
  | { type: 'player-hit'; damage: number }
  | { type: 'shelter-hit'; damage: number }
  | { type: 'resource-hit'; nodeId: string; damage: number }
  | { type: 'resource-gained'; kind: keyof ResourceCounts; amount: number }
  | { type: 'resource-destroyed'; nodeId: string }
  | { type: 'storage-full'; kind: keyof ResourceCounts; needed: number };

export const distance = (a: Position, b: Position): number => Math.hypot(a.x - b.x, a.z - b.z);
