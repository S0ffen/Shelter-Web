export enum ResourceType {
  Wood = 'wood',
  Iron = 'iron',
}

export type ResourceKind = 'wood' | 'iron';
export const RESOURCE_NAMES: Record<ResourceKind, string> = { wood: 'Wood', iron: 'Iron' };
