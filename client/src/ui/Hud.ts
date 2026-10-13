import type { Simulation } from '../domain/Simulation';
import { resourceFunding } from '../resources/ResourceBudget';
import type { MatchPhase } from '../domain/types';
import type { BuildingController } from '../building/BuildingController';
import { BUILDINGS, GENERATOR_LEVELS, buildingMaxHp } from '../building/Building';
import { CONFIG } from '../domain/config';
import { RESOURCE_NAMES } from '../resources/ResourceType';
import { sectorAt } from '../world/WorldLayout';
import { SHELTER_CORE_ID, SHELTER_DEPOSIT_ID } from '../world/ShelterLayout';
import { SHELTER_LEVELS, SHELTER_REPAIR } from '../shelter/Shelter';
import { shelterGuide } from './ShelterGuide';
import { shelterHudState } from './HudState';

const wardIcon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2 28 10v13l-12 7-12-7V10Z" stroke="currentColor"/><path d="m16 8 6 9-6 8-6-8Z" stroke="currentColor"/><path d="M16 8v17M10 17h12" stroke="currentColor"/></svg>';

export class Hud {
  private readonly menu: HTMLElement;
  private readonly title: HTMLElement;
  private readonly description: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly eyebrow: HTMLElement;
  private readonly enemy: HTMLElement;
  private lastPhase: MatchPhase | null = null;
  private resumeAvailable = false;
  private toastUntil = 0;
  private readonly nodes: Record<string, HTMLElement> = {};
  onPrimary: () => void = () => {};
  onLoad: () => void = () => {};
  onSave: () => void = () => {};
  onSkills: () => void = () => {};
  onBuild: () => void = () => {};

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="vignette" aria-hidden="true"></div>
      <div id="damage-flash" aria-hidden="true"></div><div id="corruption-vignette" aria-hidden="true"></div>
      <section id="respawn-panel" class="respawn-panel" hidden aria-live="polite"><small>GUARDIAN FALLEN</small><h2>Respawning in <b id="respawn-clock">5</b> s</h2><p>The Shelter is still under attack. The run continues while its core survives.</p></section>
      <section class="run-hud" aria-label="Shelter resources and run status">
        <div class="run-cell"><span class="hud-icon wood-glyph">♧</span><label>WOOD</label><small id="wood-max">100</small><b id="wood">0</b></div>
        <div class="run-cell"><span class="hud-icon iron-glyph">▰</span><label>IRON</label><small id="iron-max">50</small><b id="iron">0</b></div>
        <div class="run-cell"><span class="hud-icon power-glyph">ϟ</span><label>ARCANE POWER</label><small id="power-max">0</small><b id="power-count">0</b></div>
        <div class="run-cell phase-cell"><span id="phase-icon" class="phase-icon" aria-hidden="true">☀</span><label id="cycle-label">DAY</label><b id="day-number">1 D.</b></div>
        <div class="run-cell kills-cell"><span class="hud-icon" aria-hidden="true">☠</span><label>ZOMBIES KILLED</label><b id="kill-count">0</b></div>
        <p class="phase-timer" id="cycle-clock">3:00 remaining</p>
      </section>
      <section class="expedition-hud" aria-label="Psyche and carried resources"><span class="psyche-icon" aria-hidden="true"><svg viewBox="0 0 36 40"><path d="M11 37v-9C4 24 4 15 7 9 10 2 21 1 27 7c4 4 5 8 4 13l3 5h-6v6H18v6" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 12c-3-5 6-7 7-3 5-5 11 2 6 5 5 4 0 9-4 6-2 5-8 2-7-2-5 0-5-6-2-6Zm6-3v14m-7-8h14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span><div class="corruption-gauge" role="progressbar" aria-label="Psyche" aria-valuemin="0" aria-valuemax="100"><label class="sr-only"><b id="corruption-value">100%</b></label><div class="bar"><i id="corruption-fill" style="width:0%"></i></div></div><div class="carried-cell"><small>WOOD · CARRIED</small><b id="carried-wood">0</b></div><div class="carried-cell"><small>IRON · CARRIED</small><b id="carried-iron">0</b></div></section>
      <header class="topbar">
        <div class="brand">${wardIcon}<div>FANTASY <b>SHELTER</b><span id="location">SHELTER</span></div></div>
        <div class="compass"><span>W</span><i></i><strong id="heading">N</strong><i></i><span>E</span></div>
        <div class="prototype"><span class="status-dot"></span> SOLO MODE<small id="save-status">Saved on this device</small></div>
      </header>
      <section class="objective"><span class="section-label">YOUR OBJECTIVE</span><h2 id="objective-title">Defend the Shelter</h2><p id="objective-text">Prepare for the night</p></section>
      <section class="boss-panel" id="boss-panel" hidden><span id="boss-name"></span><strong id="boss-hp"></strong><div class="bar"><i id="boss-fill"></i></div><small id="boss-intent"></small></section>
      <section class="shelter-guide" aria-label="Direction to the Shelter"><span id="guide-arrow" aria-hidden="true">↑</span><div><b id="guide-label">SHELTER</b><strong id="guide-distance">0 m</strong><small id="guide-hint">Base grounds</small></div></section>
      <section class="shelter-actions" id="shelter-actions" hidden aria-label="Shelter upgrades"><b>SHELTER WORKSHOP</b><p id="shelter-upgrade"></p><p id="shelter-repair"></p></section>
      <p class="night-hint" id="night-hint" hidden><kbd>N</kbd> Skills · <b id="skill-count">3</b>points</p>
      <section class="shelter-panel" aria-label="Shelter health">
        <div class="panel-heading">${wardIcon}<span>SHELTER CORE <small id="shelter-level">LV. 01</small></span><strong id="shelter-hp">300 <em>/ 300</em></strong></div>
        <div class="bar shelter-bar"><i id="shelter-fill"></i></div>
        <p id="shelter-status">The last safe refuge</p>
      </section>
      <section class="power-panel" aria-label="Power balance"><small id="power-status"></small><small id="cycle-detail"></small></section>
      <div id="explorer-readout" class="explorer-readout"></div><div id="ability-readout" class="ability-readout"></div>
      <div class="hit-marker" id="hit-marker" aria-hidden="true">×</div><div class="floating-gains" id="floating-gains"></div>
      <div class="reticle" id="reticle" aria-hidden="true"><i></i><i></i><i></i><i></i><span></span></div>
      <div class="enemy-info" id="enemy-info" hidden><span id="target-name">UNDEAD</span><div class="bar"><i id="enemy-fill"></i></div><small id="enemy-hp"></small></div>
      <p class="toast" id="toast" role="status" aria-live="polite"></p>
      <p class="interaction" id="interaction" hidden></p>
      <section class="build-panel" id="build-panel" hidden aria-label="Building">
        <span class="section-label">HOUSING</span>
        <div class="build-options"><span data-kind="storehouse"><kbd>1</kbd> Storehouse</span><span data-kind="arcane-core"><kbd>2</kbd> Arcane Generator</span><span data-kind="magic-tower"><kbd>3</kbd> Magic Tower</span></div>
        <p id="build-cost"></p><p id="build-effect"></p><p id="build-status"></p><small><kbd>Q</kbd> Rotate · <kbd>LMB</kbd> Place<br><kbd>B / RMB</kbd> Return to sword</small>
      </section>
      <nav class="shelter-shortcuts" aria-label="Shelter actions">
        <button id="housing-shortcut" type="button" aria-label="Housing (B)"><kbd>B</kbd><span>Housing</span></button>
        <button id="skills-shortcut" type="button" aria-label="Skill tree (N)"><kbd>N</kbd><span>Skill</span><b id="shortcut-points">3</b></button>
      </nav>
      <footer class="bottom-hud">
        <section class="player-panel"><div class="panel-heading"><span class="health-symbol">✚</span><span>HEALTH</span><strong id="player-hp">100 <em>/ 100</em></strong></div><div class="bar"><i id="player-fill"></i></div><span class="section-label player-caption">SHELTER GUARDIAN</span></section>
        <div class="weapon-panel"><span class="weapon-number">01</span><div><strong>Guardian Sword</strong><span id="sword-status">LMB · QUICK / RMB · HEAVY</span></div><div class="weapon-line"><i id="sword-fill"></i></div></div>
        <div class="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>MOUSE</kbd> Look around</span><span><kbd>LMB / RMB</kbd> Quick / heavy attack</span><span><kbd>B / 1–3</kbd> Build</span><span><kbd>N</kbd> Skills</span><span><kbd>E</kbd> Deposit</span><span><kbd>ESC</kbd> Pause</span><span><kbd>R</kbd> Restart</span></div>
      </footer>
      <div class="menu-overlay" id="menu-overlay">
        <section class="menu-card" aria-labelledby="menu-title">
          <div class="menu-eyebrow" id="menu-eyebrow"><span></span> FIRST RUN</div>
          <h1 id="menu-title">The last<br><em>refuge.</em></h1>
          <p class="menu-description" id="menu-description">The city fell silent. The dead did not.<br>Take up your sword and defend what remains.</p>
          <div id="end-statistics" class="end-statistics" hidden><div><small>DAY REACHED</small><b id="end-day">1</b></div><div><small>ZOMBIES KILLED</small><b id="end-kills">0</b></div></div>
          <div class="menu-divider"></div>
          <div class="briefing"><span>01</span><p>LMB: quick attack and core repair. RMB: heavy attack. Follow the arrow to the Shelter.</p></div>
          <div class="briefing"><span>02</span><p>Gather into your backpack. E at DEPOSIT: store or withdraw materials. B: build using carried supplies, then Shelter reserves.</p></div>
          <div class="briefing"><span>03</span><p>Explore by day. At night, defend the core inside the Shelter.</p></div>
          <button id="primary-action" class="primary-button">Enter the ruins <span>→</span></button>
          <button id="load-action" class="secondary-button" hidden>Resume checkpoint</button>
          <button id="save-action" class="secondary-button" hidden>Save run</button><button id="skills-action" class="secondary-button" hidden>Skills · N</button>
          <p class="menu-note" id="menu-note">Click to capture the cursor. Escape opens the pause menu.</p>
        </section>
        <div class="scene-caption"><span>VEYRHOLM</span><p>Not every light<br>promises salvation.</p><i></i></div>
        <div class="milestone-note">DAY / NIGHT <span>EXPLORATION / BUILDING / HORDES</span></div>
      </div>`;
    for (const id of ['respawn-panel', 'respawn-clock', 'explorer-readout','ability-readout','skills-action','end-statistics', 'end-day', 'end-kills', 'boss-panel', 'boss-name', 'boss-hp', 'boss-fill', 'boss-intent', 'hit-marker', 'floating-gains', 'skill-count', 'wood-max', 'iron-max', 'power-max', 'phase-icon', 'day-number', 'kill-count', 'carried-wood', 'carried-iron', 'corruption-value', 'corruption-fill', 'corruption-vignette', 'shelter-level', 'shelter-actions', 'shelter-upgrade', 'shelter-repair', 'shelter-hp', 'shelter-fill', 'shelter-status', 'player-hp', 'player-fill', 'objective-text', 'objective-title', 'location', 'wood', 'iron', 'enemy-fill', 'enemy-hp', 'target-name', 'heading', 'sword-fill', 'sword-status', 'toast', 'reticle', 'damage-flash', 'menu-note', 'interaction', 'build-panel', 'build-cost', 'build-status', 'build-effect', 'power-count', 'power-status', 'load-action', 'save-action', 'save-status', 'cycle-label', 'cycle-clock', 'cycle-detail', 'night-hint', 'guide-arrow', 'guide-label', 'guide-distance', 'guide-hint']) {
      this.nodes[id] = root.querySelector<HTMLElement>(`#${id}`)!;
    }
    this.menu = root.querySelector('#menu-overlay')!;
    this.title = root.querySelector('#menu-title')!;
    this.description = root.querySelector('#menu-description')!;
    this.button = root.querySelector('#primary-action')!;
    this.eyebrow = root.querySelector('#menu-eyebrow')!;
    this.enemy = root.querySelector('#enemy-info')!;
    this.button.addEventListener('click', () => this.onPrimary());
    this.nodes['load-action'].addEventListener('click', () => this.onLoad());
    this.nodes['save-action'].addEventListener('click', () => this.onSave());
    this.nodes['skills-action'].addEventListener('click',()=>this.onSkills());
    root.querySelector('#housing-shortcut')!.addEventListener('click', () => this.onBuild());
    root.querySelector('#skills-shortcut')!.addEventListener('click', () => this.onSkills());
    this.nodes['shortcut-points'] = root.querySelector('#shortcut-points')!;
    this.nodes['housing-shortcut'] = root.querySelector('#housing-shortcut')!;
    this.nodes['skills-shortcut'] = root.querySelector('#skills-shortcut')!;
  }

  update(sim: Simulation, targetId: string | null, build?: BuildingController): void {
    this.nodes['shortcut-points'].textContent = String(sim.skills.points);
    this.nodes['shortcut-points'].hidden = sim.skills.points === 0;
    this.nodes['housing-shortcut'].setAttribute('aria-pressed', String(Boolean(build?.active)));
    this.nodes['housing-shortcut'].toggleAttribute('disabled', !sim.player.alive);
    this.nodes['skills-shortcut'].toggleAttribute('disabled', !sim.player.alive);
    this.nodes['respawn-panel'].hidden = sim.player.alive || sim.phase !== 'playing';
    this.nodes['respawn-clock'].textContent = String(Math.ceil(sim.player.respawnRemaining));
    const explorer=sim.skills.bonuses.explorer;
    const nearest=(kind:string)=>sim.resourceNodes.filter(n=>!n.isDestroyed&&n.resourceType===kind).sort((a,b)=>Math.hypot(a.position.x-sim.player.position.x,a.position.z-sim.player.position.z)-Math.hypot(b.position.x-sim.player.position.x,b.position.z-sim.player.position.z))[0];
    const bearing=(p:{x:number,z:number})=>{const angle=Math.atan2(p.x-sim.player.position.x,p.z-sim.player.position.z)-sim.player.yaw;return ['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(angle/(Math.PI/4))%8+8)%8];};
    const scouting:string[]=[];
    if(explorer)for(const kind of explorer>=2?['wood','iron']:['wood']){const node=nearest(kind);if(node){const d=Math.hypot(node.position.x-sim.player.position.x,node.position.z-sim.player.position.z);if(d<=32)scouting.push(bearing(node.position)+' '+kind.toUpperCase()+' '+Math.ceil(d)+' m');}}
    if(explorer>=3){const enemy=sim.livingZombies.sort((a,b)=>Math.hypot(a.position.x-sim.player.position.x,a.position.z-sim.player.position.z)-Math.hypot(b.position.x-sim.player.position.x,b.position.z-sim.player.position.z))[0];if(enemy){const d=Math.hypot(enemy.position.x-sim.player.position.x,enemy.position.z-sim.player.position.z);if(d<20)scouting.push(bearing(enemy.position)+' ZOMBIE '+Math.ceil(d)+' m');}}
    this.nodes['explorer-readout'].textContent=scouting.join(' · ');
    this.nodes['ability-readout'].textContent=(['barrage','cloak','demolition'] as const).filter(key=>sim.skills.bonuses[key]).map((key)=>({barrage:'5 BARRAGE',cloak:'6 CLOAK',demolition:'7 WRECKING'}[key])+' · '+(sim.abilities[(key+'Cooldown') as 'barrageCooldown'|'cloakCooldown'|'demolitionCooldown']>0?Math.ceil(sim.abilities[(key+'Cooldown') as 'barrageCooldown'|'cloakCooldown'|'demolitionCooldown'])+'s':'READY')).join('   |   ');
    this.nodes['skill-count'].textContent = String(sim.skills.points);
    this.nodes['player-hp'].innerHTML = `${Math.ceil(sim.player.hp)} <em>/ ${sim.player.maxHp}</em>`;
    this.nodes['shelter-level'].textContent = `LV. ${String(sim.shelter.level).padStart(2, '0')}`;
    this.nodes['shelter-hp'].innerHTML = `${Math.ceil(sim.shelter.hp)} <em>/ ${sim.shelter.maxHp}</em>`;
    this.nodes['player-fill'].style.width = `${sim.player.hp / sim.player.maxHp * 100}%`;
    this.nodes['shelter-fill'].style.width = `${sim.shelter.hp / sim.shelter.maxHp * 100}%`;
    const corruption = Math.ceil(sim.corruption.value);
    const psyche=100-corruption;
    this.nodes['corruption-fill'].closest('[role="progressbar"]')?.setAttribute('aria-valuenow',String(psyche));
    this.nodes['corruption-value'].textContent = psyche + '%';
    this.nodes['corruption-fill'].style.width = psyche + '%';
    this.nodes['corruption-vignette'].style.setProperty('--corruption-opacity', String(sim.corruption.value / 100 * .75));
    this.nodes['corruption-vignette'].classList.toggle('corruption-critical', sim.corruption.maximum);
    this.nodes['carried-wood'].textContent = String(sim.carried.wood);
    this.nodes['carried-iron'].textContent = String(sim.carried.iron);
    const top = shelterHudState(sim);
    this.nodes['wood'].textContent = String(top.wood.current); this.nodes['wood-max'].textContent = String(top.wood.maximum);
    this.nodes['iron'].textContent = String(top.iron.current); this.nodes['iron-max'].textContent = String(top.iron.maximum);
    this.nodes['power-max'].textContent = String(top.power.maximum);
    this.nodes['day-number'].textContent = top.day + ' D.';
    this.nodes['kill-count'].textContent = String(top.kills);
    this.nodes['phase-icon'].textContent = top.night ? '☾' : '☀';
    const power = sim.buildingSystem.power;
    this.nodes['power-count'].textContent = String(power.available);
    this.nodes['power-status'].textContent = power.generated > 0 ? `Free / total power · used: ${power.used}` : 'Free / total power · build a generator';
    const guide = shelterGuide(sim.player.position, sim.player.yaw);
    this.nodes['shelter-actions'].hidden = !guide.inside || sim.phase !== 'playing' || Boolean(build?.active);
    const next = SHELTER_LEVELS[sim.shelter.level];
    this.nodes['shelter-upgrade'].textContent = next ? `F · Level ${sim.shelter.level + 1}: ${Math.ceil(next.cost.wood * sim.skills.bonuses.buildingCost)} Wood / ${Math.ceil(next.cost.iron * sim.skills.bonuses.buildingCost)} Iron · +${next.powerDemand - sim.buildingSystem.coreDemand()} power (${next.powerDemand} total) · ${next.maxHp} HP / armor ${Math.round(next.armor * 100)}% · daytime` : 'Shelter fully upgraded';
    this.nodes['shelter-repair'].textContent = sim.shelter.hp < sim.shelter.maxHp ? `LMB · Strike the core: +${Math.round(SHELTER_REPAIR.amount * sim.repairMultiplier)} HP · 2 Wood / 1 Iron` : 'Shelter core needs no repairs';
    this.nodes['guide-arrow'].style.transform = `rotate(${guide.angle}deg)`;
    this.nodes['guide-arrow'].hidden = guide.inside;
    this.nodes['guide-label'].textContent = guide.label;
    this.nodes['guide-distance'].textContent = guide.inside ? 'Inside the Shelter' : `${guide.meters} m`;
    this.nodes['guide-hint'].textContent = sim.finalArenaActive ? 'No way back · defeat the Curse Overlord' : guide.hint;
    const resource = sim.resourceNodes.find(node => node.id === targetId && !node.isDestroyed);
    const coreTarget = targetId === SHELTER_CORE_ID;
    this.nodes['interaction'].hidden = !(resource || coreTarget || targetId===SHELTER_DEPOSIT_ID) || sim.phase !== 'playing' || Boolean(build?.active);
    const structure = sim.buildingSystem.buildings.find(b => b.id === targetId);
    if (structure && sim.phase === 'playing' && !build?.active) {
      this.nodes['interaction'].hidden = false;
      const repair = structure.hp < structure.maxHp ? 'LMB · repair · 2 Wood / 1 Iron' : 'Structure at full health';
      if (structure.kind === 'arcane-core') {
        const nextGenerator = GENERATOR_LEVELS[structure.level];
        const cost = nextGenerator ? sim.buildingSystem.costFor('arcane-core', structure.level + 1) : null;
        const upgrade = !nextGenerator ? 'Maximum level' : structure.level + 1 > sim.shelter.level
          ? `F · requires Shelter LV. ${structure.level + 1}`
          : `F · LV. ${structure.level + 1}: ${cost!.wood} Wood / ${cost!.iron} Iron → ${sim.buildingSystem.generatorOutputFor(structure.level + 1)} power / ${Math.round(buildingMaxHp('arcane-core', structure.level + 1) * sim.skills.bonuses.buildingHealth)} HP`;
        this.nodes['interaction'].textContent = `LV. ${structure.level} · ${sim.buildingSystem.generatorOutputFor(structure.level)} power · ${upgrade} · ${repair}`;
      } else this.nodes['interaction'].textContent = repair;
    }
    if (resource) this.nodes['interaction'].innerHTML = sim.resourceGuard(resource.id) ?? `<kbd>LMB</kbd> ${resource.distanceFrom(sim.player.position) <= CONFIG.sword.range + sim.skills.bonuses.harvestRange ? 'Strike' : 'Approach'} ${RESOURCE_NAMES[resource.resourceType]}`;
    if(targetId===SHELTER_DEPOSIT_ID)this.nodes['interaction'].innerHTML='<kbd>E</kbd> DEPOSIT · open storage';
    if (coreTarget) this.nodes['interaction'].innerHTML = sim.shelter.hp >= sim.shelter.maxHp ? 'Core at full health' : `<kbd>LMB</kbd> ${sim.shelter.distanceFrom(sim.player.position) <= CONFIG.sword.range ? 'Repair core · 2 Wood / 1 Iron' : 'Approach the core'}`;
    this.nodes['build-panel'].hidden = !build?.active || sim.phase !== 'playing';
    if (build?.active) {
      
      this.nodes['build-panel'].querySelectorAll<HTMLElement>('[data-kind]').forEach(node => node.classList.toggle('selected', node.dataset.kind === build.kind));
      const cost = sim.buildingSystem.costFor(build.kind), funding = resourceFunding(cost, sim.resourceManager, sim.carriedManager);
      this.nodes['build-cost'].textContent = build.movingId ? 'MOVING TOWER · no cost' : `${cost.wood} Wood · ${cost.iron} Iron · backpack ${funding.personal.wood}/${funding.personal.iron} · storage ${funding.shared.wood}/${funding.shared.iron}`;
      this.nodes['build-effect'].textContent = build.kind === 'storehouse' ? `+50 Wood · +25 Iron capacity · uses ${sim.buildingSystem.demand('storehouse')} power`
        : build.kind === 'arcane-core' ? `Provides ${sim.buildingSystem.generatorOutput} Arcane Power · generator pads only` : `Uses ${sim.buildingSystem.demand('magic-tower')} power · any free space in the base · range ${CONFIG.tower.range} m`;
      this.nodes['build-status'].textContent = build.reason ?? 'Valid placement — ready to build';
      this.nodes['build-status'].classList.toggle('valid', build.reason === null);
    }
    const boss = sim.finalArenaActive ? sim.livingZombies.find(z=>z.kind==='overlord') : sim.livingZombies.find(z => z.mode === 'guard' && Math.hypot(z.position.x - sim.player.position.x, z.position.z - sim.player.position.z) < 28);
    this.nodes['boss-panel'].hidden = !boss || sim.phase !== 'playing';
    if (boss) { this.nodes['boss-name'].textContent = boss.stats.label.toUpperCase(); this.nodes['boss-hp'].textContent = `${boss.hp} / ${boss.maxHp}`; this.nodes['boss-fill'].style.width = `${boss.hp / boss.maxHp * 100}%`; this.nodes['boss-intent'].textContent = boss.windup > 0 ? 'HEAVY STRIKE · DODGE' : boss.kind === 'overlord' ? (boss.hp/boss.maxHp<=.5 ? 'ENRAGED · INCREASED SPEED' : 'THE PIT · CHARGES AND SUMMONS') : boss.kind === 'ravager' ? (boss.returning ? 'RETURNING TO THE PLAZA' : 'PURSUIT · COLOSSUS MELEE') : 'GUARDIAN OF RICH DEPOSITS'; }
    const cycle = sim.cycle;
    const night = cycle.state.period === 'night';
    const alive = sim.livingZombies.length;
    this.nodes['objective-text'].textContent = night
      ? `Alive: ${alive} · incoming: ${cycle.state.pendingSpawns} · kills: ${sim.totalKills} · night fury ×1.65`
      : `Citadel of the Curse · northeast · jump into the pit; no way back`;
    this.nodes['objective-title'].textContent = night ? 'Defend the Shelter core' : "Break the city's curse";
    this.nodes['cycle-label'].textContent = night && cycle.modifier ? cycle.modifier.label : night ? 'NIGHT' : 'DAY';
    this.nodes['cycle-label'].closest('.run-hud')?.classList.toggle('special-night', Boolean(cycle.modifier) && night);
    const seconds = Math.ceil(cycle.secondsRemaining);
    this.nodes['cycle-clock'].textContent = top.remaining;
    this.nodes['cycle-detail'].textContent = night
      ? seconds > 0 ? `Defense · dawn in ${seconds} s` : 'Dawn approaches'
      : 'Prepare for night · gather and build';
    this.nodes['cycle-label'].classList.toggle('night', night);
    this.nodes['night-hint'].hidden = sim.phase !== 'playing';
    this.nodes['load-action'].hidden = !this.resumeAvailable || (sim.phase !== 'ready' && sim.phase !== 'lost');
    this.nodes['location'].textContent = `VEYRHOLM · ${sectorAt(sim.player.position).name.toUpperCase()}${(sectorAt(sim.player.position).risk ?? 1) > 1 ? ' · HIGH RISK' : ''}`;
    this.nodes['shelter-hp'].closest('.shelter-panel')?.classList.toggle('critical', sim.shelter.hp / sim.shelter.maxHp <= .25);
    this.nodes['shelter-status'].textContent = sim.shelter.hp / sim.shelter.maxHp <= .25 ? 'SHELTER CRITICAL' : sim.shelter.hp < sim.shelter.maxHp ? 'Undead have damaged the core' : 'Defend the core inside the Shelter';
    this.nodes['sword-fill'].style.width = `${(1 - sim.swordCooldown / sim.swordCooldownDuration) * 100}%`;
    this.nodes['sword-status'].textContent = sim.swordCooldown > 0 ? 'RECOVERING' : 'LMB · QUICK / RMB · HEAVY';
    const degrees = (sim.player.yaw * 180 / Math.PI % 360 + 360) % 360;
    this.nodes['heading'].textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
    const zombieTarget = sim.zombies.find(zombie => zombie.id === targetId && zombie.alive);
    const targetVisible = Boolean(resource || zombieTarget || coreTarget || structure);
    this.enemy.hidden = !targetVisible || sim.phase !== 'playing' || Boolean(build?.active);
    this.nodes['target-name'].textContent = resource ? resource.definition.label.toUpperCase() : structure ? BUILDINGS[structure.kind].label.toUpperCase() + (structure.kind === 'arcane-core' ? ` · LV. ${structure.level}` : '') : coreTarget ? 'SHELTER CORE' : zombieTarget?.stats.label.toUpperCase() ?? 'UNDEAD';
    this.nodes['enemy-fill'].style.width = `${resource ? resource.health / resource.maxHealth * 100 : structure ? structure.hp / structure.maxHp * 100 : zombieTarget ? zombieTarget.hp / zombieTarget.maxHp * 100 : coreTarget ? sim.shelter.hp / sim.shelter.maxHp * 100 : 0}%`;
    this.nodes['enemy-hp'].textContent = resource ? `${resource.health} / ${resource.maxHealth}` : structure ? `${structure.hp} / ${structure.maxHp}` : zombieTarget ? `${zombieTarget.hp} / ${zombieTarget.maxHp}` : coreTarget ? `${sim.shelter.hp} / ${sim.shelter.maxHp}` : '';
    this.nodes['reticle'].classList.toggle('target', targetVisible);
    this.nodes['reticle'].classList.toggle('resource-target', Boolean(resource));
    this.nodes['reticle'].hidden = sim.phase !== 'playing';
    if (performance.now() > this.toastUntil) this.nodes['toast'].classList.remove('visible');
    if (sim.phase !== this.lastPhase) this.setPhase(sim);
  }

  private setPhase(sim: Simulation): void {
    this.lastPhase = sim.phase;
    this.menu.hidden = sim.phase === 'playing';
    document.body.classList.toggle('in-game', sim.phase === 'playing');
    this.nodes['save-action'].hidden = sim.phase !== 'paused';
    this.nodes['skills-action'].hidden = sim.phase !== 'paused';
    const ended = sim.phase === 'won' || sim.phase === 'lost';
    this.nodes['end-statistics'].hidden = !ended; this.nodes['end-day'].textContent = String(sim.cycle.state.day); this.nodes['end-kills'].textContent = String(sim.totalKills);
    this.menu.querySelectorAll<HTMLElement>('.briefing, .menu-divider').forEach(node => node.hidden = ended);
    if (sim.phase === 'playing') return;
    const content: Record<Exclude<MatchPhase, 'playing'>, [string, string, string, string]> = {
      ready: ['GATHER BY DAY · SURVIVE THE NIGHT', 'The last<br><em>refuge.</em>', `The city is full of undead.<br>You have ${shelterHudState(sim).remaining.replace(' remaining', '')} to gather materials and prepare for the first night.`, 'Enter the ruins'],
      paused: ['RUN PAUSED', 'A moment<br><em>of respite.</em>', `Day ${sim.cycle.state.day} · ${sim.totalKills} defeated.<br>Time, patrols and the horde are paused.`, 'Return to the ruins'],
      won: ['RUN COMPLETED', 'The curse<br><em>is broken.</em>', "The Curse Overlord is defeated.<br>The Shelter's light endured.", 'New run'],
      lost: ['DEFENSE FALLEN', 'The ruins<br><em>claimed everything.</em>', 'The Shelter core was destroyed.', 'Try again'],
    };
    const [label, title, description, button] = content[sim.phase as Exclude<MatchPhase, 'playing'>];
    this.eyebrow.innerHTML = `<span></span> ${label}`;
    this.title.innerHTML = title;
    this.description.innerHTML = description;
    this.button.innerHTML = `${button} <span>→</span>`;
    this.nodes['menu-note'].textContent = 'Click to capture the cursor. Escape opens the pause menu.';
  }

  notify(message: string): void {
    this.nodes['toast'].textContent = message;
    this.nodes['toast'].classList.add('visible');
    this.toastUntil = performance.now() + 2200;
  }

  savedRun(day: number | null): void {
    this.resumeAvailable = day !== null;
    this.nodes['load-action'].textContent = day === null ? 'Resume checkpoint' : `Resume checkpoint · day ${day}`;
    this.nodes['load-action'].hidden = !this.resumeAvailable;
  }
  saveStatus(text: string): void { this.nodes['save-status'].textContent = text; }

  flashDamage(): void {
    const node = this.nodes['damage-flash'];
    node.classList.remove('flash');
    void node.offsetWidth;
    node.classList.add('flash');
  }

  hitMarker(): void { const n = this.nodes['hit-marker']; n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit'); }
  floatingGain(text: string): void {
    const node = document.createElement('span'); node.className = 'gain-number'; node.textContent = text;
    node.style.left = (45 + Math.random() * 10) + '%'; this.nodes['floating-gains'].appendChild(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
    if (this.nodes['floating-gains'].children.length > 12) this.nodes['floating-gains'].firstElementChild?.remove();
  }
  flashShelter(): void { const n = this.nodes['shelter-hp'].closest('.shelter-panel')!; n.classList.remove('under-attack'); void (n as HTMLElement).offsetWidth; n.classList.add('under-attack'); }
  lockError(): void {
    this.nodes['menu-note'].textContent = 'Could not capture the cursor. Try again, or open the game in Chrome or Edge.';
  }
}
