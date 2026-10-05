import { Color3, Mesh, CreateBox, Scene, StandardMaterial, TransformNode } from '../rendering/babylon';
import type { Zombie } from './Zombie';
import type { Player } from '../player/Player';

export class ZombieView {
  private readonly root: TransformNode;
  private readonly limbs: Mesh[] = [];
  private readonly bodyMaterial: StandardMaterial;
  private hitTime = 0;
  private deathTime = 0;

  constructor(scene: Scene, readonly id = 'zombie-01') {
    this.root = new TransformNode(`${id}-rig`, scene);
    this.bodyMaterial = new StandardMaterial(`${id}-skin`, scene);
    this.bodyMaterial.diffuseColor = Color3.FromHexString('#73846c');
    this.bodyMaterial.specularColor = Color3.Black();
    const cloth = new StandardMaterial(`${id}-rags`, scene);
    cloth.diffuseColor = Color3.FromHexString('#483e3b');
    const eyes = new StandardMaterial(`${id}-eyes`, scene);
    eyes.emissiveColor = Color3.FromHexString('#ed994e');
    const part = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial): Mesh => {
      const mesh = CreateBox(`${id}-${name}`, { width: w, height: h, depth: d }, scene);
      mesh.position.set(x, y, z);
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.metadata = { zombieId: id };
      return mesh;
    };
    part('zombie-torso', 0.62, 0.75, 0.34, 0, 1.13, 0, cloth);
    part('zombie-head', 0.35, 0.4, 0.35, 0, 1.72, 0.04, this.bodyMaterial);
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
  dispose(): void { this.root.dispose(false, true); }

  update(zombie: Zombie, player: Player, alpha: number, dt: number, time: number): void {
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.bodyMaterial.emissiveColor.set(this.hitTime * 2, this.hitTime * 0.5, 0);
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
    const target = zombie.intent === 'player' ? player.position : zombie.intent === 'patrol' ? zombie.patrolTarget : zombie.route[zombie.routeIndex] ?? zombie.position;
    this.root.rotation.y = Math.atan2(target.x - x, target.z - z);
    const walking = Math.hypot(zombie.position.x - zombie.previousPosition.x, zombie.position.z - zombie.previousPosition.z) > 0.001;
    this.limbs.forEach((limb, i) => {
      limb.rotation.x = i % 2 === 0 ? (walking ? Math.sin(time * 6 + i * Math.PI / 2) * 0.24 : 0) : -0.9 + Math.sin(time * 4) * 0.1;
    });
  }
}
