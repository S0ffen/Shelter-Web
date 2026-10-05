import type { Position } from '../domain/types';
import type { Footprint } from '../world/WorldLayout';
import { RESOURCE_DEFINITIONS } from './HarvestingConfig';
import type { HarvestThreshold, ResourceDefinition } from './HarvestingConfig';
import { ResourceType } from './ResourceType';
import placements from '../../../shared/resources.json';

export interface HarvestHit { damage: number; reward: number; destroyed: boolean }

/** Shared gameplay model for all harvestable world objects; no Babylon dependency. */
export class ResourceNode {
  readonly definition: ResourceDefinition;
  readonly maxHealth: number;
  readonly reward: readonly HarvestThreshold[];
  private currentHealth: number;

  constructor(readonly id: string, readonly resourceType: ResourceType, readonly position: Position) {
    this.definition = RESOURCE_DEFINITIONS[resourceType];
    this.maxHealth = this.currentHealth = this.definition.maxHealth;
    this.reward = this.definition.reward;
  }

  get health(): number { return this.currentHealth; }
  get isDestroyed(): boolean { return this.health === 0; }
  get footprint(): Footprint { return { ...this.position, width: this.definition.width, depth: this.definition.depth }; }

  distanceFrom(position: Position): number {
    const dx = Math.max(0, Math.abs(position.x - this.position.x) - this.definition.width / 2);
    const dz = Math.max(0, Math.abs(position.z - this.position.z) - this.definition.depth / 2);
    return Math.hypot(dx, dz);
  }

  previewDamage(amount: number): HarvestHit {
    if (this.isDestroyed || !Number.isFinite(amount) || amount <= 0) return { damage: 0, reward: 0, destroyed: this.isDestroyed };
    const damage = Math.min(this.health, amount);
    const nextHealth = this.health - damage;
    const reward = this.reward.filter(step => this.health > step.health && nextHealth <= step.health)
      .reduce((sum, step) => sum + step.amount, 0);
    return { damage, reward, destroyed: nextHealth === 0 };
  }

  damage(amount: number): HarvestHit {
    const hit = this.previewDamage(amount);
    this.currentHealth -= hit.damage;
    return hit;
  }
}

/** Fixed, authored placements shared with the checkpoint server. */
export function createResourceNodes(): ResourceNode[] {
  return placements.map(node => new ResourceNode(node.id, node.type as ResourceType, { x: node.x, z: node.z }));
}
