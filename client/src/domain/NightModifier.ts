import definitions from '../../../shared/night-modifiers.json';

export interface NightModifier { id: string; label: string; every: number; waveMultiplier: number; skyColor: string; lightColor: string; }
/** Adding another modifier requires a shared definition, not another day-specific conditional. */
export function nightModifierForDay(day: number): NightModifier | null {
  const match = Object.entries(definitions).find(([, modifier]) => day > 0 && day % modifier.every === 0);
  return match ? { id: match[0], ...match[1] } : null;
}
