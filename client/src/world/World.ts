import { Color3, DynamicTexture, Mesh, CreateBox, CreateCylinder, CreateSphere, CreatePolyhedron, Scene, StandardMaterial, PBRMaterial, Vector3 } from '../rendering/babylon';
import { CITY_RUINS, RISK_AREAS, MAP_FLOOR_TILES, WORLD_BOUNDARIES, CITY_BARRICADES } from './WorldLayout';
import { surfaceMaterial, surfaceMaterialInstance } from '../rendering/SurfaceMaterials';
import { environmentMaterial, environmentMaterialInstance, tileArtBox } from '../rendering/EnvironmentMaterials';
import type { ArtMaterial } from '../rendering/EnvironmentMaterials';
import type { Building } from '../building/Building';
import type { Block } from './WorldLayout';
import { CityArt } from './CityArt';
import { FINAL_ARENA, subtractPitFloor } from './ArenaLayout';
import { FantasyArt } from '../rendering/FantasyArt';
import { BASE_FLOOR_TILES, BASE_BOUNDARY, SHELTER_WALLS, SHELTER_HALL, GENERATOR_PADS, SHELTER_CORE, SHELTER_CORE_ID, SHELTER_DEPOSIT, SHELTER_DEPOSIT_ID } from './ShelterLayout';

