import { SKILL_BRANCHES, SKILL_SETTINGS, branchSpent } from '../domain/SkillTree';
import type { SkillBranch } from '../domain/SkillTree';
import type { Simulation } from '../domain/Simulation';
export class SkillPanel {
  readonly element: HTMLElement;
  open = false;
  private lastKey = '';
  private branch: SkillBranch = 'combat';
  onClose: () => void = () => { };
  onBuy: (id: string) => void = () => { };
  constructor(root: HTMLElement) {
    this.element = document.createElement('section');
    this.element.className = 'skill-overlay';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Umiejętności');
    root.appendChild(this.element);
    this.element.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || button.disabled)
        return;
      if (button.dataset.perk)
        this.onBuy(button.dataset.perk);
      else if (button.dataset.tab) {
        this.branch = button.dataset.tab as SkillBranch;
        this.lastKey = '';
        if (this.sim)
          this.update(this.sim);
      }
      else
        this.onClose();
    });
    this.element.addEventListener('keydown', event => {
      if (event.code === 'Escape' || event.code === 'KeyN') {
        event.preventDefault();
        this.onClose();
      }
    });
  }
  private sim: Simulation | null = null;
  show(sim: Simulation): void { this.open = true; this.lastKey = ''; this.element.hidden = false; this.update(sim); this.element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }
  hide(): void { this.open = false; this.element.hidden = true; }
  update(sim: Simulation): void {
    this.sim = sim;
    if (!this.open)
      return;
    const allowed = ['playing', 'paused'].includes(sim.phase);
    const key = JSON.stringify([sim.skills.points, sim.skills.levels, allowed, this.branch]);
    if (key === this.lastKey)
      return;
    this.lastKey = key;
    const focused = (document.activeElement as HTMLElement)?.dataset.perk;
    this.element.innerHTML = `<div class="skill-card"><header><div><small>SKILL TREE</small><h2>Rozwój strażnika</h2></div><button class="skill-close" aria-label="Zamknij umiejętności">✕</button></header><p class="skill-points">SKILL POINTS <b>${sim.skills.points}</b><span>3 na start · +1 każdego dnia</span></p><nav class="skill-tabs" aria-label="Ścieżka rozwoju">${SKILL_BRANCHES.map(branch => `<button data-tab="${branch}" aria-pressed="${branch === this.branch}">${branch.toUpperCase()} <small>${branchSpent(sim.skills.levels, branch)}</small></button>`).join('')}</nav><div class="skill-tiers">${[1, 2, 3, 4].map(tier => `<section><h3>TIER ${['I', 'II', 'III', 'IV'][tier - 1]} <small>${SKILL_SETTINGS.tierRequirements[tier - 1]} pkt w ścieżce</small></h3><div class="skill-row">${SKILL_SETTINGS.branches[this.branch].filter(perk => perk.tier === tier).map(perk => {
      const rank = sim.skills.levels[perk.id], reason = sim.skills.reason(perk.id);
      return `<button data-perk="${perk.id}" ${!allowed || reason ? 'disabled' : ''} class="skill-perk ${rank ? 'owned' : !reason ? 'available' : 'locked'}"><small>${'●'.repeat(rank)}${'○'.repeat(perk.maxRank - rank)} · ${rank}/${perk.maxRank}</small><b>${perk.name}</b><span>${perk.effect}</span><em>${rank === perk.maxRank ? 'MAX' : reason ?? 'ULEPSZ · 1 PUNKT'}</em></button>`;
    }).join('')}</div></section>`).join('')}</div><p class="skill-note">Punkty rozdajesz w dowolnym miejscu, w dzień i w nocy. Wyższe poziomy wymagają inwestycji w wybraną ścieżkę.</p><small>N / Escape · powrót do gry</small></div>`;
    if (focused)
      this.element.querySelector<HTMLButtonElement>(`button[data-perk="${focused}"]:not(:disabled)`)?.focus();
  }
}
