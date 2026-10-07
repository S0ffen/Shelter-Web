import { Color3, CreateBox, CreateSphere, StandardMaterial, Vector3 } from './babylon';
import type { Mesh, Scene } from './babylon';
import type { Position } from '../domain/types';

export type ImpactKind = 'wood' | 'iron' | 'flesh' | 'magic';
interface Fragment { mesh: Mesh; velocity: Vector3; age: number; duration: number; }
export class ImpactEffects {
  private readonly fragments: Fragment[] = [];
  private readonly materials: Record<ImpactKind, StandardMaterial>;
  constructor(private readonly scene: Scene) {
    this.materials = Object.fromEntries(Object.entries({ wood: '#c39761', iron: '#f9c465', flesh: '#9d4238', magic: '#8cf5d0' }).map(([kind, color]) => {
      const mat = new StandardMaterial('impact-' + kind, scene); mat.diffuseColor = Color3.FromHexString(color); mat.specularColor = Color3.Black();
      if (kind === 'magic' || kind === 'iron') mat.emissiveColor = mat.diffuseColor.scale(.65);
      return [kind, mat];
    })) as Record<ImpactKind, StandardMaterial>;
  }
  burst(position: Position, kind: ImpactKind, strong = false, height = .8): void {
    const count = strong ? 18 : 8;
    for (let i = 0; i < count; i++) {
      if (this.fragments.length >= 140) this.fragments.shift()!.mesh.dispose();
      const mesh = kind === 'magic' ? CreateSphere('impact-fragment', { diameter: .09, segments: 3 }, this.scene) : CreateBox('impact-fragment', { width: .07, height: kind === 'wood' ? .2 : .07, depth: .05 }, this.scene);
      mesh.material = this.materials[kind]; mesh.isPickable = false; mesh.checkCollisions = false;
      mesh.position.set(position.x, height, position.z);
      const angle = Math.random() * Math.PI * 2, speed = strong ? 3 : 1.6;
      this.fragments.push({ mesh, velocity: new Vector3(Math.cos(angle) * speed, 1 + Math.random() * 2.2, Math.sin(angle) * speed), age: 0, duration: strong ? .8 : .5 });
    }
  }
  update(dt: number): void {
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const particle = this.fragments[i]; particle.age += dt;
      if (particle.age >= particle.duration) { particle.mesh.dispose(); this.fragments.splice(i, 1); continue; }
      particle.velocity.y -= dt * 8; particle.mesh.position.addInPlace(particle.velocity.scale(dt)); particle.mesh.rotation.x += dt * 8;
      particle.mesh.scaling.setAll(Math.max(.1, 1 - particle.age / particle.duration));
    }
  }
  reset(): void { for (const p of this.fragments) p.mesh.dispose(); this.fragments.length = 0; }
  dispose(): void { this.reset(); Object.values(this.materials).forEach(mat => mat.dispose()); }
}
