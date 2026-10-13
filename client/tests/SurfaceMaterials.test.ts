import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { CreateBox, Scene, Texture } from '../src/rendering/babylon';
import { surfaceMaterial, surfaceMaterialInstance, tileBox } from '../src/rendering/SurfaceMaterials';
import type { Mesh } from '../src/rendering/babylon';
import { ZombieView } from '../src/enemies/ZombieView';
import { Zombie } from '../src/enemies/Zombie';
import { Player } from '../src/player/Player';

it('shares uploaded maps while keeping independent tint and hit feedback',()=>{
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine),source=surfaceMaterial(scene,'skin');
    source.diffuseTexture=new Texture(null,scene);source.bumpTexture=new Texture(null,scene);
    const instance=surfaceMaterialInstance(scene,'skin','instance');
    expect(instance.diffuseTexture).toBe(source.diffuseTexture);expect(instance.bumpTexture).toBe(source.bumpTexture);
    instance.emissiveColor.set(1,0,0);instance.diffuseColor.set(1,0,0);
    expect(source.emissiveColor.r).toBe(0);expect(source.diffuseColor.g).toBeGreaterThan(0);
    instance.dispose(false,false);
  } finally {engine.dispose();}
});

it('disposing a corpse preserves textures used by other undead',()=>{
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine),source=surfaceMaterial(scene,'skin'),texture=new Texture(null,scene);
    source.diffuseTexture=texture;const dispose=vi.spyOn(texture,'dispose');
    const first=new ZombieView(scene,'first'),second=new ZombieView(scene,'second');
    first.hit();first.update(new Zombie('first'),new Player(),1,.01,0);first.dispose();
    expect(dispose).not.toHaveBeenCalled();expect(scene.getMaterialByName('second-skin')?.getActiveTextures()).toContain(texture);
    second.dispose();expect(dispose).not.toHaveBeenCalled();
  } finally {engine.dispose();}
});

it('keeps paving scale and seams consistent on adjacent narrow floor strips',()=>{
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine),left=CreateBox('left',{width:.7,height:.12,depth:50},scene),right=CreateBox('right',{width:.7,height:.12,depth:50},scene);
    left.position.set(.35,0,25);right.position.set(1.05,0,25);tileBox(left,.7,.12,50);tileBox(right,.7,.12,50);
    const uvAt=(mesh:Mesh,x:number,z:number)=>{
      const positions=mesh.getVerticesData('position')!,normals=mesh.getVerticesData('normal')!,uvs=mesh.getVerticesData('uv')!;
      for(let i=0;i<positions.length/3;i++)if(normals[i*3+1]>.5&&Math.abs(positions[i*3]+mesh.position.x-x)<1e-6&&Math.abs(positions[i*3+2]+mesh.position.z-z)<1e-6)return [uvs[i*2],uvs[i*2+1]];
      throw new Error('Missing top corner');
    };
    const start=uvAt(left,0,0),end=uvAt(left,0,50),sharedLeft=uvAt(left,.7,0),sharedRight=uvAt(right,.7,0);
    expect(end[1]-start[1]).toBeCloseTo(25);expect(sharedLeft[0]-start[0]).toBeCloseTo(.35);
    expect(sharedLeft[0]).toBeCloseTo(sharedRight[0]);expect(sharedLeft[1]).toBeCloseTo(sharedRight[1]);
  } finally {engine.dispose();}
});

it('keeps stone texels square and aligned on tall narrow rampart faces in both directions',()=>{
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine);
    for(const [width,depth]of [[.6,.7],[.7,.6]]){
      const wall=CreateBox('rampart',{width,height:7.2,depth},scene);wall.position.set(-33,3.6,-10);
      tileBox(wall,width,7.2,depth);
      const positions=wall.getVerticesData('position')!,normals=wall.getVerticesData('normal')!,uvs=wall.getVerticesData('uv')!;
      for(let face=0;face<6;face++){
        if(Math.abs(normals[face*12+1])>.5)continue;
        for(let a=face*4;a<face*4+4;a++)for(let b=a+1;b<face*4+4;b++){
          const dy=Math.abs(positions[a*3+1]-positions[b*3+1]);
          const horizontal=Math.hypot(positions[a*3]-positions[b*3],positions[a*3+2]-positions[b*3+2]);
          expect(Math.abs(uvs[a*2+1]-uvs[b*2+1])).toBeCloseTo(dy/2);
          expect(Math.abs(uvs[a*2]-uvs[b*2])).toBeCloseTo(horizontal/2);
        }
      }
    }
  }finally{engine.dispose();}
});
