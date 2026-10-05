import { Color3, Mesh, CreateBox, CreateCylinder, CreateSphere, CreatePolyhedron, PointLight, Scene, StandardMaterial, Vector3 } from '../rendering/babylon';
import { CITY_RUINS, WORLD_BOUNDARIES, WORLD_BOUNDS, GATE_PILLARS, FOREST_TREES } from './WorldLayout';
import type { Block } from './WorldLayout';
import { BASE_BOUNDS, BASE_WALLS, SHELTER_WALLS, SHELTER_HALL, TOWER_PADS, inBase } from './ShelterLayout';

export class World {
  readonly shelterCrystal: Mesh;
  private readonly lights: PointLight[] = [];
  private readonly crystalMaterial: StandardMaterial;
  private readonly stone: StandardMaterial;
  private readonly trim: StandardMaterial;
  private readonly dark: StandardMaterial;
  private readonly roof: StandardMaterial;
  private readonly moss: StandardMaterial;
  private readonly gold: StandardMaterial;

  constructor(private readonly scene: Scene) {
    this.stone = this.material('old-limestone', '#555d58');
    this.trim = this.material('stone-edges', '#74786a');
    this.dark = this.material('recesses', '#1b2627');
    this.roof = this.material('weathered-roof', '#333e39');
    this.moss = this.material('moss', '#374c39');
    this.gold = this.material('aged-bronze', '#83714c');
    const ground = this.box('courtyard', WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, 0.2, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ, 0, -0.12, 3, this.material('wet-ground', '#363e3d'));
    ground.checkCollisions = true;
    ground.isPickable = true;
    ground.metadata = { buildGround: true };
    for (const [index, block] of CITY_RUINS.entries()) this.buildRuin(block, index);
    for (const [index, block] of WORLD_BOUNDARIES.entries()) {
      this.box(`boundary-${index}`, block.width, block.height, block.depth, block.x, block.height / 2, block.z, this.stone, true);
    }
    this.buildShelter();
    this.crystalMaterial = this.material('shelter-light', '#a5d9bf', '#7abf9c');
    this.shelterCrystal = CreatePolyhedron('ward-crystal', { type: 1, size: 0.4 }, scene);
    this.shelterCrystal.position.set(SHELTER_HALL.x, 8.2, SHELTER_HALL.z);
    this.shelterCrystal.scaling.y = 1.6;
    this.shelterCrystal.material = this.crystalMaterial;
    this.shelterCrystal.isPickable = false;
    const ward = new PointLight('ward-light', new Vector3(SHELTER_HALL.x, 4, SHELTER_HALL.z), scene);
    ward.diffuse = Color3.FromHexString('#a5d5b4');
    ward.intensity = 1.2;
    ward.range = 22;
    this.torch(-1.4, -12.8); this.torch(4.4, -12.8);
    this.torch(-3.3, 0); this.torch(6.3, 0);
    this.decorate();
    this.landmarks();
    this.mergeStaticDetails();
  }

