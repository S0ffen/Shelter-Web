import defaults from '../../../shared/zombies.json';
export type ZombieKind = keyof typeof defaults.types;
export const ZOMBIE_TYPES = defaults.types;
export const NIGHT_SPEED_MULTIPLIER = defaults.nightSpeedMultiplier;
