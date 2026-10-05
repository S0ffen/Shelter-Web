import type { ResourceCounts } from '../domain/types';
import type { ResourceKind } from './ResourceType';
import { CONFIG } from '../domain/config';

export class ResourceManager {
  readonly counts: ResourceCounts = { wood: 0, iron: 0 };
  readonly capacity: ResourceCounts = { ...CONFIG.resources.capacity };

  canAccept(kind: ResourceKind, amount: number): boolean {
    return Number.isFinite(amount) && amount >= 0 && this.counts[kind] + amount <= this.capacity[kind];
  }

  add(kind: ResourceKind, amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    const accepted = Math.max(0, Math.min(Math.floor(amount), this.capacity[kind] - this.counts[kind]));
    this.counts[kind] += accepted;
    return accepted;
  }

  setCapacity(capacity: ResourceCounts): void {
    for (const kind of Object.keys(capacity) as ResourceKind[]) {
      this.capacity[kind] = capacity[kind];
      this.counts[kind] = Math.min(this.counts[kind], capacity[kind]);
    }
  }

  canAfford(cost: ResourceCounts): boolean {
    return (Object.keys(cost) as ResourceKind[]).every(kind => this.counts[kind] >= cost[kind]);
  }

  spend(cost: ResourceCounts): boolean {
    if (!this.canAfford(cost)) return false;
    for (const kind of Object.keys(cost) as ResourceKind[]) this.counts[kind] -= cost[kind];
    return true;
  }
}
