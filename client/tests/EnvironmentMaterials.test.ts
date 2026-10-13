import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { PBRMaterial, Scene } from '../src/rendering/babylon';
import { environmentMaterial, environmentMaterialInstance } from '../src/rendering/EnvironmentMaterials';
import { FantasyArt } from '../src/rendering/FantasyArt';
import { World } from '../src/world/World';
import type { Mesh } from '../src/rendering/babylon';

it('shares exactly twelve uploaded city maps across many independently tinted variants', () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine);
    for (const kind of ['stone', 'paving', 'wood', 'slate'] as const) {
      const source = environmentMaterial(scene, kind);
      expect(source.albedoTexture!.gammaSpace).toBe(true);
      expect(source.bumpTexture!.gammaSpace).toBe(false);
      expect(source.metallicTexture!.gammaSpace).toBe(false);
      const dispose = vi.spyOn(source.albedoTexture!, 'dispose');
      for (let i = 0; i < 20; i++) {
        const variant = environmentMaterialInstance(scene, kind, `variant-${kind}-${i}`);
        expect(variant.getActiveTextures()).toEqual(source.getActiveTextures());
        variant.albedoColor.set(.3, .4, .5);
        expect(source.albedoColor.r).toBe(1);
        variant.dispose(false, false);
      }
      expect(dispose).not.toHaveBeenCalled();
    }
    // Babylon also allocates its shared BRDF lookup texture.
    expect(scene.textures.filter(texture => texture.name.startsWith('/textures/environment/'))).toHaveLength(12);
  } finally { engine.dispose(); }
});

it('keeps the city batched and applies cobblestone to both streets and Shelter with continuous world UVs', () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine); new World(scene);
    const floor = scene.getMeshByName('reference-city-floor')!;
    const base = scene.getMeshByName('base-floor')!;
    expect(floor.material).toBe(environmentMaterial(scene, 'paving'));
    expect(base.material).toBe(floor.material);
    const positions = floor.getVerticesData('position')!, normals = floor.getVerticesData('normal')!, uvs = floor.getVerticesData('uv')!;
    for (let point = 0; point < positions.length / 3; point++) {
      if (normals[point * 3 + 1] < .5) continue;
      expect(uvs[point * 2]).toBeCloseTo(positions[point * 3] / 2, 4);
      expect(uvs[point * 2 + 1]).toBeCloseTo(positions[point * 3 + 2] / 2, 4);
    }
    for (const name of ['environment-stone', 'old-oak', 'lime-plaster', 'environment-slate']) {
      const merged = scene.getMeshByName(`city-details-${name}`)!;
      expect(merged).not.toBeNull(); expect(merged.material).toBeInstanceOf(PBRMaterial);
      expect(merged.isPickable).toBe(false); expect(merged.receiveShadows).toBe(true);
    }
    expect(scene.textures.filter(texture => texture.name.startsWith('/textures/environment/'))).toHaveLength(12);
  } finally { engine.dispose(); }
});

it('runs slate rows along the ridge and the overlap down both roof slopes', () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), art = new FantasyArt(scene);
    art.roof('test-roof', 8, 6, 0, 5, 2, 2);
    const roofs = scene.meshes.filter(mesh => mesh.name === 'test-roof-slates') as Mesh[];
    expect(roofs).toHaveLength(2);
    for (const roof of roofs) {
      const positions = roof.getVerticesData('position')!, normals = roof.getVerticesData('normal')!, uvs = roof.getVerticesData('uv')!;
      const side = Math.sign(roof.position.x);
      const top = Array.from({ length: positions.length / 3 }, (_, i) => i).filter(i => normals[i * 3 + 1] > .5);
      const high = top.reduce((a, b) => -side * positions[a * 3] > -side * positions[b * 3] ? a : b);
      const low = top.reduce((a, b) => -side * positions[a * 3] < -side * positions[b * 3] ? a : b);
      expect(uvs[high * 2 + 1]).toBeGreaterThan(uvs[low * 2 + 1]);
      for (const point of top) expect(uvs[point * 2]).toBeCloseTo((positions[point * 3 + 2] + roof.position.z) / 2);
    }
  } finally { engine.dispose(); }
});
