import { Color3, CreateBox, Scene, StandardMaterial, TransformNode, Vector3 } from '../rendering/babylon';
import { FantasyArt } from '../rendering/FantasyArt';
import { BUILDINGS } from './Building';
import type { Building, BuildingKind } from './Building';
import type { Position } from '../domain/types';
import type { TowerState } from './MagicTowerSystem';

export class BuildingView {
  private readonly roots = new Map<string, TransformNode>();
  private readonly turrets = new Map<string, TransformNode>();
  private readonly conduitCrystals = new Map<string, TransformNode>();
  private visualTime = 0;
  private readonly crystal: StandardMaterial;
  private readonly ghost: StandardMaterial;
  private previewRoot: TransformNode | null = null;
  private previewKind: BuildingKind | null = null;

  constructor(private readonly scene: Scene) {
    const material = (name: string, hex: string): StandardMaterial => {
      const value = new StandardMaterial(name, scene);
      value.diffuseColor = Color3.FromHexString(hex);
      value.specularColor = Color3.Black();
      return value;
    };
    this.crystal = material('building-crystal', '#8ccca8');
    this.crystal.emissiveColor = Color3.FromHexString('#4d9977');
    this.ghost = material('building-preview', '#78c998');
    this.ghost.alpha = 0.4;
    this.ghost.backFaceCulling = false;
  }

  private create(kind: BuildingKind, id: string, preview: boolean): TransformNode {
    const root = new TransformNode(id, this.scene);
    const definition = BUILDINGS[kind];
    const art=new FantasyArt(this.scene,root,preview?this.ghost:undefined);
    art.box(`${id}-base`,definition.width,.22,definition.depth,0,.11,0);
    if(kind==='storehouse') {
      art.box(`${id}-stone-footing`,2.55,.45,1.95,0,.45,0);
      art.box(`${id}-oak-walls`,2.55,1.1,1.95,0,1.15,0,art.timber);
      for(const x of [-1.19,1.19]) art.box(`${id}-oak-post`,.16,1.65,2.04,x,1.025,0,art.timber);
      art.roof(`${id}-storehouse`,2.7,2.1,0,1.76,0,.65,art.timber);
      art.box(`${id}-door`,.84,1.35,.035,0,.96,-.997,art.dark);
      art.box(`${id}-oak-door`,.7,1.25,.035,0,.92,-1.021,art.timber);
      for(const y of [.65,1.3])art.box(`${id}-hinge`,.7,.07,.035,0,y,-1.04,art.iron);
      art.runeGlyph(`${id}-store-ward`,0,1.9,-1.065,.25,art.bronze);
    } else if(kind==='arcane-core') {
      art.cylinder(`${id}-runic-base`,1.65,.37,0,.405,0);
      art.cylinder(`${id}-mana-pillar`,.7,.75,0,.92,0,art.stone,.55);
      art.ring(`${id}-bronze-seal`,1.15,0,.64,0,.075,art.bronze);
      const crystalRig=new TransformNode(`${id}-conduit-heart`,this.scene);crystalRig.parent=root;crystalRig.position.y=1.65;
      const crystal=art.crystal(`${id}-crystal`,.37,0,0,0,this.crystal);crystal.parent=crystalRig;
      for(const side of [-1,1])for(const z of [-.55,.55]) {
        art.beam(`${id}-conduit-brace`,new Vector3(side*.62,.45,z),new Vector3(side*.54,1.8,z),.12,art.bronze);
        art.beam(`${id}-conduit-crown`,new Vector3(side*.54,1.8,z),new Vector3(side*.33,2.25,z*.6),.09,art.bronze);
      }
      for(const z of [-.35,.35])art.runeGlyph(`${id}-conduit-rune`,0,1,z,.45,art.rune);
      if(!preview)this.conduitCrystals.set(id,crystalRig);
    } else {
      art.cylinder(`${id}-octagonal-foot`,1.5,.35,0,.4,0);
      art.cylinder(`${id}-runic-shaft`,1.08,1.9,0,1.45,0,art.stone,.75);
      art.cylinder(`${id}-carved-capital`,1.35,.22,0,2.4,0,art.stone,1.5);
      for(const side of [-1,1]) {
        art.box(`${id}-stone-buttress`,.2,1.1,.35,side*.57,.85,0);
        art.runeGlyph(`${id}-tower-inscription`,0,1.65,side*.5,.6,art.rune);
      }
      const turret=new TransformNode(`${id}-turret`,this.scene);turret.parent=root;turret.position.y=2.55;
      const crown=new FantasyArt(this.scene,turret,preview?this.ghost:undefined);
      crown.ring(`${id}-runic-head`,1.3,0,0,0,.1,crown.bronze);
      crown.crystal(`${id}-crystal`,.3,0,.25,0,this.crystal);
      for(const side of [-1,1]) {
        crown.beam(`${id}-focus-prong`,new Vector3(side*.45,0,-.25),new Vector3(side*.2,.48,.25),.075,crown.bronze);
        crown.crystal(`${id}-focus`,.09,side*.2,.48,.25,this.crystal);
      }
      if(!preview)this.turrets.set(id,turret);
    }
    if (!preview) {
      const collider = CreateBox(`${id}-collider`, { width: definition.width, height: definition.height, depth: definition.depth }, this.scene);
      collider.parent = root;
      collider.position.y = definition.height / 2;
      collider.isVisible = false;
      collider.checkCollisions = true;
      collider.isPickable = true;
      collider.metadata = { buildingId: id };
    }
    return root;
  }

