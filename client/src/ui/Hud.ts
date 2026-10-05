import type { Simulation } from '../domain/Simulation';
import type { MatchPhase } from '../domain/types';
import type { BuildingController } from '../building/BuildingController';
import { BUILDINGS } from '../building/Building';
import { CONFIG } from '../domain/config';
import { RESOURCE_NAMES } from '../resources/ResourceType';
import { sectorAt } from '../world/WorldLayout';
import { shelterGuide } from './ShelterGuide';

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

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="vignette" aria-hidden="true"></div>
      <div id="damage-flash" aria-hidden="true"></div>
      <header class="topbar">
        <div class="brand">${wardIcon}<div>FANTASY <b>SHELTER</b><span id="location">SCHRONIENIE</span></div></div>
        <div class="compass"><span>W</span><i></i><strong id="heading">N</strong><i></i><span>E</span></div>
        <div class="prototype"><span class="status-dot"></span> SURVIVAL <b>7–8</b><small id="save-status">Zapis w tym urządzeniu</small></div>
      </header>
      <section class="objective"><span class="section-label">TWÓJ CEL</span><h2 id="objective-title">Obroń schronienie</h2><p id="objective-text">Przygotuj bazę na noc</p></section>
      <section class="shelter-guide" aria-label="Kierunek do Shelteru"><span id="guide-arrow" aria-hidden="true">↑</span><div><b id="guide-label">SHELTER</b><strong id="guide-distance">0 m</strong><small id="guide-hint">Teren bazy</small></div></section>
      <section class="cycle-panel" aria-label="Dzień i noc"><span id="cycle-label">DZIEŃ 01</span><strong id="cycle-clock">02:30</strong><p id="cycle-detail">Noc za · zbieraj i buduj</p></section>
      <p class="night-hint" id="night-hint" hidden><kbd>N</kbd> Rozpocznij noc przy Shelterze</p>
      <section class="shelter-panel" aria-label="Zdrowie schronienia">
        <div class="panel-heading">${wardIcon}<span>SHELTER <small>LV. 01</small></span><strong id="shelter-hp">300 <em>/ 300</em></strong></div>
        <div class="bar shelter-bar"><i id="shelter-fill"></i></div>
        <p id="shelter-status">Ostatnie bezpieczne miejsce</p>
      </section>
      <section class="resources" aria-label="Zasoby">
        <div><span class="resource-icon">♧</span><span>WOOD</span><b id="wood">0</b></div>
        <div><span class="resource-icon iron-icon">◇</span><span>IRON</span><b id="iron">0</b></div>
        <div><span class="resource-icon arcane-icon">ϟ</span><span>ARCANE · MOC</span><b id="power-count">0 / 0</b></div>
      </section>
      <section class="power-panel" aria-label="Bilans mocy"><small id="power-status">Zbuduj generator Arcane</small></section>
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
        <div class="weapon-panel"><span class="weapon-number">01</span><div><strong>Miecz strażnika</strong><span id="sword-status">LPM · ZWYKŁY ATAK</span></div><div class="weapon-line"><i id="sword-fill"></i></div></div>
        <div class="controls"><span><kbd>W A S D</kbd> Ruch</span><span><kbd>MYSZ</kbd> Rozejrzyj się</span><span><kbd>LPM</kbd> Walcz / zbieraj</span><span><kbd>B / 1–3</kbd> Buduj</span><span><kbd>ESC</kbd> Pauza</span><span><kbd>R</kbd> Restart</span></div>
      </footer>
      <div class="menu-overlay" id="menu-overlay">
        <section class="menu-card" aria-labelledby="menu-title">
          <div class="menu-eyebrow" id="menu-eyebrow"><span></span> PIERWSZA PRÓBA</div>
          <h1 id="menu-title">Ostatnie<br><em>schronienie.</em></h1>
          <p class="menu-description" id="menu-description">Miasto ucichło. Umarli nie.<br>Chwyć miecz i obroń to, co jeszcze zostało.</p>
          <div class="menu-divider"></div>
          <div class="briefing"><span>01</span><p>Rozbijaj pnie i złoża mieczem: LPM. Strzałka prowadzi do bazy.</p></div>
          <div class="briefing"><span>02</span><p>B: buduj w Shelterze. Najpierw generator, potem magazyn i wieże.</p></div>
          <div class="briefing"><span>03</span><p>Za dnia eksploruj. Nocą obroń Shelter przed falą.</p></div>
          <button id="primary-action" class="primary-button">Wejdź do ruin <span>→</span></button>
          <button id="load-action" class="secondary-button" hidden>Wznów zapis</button>
          <button id="save-action" class="secondary-button" hidden>Zapisz próbę</button>
          <p class="menu-note" id="menu-note">Kliknięcie przechwytuje kursor. Escape otwiera pauzę.</p>
        </section>
        <div class="scene-caption"><span>VEYRHOLM</span><p>Nie każde światło<br>oznacza ocalenie.</p><i></i></div>
        <div class="milestone-note">DZIEŃ / NOC <span>EKSPLORACJA / BUDOWANIE / FALE</span></div>
      </div>`;
    for (const id of ['shelter-hp', 'shelter-fill', 'shelter-status', 'player-hp', 'player-fill', 'objective-text', 'objective-title', 'location', 'wood', 'iron', 'enemy-fill', 'enemy-hp', 'target-name', 'heading', 'sword-fill', 'sword-status', 'toast', 'reticle', 'damage-flash', 'menu-note', 'interaction', 'build-panel', 'build-cost', 'build-status', 'build-effect', 'power-count', 'power-status', 'load-action', 'save-action', 'save-status', 'cycle-label', 'cycle-clock', 'cycle-detail', 'night-hint', 'guide-arrow', 'guide-label', 'guide-distance', 'guide-hint']) {
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
  }

  update(sim: Simulation, targetId: string | null, build?: BuildingController): void {
    this.nodes['player-hp'].innerHTML = `${sim.player.hp} <em>/ ${sim.player.maxHp}</em>`;
    this.nodes['shelter-hp'].innerHTML = `${sim.shelter.hp} <em>/ ${sim.shelter.maxHp}</em>`;
    this.nodes['player-fill'].style.width = `${sim.player.hp / sim.player.maxHp * 100}%`;
    this.nodes['shelter-fill'].style.width = `${sim.shelter.hp / sim.shelter.maxHp * 100}%`;
    this.nodes['wood'].innerHTML = `${sim.resources.wood}<small> / ${sim.resourceManager.capacity.wood}</small>`;
    this.nodes['iron'].innerHTML = `${sim.resources.iron}<small> / ${sim.resourceManager.capacity.iron}</small>`;
    const power = sim.buildingSystem.power;
    this.nodes['power-count'].textContent = `${power.available} / ${power.generated}`;
    this.nodes['power-status'].textContent = power.generated > 0 ? `Moc wolna / łącznie · zajęte: ${power.used}` : 'Moc wolna / łącznie · zbuduj generator';
    const guide = shelterGuide(sim.player.position, sim.player.yaw);
    this.nodes['guide-arrow'].style.transform = `rotate(${guide.angle}deg)`;
    this.nodes['guide-arrow'].hidden = guide.inside;
    this.nodes['guide-label'].textContent = guide.label;
    this.nodes['guide-distance'].textContent = guide.inside ? 'Jesteś w środku' : `${guide.meters} m`;
    this.nodes['guide-hint'].textContent = guide.hint;
    const resource = sim.resourceNodes.find(node => node.id === targetId && !node.isDestroyed);
    this.nodes['interaction'].hidden = !resource || sim.phase !== 'playing' || Boolean(build?.active);
    if (resource) this.nodes['interaction'].innerHTML = `<kbd>LPM</kbd> ${resource.distanceFrom(sim.player.position) <= CONFIG.sword.range ? 'Uderz' : 'Podejdź do'} ${RESOURCE_NAMES[resource.resourceType]}`;
    this.nodes['build-panel'].hidden = !build?.active || sim.phase !== 'playing';
    if (build?.active) {
      const definition = BUILDINGS[build.kind];
      this.nodes['build-panel'].querySelectorAll<HTMLElement>('[data-kind]').forEach(node => node.classList.toggle('selected', node.dataset.kind === build.kind));
      this.nodes['build-cost'].textContent = `${definition.cost.wood} Wood · ${definition.cost.iron} Iron`;
      this.nodes['build-effect'].textContent = build.kind === 'storehouse' ? `+50 Wood · +25 Iron pojemności · zajmuje ${CONFIG.power.storehouseDemand} mocy`
        : build.kind === 'arcane-core' ? `Zapewnia ${CONFIG.power.coreOutput} mocy Arcane` : `Zajmuje ${CONFIG.power.towerDemand} mocy · zasięg ${CONFIG.tower.range} m`;
      this.nodes['build-status'].textContent = build.reason ?? 'Miejsce poprawne — możesz budować';
      this.nodes['build-status'].classList.toggle('valid', build.reason === null);
    }
    const cycle = sim.cycle;
    const night = cycle.state.period === 'night';
    const alive = sim.livingZombies.length;
    this.nodes['objective-text'].textContent = night
      ? `Żywi: ${alive} · nadchodzą: ${cycle.state.pendingSpawns} · zabici: ${sim.totalKills}`
      : `Patrole w ruinach: ${alive} · zbieraj materiały na noc`;
    this.nodes['objective-title'].textContent = night ? 'Obroń schronienie' : 'Przygotuj obronę';
    this.nodes['cycle-label'].textContent = `${night ? 'NOC' : 'DZIEŃ'} ${String(cycle.state.day).padStart(2, '0')}`;
    const seconds = Math.ceil(cycle.secondsRemaining);
    this.nodes['cycle-clock'].textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.nodes['cycle-detail'].textContent = night
      ? seconds > 0 ? `Obrona · do świtu co najmniej ${seconds} s` : 'Pokonaj pozostałych, aby rozpocząć dzień'
      : 'Noc za · zbieraj i buduj';
    this.nodes['cycle-label'].classList.toggle('night', night);
    this.nodes['night-hint'].hidden = night || sim.phase !== 'playing' || sim.shelter.distanceFrom(sim.player.position) > 8;
    this.nodes['load-action'].hidden = !this.resumeAvailable || (sim.phase !== 'ready' && sim.phase !== 'lost');
    this.nodes['location'].textContent = `VEYRHOLM · ${sectorAt(sim.player.position).name.toUpperCase()}`;
    this.nodes['shelter-status'].textContent = sim.shelter.hp < sim.shelter.maxHp ? 'Schronienie otrzymało obrażenia' : 'Ostatnie bezpieczne miejsce';
    this.nodes['sword-fill'].style.width = `${(1 - sim.swordCooldown / 0.65) * 100}%`;
    this.nodes['sword-status'].textContent = sim.swordCooldown > 0 ? 'MIECZ WRACA DO POZYCJI' : 'LPM · ZWYKŁY ATAK';
    const degrees = (sim.player.yaw * 180 / Math.PI % 360 + 360) % 360;
    this.nodes['heading'].textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
    const zombieTarget = sim.zombies.find(zombie => zombie.id === targetId && zombie.alive);
    const targetVisible = Boolean(resource || zombieTarget);
    this.enemy.hidden = !targetVisible || sim.phase !== 'playing' || Boolean(build?.active);
    this.nodes['target-name'].textContent = resource ? resource.definition.label.toUpperCase() : 'NIEUMARŁY';
    this.nodes['enemy-fill'].style.width = `${resource ? resource.health / resource.maxHealth * 100 : zombieTarget ? zombieTarget.hp / zombieTarget.maxHp * 100 : 0}%`;
    this.nodes['enemy-hp'].textContent = resource ? `${resource.health} / ${resource.maxHealth}` : zombieTarget ? `${zombieTarget.hp} / ${zombieTarget.maxHp}` : '';
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
    if (sim.phase === 'playing') return;
    const content: Record<Exclude<MatchPhase, 'playing'>, [string, string, string, string]> = {
      ready: ['ZBIERAJ ZA DNIA · PRZETRWAJ NOC', 'Ostatnie<br><em>schronienie.</em>', 'Miasto jest pełne nieumarłych.<br>Masz 2:30 na materiały i obronę przed pierwszą nocą.', 'Wejdź do ruin'],
      paused: ['PRÓBA WSTRZYMANA', 'Chwila<br><em>wytchnienia.</em>', `Dzień ${sim.cycle.state.day} · ${sim.totalKills} pokonanych.<br>Czas, patrole i fala są zatrzymane.`, 'Wróć do ruin'],
      lost: ['OBRONA UPADŁA', 'Ruiny<br><em>pochłonęły wszystko.</em>', `${sim.player.hp === 0 ? 'Strażnik poległ.' : 'Światło Shelteru zgasło.'}<br>Dzień ${sim.cycle.state.day} · pokonani: ${sim.totalKills}.`, 'Spróbuj ponownie'],
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

  lockError(): void {
    this.nodes['menu-note'].textContent = 'Nie udało się przechwycić kursora. Spróbuj ponownie; jeśli podgląd blokuje kursor, otwórz adres gry w Chrome lub Edge.';
  }
}
