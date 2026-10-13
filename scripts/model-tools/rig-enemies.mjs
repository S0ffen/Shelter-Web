import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { validateBytes } from 'gltf-validator';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(project, 'verification/27-enemy-animation');
await mkdir(directory,{recursive:true});
const profiles=JSON.parse(await readFile(new URL('./rig-profiles.json',import.meta.url),'utf8'));
const parent={Hips:null,Spine:'Hips',Chest:'Spine',Neck:'Chest',Head:'Neck',LeftUpperArm:'Chest',LeftForeArm:'LeftUpperArm',LeftHand:'LeftForeArm',RightUpperArm:'Chest',RightForeArm:'RightUpperArm',RightHand:'RightForeArm',LeftThigh:'Hips',LeftShin:'LeftThigh',LeftFoot:'LeftShin',RightThigh:'Hips',RightShin:'RightThigh',RightFoot:'RightShin'};
const tip={Hips:'Spine',Spine:'Chest',Chest:'Neck',Neck:'Head',Head:'HeadEnd',LeftUpperArm:'LeftForeArm',LeftForeArm:'LeftHand',LeftHand:'LeftHandEnd',RightUpperArm:'RightForeArm',RightForeArm:'RightHand',RightHand:'RightHandEnd',LeftThigh:'LeftShin',LeftShin:'LeftFoot',LeftFoot:'LeftFootEnd',RightThigh:'RightShin',RightShin:'RightFoot',RightFoot:'RightFootEnd'};
const names=Object.keys(parent), clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)), smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function transform(v,m,direction=false) { return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+(direction?0:m[12]),m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+(direction?0:m[13]),m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+(direction?0:m[14])]; }
function yaw(v,a) {const c=Math.cos(a),s=Math.sin(a);return[c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]];}
function quat(x=0,y=0,z=0) {const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2);return[sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz];}
function distance(p,a,b) {const ab=sub(b,a),t=clamp(dot(sub(p,a),ab)/Math.max(1e-9,dot(ab,ab)));return Math.hypot(...sub(p,a.map((v,i)=>v+t*ab[i])));}
function region(p,range) { return p.every((v,i)=>v>=(range.min?.[i]??-Infinity)&&v<=(range.max?.[i]??Infinity)); }
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const id of ['hollow-warrior','undead-knight','feral-ghoul']) {
 const profile=profiles[id];
 const target=path.join(project,`client/public/models/enemies/${id}.glb`), staticFile=path.join(directory,`${id}-static.glb`);
 const supplied=await io.read(target);
 if(!supplied.getRoot().listSkins().length && !supplied.getRoot().listAnimations().length) await copyFile(target,staticFile);
 try {await readFile(staticFile);} catch {throw new Error(`Missing static baseline ${staticFile}`);}
 const original=await readFile(staticFile),doc=await io.read(staticFile),buffer=doc.getRoot().listBuffers()[0];
 const meshNode=doc.getRoot().listNodes().find(n=>n.getMesh()),mesh=meshNode.getMesh(),matrix=meshNode.getWorldMatrix();
 const sourceYaw=profile.canonicalYaw;
 const sourcePositions=mesh.listPrimitives()[0].getAttribute('POSITION').getArray();
 const authored=[];
 for(let i=0;i<sourcePositions.length;i+=3) authored.push(yaw(transform(Array.from(sourcePositions.slice(i,i+3)),matrix),sourceYaw));
 const lo=[0,1,2].map(axis=>Math.min(...authored.map(p=>p[axis]))),hi=[0,1,2].map(axis=>Math.max(...authored.map(p=>p[axis]))),height=hi[1]-lo[1];
 const center=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];
 for(const primitive of mesh.listPrimitives()) {
  for(const semantic of ['POSITION','NORMAL','TANGENT']) {
   const accessor=primitive.getAttribute(semantic); if(!accessor) continue;
   const old=accessor.getArray(),size=accessor.getElementSize(),array=new Float32Array(old);
   for(let i=0;i<array.length;i+=size) {
    let v=yaw(transform(Array.from(old.slice(i,i+3)),matrix,semantic!=='POSITION'),sourceYaw);
    if(semantic==='POSITION') v=v.map((x,j)=>(x-center[j])/height);
    else {const length=Math.hypot(...v);v=v.map(x=>x/length);}
    for(let j=0;j<3;j++) array[i+j]=v[j];
   }
   accessor.setArray(array);
  }
 }
 meshNode.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
 const scene=doc.getRoot().listScenes()[0],armature=doc.createNode(`${id}-Armature`);
 scene.addChild(armature);
 const nodes={},indices={};
 names.forEach((name,index)=>{indices[name]=index; nodes[name]=doc.createNode(name);const p=profile.joints[name];nodes[name].setTranslation(parent[name]?sub(p,profile.joints[parent[name]]):p);});
 for(const name of names) (parent[name]?nodes[parent[name]]:armature).addChild(nodes[name]);
 const inverse=new Float32Array(names.length*16);
 names.forEach((name,index)=>{const p=profile.joints[name],o=index*16;inverse[o]=inverse[o+5]=inverse[o+10]=inverse[o+15]=1;inverse[o+12]=-p[0];inverse[o+13]=-p[1];inverse[o+14]=-p[2];});
 const skin=doc.createSkin(`${id}-Skin`).setSkeleton(armature).setInverseBindMatrices(doc.createAccessor('InverseBindMatrices').setType('MAT4').setArray(inverse).setBuffer(buffer));
 names.forEach(name=>skin.addJoint(nodes[name])); meshNode.setSkin(skin);
 const assignmentCounts={};
 for(const primitive of mesh.listPrimitives()) {
  const positions=primitive.getAttribute('POSITION').getArray();
  const uv=primitive.getAttribute('TEXCOORD_0').getArray();
  const image=primitive.getMaterial().getBaseColorTexture().getImage();
  const {data:pixels,info}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const vertexColors=new Map();
  for(let i=0;i<positions.length;i+=3) {
    const key=Array.from(positions.slice(i,i+3)).join(',');
    const x=clamp(Math.floor(uv[i/3*2]*info.width),0,info.width-1),y=clamp(Math.floor(uv[i/3*2+1]*info.height),0,info.height-1),offset=(y*info.width+x)*info.channels;
    const item=vertexColors.get(key)??[0,0,0,0];for(let c=0;c<3;c++) item[c]+=pixels[offset+c];item[3]++;vertexColors.set(key,item);
  }
  // Classify fabric over the welded surface, so UV seams and isolated texels cannot
  // make one robe triangle follow a hand while its neighbour stays on the pelvis.
  const clothPositions=new Map(),neighbors=new Map();
  const positionKeys=Array.from({length:positions.length/3},(_,index)=>Array.from(positions.slice(index*3,index*3+3)).join(','));
  if(profile.cloth) {
    const tan=profile.cloth.tanColor;
    for(const key of positionKeys) {
      const point=key.split(',').map(Number),sample=vertexColors.get(key),rgb=sample.slice(0,3).map(v=>v/sample[3]);
      clothPositions.set(key,region(point,profile.cloth)&&rgb[0]>=tan.minR&&rgb[1]>=tan.minG&&rgb[0]/Math.max(1,rgb[1])<=tan.maxRoverG&&rgb[1]/Math.max(1,rgb[2])>=tan.minGoverB);
    }
    const faces=primitive.getIndices().getArray();
    for(let i=0;i<faces.length;i+=3) for(let a=0;a<3;a++) {
      const key=positionKeys[faces[i+a]],list=neighbors.get(key)??new Set();
      list.add(positionKeys[faces[i+(a+1)%3]]);list.add(positionKeys[faces[i+(a+2)%3]]);neighbors.set(key,list);
    }
    for(let pass=0;pass<4;pass++) {
      const changes=[];
      for(const [key,list] of neighbors) {
        if(!region(key.split(',').map(Number),profile.cloth)) continue;
        const votes=[...list].filter(n=>clothPositions.get(n)).length;
        if(votes/list.size>=.5) changes.push(key);
      }
      for(const key of changes) clothPositions.set(key,true);
    }
  }
  const joints=new Uint8Array(positions.length/3*4),weights=new Float32Array(positions.length/3*4);
  for(let i=0;i<positions.length;i+=3) {
   const p=Array.from(positions.slice(i,i+3)),[x,y,z]=p;
   const cloth=clothPositions.get(p.join(','))??false;
   let rigid=profile.accessories?.find(range=>!(cloth&&range.excludeCloth)&&((range.selection!=='capsule'&&region(p,range))||(range.selection!=='box'&&range.start&&distance(p,range.start,range.end)<=range.radius)));
   const cape=profile.cloak;
   const cloak=cape?smooth(cape.minY-cape.blend,cape.minY+cape.blend,y)*(1-smooth(cape.maxY-cape.blend,cape.maxY+cape.blend,y))*(1-smooth(cape.maxZ-cape.blend,cape.maxZ+cape.blend,z))*(1-smooth(cape.halfWidth-cape.blend,cape.halfWidth+cape.blend,Math.abs(x-cape.centerX))):0;
   const side=x>profile.bodyCenterX?'Left':'Right';
   // Distinguish fingers/weapons outside the torso from hips and legs at the same height.
   const armMask=smooth(profile.bodyHalfWidth-.035,profile.bodyHalfWidth+.035,Math.abs(x-profile.bodyCenterX))*(1-smooth(.80,.90,y))*smooth(profile.armMinY-.04,profile.armMinY+.04,y)*(1-cloak)*(cloth?0:1);
   const legMask=(1-smooth(profile.hipY-.045,profile.hipY+.045,y))*(1-armMask)*(1-cloak)*(cloth?0:1);
   const candidates=[];
   if(rigid) candidates.push([indices[rigid.bone],1]);
   else for(const name of names) {
    let mask=1;
    if(/Arm|Hand/.test(name)) mask=armMask*(name.startsWith(side)?1:0);
    else if(/Thigh|Shin|Foot/.test(name)) mask=legMask*(name.startsWith(side)?1:0);
    else mask=1-armMask-legMask;
    if(mask<.00001) continue;
    const a=profile.joints[name],b=profile.joints[tip[name]]??profile.ends[tip[name].replace('End','')];
    const dist=distance(p,a,b);
    candidates.push([indices[name],mask/Math.pow(.025+dist,4)]);
   }
   candidates.sort((a,b)=>b[1]-a[1]);const best=candidates.slice(0,4),sum=best.reduce((a,v)=>a+v[1],0);
   if(!sum) throw new Error(`No weights ${id} ${p}`);
   for(let j=0;j<best.length;j++){joints[i/3*4+j]=best[j][0];weights[i/3*4+j]=best[j][1]/sum;}
   const dominant=names[best[0][0]];assignmentCounts[dominant]=(assignmentCounts[dominant]??0)+1;
  }
  // Smooth on the welded triangle surface, not across nearby but disconnected
  // fingers/robes. This regularizes anatomical boundaries without opening UV seams.
  const keys=[...new Set(positionKeys)],keyIndex=new Map(keys.map((key,index)=>[key,index]));
  const adjacency=Array.from({length:keys.length},()=>new Set());
  const faces=primitive.getIndices().getArray();
  for(let i=0;i<faces.length;i+=3) for(let a=0;a<3;a++) {
    const one=keyIndex.get(positionKeys[faces[i+a]]),two=keyIndex.get(positionKeys[faces[i+(a+1)%3]]);
    adjacency[one].add(two);adjacency[two].add(one);
  }
  let dense=new Float64Array(keys.length*names.length);
  for(let vertex=0;vertex<positionKeys.length;vertex++) {
    const group=keyIndex.get(positionKeys[vertex]);
    for(let j=0;j<4;j++) dense[group*names.length+joints[vertex*4+j]]=weights[vertex*4+j];
  }
  for(let pass=0;pass<(profile.smoothingPasses??10);pass++) {
    const next=new Float64Array(dense);
    for(let group=0;group<keys.length;group++) {
      const neighbors=[...adjacency[group]];if(!neighbors.length) continue;
      for(let bone=0;bone<names.length;bone++) {
        let sum=0;for(const neighbor of neighbors)sum+=dense[neighbor*names.length+bone];
        next[group*names.length+bone]=dense[group*names.length+bone]*.45+sum/neighbors.length*.55;
      }
    }
    dense=next;
  }
  for(let vertex=0;vertex<positionKeys.length;vertex++) {
    const group=keyIndex.get(positionKeys[vertex]);
    const sorted=names.map((_,bone)=>[bone,dense[group*names.length+bone]]).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((n,p)=>n+p[1],0);
    for(let j=0;j<4;j++){weights[vertex*4+j]=sorted[j][1]/sum;joints[vertex*4+j]=weights[vertex*4+j]>0?sorted[j][0]:0;}
  }
  primitive.setAttribute('JOINTS_0',doc.createAccessor('Joints').setType('VEC4').setArray(joints).setBuffer(buffer));
  primitive.setAttribute('WEIGHTS_0',doc.createAccessor('Weights').setType('VEC4').setArray(weights).setBuffer(buffer));
 }
 // Three in-place clips. The game controls map movement; clips move bones only.
 const flavor=id==='feral-ghoul'?'feral':id==='undead-knight'?'knight':'hollow';
 for(const clip of ['Walk','Run','Attack']) {
  const duration=clip==='Walk'?(flavor==='knight'?1.30:1.06):clip==='Run'?(flavor==='feral'?.60:.74):(flavor==='knight'?.86:flavor==='feral'?.58:.72);
  const samples=33,times=new Float32Array(Array.from({length:samples},(_,i)=>i*duration/(samples-1)));
  const animation=doc.createAnimation(clip).setExtras({loop:clip!=='Attack',inPlace:true});
  const input=doc.createAccessor(`${clip}-time`).setType('SCALAR').setArray(times).setBuffer(buffer);
  const rotations=Object.fromEntries(names.map(name=>[name,[]])),translation=[];
  for(let frame=0;frame<samples;frame++) {
   const t=frame/(samples-1),phase=t*Math.PI*2,s=Math.sin(phase),c=Math.cos(phase),run=clip==='Run',attack=clip==='Attack';
   const pose=Object.fromEntries(names.map(name=>[name,[0,0,0]]));
   let lift=0,lean=0;
   if(!attack) {
    const stride=(run?.56:.30)*(flavor==='knight'?.8:1),arm=(run?.48:.25)*(flavor==='feral'?1.15:1);
    pose.LeftThigh=[-s*stride,0,0];pose.RightThigh=[s*stride,0,0];
    pose.LeftShin=[Math.max(0,-s)*(run?.78:.38),0,0];pose.RightShin=[Math.max(0,s)*(run?.78:.38),0,0];
    pose.LeftFoot=[s*stride*.35-Math.max(0,-s)*.14,0,0];pose.RightFoot=[-s*stride*.35-Math.max(0,s)*.14,0,0];
    pose.LeftUpperArm=[s*arm,0,flavor==='feral'?-.08:0];pose.RightUpperArm=[-s*arm,0,flavor==='feral'?.08:0];
    pose.LeftForeArm=[-(run?.45:.15)-Math.max(0,-s)*.15,0,0];pose.RightForeArm=[-(run?.45:.15)-Math.max(0,s)*.15,0,0];
    pose.Hips=[0,s*.045,s*(run?.028:.018)];pose.Chest=[run?.06:.018,-s*.055,-s*.018];pose.Head=[0,s*.025,0];
    lift=(1-Math.cos(phase*2))*(run?.009:.0045);lean=flavor==='feral'?(run?.12:.06):(run?.045:0);
   } else {
    // Wind-up -> fast strike -> recovery, all joints return to the rest pose.
    const wind=smooth(0,.30,t)*(1-smooth(.30,.48,t));
    const strike=smooth(.25,.46,t)*(1-smooth(.50,1,t));
    if(flavor==='feral') {
      pose.LeftUpperArm=[-wind*.95-strike*.85,-wind*.25,-wind*.25];pose.RightUpperArm=[-wind*.90-strike*.95,wind*.30,wind*.25];
      pose.LeftForeArm=[-wind*.60-strike*.35,0,0];pose.RightForeArm=[-wind*.70-strike*.30,0,0];
      pose.Chest=[strike*.22,-wind*.18+strike*.14,0];pose.Hips=[0,0,0];
    } else {
      pose.RightUpperArm=[-wind*1.10-strike*.75,wind*.15,wind*.12];pose.RightForeArm=[-wind*.55+strike*.18,0,0];pose.RightHand=[strike*.15,0,0];
      pose.LeftUpperArm=[-wind*.25-strike*.20,0,-wind*.08];pose.LeftForeArm=[-wind*.25,0,0];
      pose.Chest=[strike*.12,-wind*.35+strike*.28,0];pose.Hips=[0,-wind*.09+strike*.08,0];
    }
    pose.Head=[-strike*.08,0,0];lean=strike*.055;
   }
   pose.Spine[0]+=lean;
   for(const name of names) rotations[name].push(...quat(...pose[name]));
   const hips=profile.joints.Hips;translation.push(hips[0],hips[1]+lift,hips[2]);
  }
  function channel(name,targetPath,array,type) {
   const output=doc.createAccessor(`${clip}-${name}-${targetPath}`).setType(type).setArray(new Float32Array(array)).setBuffer(buffer);
   const sampler=doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
   animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes[name]).setTargetPath(targetPath).setSampler(sampler));
  }
  for(const name of names) channel(name,'rotation',rotations[name],'VEC4');
  channel('Hips','translation',translation,'VEC3');
 }
 const bytes=await io.writeBinary(doc),validation=await validateBytes(bytes,{uri:`${id}.glb`,maxIssues:100});
 const report={id,staticSha256:createHash('sha256').update(original).digest('hex'),runtimeSha256:createHash('sha256').update(bytes).digest('hex'),runtimeBytes:bytes.length,vertices:mesh.listPrimitives().reduce((n,p)=>n+p.getAttribute('POSITION').getCount(),0),triangles:mesh.listPrimitives().reduce((n,p)=>n+p.getIndices().getCount()/3,0),joints:names.length,skins:doc.getRoot().listSkins().length,clips:doc.getRoot().listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().length,duration:a.listSamplers()[0].getInput().getMax([])[0]})),canonical:{sourceMatrix:matrix,sourceYaw,center,height,front:[0,0,1]},assignmentCounts,validation};
 await writeFile(path.join(directory,`${id}-rig.json`),JSON.stringify(report,null,2)+'\n');
 if(validation.issues.numErrors||validation.issues.numWarnings) {console.log(validation.issues);throw new Error(`Invalid rig ${id}`);}
 await writeFile(target,bytes);
 console.log(JSON.stringify({id,bytes:bytes.length,joints:names.length,clips:report.clips,validation:validation.issues}));
}
