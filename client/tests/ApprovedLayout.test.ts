import { expect, it } from 'vitest';
import approved from './fixtures/approved-layout-v14.json';
import enemyStats from './fixtures/approved-enemy-stats-v14.json';
import zombies from '../../shared/zombies.json';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '../src/rendering/babylon';
import { World } from '../src/world/World';

it('preserves the approved city and Shelter except the explicitly marked western boundary, enlarged base and central barricades', () => {
  const engine = new NullEngine();
  try {
    const scene = new Scene(engine);
    new World(scene);
    const layout = scene.meshes.filter(mesh => mesh.checkCollisions).map(mesh => {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      return { name: mesh.name, min: bounds.minimumWorld.asArray(), max: bounds.maximumWorld.asArray(), pickable: mesh.isPickable, metadata: mesh.metadata };
    });
    const unchanged = (mesh: {name:string}) => !/^(shelter-wall-|shelter-door-lintel|resource-deposit-cabinet$|reference-boundary-(?:60(?:-court-\d+)?|(?:85|86|88|89|91|92|93|95)(?:-base-\d+)?)$|base-floor$|city-barricade-)/.test(mesh.name);
    expect(JSON.parse(JSON.stringify(layout.filter(unchanged)))).toEqual(approved.filter(unchanged));
    expect(layout.filter(unchanged)).toHaveLength(297);
    expect(layout.filter(mesh=>mesh.name.startsWith('shelter-door-lintel'))).toHaveLength(2);
    expect(layout.filter(mesh=>mesh.name.startsWith('reference-boundary-60-court-'))).toHaveLength(3);
    expect(layout.filter(mesh=>mesh.name.startsWith('city-barricade-'))).toHaveLength(2);
  } finally { engine.dispose(); }
});

it('changes enemy names without changing any archetype or combat stat', () => {
  const stats = { ...zombies, types: Object.fromEntries(Object.entries(zombies.types).map(([key, value]) => {
    const { label: _label, ...gameplay } = value;
    return [key, gameplay];
  })) };
  expect(stats).toEqual(enemyStats);
});
