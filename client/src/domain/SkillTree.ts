import settings from '../../../shared/skills.json';
export const SKILL_SETTINGS = settings;
export const SKILL_BRANCHES = ['combat', 'survival', 'engineer'] as const;
export type SkillBranch = typeof SKILL_BRANCHES[number];
export type SkillLevels = Record<string, number>;
export type SkillBonuses = typeof settings.bonusDefaults;
export interface Perk {
  id: string;
  name: string;
  tier: number;
  effect: string;
  effects: Partial<Record<keyof SkillBonuses, number[]>>;
  maxRank: number;
  requires: {
    id: string;
    rank: number;
  }[];
}
export const PERKS: Perk[] = SKILL_BRANCHES.flatMap<Perk>(branch => settings.branches[branch] as Perk[]);
export const SKILL_IDS = PERKS.map(perk => perk.id);
export const emptySkillLevels = (): SkillLevels => Object.fromEntries(SKILL_IDS.map(id => [id, 0]));
export const branchSpent = (levels: SkillLevels, branch: SkillBranch): number => settings.branches[branch].reduce((sum, perk) => sum + (levels[perk.id] ?? 0), 0);
export function validSkillLevels(value: unknown): value is SkillLevels {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false;
  const levels = value as SkillLevels;
  return Object.keys(levels).length === SKILL_IDS.length && SKILL_BRANCHES.every(branch => settings.branches[branch].every(perk => {
    const rank = levels[perk.id];
    return Number.isInteger(rank) && rank >= 0 && rank <= perk.maxRank && (!rank ||
      (branchSpent(levels, branch) - rank >= settings.tierRequirements[perk.tier - 1] && perk.requires.every(required => levels[required.id] >= required.rank)));
  }));
}
export function skillBonuses(levels: SkillLevels): SkillBonuses {
  const result = { ...settings.bonusDefaults };
  for (const perk of PERKS)
    if (levels[perk.id] > 0)
      for (const [key, values] of Object.entries(perk.effects)) {
        result[key as keyof SkillBonuses] += values![levels[perk.id] - 1];
      }
  return result;
}
export class SkillTree {
  points = settings.initialPoints;
  levels = emptySkillLevels();
  get bonuses(): SkillBonuses { return skillBonuses(this.levels); }
  nextDay(): void { this.points += settings.pointsPerDay; }
  reason(id: string): string | null {
    const perk = PERKS.find(candidate => candidate.id === id);
    if (!perk)
      return 'Nieznana umiejętność';
    if (this.levels[id] >= perk.maxRank)
      return 'Maksymalna ranga';
    const branch = SKILL_BRANCHES.find(branch => settings.branches[branch].some(candidate => candidate.id === id))!;
    const threshold = settings.tierRequirements[perk.tier - 1];
    if (branchSpent(this.levels, branch) < threshold)
      return `Wymaga ${threshold} punktów w ${branch.toUpperCase()}`;
    for (const required of perk.requires)
      if (this.levels[required.id] < required.rank)
        return `${PERKS.find(candidate => candidate.id === required.id)!.name} ${required.rank}`;
    if (this.points < 1)
      return 'Brak Skill Points';
    return null;
  }
  buy(id: string): boolean {
    if (this.reason(id))
      return false; this.points--; this.levels[id]++; return true;
  }
}
