import { CreateBox, Mesh, Scene } from '../rendering/babylon';
import { surfaceMaterial, tileBox } from '../rendering/SurfaceMaterials';
import { environmentMaterial } from '../rendering/EnvironmentMaterials';
import { ARENA_WALLS, FINAL_ARENA } from './ArenaLayout';

/** The pit exists from the start of the run; entering never creates a barrier. */
export class ArenaView {
  private readonly masonry: Mesh[] = [];
  constructor(scene: Scene) {
    const stone = environmentMaterial(scene, 'stone'), floorMaterial = surfaceMaterial(scene, 'earth');
    const b = FINAL_ARENA.bounds, depth = FINAL_ARENA.surfaceY - FINAL_ARENA.floorY;
    const floor = CreateBox('final-arena-pit-floor', { width: b.maxX - b.minX, height: .16, depth: b.maxZ - b.minZ }, scene);
    floor.position.set((b.minX + b.maxX) / 2, FINAL_ARENA.floorY - .08, (b.minZ + b.maxZ) / 2);
    floor.material = floorMaterial; floor.checkCollisions = true; floor.isPickable = true;
    floor.receiveShadows = true; floor.metadata = { arenaPit: true, terrain: true };
    tileBox(floor, b.maxX - b.minX, .16, b.maxZ - b.minZ); this.masonry.push(floor);
    for (const [index, wall] of ARENA_WALLS.entries()) {
      const mesh = CreateBox('final-arena-pit-wall-' + index, { width: wall.width, height: depth, depth: wall.depth }, scene);
      mesh.position.set(wall.x, FINAL_ARENA.floorY + depth / 2, wall.z); mesh.material = stone;
      mesh.checkCollisions = true; mesh.isPickable = true; mesh.receiveShadows = true;
      mesh.metadata = { arenaPit: true, retainingWall: true }; tileBox(mesh, wall.width, depth, wall.depth);
      this.masonry.push(mesh);
      const coping = CreateBox('final-arena-stone-rim-' + index, { width: wall.width + .1, height: .08, depth: wall.depth + .1 }, scene);
      coping.position.set(wall.x, FINAL_ARENA.surfaceY + .02, wall.z); coping.material = stone;
      coping.isPickable = false; coping.receiveShadows = true; tileBox(coping, wall.width + .1, .08, wall.depth + .1);
      this.masonry.push(coping);
    }
  }
  update(_active: boolean): void { /* The physical pit never disappears or seals itself. */ }
  dispose(): void { for (const mesh of this.masonry) mesh.dispose(); }
}
