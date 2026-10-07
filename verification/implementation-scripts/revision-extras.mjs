import fs from 'node:fs';
const edit=(p,changes)=>{let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');for(const[a,b]of changes){if(!s.includes(a))throw Error(p+' '+a.slice(0,60));s=s.replace(a,b)}fs.writeFileSync(p,s)};
edit('client/src/building/Building.ts', [['readonly rotation: number','public rotation: number']]);
edit('client/src/building/BuildingView.ts', [['      if (this.roots.has(building.id)) continue;', '      const existing = this.roots.get(building.id);\n      if (existing) { existing.position.set(building.position.x,0,building.position.z); existing.rotation.y=building.rotation; existing.computeWorldMatrix(true); existing.getChildMeshes().forEach(mesh=>mesh.computeWorldMatrix(true)); continue; }']]);
edit('client/src/domain/Simulation.ts', [
 ['  improveShelter(): string {', `  demolitionTarget(id: string | null) {
    const building=this.buildingSystem.buildings.find(b=>b.id===id&&b.alive);
    return building&&this.phase==='playing'&&inBase(this.player.position)&&building.distanceFrom(this.player.position)<=3&&hasLineOfSight(this.player.position,building.contactPoint(this.player.position),this.obstacles.filter(a=>a.x!==building.position.x||a.z!==building.position.z)) ? building : null;
  }
  demolishBuilding(id: string | null): string {
    if (!this.skills.bonuses.recycle) return 'Odblokuj Recycle w Engineer';
    const building=this.demolitionTarget(id);if(!building)return 'Podejdź do konstrukcji i wyceluj';
    const cost=this.buildingSystem.costFor(building.kind);
    this.buildingSystem.buildings.splice(this.buildingSystem.buildings.indexOf(building),1);
    this.towerSystem.towers.delete(building.id);
    this.towerSystem.projectiles.splice(0,this.towerSystem.projectiles.length,...this.towerSystem.projectiles.filter(p=>p.sourceId!==building.id));
    this.resourceManager.setCapacity(this.buildingSystem.capacity);
    const wood=this.resourceManager.add('wood',Math.floor(cost.wood*this.skills.bonuses.recycle)),iron=this.resourceManager.add('iron',Math.floor(cost.iron*this.skills.bonuses.recycle));
    this.refreshNavigation();return 'RECYCLE · zwrot '+wood+' Wood / '+iron+' Iron';
  }
  validateMoveTower(id: string, position: Position, rotation: number): string | null {
    const building=this.buildingSystem.buildings.find(b=>b.id===id&&b.kind==='magic-tower'&&b.alive);
    if(!building||!this.skills.bonuses.moveTower||this.phase!=='playing')return 'Przenoszenie wież jest niedostępne';
    const index=this.buildingSystem.buildings.indexOf(building);this.buildingSystem.buildings.splice(index,1);
    const resources=new ResourceManager();Object.assign(resources.counts,{wood:1e6,iron:1e6});
    try{return this.buildingSystem.validate('magic-tower',position,rotation,{...this.buildContext,resources});}
    finally{this.buildingSystem.buildings.splice(index,0,building);}
  }
  moveTower(id: string, position: Position, rotation: number): string {
    const reason=this.validateMoveTower(id,position,rotation);if(reason)return reason;
    const building=this.buildingSystem.buildings.find(b=>b.id===id)!;Object.assign(building.position,position);building.rotation=rotation;this.refreshNavigation();return 'Wieża przeniesiona';
  }
  improveShelter(): string {`],
 ["if (zombie.mode !== 'guard') zombie.mode = 'siege';", "if (zombie.mode !== 'guard' && !zombie.id.startsWith('boss-minion-')) zombie.mode = 'siege';"],
 ]);
edit('client/src/building/BuildingController.ts', [
 ['  active = false;', '  active = false;\n  movingId: string | null = null;'],
 ['toggle(): void { this.active = !this.active; }', 'toggle(): void { this.movingId=null; this.active = !this.active; }'],
 ['select(kind: BuildingKind): void { this.kind = kind;', 'select(kind: BuildingKind): void { this.movingId=null; this.kind = kind;'],
 ['cancel(): void { this.active = false;', 'cancel(): void { this.movingId=null; this.active = false;'],
 ['  update(sim: Simulation): void {', `  beginMove(sim: Simulation, id: string | null): string {
    const tower=sim.demolitionTarget(id);
    if(!sim.skills.bonuses.moveTower)return 'Odblokuj Turret Tower Moving w Engineer';
    if(!tower||tower.kind!=='magic-tower')return 'Podejdź do wieży i wyceluj';
    this.kind='magic-tower';this.rotation=tower.rotation;this.movingId=tower.id;this.active=true;return 'Celuj w ziemię · LPM przenieś · PPM anuluj';
  }
  update(sim: Simulation): void {`],
 ['sim.buildingSystem.validate(this.kind, this.position, this.rotation, sim.buildContext)', 'this.movingId ? sim.validateMoveTower(this.movingId,this.position,this.rotation) : sim.buildingSystem.validate(this.kind, this.position, this.rotation, sim.buildContext)'],
 ["    const result = sim.placeBuilding(this.kind, this.position, this.rotation);", "    if (this.movingId) { const reason=sim.validateMoveTower(this.movingId,this.position,this.rotation);if(reason)return reason;const message=sim.moveTower(this.movingId,this.position,this.rotation);this.cancel();return message; }\n    const result = sim.placeBuilding(this.kind, this.position, this.rotation);"],
]);
edit('client/src/core/InputManager.ts', [
 ['  onInteract: () => void = () => {};', "  onInteract: () => void = () => {};\n  onAbility: (kind: 'barrage'|'cloak'|'demolition') => void = () => {};\n  onRecycle: () => void = () => {};\n  onMoveTower: () => void = () => {};"],
 ["'KeyE', 'Digit1'", "'KeyE', 'KeyX', 'KeyV', 'Digit5', 'Digit6', 'Digit7', 'Digit1'"],
 ["      if (event.code === 'KeyE' && !event.repeat) this.onInteract();", "      if (event.code === 'KeyE' && !event.repeat) this.onInteract();\n      if(event.code==='KeyX'&&!event.repeat)this.onRecycle();\n      if(event.code==='KeyV'&&!event.repeat)this.onMoveTower();\n      if(!event.repeat) { const abilities:Record<string,'barrage'|'cloak'|'demolition'>={Digit5:'barrage',Digit6:'cloak',Digit7:'demolition'};if(abilities[event.code])this.onAbility(abilities[event.code]); }"],
]);
edit('client/src/core/Game.ts', [
 ["import { ImpactEffects }", "import { BossHazardView } from '../enemies/BossHazardView';\nimport { ImpactEffects }"],
 ['  private readonly impacts: ImpactEffects;', '  private readonly impacts: ImpactEffects;\n  private readonly hazards: BossHazardView;'],
 ['    this.impacts = new ImpactEffects(this.scenes.scene);', '    this.impacts = new ImpactEffects(this.scenes.scene);\n    this.hazards = new BossHazardView(this.scenes.scene);'],
 ['combatTarget(this.scenes.scene, this.controller.camera, CONFIG.sword.range);', 'combatTarget(this.scenes.scene, this.controller.camera, CONFIG.sword.range+Math.max(this.simulation.skills.bonuses.meleeRange,this.simulation.skills.bonuses.harvestRange));'],
 ['    this.input.onSkillToggle', `    this.input.onRecycle=()=>this.hud.notify(this.simulation.demolishBuilding(combatTarget(this.scenes.scene,this.controller.camera,3)));
    this.input.onMoveTower=()=>this.hud.notify(this.building.beginMove(this.simulation,combatTarget(this.scenes.scene,this.controller.camera,3)));
    this.input.onAbility=kind=>{ const ray=this.controller.camera.getForwardRay(18),pick=this.scenes.scene.pickWithRay(ray,mesh=>mesh.isPickable&&mesh.isEnabled());const point=pick?.pickedPoint??ray.origin.add(ray.direction.scale(12));this.hud.notify(this.simulation.useAbility(kind,{x:point.x,z:point.z})); };
    this.input.onSkillToggle`],
 ['    this.impacts.reset();', '    this.impacts.reset();\n    this.hazards.reset();'],
 ['    this.impacts.update(this.simulation.phase', '    this.hazards.update(this.simulation);\n    this.impacts.update(this.simulation.phase'],
 ['this.simulation.buildingSystem.buildings);\n    this.resourceView', 'this.simulation.buildingSystem.buildings,this.simulation.skills.bonuses.campfire>0);\n    this.resourceView'],
]);
