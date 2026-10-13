import lighting from '../../../shared/lighting.json';
import { Color3, PBRMaterial, StandardMaterial, Texture } from './babylon';
import type { Mesh, Scene } from './babylon';
import { tileBox } from './SurfaceMaterials';

export type ArtMaterial = StandardMaterial | PBRMaterial;
export type EnvironmentSurface = 'stone' | 'paving' | 'wood' | 'slate';
export const ENVIRONMENT_SURFACES = {
  stone: 'medieval_wall_02', paving: 'cobblestone_01',
  wood: 'weathered_planks', slate: 'roof_slates_02',
} as const;
const cache = new WeakMap<Scene, Map<EnvironmentSurface, PBRMaterial>>();

function map(scene: Scene, folder: string, name: string, linear: boolean): Texture {
  const texture = new Texture(`/textures/environment/${folder}/${name}.webp`, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  texture.gammaSpace = !linear;
  texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

/** Twelve shared 2K maps for the entire city, including material color variants. */
export function environmentMaterial(scene: Scene, kind: EnvironmentSurface): PBRMaterial {
  let materials = cache.get(scene);
  if (!materials) { materials = new Map(); cache.set(scene, materials); }
  const cached = materials.get(kind); if (cached) return cached;
  const material = new PBRMaterial(`environment-${kind}`, scene);
  material.albedoColor = Color3.White();
  material.metallic = 0; material.roughness = 1; material.maxSimultaneousLights = lighting.maxLights;
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  const folder = ENVIRONMENT_SURFACES[kind];
  material.albedoTexture = map(scene, folder, 'albedo', false);
  material.bumpTexture = map(scene, folder, 'normal', true);
  material.metallicTexture = map(scene, folder, 'roughness', true);
  // Supplied normal maps use OpenGL (+Y); Babylon's procedural mesh tangent space uses -Y.
  material.invertNormalMapY = true;
  material.metadata = { environmentSurface: kind, repeatMeters: 2 };
  materials.set(kind, material);
  return material;
}

/** Independent tint, shared GPU maps. Disposing a variant must not dispose textures. */
export function environmentMaterialInstance(scene: Scene, kind: EnvironmentSurface, name: string): PBRMaterial {
  const source = environmentMaterial(scene, kind);
  const material = new PBRMaterial(name, scene);
  material.albedoColor.copyFrom(source.albedoColor);
  material.metallic = source.metallic; material.roughness = source.roughness; material.maxSimultaneousLights = source.maxSimultaneousLights;
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.invertNormalMapY = source.invertNormalMapY;
  material.metadata = { ...source.metadata };
  material.albedoTexture = source.albedoTexture;
  material.bumpTexture = source.bumpTexture;
  material.metallicTexture = source.metallicTexture;
  return material;
}

/** Two-meter tiles, plus grain running along each wooden part rather than across it. */
export function tileArtBox(mesh: Mesh, width: number, height: number, depth: number, material: ArtMaterial): void {
  if (!(material instanceof PBRMaterial) && !material.diffuseTexture) return;
  tileBox(mesh, width, height, depth);
  if (material.metadata?.environmentSurface !== 'wood') return;
  const positions = mesh.getVerticesData('position')!, normals = mesh.getVerticesData('normal')!, uvs = mesh.getVerticesData('uv')!;
  const dimensions = [width, height, depth];
  const grain = dimensions.indexOf(Math.max(...dimensions));
  for (let face = 0; face < 6; face++) {
    const normal = normals.slice(face * 12, face * 12 + 3).map(Math.abs);
    const axis = normal.indexOf(Math.max(...normal));
    const plane = [0, 1, 2].filter(value => value !== axis);
    const v = plane.includes(grain) ? grain : plane[1], u = plane.find(value => value !== v)!;
    for (let vertex = 0; vertex < 4; vertex++) {
      const point = face * 4 + vertex;
      uvs[point * 2] = positions[point * 3 + u] / 2;
      uvs[point * 2 + 1] = positions[point * 3 + v] / 2;
    }
  }
  mesh.setVerticesData('uv', uvs);
}

/** Slate rows follow the ridge, with their overlap facing down each slope. */
export function tileRoofSlope(mesh: Mesh, side: number, ridgeZ: number): void {
  const positions = mesh.getVerticesData('position')!, normals = mesh.getVerticesData('normal')!, uvs = mesh.getVerticesData('uv')!;
  for (let point = 0; point < positions.length / 3; point++) {
    if (Math.abs(normals[point * 3 + 1]) < .5) continue;
    uvs[point * 2] = (positions[point * 3 + 2] + ridgeZ) / 2;
    uvs[point * 2 + 1] = -side * positions[point * 3] / 2;
  }
  mesh.setVerticesData('uv', uvs);
}
