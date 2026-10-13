export const BASIC_ENEMY_KINDS = ['normal', 'fast', 'tank'] as const;
export type BasicEnemyKind = typeof BASIC_ENEMY_KINDS[number];
export type EnemyModelSourceId = 'hollow-warrior' | 'undead-knight' | 'feral-ghoul';

export interface EnemyModelSource {
  readonly url: string;
  readonly available: boolean;
  readonly title: string;
  readonly referenceUrl: string;
}
export interface EnemyModelProfile {
  readonly source: EnemyModelSourceId;
  readonly height: number;
  readonly widthScale: number;
  readonly depthScale: number;
  readonly yaw: number;
  readonly tint: string;
}

// Checked local copies of the user-supplied GLB models. Disabling an entry keeps the
// procedural opponent in place and prevents a request for an unavailable asset.
export const ENEMY_MODEL_SOURCES: Readonly<Record<EnemyModelSourceId, EnemyModelSource>> = {
  'hollow-warrior': {
    url: '/models/enemies/hollow-warrior.glb', available: true,
    title: 'Skeleton Warrior - Undead Knight',
    referenceUrl: 'https://pixabay.com/3d-models/skeleton-warrior-undead-knight-4237/',
  },
  'undead-knight': {
    url: '/models/enemies/undead-knight.glb', available: true,
    title: 'Dark Fantasy Knight - Undead Warrior',
    referenceUrl: 'https://pixabay.com/3d-models/dark-fantasy-knight-undead-warrior-3471/',
  },
  'feral-ghoul': {
    url: '/models/enemies/feral-ghoul.glb', available: true,
    title: 'Bigfoot Ghoul - Horror Creature',
    referenceUrl: 'https://pixabay.com/3d-models/bigfoot-ghoul-horror-creature-1716/',
  },
};

// Babylon retains the glTF handedness root (rotation Y=PI, scale Z=-1).
// The animation preparation step bakes all three assets to authored +Z forward.
export const ENEMY_MODEL_PROFILES: Readonly<Record<BasicEnemyKind, EnemyModelProfile>> = {
  normal: { source: 'hollow-warrior', height: 1.9, widthScale: 1, depthScale: 1, yaw: 0, tint: '#ffffff' },
  tank: { source: 'undead-knight', height: 2.3, widthScale: 1, depthScale: 1, yaw: 0, tint: '#ffffff' },
  fast: { source: 'feral-ghoul', height: 1.8, widthScale: 1, depthScale: 1, yaw: 0, tint: '#ffffff' },
};

export function isBasicEnemyKind(kind: string): kind is BasicEnemyKind {
  return BASIC_ENEMY_KINDS.some(candidate => candidate === kind);
}
