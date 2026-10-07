import { Color3, Mesh, CreateCylinder, CreateBox, Scene, StandardMaterial, TransformNode } from '../rendering/babylon';
import type { Zombie } from './Zombie';
import type { Player } from '../player/Player';
import type { ZombieKind } from './ZombieTypes';

export class ZombieView {
  private readonly root: TransformNode;
  private readonly limbs: Mesh[] = [];
  private readonly bodyMaterial: StandardMaterial;
  private hitTime = 0;
  private deathTime = 0;
  private telegraph: Mesh | null = null;

  constructor(scene: Scene, readonly id = 'zombie-01', readonly kind: ZombieKind = 'normal') {
    this.root = new TransformNode(`${id}-rig`, scene);
    this.bodyMaterial = new StandardMaterial(`${id}-skin`, scene);
    const finalBoss = kind === 'overlord';
    const guardian = ['guardian', 'warden', 'ravager'].includes(kind) || finalBoss;
    this.bodyMaterial.diffuseColor = Color3.FromHexString(kind === 'fast' ? '#947767' : kind === 'tank' ? '#696e68' : '#73846c');
    this.root.scaling.set(kind === 'tank' ? 1.45 : kind === 'fast' ? 0.78 : 1, kind === 'tank' ? 1.2 : kind === 'fast' ? 0.94 : 1, kind === 'tank' ? 1.35 : 1);
    if (guardian) { this.root.scaling.set(finalBoss ? 3 : 2.1, finalBoss ? 2.6 : 1.85, finalBoss ? 2.5 : 1.9); this.bodyMaterial.diffuseColor = Color3.FromHexString('#706155'); }
    this.bodyMaterial.specularColor = Color3.Black();
    const cloth = new StandardMaterial(`${id}-rags`, scene);
    cloth.diffuseColor = Color3.FromHexString(kind === 'fast' ? '#692e27' : kind === 'tank' ? '#353f48' : '#483e3b');
    const eyes = new StandardMaterial(`${id}-eyes`, scene);
    eyes.emissiveColor = Color3.FromHexString(kind === 'fast' ? '#ff4e2d' : kind === 'tank' ? '#bfe99d' : '#ed994e');
    const part = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial): Mesh => {
      const mesh = CreateBox(`${id}-${name}`, { width: w, height: h, depth: d }, scene);
      mesh.position.set(x, y, z);
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.metadata = { zombieId: id, zombieKind: kind };
      mesh.receiveShadows = true;
      return mesh;
    };
    part('zombie-torso', 0.62, 0.75, 0.34, 0, 1.13, 0, cloth);
    part('zombie-head', 0.35, 0.4, 0.35, 0, 1.72, 0.04, this.bodyMaterial);
    if (kind === 'tank') {
      part('tank-chest-plate', 0.7, 0.62, 0.08, 0, 1.2, 0.21, cloth);
      for (const side of [-1, 1]) part('tank-shoulder', 0.28, 0.24, 0.42, side * 0.42, 1.48, 0, cloth);
    }
    if (kind === 'fast') for (const side of [-1, 1])
      part('runner-rib', 0.08, 0.56, 0.06, side * 0.18, 1.13, 0.2, this.bodyMaterial);
    if (guardian) {
      cloth.diffuseColor = Color3.FromHexString('#3f4549'); cloth.specularColor = new Color3(.5,.4,.3); eyes.emissiveColor = Color3.FromHexString('#ff8a36');
      if (finalBoss) {
        eyes.emissiveColor = Color3.FromHexString('#c57bff'); this.bodyMaterial.diffuseColor = Color3.FromHexString('#57515e');
        for (const x of [-.3, 0, .3]) part('overlord-crown', .12, .48, .16, x, 2.09, 0, cloth);
        for (const side of [-1,1]) { const horn = part('overlord-horn', .16, .6, .16, side * .38, 1.98, -.03, cloth); horn.rotation.z = side * -.5; }
        part('overlord-mantle', .95, 1.6, .14, 0, 1, -.3, cloth);
        for (const side of [-1,1]) part('overlord-runic-chest', .05, .5, .06, side * .2, 1.18, .31, eyes);
      }
      part('guardian-armored-chest', .8, .72, .1, 0, 1.17, .24, cloth);
      for (const side of [-1,1]) { part('guardian-pauldron', .4, .35, .48, side * .44, 1.47, 0, cloth); part('guardian-bracer', .23, .35, .25, side * .42, .9, .2, cloth); }
      part('guardian-hammer-handle', .09, 1.3, .1, .62, .67, .36, cloth); part('guardian-hammer-head', .72, .35, .35, .62, .2, .36, cloth);
      if (kind === 'guardian' || kind === 'warden') {
      const telegraphMat = new StandardMaterial(id + '-telegraph', scene); telegraphMat.emissiveColor = Color3.FromHexString('#d66b3e'); telegraphMat.alpha = .3;
      this.telegraph = CreateCylinder(id + '-telegraph', { diameter: finalBoss ? 7.6 : 6, height: .025, tessellation: 40 }, scene); this.telegraph.material = telegraphMat; this.telegraph.isPickable = false; this.telegraph.setEnabled(false);
      }
    }
    if (kind === 'ravager') { this.root.scaling.set(2.4, 2.1, 2); this.bodyMaterial.diffuseColor = Color3.FromHexString('#9f3b30'); cloth.diffuseColor = Color3.FromHexString('#422322'); eyes.emissiveColor = Color3.FromHexString('#ff2929'); }
    part('zombie-jaw', 0.27, 0.11, 0.15, 0, 1.53, 0.17, this.bodyMaterial);
    for (const side of [-1, 1]) {
      const leg = part('zombie-leg', 0.22, 0.7, 0.27, side * 0.18, 0.38, 0, cloth);
      const arm = part('zombie-arm', 0.18, 0.75, 0.2, side * 0.42, 1.05, 0.19, this.bodyMaterial);
      this.limbs.push(leg, arm);
      part('zombie-eye', 0.06, 0.045, 0.03, side * 0.095, 1.77, 0.226, eyes);
    }
  }

  hit(): void { this.hitTime = 0.2; }
  reset(): void { this.deathTime = this.hitTime = 0; this.root.setEnabled(true); }
  dispose(): void { this.root.dispose(false, true); this.telegraph?.dispose(false, true); }

  update(zombie: Zombie, player: Player, alpha: number, dt: number, time: number): void {
    this.telegraph?.setEnabled(zombie.alive && zombie.windup > 0);
    if (this.telegraph && zombie.windupTarget) this.telegraph.position.set(zombie.windupTarget.x, .055, zombie.windupTarget.z);
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.bodyMaterial.emissiveColor.set(this.hitTime * 2 + (zombie.windup > 0 ? .3 : 0), this.hitTime * 0.5, 0);
    const x = zombie.previousPosition.x + (zombie.position.x - zombie.previousPosition.x) * alpha;
    const z = zombie.previousPosition.z + (zombie.position.z - zombie.previousPosition.z) * alpha;
    this.root.position.set(x, 0, z);
    if (!zombie.alive) {
      for (const mesh of this.root.getChildMeshes()) mesh.isPickable = false;
      this.deathTime += dt;
      this.root.rotation.z = Math.min(Math.PI / 2, this.deathTime * 4);
      this.root.position.y = -Math.min(0.35, this.deathTime * 0.3);
      if (this.deathTime > 2) this.root.setEnabled(false);
      return;
    }
    this.root.rotation.z = 0;
    this.root.rotation.x = zombie.kind === 'fast' ? 0.12 : 0;
    const target = zombie.intent === 'player' ? player.position : zombie.intent === 'patrol' ? zombie.patrolTarget : zombie.route[zombie.routeIndex] ?? zombie.position;
    this.root.rotation.y = Math.atan2(target.x - x, target.z - z);
    const walking = Math.hypot(zombie.position.x - zombie.previousPosition.x, zombie.position.z - zombie.previousPosition.z) > 0.001;
    this.limbs.forEach((limb, i) => {
      limb.rotation.x = i % 2 === 0 ? (walking ? Math.sin(time * (zombie.kind === 'fast' ? 12 : zombie.kind === 'tank' ? 4 : 6) + i * Math.PI / 2) * 0.24 : 0) : -0.9 + Math.sin(time * 4) * 0.1;
    });
  }
}
