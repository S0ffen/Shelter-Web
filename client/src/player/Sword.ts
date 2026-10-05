import { Color3, CreateBox, CreateCylinder, Scene, StandardMaterial, TransformNode, Vector3 } from '../rendering/babylon';
import type { UniversalCamera } from '../rendering/babylon';

export class Sword {
  private readonly root: TransformNode;
  private swingTime = 1;

  constructor(scene: Scene, camera: UniversalCamera) {
    this.root = new TransformNode('sword-rig', scene);
    this.root.parent = camera;
    const steel = new StandardMaterial('sword-steel', scene);
    steel.diffuseColor = Color3.FromHexString('#a2b3b1');
    steel.specularColor = new Color3(0.65, 0.7, 0.7);
    const bronze = new StandardMaterial('sword-bronze', scene);
    bronze.diffuseColor = Color3.FromHexString('#9d8254');
    const leather = new StandardMaterial('sword-leather', scene);
    leather.diffuseColor = Color3.FromHexString('#342c28');
    const parts = [
      { name: 'blade', w: 0.08, h: 1.03, d: 0.023, y: 0.43, mat: steel },
      { name: 'blade-ridge', w: 0.023, h: 0.98, d: 0.03, y: 0.43, mat: steel },
      { name: 'crossguard', w: 0.34, h: 0.055, d: 0.075, y: -0.13, mat: bronze },
      { name: 'grip', w: 0.06, h: 0.24, d: 0.065, y: -0.275, mat: leather },
      { name: 'pommel', w: 0.095, h: 0.08, d: 0.085, y: -0.425, mat: bronze },
    ];
    for (const part of parts) {
      const mesh = CreateBox(part.name, { width: part.w, height: part.h, depth: part.d }, scene);
      mesh.parent = this.root;
      mesh.position.y = part.y;
      mesh.material = part.mat;
      mesh.isPickable = false;
      mesh.renderingGroupId = 1;
    }
    const tip = CreateCylinder('blade-tip', { diameterTop: 0, diameterBottom: 0.085, height: 0.15, tessellation: 4 }, scene);
    tip.parent = this.root;
    tip.position.y = 1.02;
    tip.scaling.z = 0.35;
    tip.material = steel;
    tip.isPickable = false;
    tip.renderingGroupId = 1;
    this.update(0, 0, false);
  }

  swing(): void { this.swingTime = 0; }
  reset(): void { this.swingTime = 1; }
  setVisible(visible: boolean): void { this.root.setEnabled(visible); }

  update(dt: number, time: number, moving: boolean): void {
    this.swingTime += dt;
    const t = Math.min(1, this.swingTime / 0.42);
    const arc = Math.sin(t * Math.PI);
    const bob = moving ? Math.sin(time * 10) * 0.018 : Math.sin(time * 1.8) * 0.005;
    this.root.position = new Vector3(0.37 - arc * 0.4, -0.42 + arc * 0.08 + bob, 0.7);
    this.root.rotation.set(-0.16 + arc * 0.7, -0.15 + arc * 0.4, -0.22 + arc * 1.7);
  }
}
