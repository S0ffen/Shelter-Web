import { arenaEnemyHeight } from '../world/ArenaLayout';
import { Color3, Mesh, CreateCylinder, CreateSphere, CreateBox, Scene, StandardMaterial, TransformNode } from '../rendering/babylon';
import { surfaceMaterialInstance, tileBox } from '../rendering/SurfaceMaterials';
import type { Zombie } from './Zombie';
import type { Player } from '../player/Player';
import type { ZombieKind } from './ZombieTypes';

export class ZombieView {
  private readonly root: TransformNode;
  private readonly limbs: Mesh[] = [];
  private readonly bodyMaterial: StandardMaterial;
  private hitTime = 0;
  private deathTime = 0;
  private readonly materials: StandardMaterial[] = [];
  private readonly weapon: Mesh[] = [];
  private previousWindup = 0;
  private strikeTime = 0;

  constructor(scene: Scene, readonly id = 'zombie-01', readonly kind: ZombieKind = 'normal') {
    this.root = new TransformNode(`${id}-rig`, scene);
    this.bodyMaterial = surfaceMaterialInstance(scene, 'skin', `${id}-skin`);
    const finalBoss = kind === 'overlord';
    const guardian = ['guardian', 'warden', 'ravager'].includes(kind) || finalBoss;
    this.bodyMaterial.diffuseColor = Color3.FromHexString(kind === 'fast' ? '#cbab91' : kind === 'tank' ? '#a1aa8c' : '#bdc4a3');
    this.root.scaling.set(kind === 'tank' ? 1.45 : kind === 'fast' ? 0.78 : 1, kind === 'tank' ? 1.2 : kind === 'fast' ? 0.94 : 1, kind === 'tank' ? 1.35 : 1);
    if (guardian) { this.root.scaling.set(finalBoss ? 3 : 2.1, finalBoss ? 2.6 : 1.85, finalBoss ? 2.5 : 1.9); this.bodyMaterial.diffuseColor = Color3.FromHexString('#bbb1a2'); }
    this.bodyMaterial.specularColor = Color3.Black();
    const cloth = surfaceMaterialInstance(scene, 'cloth', `${id}-rags`);
    cloth.diffuseColor = Color3.FromHexString(kind === 'fast' ? '#8c807e' : kind === 'tank' ? '#83898b' : '#a8a49a');
    const armor = surfaceMaterialInstance(scene, 'armor', `${id}-armor`);
    const bone = surfaceMaterialInstance(scene, 'bone', `${id}-bone`);
    this.materials.push(this.bodyMaterial, cloth, armor, bone);
    const eyes = new StandardMaterial(`${id}-eyes`, scene);
    eyes.emissiveColor = Color3.FromHexString(kind === 'fast' ? '#ff4e2d' : kind === 'tank' ? '#bfe99d' : '#ed994e');
    const part = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial): Mesh => {
      const rounded = name === 'zombie-head' || name === 'zombie-hand';
      const limb = name === 'zombie-arm' || name === 'zombie-leg' || name === 'zombie-torso';
      const mesh = rounded ? CreateSphere(`${id}-${name}`, { diameter: 1, segments: 12 }, scene) :
        limb ? CreateCylinder(`${id}-${name}`, { diameterTop: .82, diameterBottom: 1, height: 1, tessellation: 10 }, scene) :
        CreateBox(`${id}-${name}`, { width: w, height: h, depth: d }, scene);
      if (rounded || limb) mesh.scaling.set(w, h, d);
      else if (mat.diffuseTexture) tileBox(mesh, w, h, d, .6);
      mesh.position.set(x, y, z);
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.metadata = { zombieId: id, zombieKind: kind };
      mesh.receiveShadows = true;
      return mesh;
    };
    const adornment:typeof part=(...args)=>{const mesh=part(...args);mesh.isPickable=false;return mesh;};
    part('zombie-torso', 0.62, 0.75, 0.34, 0, 1.13, 0, cloth);
    part('zombie-head', 0.35, 0.4, 0.35, 0, 1.72, 0.04, this.bodyMaterial);
    if (kind === 'tank') {
      part('tank-chest-plate', 0.7, 0.62, 0.08, 0, 1.2, 0.21, armor);
      for (const side of [-1, 1]) part('tank-shoulder', 0.28, 0.24, 0.42, side * 0.42, 1.48, 0, armor);
    }
    if (kind === 'fast') for (const side of [-1, 1])
      part('runner-rib', 0.08, 0.56, 0.06, side * 0.18, 1.13, 0.2, bone);
    if (guardian) {
      cloth.diffuseColor = Color3.FromHexString('#978d85'); eyes.emissiveColor = Color3.FromHexString('#ff8a36');
      if (finalBoss) {
        eyes.emissiveColor = Color3.FromHexString('#c57bff'); this.bodyMaterial.diffuseColor = Color3.FromHexString('#aa9eb8');
        for (const x of [-.3, 0, .3]) part('overlord-crown', .12, .48, .16, x, 2.09, 0, armor);
        for (const side of [-1,1]) { const horn = part('overlord-horn', .16, .6, .16, side * .38, 1.98, -.03, bone); horn.rotation.z = side * -.5; }
        part('overlord-mantle', .95, 1.6, .14, 0, 1, -.3, cloth);
        for (const side of [-1,1]) part('overlord-runic-chest', .05, .5, .06, side * .2, 1.18, .31, eyes);
      }
      part('guardian-armored-chest', .8, .72, .1, 0, 1.17, .24, armor);
      for (const side of [-1,1]) { part('guardian-pauldron', .4, .35, .48, side * .44, 1.47, 0, armor); part('guardian-bracer', .23, .35, .25, side * .42, .9, .2, armor); }
      this.weapon.push(part('guardian-hammer-handle', .09, 1.3, .1, .62, .67, .36, armor), part('guardian-hammer-head', .72, .35, .35, .62, .2, .36, armor));
    }
    if (kind === 'ravager') { this.root.scaling.set(2.4, 2.1, 2); this.bodyMaterial.diffuseColor = Color3.FromHexString('#b8634a'); cloth.diffuseColor = Color3.FromHexString('#b19081'); eyes.emissiveColor = Color3.FromHexString('#ff2929'); }
    part('zombie-jaw', 0.27, 0.11, 0.15, 0, 1.53, 0.17, this.bodyMaterial);
    for (const side of [-1, 1]) {
      const leg = part('zombie-leg', 0.22, 0.7, 0.27, side * 0.18, 0.38, 0, cloth);
      const arm = part('zombie-arm', 0.18, 0.75, 0.2, side * 0.42, 1.05, 0.19, this.bodyMaterial);
      this.limbs.push(leg, arm);
      const hand = part('zombie-hand', .21, .2, .2, side * .42, .69, .19, this.bodyMaterial); hand.setParent(arm);
      part('zombie-eye-socket', .105, .08, .025, side * .095, 1.77, .207, armor);
      part('zombie-eye', 0.06, 0.045, 0.03, side * 0.095, 1.77, 0.226, eyes);
      part('zombie-brow', .15, .06, .06, side * .1, 1.83, .20, this.bodyMaterial);
      part('zombie-tooth', .045, .045, .035, side * .06, 1.56, .255, bone);
      const hem = part('torn-tunic-hem', .25, .3, .36, side * .16, .73, 0, cloth); hem.rotation.z = side * .1;
    }
    // Clothing, helmets and claws are cosmetic; the original body remains the hit target.
    const armored=kind==='tank'||guardian;
    adornment('worn-leather-belt',.67,.11,.38,0,.88,.01,armor);
    if(armored) {
      adornment('fallen-guard-helm-crown',.5,.18,.44,0,1.93,.035,armor);
      adornment('fallen-guard-nasal',.055,.38,.045,0,1.75,.263,armor);
      for(const side of [-1,1]) {
        adornment('fallen-guard-cheek',.095,.36,.34,side*.205,1.73,.035,armor);
        adornment('fallen-guard-greave',.24,.43,.1,side*.18,.42,.165,armor).setParent(this.limbs[side<0?0:2]);
        const gauntlet=adornment('fallen-guard-gauntlet',.23,.28,.24,side*.42,.73,.19,armor);gauntlet.setParent(this.limbs[side<0?1:3]);
      }
      adornment('fallen-guard-crest',.075,.25,.35,0,2.05,.035,armor);
      const shield=adornment('broken-heraldic-shield',.43,.69,.075,-.5,.9,.32,armor);shield.rotation.z=-.15;shield.setParent(this.limbs[1]);
      const heraldry=adornment('shield-faded-cross',.055,.45,.016,-.5,.93,.37,bone);heraldry.setParent(this.limbs[1]);
    } else if(kind==='normal') {
      adornment('hollow-cowl-top',.44,.19,.44,0,1.94,.01,cloth);
      for(const side of [-1,1])adornment('hollow-torn-hood',.065,.43,.38,side*.205,1.69,.01,cloth);
      adornment('hollow-cowl-back',.4,.45,.09,0,1.7,-.17,cloth);
      adornment('hollow-shoulder-shawl',.66,.15,.39,0,1.49,-.015,cloth);
      for(const side of [-1,1]) {
        const hem=adornment('hollow-ragged-robe',.21,.48,.34,side*.17,.65,-.02,cloth);hem.rotation.z=side*.16;
        const boot=adornment('hollow-worn-boot',.24,.18,.33,side*.18,.12,.02,armor);boot.setParent(this.limbs[side<0?0:2]);
      }
    } else if(kind==='fast') {
      adornment('feral-exposed-spine',.08,.64,.1,0,1.18,-.22,bone);
      for(const side of [-1,1]) {
        const shoulder=adornment('feral-bone-spur',.065,.35,.065,side*.33,1.63,-.04,bone);shoulder.rotation.z=side*.55;
        for(const finger of [-1,0,1]) {
          const claw=adornment('feral-long-claw',.028,.27,.035,side*.42+finger*.06,.52,.27,bone);claw.setParent(this.limbs[side<0?1:3]);
        }
      }
    }
    for (const mesh of this.weapon) mesh.setParent(this.limbs[3]);
    this.materials.push(eyes);
  }

  hit(): void { this.hitTime = 0.2; }
  reset(): void { this.deathTime = this.hitTime = 0; this.root.setEnabled(true); }
  dispose(): void { this.root.dispose(false, false); for (const material of this.materials) material.dispose(false, false); }

  update(zombie: Zombie, player: Player, alpha: number, dt: number, time: number): void {
    this.hitTime = Math.max(0, this.hitTime - dt);
    if (this.previousWindup > 0 && zombie.windup === 0) this.strikeTime = .2;
    this.previousWindup = zombie.windup;
    this.strikeTime = Math.max(0, this.strikeTime - dt);
    for (const material of this.materials.slice(0, 4)) material.emissiveColor.set(this.hitTime * 2, this.hitTime * .5, 0);
    const x = zombie.previousPosition.x + (zombie.position.x - zombie.previousPosition.x) * alpha;
    const z = zombie.previousPosition.z + (zombie.position.z - zombie.previousPosition.z) * alpha;
    const floorY = arenaEnemyHeight(zombie.id, zombie.kind);
    this.root.position.set(x, floorY, z);
    if (!zombie.alive) {
      for (const mesh of this.root.getChildMeshes()) mesh.isPickable = false;
      this.deathTime += dt;
      this.root.rotation.z = Math.min(Math.PI / 2, this.deathTime * 4);
      this.root.position.y = floorY - Math.min(0.35, this.deathTime * 0.3);
      if (this.deathTime > 2) this.root.setEnabled(false);
      return;
    }
    this.root.rotation.z = 0;
    this.root.rotation.x = zombie.kind === 'fast' ? 0.28 : 0;
    const target = zombie.intent === 'player' ? player.position : zombie.intent === 'patrol' ? zombie.patrolTarget : zombie.route[zombie.routeIndex] ?? zombie.position;
    this.root.rotation.y = Math.atan2(target.x - x, target.z - z);
    const walking = Math.hypot(zombie.position.x - zombie.previousPosition.x, zombie.position.z - zombie.previousPosition.z) > 0.001;
    this.limbs.forEach((limb, i) => {
      limb.rotation.x = i % 2 === 0 ? (walking ? Math.sin(time * (zombie.kind === 'fast' ? 12 : zombie.kind === 'tank' ? 4 : 6) + i * Math.PI / 2) * 0.24 : 0) :
        zombie.windup > 0 ? -1.2 - Math.min(1, zombie.windup) : this.strikeTime > 0 ? -.2 : -0.9 + Math.sin(time * 4) * 0.1;
    });
  }
}
