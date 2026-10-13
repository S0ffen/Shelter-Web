import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene, VertexData } from '../src/rendering/babylon';
import { FantasyArt } from '../src/rendering/FantasyArt';

it('keeps both roof gables facing the street and all art outside collision and picking', () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), art = new FantasyArt(scene);
    art.roof('house',10,8,0,7,0,3);
    const gable = scene.getMeshByName('house-gable')!;
    const calculated: number[] = [];
    VertexData.ComputeNormals(gable.getVerticesData('position')!,gable.getIndices()!,calculated);
    expect(calculated).toEqual(gable.getVerticesData('normal'));
    for (const mesh of scene.meshes) {
      expect(mesh.checkCollisions).toBe(false);
      expect(mesh.isPickable).toBe(false);
    }
  } finally { engine.dispose(); }
});
