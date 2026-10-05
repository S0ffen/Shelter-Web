import { Engine } from '../rendering/babylon';
import { CONFIG } from '../domain/config';
import { Simulation } from '../domain/Simulation';
import { PlayerController } from '../player/PlayerController';
import { Sword } from '../player/Sword';
import { HordeView } from '../enemies/HordeView';
import { Hud } from '../ui/Hud';
import { InputManager } from './InputManager';
import { SceneManager } from './SceneManager';
import { ResourceView } from '../resources/ResourceView';
import { BuildingController } from '../building/BuildingController';
import { ProjectileView } from '../building/ProjectileView';
import { RESOURCE_NAMES } from '../resources/ResourceType';
import { captureRun, restoreRun } from '../persistence/RunSnapshot';
import { SaveService } from '../persistence/SaveService';

/** Coordinates the renderer, input and local gameplay authority. */
export class Game {
  private readonly engine: Engine;
  private readonly scenes: SceneManager;
  private readonly input: InputManager;
  private readonly controller: PlayerController;
  private readonly sword: Sword;
  private readonly zombieView: HordeView;
  private readonly resourceView: ResourceView;
  private readonly building: BuildingController;
  private readonly projectileView: ProjectileView;
  private readonly hud: Hud;
  private readonly simulation = new Simulation();
  private accumulator = 0;
  private hudCountdown = 0;
  private visualTime = 0;
  private disposed = false;
  private readonly saves = new SaveService();
  private saveCountdown = 20;
  private resultRecorded = false;
  private readonly resize = (): void => this.engine.resize();

  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
    this.scenes = new SceneManager(this.engine);
    this.input = new InputManager(canvas);
    this.controller = new PlayerController(this.scenes.scene, this.input);
    this.sword = new Sword(this.scenes.scene, this.controller.camera);
    this.zombieView = new HordeView(this.scenes.scene);
    this.resourceView = new ResourceView(this.scenes.scene, this.simulation.resourceNodes);
    this.building = new BuildingController(this.scenes.scene, this.controller.camera);
    this.projectileView = new ProjectileView(this.scenes.scene);
    this.hud = new Hud(root);
    this.hud.onPrimary = () => {
      if (this.simulation.phase === 'lost') this.reset();
      this.input.requestLock();
    };
    this.hud.onSave = () => { void this.saveRun(true); };
    this.hud.onLoad = () => {
      const saved = this.saves.latest;
      if (!saved) { this.hud.notify('Nie znaleziono poprawnego zapisu'); return; }
      this.reset();
      restoreRun(this.simulation, saved);
      this.controller.restore(this.simulation.player);
      this.hud.update(this.simulation, null);
      this.input.requestLock();
    };
    void this.saves.initialize().then(saved => {
      if (this.disposed) return;
      this.hud.savedRun(saved?.cycle.day ?? null);
      this.hud.saveStatus(this.saves.online ? 'SQLite · gotowy' : 'Zapis w tym urządzeniu');
      if (!saved && this.saves.incompatibleSave) this.hud.notify('Układ bazy się zmienił — rozpocznij nową próbę');
    });
    this.input.onLockChange = locked => {
      if (locked) {
        this.simulation.start();
        void this.saveRun(false);
      }
      else {
        this.simulation.pause(); this.building.cancel();
        if (this.simulation.phase === 'paused') void this.saveRun(false);
      }
      this.accumulator = 0;
      this.hud.update(this.simulation, null);
    };
    this.input.onLockError = () => this.hud.lockError();
    this.input.onAttack = () => {
      if (this.building.active) { this.hud.notify(this.building.confirm(this.simulation)); return; }
      const ray = this.controller.camera.getForwardRay(CONFIG.sword.range);
      const pick = this.scenes.scene.pickWithRay(ray, mesh => mesh.isEnabled() && mesh.isPickable);
      const id: string | null = pick?.pickedMesh?.metadata?.zombieId ?? pick?.pickedMesh?.metadata?.resourceNodeId ?? null;
      this.simulation.attack(id);
    };
    this.input.onRestart = () => { this.reset(); if (this.input.locked) { this.simulation.start(); void this.saveRun(false); } };
    this.input.onBuildToggle = () => this.building.toggle();
    this.input.onBuildSelect = kind => this.building.select(kind);
    this.input.onBuildRotate = () => this.building.rotate();
    this.input.onBuildCancel = () => this.building.cancel();
    this.input.onNextNight = () => { if (!this.simulation.beginNight()) this.hud.notify('Rozpocznij noc przy Shelterze, podczas dnia'); };
    window.addEventListener('resize', this.resize);
    this.hud.update(this.simulation, null);
    this.engine.runRenderLoop(() => this.frame());
  }

  private reset(): void {
    this.simulation.reset();
    this.controller.reset();
    this.zombieView.reset();
    this.sword.reset();
    this.building.reset();
    this.input.clear();
    this.accumulator = 0;
    this.hudCountdown = 0;
    this.saveCountdown = 20;
    this.resultRecorded = false;
  }

  private async saveRun(manual: boolean): Promise<void> {
    if (this.simulation.phase !== 'playing' && this.simulation.phase !== 'paused') return;
    const snapshot = captureRun(this.simulation);
    const destination = await this.saves.save(snapshot);
    if (this.disposed) return;
    this.hud.savedRun(snapshot.cycle.day);
    this.hud.saveStatus(destination === 'sqlite' ? 'SQLite · zapisano' : destination === 'local' ? 'Zapis w tym urządzeniu' : 'Nie udało się zapisać na dysku');
    if (manual) this.hud.notify(destination === 'memory' ? 'Zapis na dysku jest niedostępny' : destination === 'sqlite' ? 'Próba zapisana w SQLite' : 'Próba zapisana w tej przeglądarce');
  }

  private frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    this.visualTime += dt;
    if (this.simulation.phase === 'playing') {
      this.controller.update(dt, this.simulation.player);
      this.accumulator += dt;
      while (this.accumulator >= CONFIG.simulationStep) {
        this.simulation.update(CONFIG.simulationStep);
        this.accumulator -= CONFIG.simulationStep;
      }
      this.saveCountdown -= dt;
      if (this.saveCountdown <= 0) { this.saveCountdown = 20; void this.saveRun(false); }
    }
    for (const event of this.simulation.drainEvents()) {
      switch (event.type) {
        case 'swing': this.sword.swing(); break;
        case 'zombie-hit': this.zombieView.hit(event.zombieId); this.hud.notify(`${event.source === 'tower' ? 'Trafienie wieży' : 'Trafienie'} · −${event.damage} HP`); break;
        case 'player-hit': this.hud.flashDamage(); this.hud.notify(`Nieumarły cię atakuje · −${event.damage} HP`); break;
        case 'shelter-hit': this.hud.notify(`Shelter pod atakiem · −${event.damage} HP`); break;
        case 'zombie-dead': this.hud.notify('Nieumarły pokonany'); break;
        case 'night-started': this.hud.notify(`Noc ${event.day} · fala ${event.waveSize} nieumarłych — wróć do Shelteru`); break;
        case 'day-started': this.hud.notify(`Dzień ${event.day} · obrona przetrwała. Zbieraj i rozbuduj bazę`); void this.saveRun(false); break;
        case 'resource-hit': this.resourceView.hit(event.nodeId); break;
        case 'resource-gained': this.hud.notify(`+${event.amount} ${RESOURCE_NAMES[event.kind]}`); break;
        case 'resource-destroyed': break;
        case 'storage-full': this.hud.notify(`Brak miejsca na ${event.needed} ${RESOURCE_NAMES[event.kind]} — wydaj materiał lub zbuduj Storehouse`); break;
      }
    }
    if (this.simulation.phase === 'lost' && this.input.locked) this.input.release();
    if (this.simulation.phase === 'lost' && !this.resultRecorded) {
      this.resultRecorded = true;
      void this.saves.recordResult({ runId: this.simulation.runId, day: this.simulation.cycle.state.day, kills: this.simulation.totalKills, elapsed: this.simulation.elapsed });
    }
    this.zombieView.update(this.simulation.zombies, this.simulation.player, this.accumulator / CONFIG.simulationStep, this.simulation.phase === 'paused' ? 0 : dt, this.simulation.elapsed);
    this.scenes.updateLighting(this.simulation.cycle, dt);
    this.sword.update(this.simulation.phase === 'paused' ? 0 : dt, this.simulation.elapsed, this.simulation.phase === 'playing' && this.controller.moving);
    this.scenes.world.update(this.visualTime, this.simulation.shelter.hp / this.simulation.shelter.maxHp);
    this.resourceView.update(this.simulation.resourceNodes, this.visualTime, dt);
    this.building.update(this.simulation);
    this.building.view.updateTowers(this.simulation.towerSystem.towers, dt);
    this.projectileView.update(this.simulation.towerSystem.projectiles);
    this.sword.setVisible(!this.building.active);
    this.hudCountdown -= dt;
    if (this.hudCountdown <= 0) {
      const ray = this.controller.camera.getForwardRay(12);
      const pick = this.scenes.scene.pickWithRay(ray, mesh => mesh.isEnabled() && mesh.isPickable);
      const targetId: string | null = pick?.pickedMesh?.metadata?.zombieId ?? pick?.pickedMesh?.metadata?.resourceNodeId ?? null;
      this.hud.update(this.simulation, targetId, this.building);
      this.hudCountdown = 0.1;
    }
    this.scenes.scene.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.engine.stopRenderLoop();
    this.scenes.scene.dispose();
    this.engine.dispose();
  }
}
