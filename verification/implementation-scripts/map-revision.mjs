import fs from 'node:fs';
import ts from '../../client/node_modules/typescript/lib/typescript.js';
const path='client/src/world/World.ts';let code=fs.readFileSync(path,'utf8');
const parsed=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true), cls=parsed.statements.find(ts.isClassDeclaration);
const replacements={
 buildRuin:`private buildRuin(block: Block, index: number): void {
    const {x,z,width,depth,height}=block;
    this.box('city-solid-'+index,width,height,depth,x,height/2,z,this.stone,true);
    this.box('city-roof-'+index,width,.12,depth,x,height+.06,z,this.roof);
    if(width>4&&depth>3){
      this.box('city-window-'+index,1.1,1.5,.035,x,height*.55,z-depth/2-.02,this.dark);
      this.box('city-moss-'+index,Math.min(width,3),.5,.035,x,.5,z-depth/2-.025,this.moss);
    }
  }`,
 decorate:'',landmarks:'',
 highRiskLandmarks:`private highRiskLandmarks(): void {
    const arena=RISK_AREAS.finalArena;
    this.box('citadel-arena-floor',arena.width,.025,arena.depth,arena.x,-.006,arena.z,surfaceMaterial(this.scene,'slate'));
    for(const area of [RISK_AREAS.ancientForge,RISK_AREAS.graveyard,RISK_AREAS.centralSquare,arena]){
      if(typeof document==='undefined')continue;
      const texture=new DynamicTexture('district-sign-'+area.name,{width:1024,height:128},this.scene,false);
      texture.drawText(area.name.toUpperCase(),null,82,'bold 38px sans-serif','#e0c18b','#192321',true);
      const material=this.material('district-sign-'+area.name,'#ffffff');material.diffuseTexture=texture;
      const sign=CreateBox('district-sign',{width:6,height:.75,depth:.03},this.scene);sign.position.set(area.x,3.5,area.z-area.depth/2+2);sign.material=material;sign.isPickable=false;
    }
  }`
};
for(const member of cls.members.slice().reverse()){
 const name=member.name?.getText(parsed);if(Object.hasOwn(replacements,name))code=code.slice(0,member.getFullStart())+'\n  '+replacements[name]+'\n'+code.slice(member.end);
}
code=code.replace('RISK_AREAS, SHELTER_CLEARING, WORLD_BOUNDARIES, WORLD_BOUNDS, GATE_PILLARS, FOREST_TREES','RISK_AREAS, MAP_FLOOR_TILES, WORLD_BOUNDARIES');
const start=code.indexOf("    const ground = this.box('courtyard'");const end=code.indexOf('    this.buildShelter();',start);if(start<0||end<0)throw Error('Ground markers missing');
code=code.slice(0,start)+`    const paving=surfaceMaterial(scene,'paving');
    const parts=MAP_FLOOR_TILES.map((tile,index)=>this.box('map-floor-'+index,tile.width,.12,tile.depth,tile.x,-.08,tile.z,paving));
    const ground=Mesh.MergeMeshes(parts,true,true)!;ground.name='reference-city-floor';ground.isPickable=true;ground.metadata={buildGround:true};ground.receiveShadows=true;
    for(const [index,block]of CITY_RUINS.entries())this.buildRuin(block,index);
    for(const [index,block]of WORLD_BOUNDARIES.entries())this.box('reference-boundary-'+index,block.width,block.height,block.depth,block.x,block.height/2,block.z,this.dark,true);
`+code.slice(end);
code=code.replace('    this.decorate();\n','').replace('    this.landmarks();\n','');fs.writeFileSync(path,code);
const shelter=JSON.parse(fs.readFileSync('shared/shelter.json'));shelter.hall.width=21.6;shelter.hall.depth=9.6;fs.writeFileSync('shared/shelter.json',JSON.stringify(shelter,null,2)+'\n');
const zombies=JSON.parse(fs.readFileSync('shared/zombies.json'));
zombies.types.guardian={...zombies.types.guardian,hp:1800,speed:2.8,label:'Strażnik Kuźni'};
zombies.types.warden={...zombies.types.guardian,hp:2100,speed:2.6,label:'Strażnik Katakumb'};
zombies.types.ravager={hp:4500,speed:5.9,damage:32,shelterDamage:0,attackCooldown:1.25,label:'Rozszalały Kolos'};
zombies.types.overlord={...zombies.types.overlord,hp:16000,speed:5.2,damage:45};fs.writeFileSync('shared/zombies.json',JSON.stringify(zombies,null,2)+'\n');
fs.writeFileSync('shared/checkpoint.json',JSON.stringify({version:13},null,2)+'\n');
