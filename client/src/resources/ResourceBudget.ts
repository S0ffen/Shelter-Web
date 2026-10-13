import type { ResourceCounts } from '../domain/types';
import type { ResourceManager } from './ResourceManager';

/** Spend personal materials first, then cover each shortage from the shared warehouse. */
export function resourceFunding(cost: ResourceCounts, warehouse: ResourceManager, carried?: ResourceManager) {
  const personal = { wood: 0, iron: 0 }, shared = { wood: 0, iron: 0 };
  let affordable = true;
  for (const kind of ['wood', 'iron'] as const) {
    if (!Number.isSafeInteger(cost[kind]) || cost[kind] < 0) affordable = false;
    personal[kind] = Math.min(cost[kind], carried?.counts[kind] ?? 0);
    shared[kind] = cost[kind] - personal[kind];
    if (warehouse.counts[kind] < shared[kind]) affordable = false;
  }
  return { personal, shared, affordable };
}

/** Validate the complete bill before mutating either inventory. */
export function spendResources(cost: ResourceCounts, warehouse: ResourceManager, carried?: ResourceManager): boolean {
  const bill = resourceFunding(cost, warehouse, carried);
  if (!bill.affordable) return false;
  carried?.spend(bill.personal);
  warehouse.spend(bill.shared);
  return true;
}
