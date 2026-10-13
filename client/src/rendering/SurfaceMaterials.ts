import lighting from '../../../shared/lighting.json';
import { Color3, DynamicTexture, StandardMaterial, Texture } from './babylon';
import type { Mesh, Scene } from './babylon';

type Surface = 'stone' | 'paving' | 'wood' | 'slate' | 'earth' | 'metal' | 'skin' | 'cloth' | 'armor' | 'bone' | 'ore';
const palettes: Record<Surface, number[]> = {
  stone: [151, 142, 123], paving: [118, 112, 102], wood: [127, 88, 51],
  slate: [65, 75, 84], earth: [75, 65, 48], metal: [105, 101, 91],
  skin: [150, 151, 126], cloth: [84, 66, 48], armor: [73, 69, 62], bone: [192, 178, 142], ore: [79, 80, 74],
};
const cache = new WeakMap<Scene, Map<Surface, StandardMaterial>>();
const atlases = new WeakMap<Scene, Map<string, Promise<HTMLImageElement>>>();
const tiles: Record<Surface, [string, number, number, number, number]> = {
  stone: ['environment', 3, 2, 0, 0], paving: ['environment', 3, 2, 1, 0], wood: ['environment', 3, 2, 2, 0],
  slate: ['environment', 3, 2, 0, 1], earth: ['environment', 3, 2, 1, 1], metal: ['environment', 3, 2, 2, 1],
  skin: ['undead', 2, 2, 0, 0], cloth: ['undead', 2, 2, 1, 0], armor: ['undead', 2, 2, 0, 1], bone: ['undead', 2, 2, 1, 1],
  ore: ['environment', 3, 2, 2, 1],
};
function atlas(scene: Scene, name: string): Promise<HTMLImageElement> {
  let images = atlases.get(scene);
  if (!images) { images = new Map(); atlases.set(scene, images); }
  let image = images.get(name);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const source = new Image(); source.onload = () => resolve(source); source.onerror = reject;
      source.src = `/textures/${name}-atlas.webp`;
    });
    images.set(name, image);
  }
  return image;
}

/** Shared generated albedo tiles with relief derived once on upload; no texture is allocated per enemy. */
export function surfaceMaterial(scene: Scene, kind: Surface): StandardMaterial {
  let materials = cache.get(scene);
  if (!materials) { materials = new Map(); cache.set(scene, materials); }
  const cached = materials.get(kind); if (cached) return cached;
  const material = new StandardMaterial(`surface-${kind}`, scene);
  material.diffuseColor = Color3.FromInts(...palettes[kind] as [number, number, number]);
  material.specularColor = ['metal', 'armor'].includes(kind) ? new Color3(.22, .2, .17) : new Color3(.04, .04, .04);
  material.specularPower = 32; material.maxSimultaneousLights = lighting.maxLights;
  materials.set(kind, material);
  // NullEngine verifies exactly the same meshes and collisions without browser image loading.
  if (typeof document === 'undefined') return material;
  const size = 512;
  const albedo = new DynamicTexture(`${kind}-albedo`, size, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  const normal = new DynamicTexture(`${kind}-normal`, size, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  for (const texture of [albedo, normal]) {
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
  }
  const color = albedo.getContext();
  color.fillStyle = `rgb(${palettes[kind].join(',')})`; color.fillRect(0, 0, size, size); albedo.update(false);
  material.diffuseColor = kind === 'ore' ? new Color3(.57, .61, .62) : Color3.White();
  material.diffuseTexture = albedo;
  const normalContext = normal.getContext(); normalContext.fillStyle = '#8080ff'; normalContext.fillRect(0, 0, size, size); normal.update(false);
  normal.level = kind === 'skin' || kind === 'cloth' ? .25 : .48;
  material.bumpTexture = normal;
  const [name, columns, rows, column, row] = tiles[kind];
  void atlas(scene, name).then(image => {
    if (scene.isDisposed) return;
    color.drawImage(image, column * image.width / columns, row * image.height / rows,
      image.width / columns, image.height / rows, 0, 0, size, size);
    albedo.update(false);
    const source = color.getImageData(0, 0, size, size).data;
    const context = normal.getContext(), result = context.getImageData(0, 0, size, size);
    const height = new Float32Array(size * size), smooth = new Float32Array(size * size);
    for (let i = 0; i < height.length; i++) height[i] = (source[i*4]*.3 + source[i*4+1]*.59 + source[i*4+2]*.11) / 255;
    const index = (x: number, y: number) => ((y+size)%size)*size + (x+size)%size;
    for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
      let sum=0; for (let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) sum+=height[index(x+dx,y+dy)];
      smooth[y*size+x]=sum/9;
    }
    for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
      const nx=(smooth[index(x-1,y)]-smooth[index(x+1,y)])*3, ny=(smooth[index(x,y-1)]-smooth[index(x,y+1)])*3;
      const length=Math.hypot(nx,ny,1), i=(y*size+x)*4;
      result.data[i]=(nx/length*.5+.5)*255; result.data[i+1]=(ny/length*.5+.5)*255;
      result.data[i+2]=(1/length*.5+.5)*255; result.data[i+3]=255;
    }
    context.putImageData(result,0,0); normal.update(false); normal.level = kind === 'skin' || kind === 'cloth' ? .25 : .48;
    material.bumpTexture = normal;
  }).catch(() => { /* Keep the material's neutral fallback if an image cannot load. */ });
  return material;
}

/** Babylon clones DynamicTexture into an empty GPU texture; retain the uploaded shared maps instead. */
export function surfaceMaterialInstance(scene: Scene, kind: Surface, name: string): StandardMaterial {
  const source = surfaceMaterial(scene, kind), material = new StandardMaterial(name, scene);
  material.diffuseColor.copyFrom(source.diffuseColor);
  material.specularColor.copyFrom(source.specularColor);
  material.specularPower = source.specularPower; material.maxSimultaneousLights = source.maxSimultaneousLights;
  material.diffuseTexture = source.diffuseTexture;
  material.bumpTexture = source.bumpTexture;
  return material;
}

/** Match surface scale on every face instead of stretching one tile across a facade. */
export function tileBox(mesh: Mesh, _width: number, _height: number, _depth: number, repeatMeters = 2): void {
  const uvs = mesh.getVerticesData('uv'), normals = mesh.getVerticesData('normal'), positions = mesh.getVerticesData('position');
  if (!uvs || !normals || !positions) return;
  for (let face = 0; face < 6; face++) {
    const nx = Math.abs(normals[face * 12]), ny = Math.abs(normals[face * 12 + 1]);
    for (let vertex = 0; vertex < 4; vertex++) {
      const index = face * 8 + vertex * 2;
        const position = (face * 4 + vertex) * 3;
      if (ny > .5) {
        // BoxBuilder rotates its top UVs; world projection avoids stretching narrow raster strips
        // and keeps cobblestones continuous across the hundreds of merged floor rectangles.
        uvs[index] = (positions[position] + mesh.position.x) / repeatMeters;
        uvs[index + 1] = (positions[position + 2] + mesh.position.z) / repeatMeters;
      } else {
          // Side-face UV axes differ in BoxBuilder. Project in world space so narrow
          // rampart strips keep square stones and continuous seams on both orientations.
          uvs[index] = (nx > .5 ? positions[position + 2] + mesh.position.z : positions[position] + mesh.position.x) / repeatMeters;
          uvs[index + 1] = (positions[position + 1] + mesh.position.y) / repeatMeters;
      }
    }
  }
  mesh.setVerticesData('uv', uvs);
}
