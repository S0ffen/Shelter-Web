import { ArenaView } from '../world/ArenaView';
import { AudioFeedback } from './AudioFeedback';
import { BossHazardView } from '../enemies/BossHazardView';
import { ImpactEffects } from '../rendering/ImpactEffects';
import { Engine } from '../rendering/babylon';
import { CONFIG } from '../domain/config';
import { Simulation } from '../domain/Simulation';
import { PlayerController } from '../player/PlayerController';
import { combatTarget } from '../player/CombatTarget';
import { Sword } from '../player/Sword';
import { HordeView } from '../enemies/HordeView';
import { SkillPanel } from '../ui/SkillPanel';
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
  private readonly audio = new AudioFeedback();
  private readonly impacts: ImpactEffects;
  private readonly arena: ArenaView;
  private readonly hazards: BossHazardView;
  private lastAttack: 'quick' | 'heavy' = 'quick';
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
  private readonly skills: SkillPanel;
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
    this.impacts = new ImpactEffects(this.scenes.scene);
    this.arena = new ArenaView(this.scenes.scene);
    this.hazards = new BossHazardView(this.scenes.scene);
    this.input = new InputManager(canvas);
    this.controller = new PlayerController(this.scenes.scene, this.input);
    this.sword = new Sword(this.scenes.scene, this.controller.camera);
    this.zombieView = new HordeView(this.scenes.scene);
    this.resourceView = new ResourceView(this.scenes.scene, this.simulation.resourceNodes);
    this.building = new BuildingController(this.scenes.scene, this.controller.camera);
    this.projectileView = new ProjectileView(this.scenes.scene, () => this.audio.play('magic'));
    this.hud = new Hud(root);
    this.skills = new SkillPanel(root);
    this.skills.onClose = () => { this.skills.hide(); this.input.requestLock(); };
    this.skills.onBuy = branch => { this.hud.notify(this.simulation.purchaseSkill(branch)); this.skills.update(this.simulation); void this.saveRun(false); };
    this.hud.onPrimary = () => {
      if (this.simulation.phase === 'lost' || this.simulation.phase === 'won') this.reset();
      this.audio.unlock();
      this.input.requestLock();
    };
    this.hud.onSave = () => { void this.saveRun(true); };
    this.hud.onLoad = () => {
      const saved = this.saves.latest;
      if (!saved) { this.hud.notify('Nie znaleziono poprawnego zapisu'); return; }
      this.reset();
      restoreRun(this.simulation, saved);
      this.controller.restore(this.simulation.player);
      this.audio.unlock();
      this.hud.update(this.simulation, null);
      this.input.requestLock();
    };
    void this.saves.initialize().then(saved => {
      if (this.disposed) return;
      this.hud.savedRun(saved?.outcome === 'active' ? saved.cycle.day : null);
      if (saved && saved.outcome !== 'active' && this.simulation.phase === 'ready') { restoreRun(this.simulation, saved); this.controller.restore(this.simulation.player); this.hud.update(this.simulation, null); }
      this.hud.saveStatus(this.saves.online ? 'Zapis gotowy' : 'Zapis w tym urządzeniu');
      if (!saved && this.saves.incompatibleSave) this.hud.notify('Mechaniki i mapa się zmieniły — rozpocznij nową próbę');
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
    this.input.onAttack = kind => {
      if (this.building.active) { if (kind === 'heavy') this.building.cancel(); else this.hud.notify(this.building.confirm(this.simulation)); return; }
      const id = combatTarget(this.scenes.scene, this.controller.camera, CONFIG.sword.range+Math.max(this.simulation.skills.bonuses.meleeRange,this.simulation.skills.bonuses.harvestRange));
      this.simulation.attack(id, kind);
    };
    this.input.onRestart = () => { this.reset(); if (this.input.locked) { this.simulation.start(); void this.saveRun(false); } };
    this.input.onBuildToggle = () => this.building.toggle();
    this.input.onBuildSelect = kind => this.building.select(kind);
    this.input.onBuildRotate = () => this.building.rotate();
    this.input.onBuildCancel = () => this.building.cancel();
    this.input.onShelterUpgrade = () => this.hud.notify(this.simulation.improveShelter());
    this.input.onInteract = () => this.hud.notify(this.simulation.interact(combatTarget(this.scenes.scene,this.controller.camera,3)));
    this.input.onRecycle=()=>this.hud.notify(this.simulation.demolishBuilding(combatTarget(this.scenes.scene,this.controller.camera,3)));
    this.input.onMoveTower=()=>this.hud.notify(this.building.beginMove(this.simulation,combatTarget(this.scenes.scene,this.controller.camera,3)));
    this.input.onAbility=kind=>{ const ray=this.controller.camera.getForwardRay(18),pick=this.scenes.scene.pickWithRay(ray,mesh=>mesh.isPickable&&mesh.isEnabled());const point=pick?.pickedPoint??ray.origin.add(ray.direction.scale(12));this.hud.notify(this.simulation.useAbility(kind,{x:point.x,z:point.z})); };
    this.input.onSkillToggle = () => { if(!['playing','paused'].includes(this.simulation.phase))return;this.building.cancel(); this.input.release(); this.skills.show(this.simulation); };
    this.hud.onSkills = () => this.input.onSkillToggle();
    window.addEventListener('resize', this.resize);
    this.hud.update(this.simulation, null);
    this.engine.runRenderLoop(() => this.frame());
  }

  private reset(): void {
    this.skills.hide();
    this.simulation.reset();
    this.controller.reset();
    this.impacts.reset();
    this.hazards.reset();
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
    if (!['playing', 'paused', 'won', 'lost'].includes(this.simulation.phase)) return;
    const snapshot = captureRun(this.simulation);
    const destination = await this.saves.save(snapshot);
    if (this.disposed) return;
    this.hud.savedRun(snapshot.outcome === 'active' ? snapshot.cycle.day : null);
    this.hud.saveStatus(destination === 'sqlite' ? 'Zapisano' : destination === 'local' ? 'Zapis w tym urządzeniu' : 'Nie udało się zapisać na dysku');
    if (manual) this.hud.notify(destination === 'memory' ? 'Zapis na dysku jest niedostępny' : destination === 'sqlite' ? 'Próba zapisana' : 'Próba zapisana w tej przeglądarce');
  }

  private frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    this.visualTime += dt;
    this.arena.update(this.simulation.finalArenaActive);
    if (this.simulation.phase === 'playing') {
      this.controller.update(dt, this.simulation.player, this.simulation.movementSpeed);
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
        case 'swing': this.lastAttack = event.kind; this.sword.swing(event.kind); break;
        case 'shelter-repaired': this.audio.play('repair'); this.hud.notify(`Naprawiono rdzeń · +${event.amount} HP`); break;
        case 'action-blocked': this.hud.notify(event.message); break;
        case 'zombie-hit': {
          this.zombieView.hit(event.zombieId); const zombie = this.simulation.zombies.find(z => z.id === event.zombieId);
          if (event.source === 'sword') { this.hud.hitMarker(); this.audio.play('flesh'); if (this.lastAttack === 'heavy') this.controller.shake(); }
          else this.audio.play('impact');
          if (zombie) this.impacts.burst(zombie.position, event.source === 'tower' ? 'magic' : 'flesh', event.source === 'sword' && this.lastAttack === 'heavy', 1.3);
          break;
        }
        case 'corruption-hit': this.hud.flashDamage(); this.hud.notify(`Psyche wyczerpane · −${event.damage} HP · wróć do Shelteru`); break;
        case 'player-hit': this.hud.flashDamage(); this.hud.notify(`Nieumarły cię atakuje · −${event.damage} HP`); break;
        case 'run-completed': this.audio.play('dawn'); this.hud.notify('RUN COMPLETED'); break;
        case 'guardian-defeated': this.hud.notify('Forge Guardian pokonany · bogate złoża Iron dostępne'); void this.saveRun(false); break;
        case 'boss-windup': this.hud.notify('Unik! Strażnik szykuje silne uderzenie'); this.audio.play('warning'); break;
        case 'boss-slam': this.impacts.burst(event.position, 'magic', true, .15); this.audio.play('impact'); break;
        case 'building-hit': break;
        case 'building-destroyed': this.hud.notify(`Zniszczono ${event.kind}${event.lostResources.wood || event.lostResources.iron ? ' · część zapasów utracona' : ''}`); break;
        case 'shelter-hit': this.hud.flashShelter(); this.hud.notify(`Rdzeń Shelteru pod atakiem · −${event.damage} HP`); break;
        case 'zombie-dead': {
          const enemy=this.simulation.zombies.find(z=>z.id===event.zombieId);
          this.hud.notify(enemy?.mode==='guard' ? `${enemy.stats.label} pokonany` : 'Nieumarły pokonany');
          if(enemy?.mode==='guard')void this.saveRun(false);
          break;
        }
        case 'night-warning': this.audio.play('warning'); this.hud.notify(`${this.simulation.cycle.modifier?.label ?? 'NIGHT IS COMING'} · ${event.seconds} seconds to night`); break;
        case 'night-started': this.hud.notify(`${this.simulation.cycle.modifier?.label ?? 'Noc'} ${event.day} · fala ${event.waveSize} nieumarłych — wróć do Shelteru`); break;
        case 'day-started': this.audio.play('dawn'); this.hud.notify(`Dzień ${event.day} · +1 Skill Point${this.simulation.cycle.modifier ? ' · tej nocy ' + this.simulation.cycle.modifier.label : ''}`); void this.saveRun(false); break;
        case 'resource-hit': {
          this.resourceView.hit(event.nodeId); const node = this.simulation.resourceNodes.find(n => n.id === event.nodeId)!;
          this.impacts.burst(node.position, node.resourceType); break;
        }
        case 'resource-gained': this.audio.play('resource'); this.hud.floatingGain(`+${event.amount} ${RESOURCE_NAMES[event.kind].toUpperCase()}`); break;
        case 'resource-destroyed': {
          const node = this.simulation.resourceNodes.find(n => n.id === event.nodeId)!;
          this.impacts.burst(node.position, node.resourceType, true); break;
        }
        case 'resources-deposited': this.hud.notify(`Zdeponowano · ${event.amount.wood} Wood / ${event.amount.iron} Iron`); break;
        case 'storage-full': this.hud.notify(`Plecak pełny · brak miejsca na ${event.needed} ${RESOURCE_NAMES[event.kind]} — wróć i zdeponuj materiały`); break;
      }
    }
    if (['lost', 'won'].includes(this.simulation.phase) && this.input.locked) this.input.release();
    if (['lost', 'won'].includes(this.simulation.phase) && !this.resultRecorded) {
      this.resultRecorded = true;
      void this.saveRun(false);
      void this.saves.recordResult({ runId: this.simulation.runId, day: this.simulation.cycle.state.day, kills: this.simulation.totalKills, elapsed: this.simulation.elapsed, outcome: this.simulation.phase === 'won' ? 'won' : 'lost' });
    }
    this.zombieView.update(this.simulation.zombies, this.simulation.player, this.accumulator / CONFIG.simulationStep, this.simulation.phase === 'paused' ? 0 : dt, this.simulation.elapsed);
    this.scenes.updateLighting(this.simulation.cycle, dt);
    this.hazards.update(this.simulation);
    this.impacts.update(this.simulation.phase === 'playing' ? dt : 0);
    this.sword.update(this.simulation.phase === 'paused' ? 0 : dt, this.simulation.elapsed, this.simulation.phase === 'playing' && this.controller.moving);
    this.scenes.world.update(this.visualTime, this.simulation.shelter.hp / this.simulation.shelter.maxHp, this.simulation.shelter.level, this.simulation.buildingSystem.buildings,this.simulation.skills.bonuses.campfire>0);
    this.resourceView.update(this.simulation.resourceNodes, this.visualTime, dt);
    this.building.update(this.simulation);
    this.building.view.updateTowers(this.simulation.towerSystem.towers, dt);
    this.projectileView.update(this.simulation.towerSystem.projectiles);
    this.sword.setVisible(!this.building.active);
    this.hudCountdown -= dt;
    if (this.hudCountdown <= 0) {
      const targetId = combatTarget(this.scenes.scene, this.controller.camera, 12);
      this.hud.update(this.simulation, targetId, this.building);
      this.skills.update(this.simulation);
      this.hudCountdown = 0.1;
    }
    this.scenes.scene.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    this.audio.dispose(); this.impacts.dispose();
    this.input.dispose();
    this.engine.stopRenderLoop();
    this.scenes.scene.dispose();
    this.engine.dispose();
  }
}