  private material(name: string, color: string, emissive?: string): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = new Color3(0.04, 0.05, 0.04);
    if (emissive) material.emissiveColor = Color3.FromHexString(emissive);
    return material;
  }

  private box(name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: StandardMaterial, solid = false): Mesh {
    const mesh = CreateBox(name, { width, height, depth }, this.scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.checkCollisions = solid;
    mesh.isPickable = solid;
    return mesh;
  }

  private buildRuin(block: Block, index: number): void {
    const { x, z, width: w, depth: d, height: h } = block;
    this.box(`ruin-${index}`, w, h, d, x, h / 2, z, this.stone, true);
    this.box(`ruin-${index}-foundation`, w + 0.15, 0.35, d + 0.15, x, 0.2, z, this.dark);
    this.box(`ruin-${index}-cornice`, w + 0.2, 0.25, d + 0.2, x, h - 0.3, z, this.trim);
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        this.box('shutter', 0.9, 1.4, 0.08, x + i * w / 3, h * 0.57, z + side * (d / 2 + 0.04), this.dark);
        this.box('sill', 1.15, 0.15, 0.16, x + i * w / 3, h * 0.57 - 0.76, z + side * (d / 2 + 0.06), this.trim);
      }
      for (let i = -1; i <= 1; i++) {
        this.box('side-window', 0.08, 1.4, 0.9, x + side * (w / 2 + 0.04), h * 0.57, z + i * d / 3, this.dark);
        this.box('buttress', 0.4, h + 0.3, 0.55, x + side * (w / 2 + 0.07), (h + 0.3) / 2, z + i * d / 3, this.trim);
      }
    }
    if (index % 2 === 0) {
      const roof = CreateCylinder('broken-roof', { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, this.scene);
      roof.scaling.set(w * 1.48, 2.3, d * 1.48);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(x, h + 1.15, z);
      roof.material = this.roof;
      roof.isPickable = false;
    } else {
      for (let i = 0; i < 5; i++) this.box('fractured-wall', w / 5 - 0.12, 0.5 + i % 3 * 0.55, 0.6, x - w / 2 + (i + 0.5) * w / 5, h + 0.25, z - d / 2 + 0.2, this.stone);
    }
    this.box('moss-on-wall', w * 0.6, 0.7, 0.04, x + 0.4, 0.55, z - d / 2 - 0.05, this.moss);
  }

  private buildShelter(): void {
    const { x, z, width, depth, height, doorWidth } = SHELTER_HALL;
    const { minX, maxX, minZ, maxZ } = BASE_BOUNDS;
    const floor = this.box('base-floor', maxX - minX, 0.06, maxZ - minZ, x, 0, 0, this.material('base-paving', '#4b514b'), true);
    floor.metadata = { buildGround: true };
    for (const [i, wall] of BASE_WALLS.entries()) {
      this.box(`base-wall-${i}`, wall.width, wall.height, wall.depth, wall.x, wall.height / 2, wall.z, this.stone, true);
      this.box('base-wall-cap', wall.width + 0.08, 0.15, wall.depth + 0.08, wall.x, wall.height, wall.z, this.trim);
    }
    for (const pad of TOWER_PADS) {
      this.box('defense-pad', 2.4, 0.035, 2.4, pad.x, 0.05, pad.z, this.dark);
      for (const side of [-1, 1]) this.box('defense-pad-edge', 0.07, 0.04, 2.4, pad.x + side * 1.2, 0.075, pad.z, this.gold);
    }
    for (const [i, wall] of SHELTER_WALLS.entries())
      this.box(`shelter-wall-${i}`, wall.width, wall.height, wall.depth, wall.x, wall.height / 2, wall.z, this.stone, true);
    const hallFloor = this.box('shelter-floor', width, 0.025, depth, x, 0.013, z, this.trim, true);
    hallFloor.metadata = { buildGround: true };
    this.box('shelter-ceiling', width + 0.5, 0.25, depth + 0.5, x, height + 0.1, z, this.trim, true);
    const canopy = CreateCylinder('shelter-roof', { diameterTop: 0, diameterBottom: 10, height: 2.5, tessellation: 4 }, this.scene);
    canopy.position.set(x, height + 1.45, z);
    canopy.rotation.y = Math.PI / 4;
    canopy.scaling.z = 0.9;
    canopy.material = this.roof;
    canopy.isPickable = false;
    const frontZ = z - depth / 2;
    this.box('shelter-door-lintel', doorWidth, 0.8, 0.5, x, height - 0.4, frontZ, this.trim, true);
    // Hinged leaves sit open against the wall, leaving a full 3 m entrance.
    for (const side of [-1, 1]) {
      this.box('open-door', 0.12, 2.9, 1.4, x + side * (doorWidth / 2 + 0.12), 1.5, frontZ - 0.6, this.gold);
      this.box('door-brace', 0.14, 0.1, 1.2, x + side * (doorWidth / 2 + 0.14), 1.7, frontZ - 0.6, this.dark);
    }
    this.box('shelter-rear-bench', 3.2, 0.7, 0.5, x, 0.4, z + depth / 2 - 0.5, this.gold);
    for (const side of [-1, 1]) {
      this.box('shelter-banner', 1, 2, 0.06, x + side * 2.7, 2.5, frontZ - 0.29, this.material(`banner-${side}`, '#613d35'));
      this.box('ward-symbol', 0.16, 0.8, 0.07, x + side * 2.7, 2.65, frontZ - 0.34, this.gold);
    }
    this.box('crystal-pedestal', 0.65, 1.4, 0.65, x, 7.2, z, this.gold);
    const beam = CreateCylinder('shelter-beacon', { diameter: 0.14, height: 16, tessellation: 8 }, this.scene);
    beam.position.set(x, 16, z); beam.isPickable = false;
    const beamMaterial = this.material('beacon-glow', '#9ec9b0', '#6eaa8d');
    beamMaterial.alpha = 0.35; beam.material = beamMaterial;
  }

  private torch(x: number, z: number): void {
    this.box('torch-post', 0.16, 2.6, 0.16, x, 1.3, z, this.dark);
    this.box('lantern-base', 0.38, 0.16, 0.38, x, 2.4, z, this.gold);
    const flame = CreateSphere('lantern', { diameter: 0.25, segments: 6 }, this.scene);
    flame.position.set(x, 2.65, z);
    flame.scaling.y = 1.8;
    flame.material = this.material(`flame-${x}-${z}`, '#ffd2a0', '#ffab59');
    flame.isPickable = false;
    const light = new PointLight('torch-light', new Vector3(x, 2.8, z), this.scene);
    light.diffuse = Color3.FromHexString('#ffc080');
    light.intensity = 0.65;
    light.range = 9;
    this.lights.push(light);
  }

  private decorate(): void {
    // Repeated decorative geometry uses instances; the city layout stays authored.
    const source = this.box('cobble-source', 0.68, 0.045, 1.05, 0, -10, 0, this.trim);
    source.isVisible = false;
    for (let z = -18; z < 21; z += 1.65) {
      for (let x = -7.7; x < -3.5; x += 1.1) {
        const cobble = source.createInstance('street-cobble');
        cobble.position.set(x + Math.sin(z * 2.3) * 0.1, -0.006, z);
        cobble.rotation.y = Math.sin(x * z) * 0.06;
        cobble.isPickable = false;
      }
    }
    for (let i = 0; i < 36; i++) {
      const x = Math.sin(i * 31.3) * 16;
      const z = Math.cos(i * 17.6) * 18;
      if (inBase({ x, z })) continue;
      const rubble = this.box('rubble', 0.35 + i % 3 * 0.2, 0.22, 0.6, x, 0.09, z, this.stone);
      rubble.rotation.set(0.1, i * 0.7, 0.12);
    }
    const well = CreateCylinder('old-well', { diameter: 1.8, height: 0.65, tessellation: 8 }, this.scene);
    well.position.set(27, 0.3, 17);
    well.material = this.trim;
    well.isPickable = false;
    this.box('well-dark-water', 1, 0.08, 1, 27, 0.65, 17, this.dark);
  }

  private landmarks(): void {
    this.box('bell-tower', 2.4, 11, 2.4, 3.2, 5.5, 18, this.stone);
    this.box('bell-opening', 2.5, 2.2, 1.8, 3.2, 9.3, 18, this.dark);
    for (const x of [2.1, 4.3]) this.box('tower-column', 0.35, 3, 2.5, x, 9.5, 18, this.trim);
    this.box('tower-crown', 3.1, 0.4, 3.1, 3.2, 11.2, 18, this.trim);
    // Temple spire, cemetery memorial, market stalls, forge chimney and mine gate.
    const spire = CreateCylinder('temple-spire', { diameterTop: 0, diameterBottom: 4, height: 7, tessellation: 4 }, this.scene);
    spire.position.set(34, 12.5, 42);
    spire.material = this.roof;
    spire.isPickable = false;
    for (const x of [29, 34, 39]) this.box('temple-column', 0.5, 7, 0.6, x, 3.5, 36.6, this.trim);
    this.box('temple-pediment', 12, 0.5, 1, 34, 7.3, 36.6, this.trim);
    this.box('cemetery-obelisk', 0.75, 5.5, 0.75, -36, 2.75, 39, this.trim);
    for (const [x, z] of [[-28, 32], [-28, 35], [-33, 41], [-35, 35], [-37, 30]]) {
      this.box('gravestone', 0.5, 0.9, 0.22, x, 0.45, z, this.stone);
    }
    for (const x of [-5.5, 5.5]) {
      this.box('market-stall', 2.5, 0.75, 1.1, x, 0.4, 32, this.gold);
      this.box('market-canopy', 2.8, 0.16, 1.5, x, 2.3, 32, this.roof);
      for (const offset of [-1.1, 1.1]) this.box('stall-post', 0.1, 2.3, 0.1, x + offset, 1.15, 32, this.gold);
    }
    this.box('forge-chimney', 1.8, 11, 1.8, 40, 5.5, 7, this.dark);
    this.box('forge-chimney-cap', 2.3, 0.5, 2.3, 40, 11, 7, this.trim);
    this.box('forge-anvil', 1.3, 0.4, 0.6, 31, 0.7, 4.5, this.dark);
    this.box('mine-opening', 3, 3.2, 0.04, 38, 1.6, -35.46, this.dark);
    for (const x of [36.4, 39.6]) this.box('mine-frame', 0.4, 3.4, 0.35, x, 1.7, -35.3, this.gold);
    this.box('mine-lintel', 3.6, 0.45, 0.35, 38, 3.4, -35.3, this.gold);
    for (const pillar of GATE_PILLARS) this.box('gate-pillar', pillar.width, pillar.height, pillar.depth, pillar.x, pillar.height / 2, pillar.z, this.trim, true);
    this.box('gate-arch', 8.4, 0.8, 1.2, 0, 5.4, -35, this.trim);
    for (const tree of FOREST_TREES) {
      this.box('forest-trunk', tree.width, tree.height, tree.depth, tree.x, tree.height / 2, tree.z, this.dark, true);
      const foliage = CreateCylinder('forest-crown', { diameterTop: 0, diameterBottom: 3.5, height: 4.5, tessellation: 6 }, this.scene);
      foliage.position.set(tree.x, tree.height, tree.z);
      foliage.material = this.moss;
      foliage.isPickable = false;
    }
    this.box('forest-floor', 14, 0.025, 17, -31, -0.005, -31, this.moss);
    const moon = CreateSphere('moon', { diameter: 3.5, segments: 20 }, this.scene);
    moon.position.set(-30, 40, 110);
    moon.material = this.material('moon-surface', '#c2d6c9', '#92a69b');
    moon.isPickable = false;
  }

  private mergeStaticDetails(): void {
    // Merge only decorative geometry. Collision/raycast meshes remain independent.
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of this.scene.meshes) {
      if (!(mesh instanceof Mesh) || !mesh.isVisible || mesh.isPickable || mesh.checkCollisions ||
        mesh.instances.length > 0 || mesh === this.shelterCrystal || !(mesh.material instanceof StandardMaterial)) continue;
      const group = groups.get(mesh.material) ?? [];
      group.push(mesh);
      groups.set(mesh.material, group);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const merged = Mesh.MergeMeshes(meshes, true, true);
      if (merged) { merged.name = `city-details-${material.name}`; merged.isPickable = false; }
    }
  }

  update(time: number, shelterHpRatio: number): void {
    this.shelterCrystal.rotation.y = time * 0.4;
    this.shelterCrystal.position.y = 8.2 + Math.sin(time * 1.8) * 0.08;
    this.crystalMaterial.emissiveColor.set(0.3 + 0.2 * shelterHpRatio, 0.4 + 0.3 * shelterHpRatio, 0.4);
    this.lights.forEach((light, index) => { light.intensity = 0.6 + Math.sin(time * 7 + index * 2) * 0.05; });
  }
}
