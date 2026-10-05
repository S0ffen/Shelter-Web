import type { ResourceType } from './ResourceType';
import definitions from '../../../shared/harvesting.json';

export interface HarvestThreshold { health: number; amount: number }
export interface ResourceDefinition {
  label: string;
  maxHealth: number;
  reward: readonly HarvestThreshold[];
  width: number;
  depth: number;
  height: number;
}

/** Shared health, rewards and dimensions for the client and persistence schema. */
export const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition> = definitions;
