import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '../src/rendering/babylon';
import { ImpactEffects } from '../src/rendering/ImpactEffects';
import { ProjectileView } from '../src/building/ProjectileView';

it('bounds transient debris, keeps it out of targeting and collision and disposes it when its lifetime ends', () => {
  const engine = new NullEngine(), scene = new Scene(engine), effects = new ImpactEffects(scene);
  for (let i = 0; i < 30; i++) effects.burst({ x: 0, z: 0 }, 'iron', true);
  const particles = scene.meshes.filter(mesh => mesh.name === 'impact-fragment');
  expect(particles).toHaveLength(140); expect(particles.every(mesh => !mesh.isPickable && !mesh.checkCollisions)).toBe(true);
  effects.update(1); expect(scene.meshes).toHaveLength(0); effects.dispose(); engine.dispose();
});
it('adds a magic trail and removes the whole projectile without replaying its launch sound every frame', () => {
  const engine = new NullEngine(), scene = new Scene(engine); let launches = 0;
  const view = new ProjectileView(scene, () => launches++);
  const shots = [{ id: 1, sourceId: 't', targetId: 'z', position: { x: 0, y: 2, z: 0 }, lifetime: 3 }];
  view.update(shots); shots[0].position.z = 1; view.update(shots);
  expect(launches).toBe(1); expect(scene.meshes.filter(mesh => mesh.name.startsWith('magic-trail'))).toHaveLength(4);
  expect(scene.meshes.every(mesh => !mesh.isPickable)).toBe(true);
  view.update([]); expect(scene.meshes).toHaveLength(0); engine.dispose();
});
