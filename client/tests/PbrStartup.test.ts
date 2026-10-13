import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '../src/rendering/babylon';
import { environmentMaterial, environmentMaterialInstance } from '../src/rendering/EnvironmentMaterials';

// NullEngine normally disables float render targets and skips the BRDF decoding
// that blocked every PBR surface in a real WebGL browser.
it.each(['half-float', 'float'] as const)('finishes PBR BRDF decoding with %s render targets', async format => {
  const engine = new NullEngine();
  Object.assign(engine.getCaps(), {
    textureHalfFloatRender: format === 'half-float', textureHalfFloatLinearFiltering: true,
    textureFloatRender: true, textureFloatLinearFiltering: true,
  });
  try {
    const compile = vi.spyOn(engine, 'createShaderProgram');
    const scene = new Scene(engine), stone = environmentMaterial(scene, 'stone');
    const brdf = stone.environmentBRDFTexture!;
    expect(brdf.isReady()).toBe(false);
    await vi.waitFor(() => expect(brdf.isReady()).toBe(true));
    const decode = compile.mock.calls.find(call => call[2].includes('fromRGBD'));
    expect(decode, 'BRDF decoder must use registered GLSL').toBeDefined();
    expect(decode![1]).toContain('gl_Position');
    expect(decode![2]).not.toMatch(/<!doctype|<html/i);
    expect(brdf.getInternalTexture()!.type).toBe(format === 'half-float' ? 2 : 1);
    for (const kind of ['stone', 'paving', 'wood', 'slate'] as const) {
      const variant = environmentMaterialInstance(scene, kind, `startup-${kind}`);
      expect(variant.environmentBRDFTexture).toBe(brdf);
      expect(variant.environmentBRDFTexture!.isReady()).toBe(true);
    }
  } finally { engine.dispose(); }
});
