import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { unweld, tangents, weld } from '@gltf-transform/functions';
import { generateTangents } from 'mikktspace';
import { validateBytes } from 'gltf-validator';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const [input, output, original, reportPath] = process.argv.slice(2);
if (!reportPath) throw new Error('Usage: node finalize.mjs optimized.glb output.glb original.glb report.json');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
let repairedNormals = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const normals = primitive.getAttribute('NORMAL');
  if (!normals) continue;
  const n = new Float32Array(normals.getArray());
  const p = primitive.getAttribute('POSITION').getArray();
  const indices = primitive.getIndices()?.getArray() ?? Array.from({length:p.length/3}, (_,i)=>i);
  const sum = new Float64Array(n.length);
  for (let i=0; i<indices.length; i+=3) {
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2];
    const vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    const face=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
    for (const vertex of [a,b,c]) for(let j=0;j<3;j++) sum[vertex+j]+=face[j];
  }
  for(let i=0;i<n.length;i+=3) {
    const length=Math.hypot(n[i],n[i+1],n[i+2]);
    if (Math.abs(length-1)<1e-5) continue;
    repairedNormals++;
    let vector=length>1e-8 ? [n[i],n[i+1],n[i+2]] : [sum[i],sum[i+1],sum[i+2]];
    let size=Math.hypot(...vector);
    if(size<1e-8) { vector=[0,1,0]; size=1; }
    for(let j=0;j<3;j++) n[i+j]=vector[j]/size;
  }
  normals.setArray(n);
}
// Match CLI MikkTSpace processing: face-corner tangents, then weld equivalent vertices.
await doc.transform(unweld(), tangents({generateTangents}), weld());
let repairedTangents = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const accessor = primitive.getAttribute('TANGENT');
  if (!accessor) continue;
  const values = new Float32Array(accessor.getArray());
  const normals = primitive.getAttribute('NORMAL').getArray();
  for(let i=0;i<values.length;i+=4) {
    const length=Math.hypot(values[i],values[i+1],values[i+2]);
    if (length>1e-8 && Math.abs(length-1)<1e-5) continue;
    repairedTangents++;
    const n=Array.from(normals.slice(i/4*3,i/4*3+3));
    let t=Array.from(values.slice(i,i+3));
    if(length<1e-8) {
      // Degenerate UV faces have no MikkTSpace tangent. Choose a stable orthogonal axis.
      const axis=Math.abs(n[0])<.8?[1,0,0]:[0,1,0];
      t=[n[1]*axis[2]-n[2]*axis[1],n[2]*axis[0]-n[0]*axis[2],n[0]*axis[1]-n[1]*axis[0]];
    }
    const magnitude=Math.hypot(...t);
    for(let j=0;j<3;j++) values[i+j]=t[j]/magnitude;
    values[i+3]=values[i+3]<0?-1:1;
  }
  accessor.setArray(values);
}
await io.write(output, doc);
const bytes = await readFile(output);
const validation = await validateBytes(new Uint8Array(bytes), {uri:path.basename(output), maxIssues:100});
const source = await readFile(original);
const report={original:path.basename(original),sourceBytes:source.length,sourceSha256:createHash('sha256').update(source).digest('hex'),runtime:path.basename(output),runtimeBytes:bytes.length,runtimeSha256:createHash('sha256').update(bytes).digest('hex'),repairedNormals,repairedTangents,vertices:doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((a,p)=>a+p.getAttribute('POSITION').getCount(),0),triangles:doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((a,p)=>a+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),skins:doc.getRoot().listSkins().length,animations:doc.getRoot().listAnimations().length,textures:doc.getRoot().listTextures().map(t=>({name:t.getName(),size:t.getSize(),mime:t.getMimeType()})),validation};
await mkdir(path.dirname(reportPath),{recursive:true});
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file:report.runtime,bytes:report.runtimeBytes,vertices:report.vertices,triangles:report.triangles,repairedNormals,repairedTangents,errors:validation.issues.numErrors,warnings:validation.issues.numWarnings}));
if(validation.issues.numErrors) process.exitCode=1;