export class World {
  private readonly cityArt: CityArt;
  private readonly art: FantasyArt;
  private readonly wardMotes: Mesh[] = [];
  private readonly campfire: Mesh;
  readonly shelterCrystal: Mesh;
  readonly shelterCore: Mesh;
  private readonly coreGlow: StandardMaterial;
  private readonly crystalMaterial: StandardMaterial;
  private readonly stone: PBRMaterial;
  private readonly trim: PBRMaterial;
  private readonly dark: StandardMaterial;
  private readonly gold: StandardMaterial;
  private readonly pads: Mesh[] = [];
  private readonly reinforcements: Mesh[] = [];
  private readonly occupiedPad: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.art = new FantasyArt(scene);
    this.cityArt = new CityArt(scene);
    this.stone = environmentMaterial(scene, 'stone');
    this.occupiedPad = surfaceMaterial(scene, 'metal');
    this.trim = environmentMaterialInstance(scene, 'stone', 'stone-edges');
    this.trim.albedoColor.set(.9, .9, .86);
    this.dark = this.material('recesses', '#1b2627');
    this.gold = surfaceMaterialInstance(scene, 'metal', 'aged-bronze');
    this.gold.diffuseColor.set(.85, .73, .5);
    const paving=environmentMaterial(scene,'paving');
    const streetFloor=subtractPitFloor(MAP_FLOOR_TILES);
    const parts=streetFloor.map((tile,index)=>this.box('map-floor-'+index,tile.width,.12,tile.depth,tile.x,-.08,tile.z,paving));
    const ground=Mesh.MergeMeshes(parts,true,true)!;ground.name='reference-city-floor';ground.isPickable=true;ground.metadata={buildGround:true};ground.receiveShadows=true;
    for(const [index,block]of CITY_RUINS.entries())this.buildRuin(block,index);
    for(const block of WORLD_BOUNDARIES){
      const collider=this.box(block.colliderName,block.width,block.height,block.depth,block.x,block.height/2,block.z,this.stone,true);
      collider.isVisible=false;this.cityArt.boundary(block);
    }
    for(const barricade of CITY_BARRICADES){
      const collider=this.box('city-barricade-'+barricade.id,barricade.width,barricade.height,barricade.depth,barricade.x,barricade.height/2,barricade.z,this.art.timber,true);
      collider.isVisible=false;collider.metadata={mapBarricade:barricade.id};this.cityArt.barricade(barricade);
    }
    this.buildShelter();
    const fireBase=CreateCylinder('campfire-brazier',{diameter:1.1,height:.4,tessellation:12},scene);fireBase.position.set(-2,.2,7);fireBase.material=this.occupiedPad;fireBase.isPickable=false;fireBase.metadata={dynamicDetail:true};
    this.campfire=CreateSphere('campfire-flame',{diameter:.6,segments:8},scene);this.campfire.position.set(-2,.65,7);this.campfire.scaling.y=1.5;this.campfire.material=this.material('campfire-embers','#ffad56','#df7431');this.campfire.isPickable=false;this.campfire.metadata={dynamicDetail:true};this.campfire.setEnabled(false);
    const depot = SHELTER_DEPOSIT;
    const cabinet = this.box('resource-deposit-cabinet',depot.width,depot.height,depot.depth,depot.x,depot.height/2,depot.z,this.art.timber,true);
    cabinet.metadata={depositId:SHELTER_DEPOSIT_ID};
    const depotDoor=this.box('resource-deposit-door',depot.width-.14,depot.height-.18,.07,depot.x,depot.height/2,depot.z-depot.depth/2-.035,this.art.timber);
    depotDoor.isPickable=true;depotDoor.metadata={depositId:SHELTER_DEPOSIT_ID};
    const handle=this.box('resource-deposit-handle',.08,.55,.12,depot.x+.43,1.3,depot.z-depot.depth/2-.1,this.gold);
    handle.isPickable=true;handle.metadata={depositId:SHELTER_DEPOSIT_ID};
    this.art.crystal('depot-ward-seal',.06,depot.x,1.94,depot.z-depot.depth/2-.07,this.art.rune);
    this.art.ring('depot-seal-frame',.23,depot.x,1.94,depot.z-depot.depth/2-.06,.025,this.gold).rotation.x=Math.PI/2;
    if(typeof document!=='undefined'){
      const label=new DynamicTexture('deposit-sign',{width:256,height:128},scene,false);label.drawText('DEPOSIT',null,73,'bold 34px Georgia, serif','#d4c4a2','#32291f');
      const mat=this.material('deposit-label','#ffffff');mat.diffuseTexture=label;
      const sign=CreateBox('deposit-label',{width:1,height:.35,depth:.03},scene);sign.position.set(depot.x,.75,depot.z-depot.depth/2-.08);sign.material=mat;sign.isPickable=true;sign.metadata={depositId:SHELTER_DEPOSIT_ID};
    }
    for(const side of [-1,1]){
      this.art.box('depot-oak-corner',.12,depot.height,.14,depot.x+side*(depot.width/2-.04),depot.height/2,depot.z-depot.depth/2-.055,this.art.timber);
      this.art.box('depot-wrought-hinge',depot.width-.15,.09,.035,depot.x,1.2+side*.55,depot.z-depot.depth/2-.09,this.art.iron);
    }
    this.art.box('depot-stone-coping',depot.width+.12,.16,depot.depth+.1,depot.x,depot.height+.08,depot.z);
    this.art.runeGlyph('depot-ward',depot.x,1.62,depot.z-depot.depth/2-.085,.28,this.art.bronze);
    this.coreGlow = this.material('core-runes', '#9abdac', '#638d76');
    this.shelterCore = this.box('shelter-core-body', SHELTER_CORE.width, SHELTER_CORE.height, SHELTER_CORE.depth,
      SHELTER_CORE.x, SHELTER_CORE.height / 2, SHELTER_CORE.z, this.stone, true);
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
        const rune = this.box('shelter-core-rune', w, 1.2, d, SHELTER_CORE.x + dx, 1.65, SHELTER_CORE.z + dz, this.art.iron);
        rune.isPickable = true; rune.metadata = { shelterCoreId: SHELTER_CORE_ID };
      }
    }
    const cx=SHELTER_CORE.x,cz=SHELTER_CORE.z;
    this.art.ring('beacon-floor-seal',4,cx,.052,cz,.035,this.coreGlow);
    this.art.ring('beacon-inner-seal',2.8,cx,.051,cz,.024,this.gold);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      const from=new Vector3(cx+Math.sin(angle)*1.45,.055,cz+Math.cos(angle)*1.45);
      const to=new Vector3(cx+Math.sin(angle)*1.92,.055,cz+Math.cos(angle)*1.92);
      this.art.beam('beacon-floor-glyph',from,to,.025,this.coreGlow);
      const mote=this.art.sphere('beacon-mote',.028,.028,.028,cx,1,cz,this.coreGlow);
      mote.metadata={artOnly:true,dynamicDetail:true};this.wardMotes.push(mote);
    }
    for(const side of [-1,1])for(const y of [1,1.65,2.3]){
      this.art.runeGlyph('beacon-inscribed-rune',cx, y, cz+side*.815,.4,this.coreGlow);
      this.art.runeGlyph('beacon-inscribed-rune',cx+side*.815, y, cz,.4,this.coreGlow,Math.PI/2);
    }
    this.art.crystal('beacon-crown-heart',.22,cx,3.55,cz,this.coreGlow);
    this.crystalMaterial = this.material('shelter-light', '#a5d9bf', '#7abf9c');
    this.shelterCrystal = CreatePolyhedron('ward-crystal', { type: 1, size: 0.4 }, scene);
    this.shelterCrystal.position.set(SHELTER_HALL.x, 8.2, SHELTER_HALL.z);
    this.shelterCrystal.scaling.y = 1.6;
    this.shelterCrystal.material = this.crystalMaterial;
    this.shelterCrystal.isPickable = false;
    this.torch(-1.4, -12.8); this.torch(4.4, -12.8);
    this.torch(-3.3, 0); this.torch(6.3, 0);
    this.highRiskLandmarks();
    this.cityArt.landmarks();
    this.mergeStaticDetails();
  }

  private material(name: string, color: string, emissive?: string): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = new Color3(0.04, 0.05, 0.04);
    if (emissive) material.emissiveColor = Color3.FromHexString(emissive);
    return material;
  }

  private box(name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: ArtMaterial, solid = false): Mesh {
    const mesh = CreateBox(name, { width, height, depth }, this.scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    tileArtBox(mesh, width, height, depth, material);
    mesh.receiveShadows = true;
    mesh.checkCollisions = solid;
    mesh.isPickable = solid;
    return mesh;
  }
  private buildRuin(block: Block, index: number): void {
    const {x,z,width,depth,height}=block;
    const collider=this.box('city-solid-'+index,width,height,depth,x,height/2,z,this.stone,true);
    collider.isVisible=false;
    this.cityArt.build(block,index);
  }


  private buildShelter(): void {
    const { x, z, width, depth, height, doorWidth } = SHELTER_HALL;
    const floorParts=BASE_FLOOR_TILES.map((tile,index)=>this.box('base-floor-part-'+index,tile.width,.06,tile.depth,tile.x,0,tile.z,environmentMaterial(this.scene,'paving')));
    const floor=Mesh.MergeMeshes(floorParts,true,true)!;
    floor.name='base-floor';floor.checkCollisions=true;floor.isPickable=true;floor.receiveShadows=true;floor.metadata={buildGround:true};
    const boundary=this.material('shelter-build-boundary-material','#ffcf59','#ffcf59');boundary.disableLighting=true;
    for(const [index,edge]of BASE_BOUNDARY.entries()) {
      const line=this.box('shelter-build-boundary-'+index,Math.max(.26,Math.abs(edge.to.x-edge.from.x)),.012,Math.max(.26,Math.abs(edge.to.z-edge.from.z)),(edge.from.x+edge.to.x)/2,.047,(edge.from.z+edge.to.z)/2,boundary);
      line.isPickable=false;line.checkCollisions=false;line.receiveShadows=false;line.metadata={baseBoundary:true,unlitDetail:true,dynamicDetail:true};
    }
    for (const pad of GENERATOR_PADS) {
      const tile = this.box('generator-pad', 2.4, 0.035, 2.4, pad.x, 0.05, pad.z, surfaceMaterial(this.scene, 'slate'));
      tile.isPickable = true; tile.metadata = { buildGround: true, generatorPad: this.pads.length + 1 }; this.pads.push(tile);
      this.art.ring('conduit-anchor-seal',1.65,pad.x,.081,pad.z,.035,this.gold);
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
    this.art.roof('shelter-sanctuary',width+.4,depth+.4,x,height+.28,z,2.5,this.stone);
    const frontZ = z - depth / 2;
    // Opposite entrances share the same clear width, including navigation and raycasts.
    for (const face of [-1, 1]) {
      const entranceZ = z + face * depth / 2;
      this.box(`shelter-door-lintel-${face}`, doorWidth, 0.8, 0.5, x, height - 0.4, entranceZ, this.trim, true);
      for (const side of [-1, 1]) {
        this.box('open-door', 0.12, 2.9, 1.4, x + side * (doorWidth / 2 + 0.12), 1.5, entranceZ + face * .6, this.art.timber);
        this.box('door-brace', 0.14, 0.1, 1.2, x + side * (doorWidth / 2 + 0.14), 1.7, entranceZ + face * .6, this.dark);
        this.art.beam('sanctuary-entrance-arch',new Vector3(x+side*doorWidth/2,2.6,entranceZ+face*.26),new Vector3(x+side*.45,3.25,entranceZ+face*.26),.13,this.gold);
        this.art.box('sanctuary-doorpost',.15,2.6,.1,x+side*(doorWidth/2+.08),1.3,entranceZ+face*.22,this.art.timber);
      }
    }
    for(const side of [-1,1]) {
      this.art.box('sanctuary-oak-eave',.18,.2,depth+.65,x+side*(width/2+.15),height-.07,z,this.art.timber);
      this.art.box('sanctuary-corner-beam',.2,height,.2,x+side*(width/2-.12),height/2,z+depth/2-.1,this.art.timber);
      this.art.box('sanctuary-front-beam',.2,height,.22,x+side*(width/2-.12),height/2,frontZ-.02,this.art.timber);
      this.art.runeGlyph('sanctuary-banner-crest',x+side*2.7,2.65,frontZ-.37,.75,this.gold);
    }
    this.box('shelter-side-bench', 0.5, 0.7, 2.6, x - width / 2 + 0.65, 0.4, z + .3, environmentMaterial(this.scene, 'wood'));
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

  }
  

  

  private highRiskLandmarks(): void {
    const arena=RISK_AREAS.finalArena;
    for(const area of [RISK_AREAS.ancientForge,RISK_AREAS.graveyard,RISK_AREAS.centralSquare,arena]){
      if(typeof document==='undefined')continue;
      const signZ=area===arena?FINAL_ARENA.bounds.minZ-1.4:area.z-area.depth/2+2;
      const texture=new DynamicTexture('district-sign-'+area.name,{width:1024,height:128},this.scene,false);
      texture.drawText(area.name.toUpperCase(),null,82,'bold 38px Georgia, serif','#d9c097','#352b20',true);
      const material=this.material('district-sign-'+area.name,'#ffffff');material.diffuseTexture=texture;
      const sign=CreateBox('district-sign',{width:6,height:.75,depth:.03},this.scene);sign.position.set(area.x,3.5,signZ);sign.material=material;sign.isPickable=false;
      this.art.box('district-oak-sign-frame',6.2,.09,.08,area.x,3.9,signZ,this.art.timber);
      for(const side of [-1,1]) this.art.box('district-sign-chain',.035,.8,.035,area.x+side*2.6,4.25,signZ,this.art.iron);
      this.art.box('district-sign-crossbeam',6.4,.14,.14,area.x,4.7,signZ,this.art.timber);
    }
  }

  private mergeStaticDetails(): void {
    // Merge only decorative geometry. Collision/raycast meshes remain independent.
    const groups = new Map<ArtMaterial, Mesh[]>();
    for (const mesh of this.scene.meshes) {
      if (!(mesh instanceof Mesh) || !mesh.isVisible || mesh.metadata?.dynamicDetail || mesh.isPickable || mesh.checkCollisions ||
        mesh.instances.length > 0 || mesh === this.shelterCrystal || !(mesh.material instanceof StandardMaterial || mesh.material instanceof PBRMaterial)) continue;
      const group = groups.get(mesh.material) ?? [];
      group.push(mesh);
      groups.set(mesh.material, group);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const merged = Mesh.MergeMeshes(meshes, true, true);
      if (merged) { merged.name = `city-details-${material.name}`; merged.isPickable = false; merged.receiveShadows = true; }
    }
  }

  update(time: number, shelterHpRatio: number, shelterLevel = 1, buildings: readonly Building[] = [], campfireEnabled = false): void {
    this.reinforcements.forEach((mesh, index) => mesh.setEnabled(shelterLevel >= (index % 2 === 0 ? 2 : 3)));
    this.pads.forEach((mesh, index) => { mesh.material = buildings.some(building => building.kind === 'arcane-core' && Math.hypot(building.position.x - GENERATOR_PADS[index].x, building.position.z - GENERATOR_PADS[index].z) < 0.1) ? this.occupiedPad : surfaceMaterial(this.scene, 'slate'); });
    this.coreGlow.emissiveColor.set(.14 + .2 * shelterHpRatio, .18 + .4 * shelterHpRatio, .16 + .3 * shelterHpRatio);
    this.wardMotes.forEach((mote,i)=>{const angle=time*.18+i*Math.PI/4;mote.position.set(SHELTER_CORE.x+Math.cos(angle)*1.14,.45+((time*.23+i*.37)%2.55),SHELTER_CORE.z+Math.sin(angle)*1.14);});
    this.campfire.setEnabled(campfireEnabled);this.campfire.scaling.y=1.3+Math.sin(time*8)*.2;
    this.shelterCrystal.rotation.y = time * 0.4;
    this.shelterCrystal.position.y = 8.2 + Math.sin(time * 1.8) * 0.08;
    this.crystalMaterial.emissiveColor.set(0.3 + 0.2 * shelterHpRatio, 0.4 + 0.3 * shelterHpRatio, 0.4);
  }
}