  sync(buildings: readonly Building[]): void {
    for (const [id, root] of this.roots) {
      if (!buildings.some(building => building.id === id)) { root.dispose(); this.roots.delete(id); this.turrets.delete(id); this.conduitCrystals.delete(id); }
    }
    for (const building of buildings) {
      const existing = this.roots.get(building.id);
      if (existing) { existing.position.set(building.position.x,0,building.position.z); existing.rotation.y=building.rotation; existing.computeWorldMatrix(true); existing.getChildMeshes().forEach(mesh=>mesh.computeWorldMatrix(true)); continue; }
      const root = this.create(building.kind, building.id, false);
      root.position.set(building.position.x, 0, building.position.z);
      root.rotation.y = building.rotation;
      root.computeWorldMatrix(true);
      root.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      this.roots.set(building.id, root);
    }
  }

  updateTowers(states: ReadonlyMap<string, TowerState>, dt: number): void {
    this.visualTime+=dt;
    for(const heart of this.conduitCrystals.values()){heart.rotation.y=this.visualTime*.3;heart.position.y=1.65+Math.sin(this.visualTime*1.6)*.035;}
    for (const [id, turret] of this.turrets) {
      const state = states.get(id);
      if (!state) continue;
      const desired = state.yaw - this.roots.get(id)!.rotation.y;
      const delta = Math.atan2(Math.sin(desired - turret.rotation.y), Math.cos(desired - turret.rotation.y));
      turret.rotation.y += delta * Math.min(1, dt * 12);
    }
  }

  preview(kind: BuildingKind | null, position: Position | null, rotation: number, valid: boolean): void {
    if (!kind || !position) { this.previewRoot?.setEnabled(false); return; }
    if (this.previewKind !== kind) {
      this.previewRoot?.dispose();
      this.previewRoot = this.create(kind, 'build-preview', true);
      this.previewKind = kind;
    }
    this.previewRoot!.setEnabled(true);
    this.previewRoot!.position.set(position.x, 0, position.z);
    this.previewRoot!.rotation.y = rotation;
    const color = valid ? Color3.FromHexString('#78c998') : Color3.FromHexString('#d17760');
    this.ghost.diffuseColor.copyFrom(color);
    this.ghost.emissiveColor.copyFrom(color.scale(0.3));
  }

  reset(): void {
    for (const root of this.roots.values()) root.dispose();
    this.roots.clear();
    this.turrets.clear();
    this.conduitCrystals.clear();
    this.previewRoot?.setEnabled(false);
  }
}
