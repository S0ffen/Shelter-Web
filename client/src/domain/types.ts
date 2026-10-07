export interface Position { x: number; z: number }
export type MatchPhase = 'ready' | 'playing' | 'paused' | 'lost' | 'won';
export type ZombieIntent = 'shelter' | 'player' | 'patrol' | 'guard';
export interface ResourceCounts { wood: number; iron: number }
export type AttackKind = 'quick' | 'heavy';
export type GameEvent =
  | { type: 'resources-deposited'; amount: ResourceCounts }
  | { type: 'corruption-hit'; damage: number }
  | { type: 'night-warning'; seconds: number }
  | { type: 'building-hit'; buildingId: string; damage: number }
  | { type: 'building-destroyed'; buildingId: string; kind: string; lostResources: ResourceCounts }
  | { type: 'run-completed' }
  | { type: 'guardian-defeated' }
  | { type: 'boss-windup'; zombieId: string; position: Position }
  | { type: 'boss-slam'; zombieId: string; position: Position }
  | { type: 'swing'; kind: AttackKind }
  | { type: 'shelter-repaired'; amount: number }
  | { type: 'action-blocked'; message: string }
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
