import { Color3, DynamicTexture, Mesh, CreateBox, CreateCylinder, CreateSphere, CreatePolyhedron, PointLight, Scene, StandardMaterial, Vector3 } from '../rendering/babylon';
import { CITY_RUINS, RISK_AREAS, MAP_FLOOR_TILES, WORLD_BOUNDARIES } from './WorldLayout';
import { surfaceMaterial, tileBox } from '../rendering/SurfaceMaterials';
import type { Building } from '../building/Building';
import type { Block } from './WorldLayout';
import { BASE_BOUNDS, BASE_WALLS, SHELTER_WALLS, SHELTER_HALL, GENERATOR_PADS, SHELTER_CORE, SHELTER_CORE_ID, SHELTER_DEPOSIT, SHELTER_DEPOSIT_ID } from './ShelterLayout';

export class World {
  private readonly campfire: Mesh;
  readonly shelterCrystal: Mesh;
  readonly shelterCore: Mesh;
  private readonly coreGlow: StandardMaterial;
  private readonly lights: PointLight[] = [];
  private readonly crystalMaterial: StandardMaterial;
  private readonly stone: StandardMaterial;
  private readonly trim: StandardMaterial;
  private readonly dark: StandardMaterial;
  private readonly roof: StandardMaterial;
  private readonly moss: StandardMaterial;
  private readonly gold: StandardMaterial;
  private readonly pads: Mesh[] = [];
  private readonly reinforcements: Mesh[] = [];
  private readonly occupiedPad: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.stone = surfaceMaterial(scene, 'stone');
    this.occupiedPad = surfaceMaterial(scene, 'metal');
    this.trim = this.material('stone-edges', '#74786a');
    this.dark = this.material('recesses', '#1b2627');
    this.roof = surfaceMaterial(scene, 'slate');
    this.moss = this.material('moss', '#374c39');
    this.gold = this.material('aged-bronze', '#83714c');
    const paving=surfaceMaterial(scene,'paving');
    const parts=MAP_FLOOR_TILES.map((tile,index)=>this.box('map-floor-'+index,tile.width,.12,tile.depth,tile.x,-.08,tile.z,paving));
    const ground=Mesh.MergeMeshes(parts,true,true)!;ground.name='reference-city-floor';ground.isPickable=true;ground.metadata={buildGround:true};ground.receiveShadows=true;
    for(const [index,block]of CITY_RUINS.entries())this.buildRuin(block,index);
    for(const [index,block]of WORLD_BOUNDARIES.entries())this.box('reference-boundary-'+index,block.width,block.height,block.depth,block.x,block.height/2,block.z,this.dark,true);
    this.buildShelter();
    const fireBase=CreateCylinder('campfire-brazier',{diameter:1.1,height:.4,tessellation:12},scene);fireBase.position.set(-2,.2,7);fireBase.material=this.occupiedPad;fireBase.isPickable=false;fireBase.metadata={dynamicDetail:true};
    this.campfire=CreateSphere('campfire-flame',{diameter:.6,segments:8},scene);this.campfire.position.set(-2,.65,7);this.campfire.scaling.y=1.5;this.campfire.material=this.material('campfire-embers','#ffad56','#df7431');this.campfire.isPickable=false;this.campfire.metadata={dynamicDetail:true};this.campfire.setEnabled(false);
    const depot = SHELTER_DEPOSIT;
    const cabinet = this.box('resource-deposit-cabinet',depot.width,depot.height,depot.depth,depot.x,depot.height/2,depot.z,surfaceMaterial(scene,'metal'),true);
    cabinet.metadata={depositId:SHELTER_DEPOSIT_ID};
    const depotDoor=this.box('resource-deposit-door',depot.width-.14,depot.height-.18,.07,depot.x,depot.height/2,depot.z-depot.depth/2-.035,surfaceMaterial(scene,'metal'));
    depotDoor.isPickable=true;depotDoor.metadata={depositId:SHELTER_DEPOSIT_ID};
    const handle=this.box('resource-deposit-handle',.08,.55,.12,depot.x+.43,1.3,depot.z-depot.depth/2-.1,this.gold);
    handle.isPickable=true;handle.metadata={depositId:SHELTER_DEPOSIT_ID};
    this.box('resource-deposit-light',.45,.1,.08,depot.x,1.94,depot.z-depot.depth/2-.07,this.material('deposit-light','#a2cfb1','#6ca787'));
    if(typeof document!=='undefined'){
      const label=new DynamicTexture('deposit-sign',{width:256,height:128},scene,false);label.drawText('DEPOSIT',null,73,'bold 35px sans-serif','#e6e1c8','#263d34');
      const mat=this.material('deposit-label','#ffffff');mat.diffuseTexture=label;
      const sign=CreateBox('deposit-label',{width:1,height:.35,depth:.03},scene);sign.position.set(depot.x,.75,depot.z-depot.depth/2-.08);sign.material=mat;sign.isPickable=true;sign.metadata={depositId:SHELTER_DEPOSIT_ID};
    }
    this.coreGlow = this.material('core-runes', '#9abdac', '#638d76');
    this.shelterCore = this.box('shelter-core-body', SHELTER_CORE.width, SHELTER_CORE.height, SHELTER_CORE.depth,
      SHELTER_CORE.x, SHELTER_CORE.height / 2, SHELTER_CORE.z, surfaceMaterial(scene, 'metal'), true);
    this.shelterCore.metadata = { shelterCoreId: SHELTER_CORE_ID };
    for (const [name, w, h, d, y, material] of [
      ['foot', 1.95, .3, 1.95, .15, this.stone], ['collar', 1.8, .16, 1.8, 2.7, this.gold],
      ['crown', 1.9, .22, 1.9, 3.25, this.gold],
    ] as const) {
      const part = this.box('shelter-core-' + name, w, h, d, SHELTER_CORE.x, y, SHELTER_CORE.z, material);
      part.isPickable = true; part.metadata = { shelterCoreId: SHELTER_CORE_ID };
    }
    for (const side of [-1, 1]) {
      for (const [dx, dz, w, d] of [[side * .81, 0, .035, .3], [0, side * .81, .3, .035]]) {
        const rune = this.box('shelter-core-rune', w, 1.2, d, SHELTER_CORE.x + dx, 1.65, SHELTER_CORE.z + dz, this.coreGlow);
        rune.isPickable = true; rune.metadata = { shelterCoreId: SHELTER_CORE_ID };
      }
    }
    this.crystalMaterial = this.material('shelter-light', '#a5d9bf', '#7abf9c');
    this.shelterCrystal = CreatePolyhedron('ward-crystal', { type: 1, size: 0.4 }, scene);
    this.shelterCrystal.position.set(SHELTER_HALL.x, 8.2, SHELTER_HALL.z);
    this.shelterCrystal.scaling.y = 1.6;
    this.shelterCrystal.material = this.crystalMaterial;
    this.shelterCrystal.isPickable = false;
    const ward = new PointLight('ward-light', new Vector3(SHELTER_HALL.x, 4, SHELTER_HALL.z), scene);
    ward.diffuse = Color3.FromHexString('#a5d5b4');
    ward.intensity = 1.2;
    ward.range = 22;
    this.torch(-1.4, -12.8); this.torch(4.4, -12.8);
    this.torch(-3.3, 0); this.torch(6.3, 0);
    this.highRiskLandmarks();
    this.mergeStaticDetails();
  }

  private material(name: string, color: string, emissive?: string): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = new Color3(0.04, 0.05, 0.04);
    if (emissive) material.emissiveColor = Color3.FromHexString(emissive);
    return material;
  }

  private box(name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: StandardMaterial, solid = false): Mesh {
    const mesh = CreateBox(name, { width, height, depth }, this.scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    if (material.diffuseTexture) tileBox(mesh, width, height, depth);
    mesh.receiveShadows = true;
    mesh.checkCollisions = solid;
    mesh.isPickable = solid;
    return mesh;
  }
  private buildRuin(block: Block, index: number): void {
    const {x,z,width,depth,height}=block;
    this.box('city-solid-'+index,width,height,depth,x,height/2,z,this.stone,true);
    this.box('city-roof-'+index,width,.12,depth,x,height+.06,z,this.roof);
    if(width>4&&depth>3){
      this.box('city-window-'+index,1.1,1.5,.035,x,height*.55,z-depth/2-.02,this.dark);
      this.box('city-moss-'+index,Math.min(width,3),.5,.035,x,.5,z-depth/2-.025,this.moss);
    }
  }


  private buildShelter(): void {
    const { x, z, width, depth, height, doorWidth } = SHELTER_HALL;
    const { minX, maxX, minZ, maxZ } = BASE_BOUNDS;
    const floor = this.box('base-floor', maxX - minX, 0.06, maxZ - minZ, x, 0, 0, surfaceMaterial(this.scene, 'paving'), true);
    floor.metadata = { buildGround: true };
    for (const [i, wall] of BASE_WALLS.entries()) {
      this.box(`base-wall-${i}`, wall.width, wall.height, wall.depth, wall.x, wall.height / 2, wall.z, this.stone, true);
      this.box('base-wall-cap', wall.width + 0.08, 0.15, wall.depth + 0.08, wall.x, wall.height, wall.z, this.trim);
    }
    for (const pad of GENERATOR_PADS) {
      const tile = this.box('generator-pad', 2.4, 0.035, 2.4, pad.x, 0.05, pad.z, surfaceMaterial(this.scene, 'slate'));
      tile.isPickable = true; tile.metadata = { buildGround: true, generatorPad: this.pads.length + 1 }; this.pads.push(tile);
      for (const side of [-1, 1]) this.box('generator-pad-edge', 0.07, 0.04, 2.4, pad.x + side * 1.2, 0.075, pad.z, this.gold);
    }
    for (const [i, wall] of SHELTER_WALLS.entries()) {
      if (!wall.windows?.length) { this.box(`shelter-wall-${i}`, wall.width, wall.height, wall.depth, wall.x, wall.height / 2, wall.z, this.stone, true); continue; }
      const vertical = wall.width < wall.depth;
      const length = vertical ? wall.depth : wall.width;
      const center = vertical ? wall.z : wall.x;
      const piece = (start: number, end: number, bottom: number, top: number, label: string) => {
        if (end - start < 0.01) return;
        this.box(`shelter-wall-${i}-${label}`, vertical ? wall.width : end - start, top - bottom, vertical ? end - start : wall.depth,
          vertical ? wall.x : (start + end) / 2, (top + bottom) / 2, vertical ? (start + end) / 2 : wall.z, this.stone, true);
      };
      piece(center - length / 2, center + length / 2, 0, 1.15, 'sill');
      piece(center - length / 2, center + length / 2, 2.7, height, 'upper');
      let cursor = center - length / 2;
      for (const [n, window] of [...wall.windows].sort((a, b) => (vertical ? a.z - b.z : a.x - b.x)).entries()) {
        const axis = vertical ? window.z : window.x, span = vertical ? window.depth : window.width;
        piece(cursor, axis - span / 2, 1.15, 2.7, `column-${n}`);
        cursor = axis + span / 2;
        this.box('window-sill', vertical ? 0.75 : span + 0.2, 0.13, vertical ? span + 0.2 : 0.75, window.x, 1.12, window.z, this.trim);
        this.box('window-lintel', vertical ? 0.68 : span + 0.16, 0.16, vertical ? span + 0.16 : 0.68, window.x, 2.75, window.z, this.trim);
      }
      piece(cursor, center + length / 2, 1.15, 2.7, 'end');
    }
    const hallFloor = this.box('shelter-floor', width, 0.025, depth, x, 0.013, z, this.trim, true);
    hallFloor.metadata = { buildGround: true };
    this.box('shelter-ceiling', width + 0.5, 0.25, depth + 0.5, x, height + 0.1, z, this.trim, true);
    const canopy = CreateCylinder('shelter-roof', { diameterTop: 0, diameterBottom: (width + 1) * Math.SQRT2, height: 2.5, tessellation: 4 }, this.scene);
    canopy.position.set(x, height + 1.45, z);
    canopy.rotation.y = Math.PI / 4;
    canopy.scaling.z = (depth + 0.8) / (width + 1);
    canopy.material = this.roof;
    canopy.isPickable = false;
    const frontZ = z - depth / 2;
    this.box('shelter-door-lintel', doorWidth, 0.8, 0.5, x, height - 0.4, frontZ, this.trim, true);
    // Hinged leaves sit open against the wall, leaving a full 3 m entrance.
    for (const side of [-1, 1]) {
      this.box('open-door', 0.12, 2.9, 1.4, x + side * (doorWidth / 2 + 0.12), 1.5, frontZ - 0.6, this.gold);
      this.box('door-brace', 0.14, 0.1, 1.2, x + side * (doorWidth / 2 + 0.14), 1.7, frontZ - 0.6, this.dark);
    }
    this.box('shelter-rear-bench', 3.2, 0.7, 0.5, x, 0.4, z + depth / 2 - 0.5, surfaceMaterial(this.scene, 'wood'));
    for (const side of [-1, 1]) {
      const band = this.box('shelter-reinforcement', 0.12, 0.16, depth + 0.6, x + side * (width / 2 + 0.3), 3.1, z, this.gold);
      band.isPickable = true; this.reinforcements.push(band); band.setEnabled(false);
      const shield = this.box('shelter-ward-plating', 0.12, 0.65, depth + 0.4, x + side * (width / 2 + 0.28), 0.7, z, this.gold);
      shield.isPickable = true; this.reinforcements.push(shield); shield.setEnabled(false);
    }
    for (const side of [-1, 1]) {
      this.box('shelter-banner', 1, 2, 0.06, x + side * 2.7, 2.5, frontZ - 0.29, this.material(`banner-${side}`, '#613d35'));
      this.box('ward-symbol', 0.16, 0.8, 0.07, x + side * 2.7, 2.65, frontZ - 0.34, this.gold);
    }
    this.box('crystal-pedestal', 0.65, 1.4, 0.65, x, 7.2, z, this.gold);
    const beam = CreateCylinder('shelter-beacon', { diameter: 0.14, height: 16, tessellation: 8 }, this.scene);
    beam.position.set(x, 16, z); beam.isPickable = false;
    const beamMaterial = this.material('beacon-glow', '#9ec9b0', '#6eaa8d');
    beamMaterial.alpha = 0.35; beam.material = beamMaterial;
  }

  private torch(x: number, z: number): void {
    this.box('torch-post', 0.16, 2.6, 0.16, x, 1.3, z, this.dark);
    this.box('lantern-base', 0.38, 0.16, 0.38, x, 2.4, z, this.gold);
    const flame = CreateSphere('lantern', { diameter: 0.25, segments: 6 }, this.scene);
    flame.position.set(x, 2.65, z);
    flame.scaling.y = 1.8;
    flame.material = this.material(`flame-${x}-${z}`, '#ffd2a0', '#ffab59');
    flame.isPickable = false;
    const light = new PointLight('torch-light', new Vector3(x, 2.8, z), this.scene);
    light.diffuse = Color3.FromHexString('#ffc080');
    light.intensity = 0.65;
    light.range = 9;
    this.lights.push(light);
  }
  

  

  private highRiskLandmarks(): void {
    const arena=RISK_AREAS.finalArena;
    this.box('citadel-arena-floor',arena.width,.025,arena.depth,arena.x,-.006,arena.z,surfaceMaterial(this.scene,'slate'));
    for(const area of [RISK_AREAS.ancientForge,RISK_AREAS.graveyard,RISK_AREAS.centralSquare,arena]){
      if(typeof document==='undefined')continue;
      const texture=new DynamicTexture('district-sign-'+area.name,{width:1024,height:128},this.scene,false);
      texture.drawText(area.name.toUpperCase(),null,82,'bold 38px sans-serif','#e0c18b','#192321',true);
      const material=this.material('district-sign-'+area.name,'#ffffff');material.diffuseTexture=texture;
      const sign=CreateBox('district-sign',{width:6,height:.75,depth:.03},this.scene);sign.position.set(area.x,3.5,area.z-area.depth/2+2);sign.material=material;sign.isPickable=false;
    }
  }

  private mergeStaticDetails(): void {
    // Merge only decorative geometry. Collision/raycast meshes remain independent.
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of this.scene.meshes) {
      if (!(mesh instanceof Mesh) || !mesh.isVisible || mesh.metadata?.dynamicDetail || mesh.isPickable || mesh.checkCollisions ||
        mesh.instances.length > 0 || mesh === this.shelterCrystal || !(mesh.material instanceof StandardMaterial)) continue;
      const group = groups.get(mesh.material) ?? [];
      group.push(mesh);
      groups.set(mesh.material, group);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const merged = Mesh.MergeMeshes(meshes, true, true);
      if (merged) { merged.name = `city-details-${material.name}`; merged.isPickable = false; }
    }
  }

  update(time: number, shelterHpRatio: number, shelterLevel = 1, buildings: readonly Building[] = [], campfireEnabled = false): void {
    this.reinforcements.forEach((mesh, index) => mesh.setEnabled(shelterLevel >= (index % 2 === 0 ? 2 : 3)));
    this.pads.forEach((mesh, index) => { mesh.material = buildings.some(building => building.kind === 'arcane-core' && Math.hypot(building.position.x - GENERATOR_PADS[index].x, building.position.z - GENERATOR_PADS[index].z) < 0.1) ? this.occupiedPad : surfaceMaterial(this.scene, 'slate'); });
    this.coreGlow.emissiveColor.set(.14 + .2 * shelterHpRatio, .18 + .4 * shelterHpRatio, .16 + .3 * shelterHpRatio);
    this.campfire.setEnabled(campfireEnabled);this.campfire.scaling.y=1.3+Math.sin(time*8)*.2;
    this.shelterCrystal.rotation.y = time * 0.4;
    this.shelterCrystal.position.y = 8.2 + Math.sin(time * 1.8) * 0.08;
    this.crystalMaterial.emissiveColor.set(0.3 + 0.2 * shelterHpRatio, 0.4 + 0.3 * shelterHpRatio, 0.4);
    this.lights.forEach((light, index) => { light.intensity = 0.6 + Math.sin(time * 7 + index * 2) * 0.05; });
  }
}
