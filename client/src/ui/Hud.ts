import type { Simulation } from '../domain/Simulation';
import type { MatchPhase } from '../domain/types';
import type { BuildingController } from '../building/BuildingController';
import { BUILDINGS } from '../building/Building';
import { CONFIG } from '../domain/config';
import { RESOURCE_NAMES } from '../resources/ResourceType';
import { sectorAt } from '../world/WorldLayout';
import { SHELTER_CORE_ID, SHELTER_DEPOSIT_ID } from '../world/ShelterLayout';
import { SHELTER_LEVELS } from '../shelter/Shelter';
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

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="vignette" aria-hidden="true"></div>
      <div id="damage-flash" aria-hidden="true"></div><div id="corruption-vignette" aria-hidden="true"></div>
      <section class="run-hud" aria-label="Zasoby Shelteru i stan runu">
        <div class="run-cell"><span class="hud-icon wood-glyph">♧</span><label>WOOD</label><small id="wood-max">100</small><b id="wood">0</b></div>
        <div class="run-cell"><span class="hud-icon iron-glyph">▰</span><label>IRON</label><small id="iron-max">50</small><b id="iron">0</b></div>
        <div class="run-cell"><span class="hud-icon power-glyph">ϟ</span><label>ARCANE POWER</label><small id="power-max">0</small><b id="power-count">0</b></div>
        <div class="run-cell phase-cell"><span id="phase-icon" class="phase-icon" aria-hidden="true">☀</span><label id="cycle-label">DZIEŃ</label><b id="day-number">1 D.</b></div>
        <div class="run-cell kills-cell"><span class="hud-icon" aria-hidden="true">☠</span><label>ZOMBIES KILLED</label><b id="kill-count">0</b></div>
        <p class="phase-timer" id="cycle-clock">3:00 remaining</p>
      </section>
      <section class="expedition-hud" aria-label="Psyche i zasoby przy sobie"><span class="psyche-icon" aria-hidden="true"><svg viewBox="0 0 36 40"><path d="M11 37v-9C4 24 4 15 7 9 10 2 21 1 27 7c4 4 5 8 4 13l3 5h-6v6H18v6" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 12c-3-5 6-7 7-3 5-5 11 2 6 5 5 4 0 9-4 6-2 5-8 2-7-2-5 0-5-6-2-6Zm6-3v14m-7-8h14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span><div class="corruption-gauge" role="progressbar" aria-label="Psyche" aria-valuemin="0" aria-valuemax="100"><label class="sr-only"><b id="corruption-value">100%</b></label><div class="bar"><i id="corruption-fill" style="width:0%"></i></div></div><div class="carried-cell"><small>WOOD · PRZY SOBIE</small><b id="carried-wood">0</b></div><div class="carried-cell"><small>IRON · PRZY SOBIE</small><b id="carried-iron">0</b></div></section>
      <header class="topbar">
        <div class="brand">${wardIcon}<div>FANTASY <b>SHELTER</b><span id="location">SCHRONIENIE</span></div></div>
        <div class="compass"><span>W</span><i></i><strong id="heading">N</strong><i></i><span>E</span></div>
        <div class="prototype"><span class="status-dot"></span> TRYB SOLO<small id="save-status">Zapis w tym urządzeniu</small></div>
      </header>
      <section class="objective"><span class="section-label">TWÓJ CEL</span><h2 id="objective-title">Obroń schronienie</h2><p id="objective-text">Przygotuj bazę na noc</p></section>
      <section class="boss-panel" id="boss-panel" hidden><span id="boss-name"></span><strong id="boss-hp"></strong><div class="bar"><i id="boss-fill"></i></div><small id="boss-intent"></small></section>
      <section class="shelter-guide" aria-label="Kierunek do Shelteru"><span id="guide-arrow" aria-hidden="true">↑</span><div><b id="guide-label">SHELTER</b><strong id="guide-distance">0 m</strong><small id="guide-hint">Teren bazy</small></div></section>
      <section class="shelter-actions" id="shelter-actions" hidden aria-label="Rozbudowa Shelteru"><b>WARSZTAT SHELTERU</b><p id="shelter-upgrade"></p><p id="shelter-repair"></p></section>
      <p class="night-hint" id="night-hint" hidden><kbd>N</kbd> Umiejętności · <b id="skill-count">3</b> pkt</p>
      <section class="shelter-panel" aria-label="Zdrowie schronienia">
        <div class="panel-heading">${wardIcon}<span>RDZEŃ SHELTERU <small id="shelter-level">LV. 01</small></span><strong id="shelter-hp">300 <em>/ 300</em></strong></div>
        <div class="bar shelter-bar"><i id="shelter-fill"></i></div>
        <p id="shelter-status">Ostatnie bezpieczne miejsce</p>
      </section>
      <section class="power-panel" aria-label="Bilans mocy"><small id="power-status"></small><small id="cycle-detail"></small></section>
      <div id="explorer-readout" class="explorer-readout"></div><div id="ability-readout" class="ability-readout"></div>
      <div class="hit-marker" id="hit-marker" aria-hidden="true">×</div><div class="floating-gains" id="floating-gains"></div>
      <div class="reticle" id="reticle" aria-hidden="true"><i></i><i></i><i></i><i></i><span></span></div>
      <div class="enemy-info" id="enemy-info" hidden><span id="target-name">NIEUMARŁY</span><div class="bar"><i id="enemy-fill"></i></div><small id="enemy-hp"></small></div>
      <p class="toast" id="toast" role="status" aria-live="polite"></p>
      <p class="interaction" id="interaction" hidden></p>
      <section class="build-panel" id="build-panel" hidden aria-label="Budowanie">
        <span class="section-label">BUDOWANIE</span>
        <div class="build-options"><span data-kind="storehouse"><kbd>1</kbd> Storehouse</span><span data-kind="arcane-core"><kbd>2</kbd> Generator Arcane</span><span data-kind="magic-tower"><kbd>3</kbd> Magic Tower</span></div>
        <p id="build-cost"></p><p id="build-effect"></p><p id="build-status"></p><small><kbd>Q</kbd> Obróć · <kbd>LPM</kbd> Postaw<br><kbd>B / PPM</kbd> Wróć do miecza</small>
      </section>
      <footer class="bottom-hud">
        <section class="player-panel"><div class="panel-heading"><span class="health-symbol">✚</span><span>ZDROWIE</span><strong id="player-hp">100 <em>/ 100</em></strong></div><div class="bar"><i id="player-fill"></i></div><span class="section-label player-caption">STRAŻNIK SCHRONIENIA</span></section>
        <div class="weapon-panel"><span class="weapon-number">01</span><div><strong>Miecz strażnika</strong><span id="sword-status">LPM · SZYBKI / PPM · MOCNY</span></div><div class="weapon-line"><i id="sword-fill"></i></div></div>
        <div class="controls"><span><kbd>W A S D</kbd> Ruch</span><span><kbd>MYSZ</kbd> Rozejrzyj się</span><span><kbd>LPM / PPM</kbd> Szybki / mocny atak</span><span><kbd>B / 1–3</kbd> Buduj</span><span><kbd>N</kbd> Umiejętności</span><span><kbd>E</kbd> Depozyt</span><span><kbd>ESC</kbd> Pauza</span><span><kbd>R</kbd> Restart</span></div>
      </footer>
      <div class="menu-overlay" id="menu-overlay">
        <section class="menu-card" aria-labelledby="menu-title">
          <div class="menu-eyebrow" id="menu-eyebrow"><span></span> PIERWSZA PRÓBA</div>
          <h1 id="menu-title">Ostatnie<br><em>schronienie.</em></h1>
          <p class="menu-description" id="menu-description">Miasto ucichło. Umarli nie.<br>Chwyć miecz i obroń to, co jeszcze zostało.</p>
          <div id="end-statistics" class="end-statistics" hidden><div><small>DAY REACHED</small><b id="end-day">1</b></div><div><small>ZOMBIES KILLED</small><b id="end-kills">0</b></div></div>
          <div class="menu-divider"></div>
          <div class="briefing"><span>01</span><p>LPM: szybki atak i naprawa słupa. PPM: mocny atak. Strzałka prowadzi do bazy.</p></div>
          <div class="briefing"><span>02</span><p>Zbieraj do plecaka. E przy urządzeniu DEPOSIT wewnątrz Shelteru oddaje materiały do magazynu. B: buduj z zasobów bazy.</p></div>
          <div class="briefing"><span>03</span><p>Za dnia eksploruj. Nocą nie pozwól zombie zniszczyć słupa wewnątrz Shelteru.</p></div>
          <button id="primary-action" class="primary-button">Wejdź do ruin <span>→</span></button>
          <button id="load-action" class="secondary-button" hidden>Wznów zapis</button>
          <button id="save-action" class="secondary-button" hidden>Zapisz próbę</button><button id="skills-action" class="secondary-button" hidden>Umiejętności · N</button>
          <p class="menu-note" id="menu-note">Kliknięcie przechwytuje kursor. Escape otwiera pauzę.</p>
        </section>
        <div class="scene-caption"><span>VEYRHOLM</span><p>Nie każde światło<br>oznacza ocalenie.</p><i></i></div>
        <div class="milestone-note">DZIEŃ / NOC <span>EKSPLORACJA / BUDOWANIE / FALE</span></div>
      </div>`;
    for (const id of ['explorer-readout','ability-readout','skills-action','end-statistics', 'end-day', 'end-kills', 'boss-panel', 'boss-name', 'boss-hp', 'boss-fill', 'boss-intent', 'hit-marker', 'floating-gains', 'skill-count', 'wood-max', 'iron-max', 'power-max', 'phase-icon', 'day-number', 'kill-count', 'carried-wood', 'carried-iron', 'corruption-value', 'corruption-fill', 'corruption-vignette', 'shelter-level', 'shelter-actions', 'shelter-upgrade', 'shelter-repair', 'shelter-hp', 'shelter-fill', 'shelter-status', 'player-hp', 'player-fill', 'objective-text', 'objective-title', 'location', 'wood', 'iron', 'enemy-fill', 'enemy-hp', 'target-name', 'heading', 'sword-fill', 'sword-status', 'toast', 'reticle', 'damage-flash', 'menu-note', 'interaction', 'build-panel', 'build-cost', 'build-status', 'build-effect', 'power-count', 'power-status', 'load-action', 'save-action', 'save-status', 'cycle-label', 'cycle-clock', 'cycle-detail', 'night-hint', 'guide-arrow', 'guide-label', 'guide-distance', 'guide-hint']) {
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
  }

  update(sim: Simulation, targetId: string | null, build?: BuildingController): void {
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
    this.nodes['power-status'].textContent = power.generated > 0 ? `Moc wolna / łącznie · zajęte: ${power.used}` : 'Moc wolna / łącznie · zbuduj generator';
    const guide = shelterGuide(sim.player.position, sim.player.yaw);
    this.nodes['shelter-actions'].hidden = !guide.inside || sim.phase !== 'playing' || Boolean(build?.active);
    const next = SHELTER_LEVELS[sim.shelter.level];
    this.nodes['shelter-upgrade'].textContent = next ? `F · Poziom ${sim.shelter.level + 1}: ${Math.ceil(next.cost.wood * sim.skills.bonuses.buildingCost)} Wood / ${Math.ceil(next.cost.iron * sim.skills.bonuses.buildingCost)} Iron · ${next.maxHp} HP / pancerz ${Math.round(next.armor * 100)}% · za dnia` : 'Shelter maksymalnie rozbudowany';
    this.nodes['shelter-repair'].textContent = sim.shelter.hp < sim.shelter.maxHp ? `LPM · Uderz słup: +${Math.round(25 * sim.repairMultiplier)} HP · 2 Wood / 1 Iron` : 'Rdzeń Shelteru nie wymaga naprawy';
    this.nodes['guide-arrow'].style.transform = `rotate(${guide.angle}deg)`;
    this.nodes['guide-arrow'].hidden = guide.inside;
    this.nodes['guide-label'].textContent = guide.label;
    this.nodes['guide-distance'].textContent = guide.inside ? 'Jesteś w środku' : `${guide.meters} m`;
    this.nodes['guide-hint'].textContent = sim.finalArenaActive ? 'Arena zamknięta · pokonaj Władcę Klątwy' : guide.hint;
    const resource = sim.resourceNodes.find(node => node.id === targetId && !node.isDestroyed);
    const coreTarget = targetId === SHELTER_CORE_ID;
    this.nodes['interaction'].hidden = !(resource || coreTarget || targetId===SHELTER_DEPOSIT_ID) || sim.phase !== 'playing' || Boolean(build?.active);
    const structure = sim.buildingSystem.buildings.find(b => b.id === targetId);
    if (structure && sim.phase === 'playing' && !build?.active) { this.nodes['interaction'].hidden = false; this.nodes['interaction'].textContent = structure.hp < structure.maxHp ? 'LPM · napraw konstrukcję · 2 Wood / 1 Iron' : 'Konstrukcja w pełni sprawna'; }
    if (resource) this.nodes['interaction'].innerHTML = sim.resourceGuard(resource.id) ?? `<kbd>LPM</kbd> ${resource.distanceFrom(sim.player.position) <= CONFIG.sword.range + sim.skills.bonuses.harvestRange ? 'Uderz' : 'Podejdź do'} ${RESOURCE_NAMES[resource.resourceType]}`;
    if(targetId===SHELTER_DEPOSIT_ID)this.nodes['interaction'].innerHTML='<kbd>E</kbd> DEPOSIT · oddaj Wood / Iron do Shelteru';
    if (coreTarget) this.nodes['interaction'].innerHTML = sim.shelter.hp >= sim.shelter.maxHp ? 'Rdzeń w pełni sprawny' : `<kbd>LPM</kbd> ${sim.shelter.distanceFrom(sim.player.position) <= CONFIG.sword.range ? 'Napraw rdzeń · 2 Wood / 1 Iron' : 'Podejdź do rdzenia'}`;
    this.nodes['build-panel'].hidden = !build?.active || sim.phase !== 'playing';
    if (build?.active) {
      
      this.nodes['build-panel'].querySelectorAll<HTMLElement>('[data-kind]').forEach(node => node.classList.toggle('selected', node.dataset.kind === build.kind));
      this.nodes['build-cost'].textContent = build.movingId ? 'PRZENOSZENIE WIEŻY · bez opłat' : `${sim.buildingSystem.costFor(build.kind).wood} Wood · ${sim.buildingSystem.costFor(build.kind).iron} Iron · z magazynu Shelteru`;
      this.nodes['build-effect'].textContent = build.kind === 'storehouse' ? `+50 Wood · +25 Iron pojemności · zajmuje ${sim.buildingSystem.demand('storehouse')} mocy`
        : build.kind === 'arcane-core' ? `Zapewnia ${Math.round(CONFIG.power.coreOutput*sim.skills.bonuses.powerOutput)} mocy Arcane · tylko na stanowiskach generatorów` : `Zajmuje ${sim.buildingSystem.demand('magic-tower')} mocy · dowolne wolne miejsce w bazie · zasięg ${CONFIG.tower.range} m`;
      this.nodes['build-status'].textContent = build.reason ?? 'Miejsce poprawne — możesz budować';
      this.nodes['build-status'].classList.toggle('valid', build.reason === null);
    }
    const boss = sim.finalArenaActive ? sim.livingZombies.find(z=>z.kind==='overlord') : sim.livingZombies.find(z => z.mode === 'guard' && Math.hypot(z.position.x - sim.player.position.x, z.position.z - sim.player.position.z) < 28);
    this.nodes['boss-panel'].hidden = !boss || sim.phase !== 'playing';
    if (boss) { this.nodes['boss-name'].textContent = boss.stats.label.toUpperCase(); this.nodes['boss-hp'].textContent = `${boss.hp} / ${boss.maxHp}`; this.nodes['boss-fill'].style.width = `${boss.hp / boss.maxHp * 100}%`; this.nodes['boss-intent'].textContent = boss.windup > 0 ? 'SILNY ATAK · USKOCZ' : boss.kind === 'overlord' ? (boss.hp/boss.maxHp<=.5 ? 'ENRAGED · WIĘKSZA SZYBKOŚĆ' : 'ARENA ZAMKNIĘTA · SZARŻE I PRZYWOŁANIA') : boss.kind === 'ravager' ? 'POŚCIG · KOLOS WALCZY WRĘCZ' : 'STRAŻNIK BOGATYCH ZŁÓŻ'; }
    const cycle = sim.cycle;
    const night = cycle.state.period === 'night';
    const alive = sim.livingZombies.length;
    this.nodes['objective-text'].textContent = night
      ? `Żywi: ${alive} · nadchodzą: ${cycle.state.pendingSpawns} · zabici: ${sim.totalKills} · nocna furia ×1,65`
      : `Citadel of the Curse · północny wschód · wejście zamyka arenę`;
    this.nodes['objective-title'].textContent = night ? 'Obroń rdzeń Shelteru' : 'Przełam klątwę miasta';
    this.nodes['cycle-label'].textContent = night && cycle.modifier ? cycle.modifier.label : night ? 'NOC' : 'DZIEŃ';
    this.nodes['cycle-label'].closest('.run-hud')?.classList.toggle('special-night', Boolean(cycle.modifier) && night);
    const seconds = Math.ceil(cycle.secondsRemaining);
    this.nodes['cycle-clock'].textContent = top.remaining;
    this.nodes['cycle-detail'].textContent = night
      ? seconds > 0 ? `Obrona · do świtu ${seconds} s` : 'Nadchodzi świt'
      : 'Noc za · zbieraj i buduj';
    this.nodes['cycle-label'].classList.toggle('night', night);
    this.nodes['night-hint'].hidden = sim.phase !== 'playing';
    this.nodes['load-action'].hidden = !this.resumeAvailable || (sim.phase !== 'ready' && sim.phase !== 'lost');
    this.nodes['location'].textContent = `VEYRHOLM · ${sectorAt(sim.player.position).name.toUpperCase()}${(sectorAt(sim.player.position).risk ?? 1) > 1 ? ' · HIGH RISK' : ''}`;
    this.nodes['shelter-hp'].closest('.shelter-panel')?.classList.toggle('critical', sim.shelter.hp / sim.shelter.maxHp <= .25);
    this.nodes['shelter-status'].textContent = sim.shelter.hp / sim.shelter.maxHp <= .25 ? 'SHELTER CRITICAL' : sim.shelter.hp < sim.shelter.maxHp ? 'Zombie uszkodziły centralny rdzeń' : 'Obroń słup wewnątrz Shelteru';
    this.nodes['sword-fill'].style.width = `${(1 - sim.swordCooldown / sim.swordCooldownDuration) * 100}%`;
    this.nodes['sword-status'].textContent = sim.swordCooldown > 0 ? 'MIECZ WRACA DO POZYCJI' : 'LPM · SZYBKI / PPM · MOCNY';
    const degrees = (sim.player.yaw * 180 / Math.PI % 360 + 360) % 360;
    this.nodes['heading'].textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
    const zombieTarget = sim.zombies.find(zombie => zombie.id === targetId && zombie.alive);
    const targetVisible = Boolean(resource || zombieTarget || coreTarget || structure);
    this.enemy.hidden = !targetVisible || sim.phase !== 'playing' || Boolean(build?.active);
    this.nodes['target-name'].textContent = resource ? resource.definition.label.toUpperCase() : structure ? BUILDINGS[structure.kind].label.toUpperCase() : coreTarget ? 'RDZEŃ SHELTERU' : zombieTarget?.stats.label.toUpperCase() ?? 'NIEUMARŁY';
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
      ready: ['ZBIERAJ ZA DNIA · PRZETRWAJ NOC', 'Ostatnie<br><em>schronienie.</em>', `Miasto jest pełne nieumarłych.<br>Masz ${shelterHudState(sim).remaining.replace(' remaining', '')} na materiały i obronę przed pierwszą nocą.`, 'Wejdź do ruin'],
      paused: ['PRÓBA WSTRZYMANA', 'Chwila<br><em>wytchnienia.</em>', `Dzień ${sim.cycle.state.day} · ${sim.totalKills} pokonanych.<br>Czas, patrole i fala są zatrzymane.`, 'Wróć do ruin'],
      won: ['RUN COMPLETED', 'Klątwa<br><em>przełamana.</em>', 'Władca Klątwy pokonany.<br>Światło Shelteru przetrwało.', 'Nowa próba'],
      lost: ['OBRONA UPADŁA', 'Ruiny<br><em>pochłonęły wszystko.</em>', `${sim.player.hp === 0 ? 'Strażnik poległ.' : 'Światło Shelteru zgasło.'}`, 'Spróbuj ponownie'],
    };
    const [label, title, description, button] = content[sim.phase as Exclude<MatchPhase, 'playing'>];
    this.eyebrow.innerHTML = `<span></span> ${label}`;
    this.title.innerHTML = title;
    this.description.innerHTML = description;
    this.button.innerHTML = `${button} <span>→</span>`;
    this.nodes['menu-note'].textContent = 'Kliknięcie przechwytuje kursor. Escape otwiera pauzę.';
  }

  notify(message: string): void {
    this.nodes['toast'].textContent = message;
    this.nodes['toast'].classList.add('visible');
    this.toastUntil = performance.now() + 2200;
  }

  savedRun(day: number | null): void {
    this.resumeAvailable = day !== null;
    this.nodes['load-action'].textContent = day === null ? 'Wznów zapis' : `Wznów zapis · dzień ${day}`;
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
    this.nodes['menu-note'].textContent = 'Nie udało się przechwycić kursora. Spróbuj ponownie; jeśli podgląd blokuje kursor, otwórz adres gry w Chrome lub Edge.';
  }
}
