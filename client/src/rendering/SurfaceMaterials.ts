import { Color3, DynamicTexture, StandardMaterial, Texture } from './babylon';
import type { Mesh, Scene } from './babylon';

type Surface = 'stone' | 'paving' | 'wood' | 'slate' | 'earth' | 'metal';
const palettes: Record<Surface, number[]> = {
  stone: [151, 142, 123], paving: [118, 112, 102], wood: [127, 88, 51],
  slate: [65, 75, 84], earth: [75, 65, 48], metal: [105, 101, 91],
};
const cache = new WeakMap<Scene, Map<Surface, StandardMaterial>>();
const mod = (x: number, n: number) => (x % n + n) % n;
const hash = (x: number, y: number) => {
  let n = Math.imul(x + 1237, 374761393) ^ Math.imul(y + 97, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return (n >>> 0) / 4294967295;
};

/** Original, deterministic tile textures; generated once per scene, with normal maps. */
export function surfaceMaterial(scene: Scene, kind: Surface): StandardMaterial {
  let materials = cache.get(scene);
  if (!materials) { materials = new Map(); cache.set(scene, materials); }
  const cached = materials.get(kind); if (cached) return cached;
  const material = new StandardMaterial(`surface-${kind}`, scene);
  material.diffuseColor = Color3.FromInts(...palettes[kind] as [number, number, number]);
  material.specularColor = new Color3(0.06, 0.06, 0.06);
  material.specularPower = 24;
  materials.set(kind, material);
  // NullEngine has no drawing surface. Gameplay/collision tests use the same geometry.
  if (typeof document === 'undefined') return material;
  const size = 512;
  const albedo = new DynamicTexture(`${kind}-albedo`, size, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  const normal = new DynamicTexture(`${kind}-normal`, size, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  const colorContext = albedo.getContext(), normalContext = normal.getContext();
  const colors = colorContext.getImageData(0, 0, size, size), normals = normalContext.getImageData(0, 0, size, size);
  const relief = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = hash(x, y) - 0.5;
    const cloud = Math.sin(x * Math.PI / 128) * Math.cos(y * Math.PI / 256);
    let shade = grain * 28 + cloud * 9, height = 0.55 + grain * 0.035;
    let moss = 0;
    if (kind === 'stone' || kind === 'paving' || kind === 'slate') {
      const rowHeight = kind === 'slate' ? 64 : kind === 'stone' ? 128 : 64;
      const columnWidth = kind === 'stone' ? 256 : 128;
      const row = Math.floor(y / rowHeight);
      const offset = row % 2 * columnWidth / 2;
      const px = mod(x + offset, columnWidth), py = mod(y, rowHeight);
      const edge = Math.min(px, columnWidth - px, py, rowHeight - py);
      const block = hash(Math.floor(mod(x + offset, size) / columnWidth), row);
      shade += (block - 0.5) * 28;
      if (edge < 3) { shade -= 60; height = 0.12; }
      else if (edge < 6) { shade -= 18; height = 0.35; }
      else { height += block * 0.05; shade += Math.sin(px * 0.15 + py * 0.12) * 3; }
      const crack = Math.abs(px - columnWidth * (0.25 + block * 0.45) - Math.sin(py * 0.07) * 4);
      if (block > 0.63 && crack < 0.9 && py > rowHeight * 0.35) { shade -= 34; height -= 0.15; }
      if (kind !== 'slate' && edge < 12 && hash(Math.floor(x / 7), Math.floor(y / 7)) > 0.7) moss = 12;
    } else if (kind === 'wood') {
      const px = x % 128;
      shade += Math.sin(x * 0.46 + Math.sin(y * Math.PI / 128) * 1.8) * 13;
      if (px < 3 || px > 124) { shade -= 48; height = 0.18; }
      height += Math.sin(x * 0.46) * 0.045;
      if (Math.hypot(px - 10, y % 256 - 16) < 4) { shade -= 65; height += 0.04; }
    } else if (kind === 'earth') {
      shade += Math.sin(x * Math.PI / 64) * Math.cos(y * Math.PI / 64) * 12;
      height += grain * 0.12; moss = Math.max(0, cloud) * 10;
    } else {
      shade += (hash(x, Math.floor(y / 24)) - 0.5) * 8;
      if (hash(x, y) > 0.985) shade += 28;
      height += grain * 0.025;
    }
    relief[y * size + x] = height;
    const index = (y * size + x) * 4;
    colors.data[index] = palettes[kind][0] + shade - moss;
    colors.data[index + 1] = palettes[kind][1] + shade + moss * 0.15;
    colors.data[index + 2] = palettes[kind][2] + shade - moss;
    colors.data[index + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = relief[y * size + mod(x - 1, size)], right = relief[y * size + mod(x + 1, size)];
    const up = relief[mod(y - 1, size) * size + x], down = relief[mod(y + 1, size) * size + x];
    const nx = (left - right) * 2.5, ny = (up - down) * 2.5, length = Math.hypot(nx, ny, 1);
    const index = (y * size + x) * 4;
    normals.data[index] = (nx / length * 0.5 + 0.5) * 255;
    normals.data[index + 1] = (ny / length * 0.5 + 0.5) * 255;
    normals.data[index + 2] = (1 / length * 0.5 + 0.5) * 255;
    normals.data[index + 3] = 255;
  }
  colorContext.putImageData(colors, 0, 0); normalContext.putImageData(normals, 0, 0);
  albedo.wrapU = albedo.wrapV = normal.wrapU = normal.wrapV = Texture.WRAP_ADDRESSMODE;
  albedo.update(false); normal.update(false);
  albedo.anisotropicFilteringLevel = normal.anisotropicFilteringLevel = 8;
  normal.level = 0.55;
  material.diffuseColor = Color3.White(); material.diffuseTexture = albedo; material.bumpTexture = normal;
  return material;
}

/** Keep brick/stone size consistent rather than stretching a tile across a whole facade. */
export function tileBox(mesh: Mesh, width: number, height: number, depth: number): void {
  const uvs = mesh.getVerticesData('uv'); if (!uvs) return;
  const normals = mesh.getVerticesData('normal'); if (!normals) return;
  for (let face = 0; face < 6; face++) {
    const nx = Math.abs(normals[face * 12]), ny = Math.abs(normals[face * 12 + 1]);
    const dimensions = ny > 0.5 ? [width, depth] : nx > 0.5 ? [depth, height] : [width, height];
    for (let vertex = 0; vertex < 4; vertex++) {
      const index = face * 8 + vertex * 2;
      uvs[index] *= dimensions[0] / 2; uvs[index + 1] *= dimensions[1] / 2;
    }
  }
  mesh.setVerticesData('uv', uvs);
}
