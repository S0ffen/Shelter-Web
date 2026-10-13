import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene, Vector3 } from '../src/rendering/babylon';
import { CityArt } from '../src/world/CityArt';
import { WORLD_BOUNDARIES, referenceFloorOpen } from '../src/world/WorldLayout';

it('renders the existing west and south walls where expanded base edges fall between raster cells', () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine), art = new CityArt(scene);
    for (const block of WORLD_BOUNDARIES) art.boundary(block);
    const walls = scene.meshes.filter(mesh => mesh.name === 'ancient-city-rampart');
    for (const wall of walls) wall.computeWorldMatrix(true);
    for (const point of [{x:-33.15,z:-10},{x:-33.15,z:-13.15},{x:-33.1,z:-15.62},{x:0,z:-12.5},{x:17.35,z:-10.35}]) {
      expect(walls.some(mesh => mesh.getBoundingInfo().boundingBox.intersectsPoint(new Vector3(point.x,2,point.z))), JSON.stringify(point)).toBe(true);
    }
    expect(referenceFloorOpen({x:-32.85,z:-10.35})).toBe(false);
    expect(walls.every(mesh => !mesh.checkCollisions && !mesh.isPickable)).toBe(true);
    for (const point of [{x:29,z:9},{x:1.5,z:23.75}]) {
      expect(walls.some(mesh => mesh.getBoundingInfo().boundingBox.intersectsPoint(new Vector3(point.x,2,point.z)))).toBe(false);
    }
  } finally { engine.dispose(); }
});
