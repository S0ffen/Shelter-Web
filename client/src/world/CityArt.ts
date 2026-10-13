import { inBase } from './ShelterLayout';
import { Vector3 } from '../rendering/babylon';
import type { Scene } from '../rendering/babylon';
import type { ArtMaterial } from '../rendering/EnvironmentMaterials';
import { FantasyArt } from '../rendering/FantasyArt';
import { CITY_RUINS, RISK_AREAS, referenceFloorOpen } from './WorldLayout';
import type { Block } from './WorldLayout';

/** Dresses the raster lots; it never writes to the level or creates collision volumes. */
export class CityArt {
  readonly art: FantasyArt;
  private readonly group: number[];
  constructor(scene: Scene) {
    this.art=new FantasyArt(scene);
    this.group=CITY_RUINS.map((_,i)=>i);
    // Adjacent strips of one irregular footprint share a wall height and palette.
    const root=(i:number):number=>this.group[i]===i?i:(this.group[i]=root(this.group[i]));
    for(let i=0;i<CITY_RUINS.length;i++)for(let j=0;j<i;j++) {
      const a=CITY_RUINS[i],b=CITY_RUINS[j],dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);
      if((Math.abs(dx-(a.width+b.width)/2)<.015&&dz<(a.depth+b.depth)/2-.05)||
        (Math.abs(dz-(a.depth+b.depth)/2)<.015&&dx<(a.width+b.width)/2-.05)) this.group[root(i)]=root(j);
    }
    this.group=this.group.map((_,i)=>root(i));
  }
  build(block: Block, index: number): void {
    const {x,z,width:w,depth:d}=block,a=this.art,seed=this.group[index];
    const h=[5.5,6.6,8.2,7.4,9.1][seed%5],upper=seed%3!==0;
    a.box('medieval-stone-plinth',w,.45,d,x,.225,z);
    a.box('medieval-ground-storey',w,upper?3.05:h-.45,d,x,upper?1.975:(h+.45)/2,z);
    if(upper) a.box('medieval-lime-upper-storey',w,h-3.5,d,x,(h+3.5)/2,z,a.plaster);
    // Narrow staircase fragments stay masonry, while substantial lots receive roofs.
    if(w>=2.1&&d>=2.1) {
      const rise=Math.min(3.5,Math.max(1.45,w*.24));
      a.roof('medieval-house-'+index,w,d,x,h,z,rise,upper?a.plaster:a.stone,seed%7===0);
      if(index%3===0&&w>4&&d>3) {
        a.box('medieval-chimney',.75,rise+1.4,.85,x+w*.23,h+rise/2+.7,z+d*.18);
        a.box('chimney-coping',.94,.16,1.04,x+w*.23,h+rise+1.42,z+d*.18,a.iron);
      }
      if(seed%11===0&&Math.min(w,d)>4) {
        a.cylinder('roof-watch-turret',2,3.4,x,h+1.7,z,a.stone,1.85);
        a.cylinder('roof-watch-spire',2.5,3.2,x,h+5,z,a.slate,0);
        a.box('spire-finial',.1,.9,.1,x,h+7,z,a.bronze);
      }
    } else a.box('broken-wall-coping',w,.16,d,x,h+.08,z,a.slate);
    this.facade(block,h,index,upper);
  }
  boundary(block: Block): void {
    const a=this.art,{x,z,width:w,depth:d,height:h}=block;
    // Original outside-map solids remain intact. Render their street-facing rampart only,
    // rather than the enormous flat tops of the raster's exterior filler rectangles.
    for(const vertical of [false,true])for(const side of [-1,1]) {
      const length=vertical?d:w,steps=Math.max(1,Math.round(length/.7)),span=length/steps;
      for(let i=0;i<steps;i++) {
        const along=-length/2+(i+.5)*span;
        const px=x+(vertical?side*(w/2+.2):along),pz=z+(vertical?along:side*(d/2+.2));
        // Expanded base edges are continuous and can lie between the raster's cell centres.
        const baseFace=inBase({x:px,z:pz});
        if(!baseFace&&!referenceFloorOpen({x:px,z:pz}))continue;
        const thickness=Math.min(.6,vertical?w:d);
        const faceSpan=span+(baseFace?.12:0); // Cover sub-cell corner seams after the base cuts.
        const wx=x+(vertical?side*(w/2-thickness/2):along),wz=z+(vertical?along:side*(d/2-thickness/2));
        a.box('ancient-city-rampart',vertical?thickness:faceSpan,h,vertical?faceSpan:thickness,wx,h/2,wz);
        if(i%3===1)a.box('broken-rampart-merlon',vertical?thickness:span,.65,vertical?span:thickness,wx,h+.325,wz);
      }
    }
  }
  barricade(block:Block&{id:string}):void {
    const a=this.art,{x,z,width:w,depth:d,height:h}=block;
    // Solid demolition rubble and crossed oak beams occupy the exact navigation collider.
    a.box('barricade-rubble-'+block.id,w,.75,d,x,.375,z,a.stone);
    for(let i=0;i<6;i++){
      const px=x-w/2+.3+i*(w-.6)/5;
      a.box('barricade-oak-stake',.32,h-.3,d*.45,px,(h-.3)/2+.3,z,a.timber).rotation.z=(i%2?1:-1)*.06;
      a.box('barricade-stake-cap',.35,.18,d*.5,px,h-.07,z,a.iron);
    }
    for(const face of [-1,1]){
      const bz=z+face*(d/2-.13);
      for(const y of [1.05,2.25])a.box('barricade-oak-crossbar',w,.27,.22,x,y,bz,a.timber);
      a.beam('barricade-diagonal-brace',new Vector3(x-w/2+.2,.55,bz),new Vector3(x+w/2-.2,h-.2,bz),.2,a.timber);
      a.beam('barricade-diagonal-brace',new Vector3(x+w/2-.2,.55,bz),new Vector3(x-w/2+.2,h-.2,bz),.2,a.timber);
    }
  }
  private facade(block: Block, height: number, index: number, upper: boolean): void {
    const a=this.art,{x,z,width:w,depth:d}=block;
    for(const vertical of [false,true])for(const side of [-1,1]) {
      const length=vertical?d:w,edge=side*(vertical?w:d)/2;
      const at=(along:number,y:number,offset=0)=>new Vector3(x+(vertical?edge+side*offset:along),y,z+(vertical?along:edge+side*offset));
      const exposed=(along:number)=>{const p=at(along,0,.22);return referenceFloorOpen({x:p.x,z:p.z});};
      const panel=(name:string,ww:number,hh:number,dd:number,along:number,y:number,offset:number,mat:ArtMaterial=a.timber)=>{
        const p=at(along,y,offset);return a.box(name,vertical?dd:ww,hh,vertical?ww:dd,p.x,p.y,p.z,mat);
      };
      if(length<1.4)continue;
      for(let along=-length/2+.3;along<length/2;along+=2.8)if(exposed(along)) {
        panel('oak-upright',.17,height-.5,.1,along,(height+.5)/2,.025);
        if(upper) panel('oak-floor-rail',Math.min(2.8,length/2-along),.19,.13,along+Math.min(2.8,length/2-along)/2,3.5,.025);
      }
      for(let along=-length/2+1.4;along<length/2-.65;along+=2.8)if(exposed(along)) {
        for(const y of (height>6.4?[2.15,5.05]:[2.15,4.3])) {
          panel('deep-medieval-window',.75,1.08,.04,along,y,.012,a.dark);
          panel('window-oak-sill',.98,.12,.14,along,y-.57,.045);
          panel('window-oak-lintel',.98,.12,.12,along,y+.57,.035);
          for(const s of [-1,1]) {
            panel('window-frame',.1,1.1,.08,along+s*.43,y,.035);
            const shutter=panel('broken-shutter',.29,1,.07,along+s*.61,y-.02,.05);
            shutter.rotation[vertical?'x':'z']=s*(index%3)*.035;
          }
          if(upper&&y>3.5) {
            const start=at(along-.65,3.65,.08),end=at(along+.65,height-.2,.08);
            a.beam('half-timber-brace',start,end,.12);
          }
        }
        if(index%5===0&&along<0&&length>4) {
          panel('door-recess',1.15,2.15,.04,along,1.075,.015,a.dark);
          panel('oak-door',.92,1.95,.08,along,.975,.025);
          for(const y of [.55,1.45])panel('wrought-door-hinge',.85,.07,.025,along,y,.08,a.iron);
          for(const s of [-1,1])panel('stone-door-jamb',.16,2.3,.14,along+s*.61,1.15,.06,a.stone);
          panel('stone-door-lintel',1.4,.25,.16,along,2.32,.06,a.stone);
          const p=at(along+.9,2.65,.12);a.lantern('street-lantern',p.x,p.y,p.z);
        }
      }
      if(index%6===0&&exposed(0)) {
        panel('wall-moss',Math.min(length,1.9),.3,.02,0,.17,.012,a.moss);
        if(height>7) {
          // A small projecting upper floor is safely above player and enemy travel.
          panel('hanging-bay',Math.min(length,1.6),1.25,.3,0,4.9,.02,a.plaster);
          panel('bay-oak-beam',Math.min(length,1.7),.16,.38,0,4.2,.035);
        }
      }
    }
  }

  private nearestLot(x: number,z: number): Block {
    return CITY_RUINS.filter(b=>Math.min(b.width,b.depth)>3.5).reduce((best,b)=>Math.hypot(b.x-x,b.z-z)<Math.hypot(best.x-x,best.z-z)?b:best);
  }
  landmarks(): void {
    const a=this.art,forge=this.nearestLot(RISK_AREAS.ancientForge.x,RISK_AREAS.ancientForge.z);
    // Landmarks sit on already-solid lots, so neither a route nor a resource is occupied.
    const height=(b:Block)=>[5.5,6.6,8.2,7.4,9.1][this.group[CITY_RUINS.indexOf(b)]%5];
    const fh=height(forge);
    a.box('forge-furnace-house',forge.width,2,forge.depth,forge.x,fh+1,forge.z,a.iron);
    a.cylinder('great-forge-chimney',2.5,9,forge.x,fh+6.5,forge.z,a.stone,2);
    a.cylinder('forge-chimney-mouth',2.8,.4,forge.x,fh+11.1,forge.z,a.iron);
    a.cylinder('forge-embers',2,.05,forge.x,fh+11.33,forge.z,a.ember);
    const chapel=this.nearestLot(RISK_AREAS.graveyard.x,RISK_AREAS.graveyard.z);
    const towerX=chapel.x+chapel.width*.25;
    const ch=height(chapel);
    a.box('catacomb-chapel-belfry',3.1,8,3.1,towerX,ch+4,chapel.z);
    for(const s of [-1,1]) a.box('belfry-open-arch',1,2,.04,towerX,ch+6.2,chapel.z+s*1.57,a.dark);
    a.cylinder('catacomb-chapel-spire',4.3,5,towerX,ch+10.4,chapel.z,a.slate,0,4).rotation.y=Math.PI/4;
    a.box('chapel-broken-cross',.18,1.5,.18,towerX,ch+13.5,chapel.z,a.bronze);
    a.box('chapel-crossbar',.8,.16,.16,towerX,ch+13.8,chapel.z,a.bronze);
    const square=this.nearestLot(RISK_AREAS.centralSquare.x,RISK_AREAS.centralSquare.z);
    const sh=height(square)+Math.min(3.5,Math.max(1.45,square.width*.24));
    a.cylinder('square-statue-plinth',2.2,1,square.x,sh+.4,square.z,a.stone);
    a.cylinder('forgotten-king-robes',1.35,3,square.x,sh+2.4,square.z,a.stone,.85);
    a.sphere('forgotten-king-head',.7,.9,.7,square.x,sh+4.25,square.z,a.stone);
    a.beam('statue-raised-arm',new Vector3(square.x+.35,sh+3.2,square.z),new Vector3(square.x+1.1,sh+4,square.z),.25,a.stone);
    a.box('statue-sword',.16,2.6,.16,square.x+1.1,sh+4.2,square.z,a.iron);
    const citadel=this.nearestLot(58,116);
    for(const side of [-1,1]) {
      const tx=citadel.x+side*Math.min(citadel.width*.3,4.5);
      const gh=height(citadel);
      a.cylinder('citadel-gate-tower',2.8,6,tx,gh+3,citadel.z,a.stone);
      a.cylinder('citadel-gate-spire',3.3,4.5,tx,gh+8.2,citadel.z,a.slate,0);
      a.runeGlyph('citadel-curse-sigil',tx,gh+3.8,citadel.z-citadel.depth/2-.04,1.3,a.flat('curse-violet','#685975','#30233c'));
    }
    a.box('citadel-gate-crown',Math.min(citadel.width,12),.4,1,citadel.x,height(citadel)+5.1,citadel.z,a.stone);
    this.props();
  }
  private props(): void {
    const a=this.art;
    for(const [i,b] of CITY_RUINS.entries()) {
      if(Math.min(b.width,b.depth)<3.5||i%3!==0)continue;
      // Clutter hugs existing walls; its centre cannot be entered through the old collider.
      const x=b.x-b.width/2+.65,z=b.z-b.depth/2-.035;
      if(!referenceFloorOpen({x,z:z-.25}))continue;
      if(i%2===0) {
        a.barrel('abandoned-barrel',x,0,z,.9);
        a.box('merchant-crate',.7,.65,.7,x+.85,.325,z,a.timber);
      } else {
        a.cylinder('dead-tree-trunk',.4,4.6,x,2.3,z,a.timber,.16,6).rotation.z=.12;
        for(const side of [-1,1]) a.beam('dead-tree-limb',new Vector3(x,2.2,z),new Vector3(x+side*.45,4.3,z+.24),.15);
        a.beam('dead-tree-limb',new Vector3(x,3,z),new Vector3(x+.35,4.6,z-.35),.12);
      }
      if(i%5===0) {
        a.crystal('curse-crack-crystal',.23,x+.3,.55,z,a.flat('curse-violet','#685975','#30233c'));
        a.runeGlyph('faded-ritual-mark',x+1.2,1.3,b.z-b.depth/2-.015,.6,a.moss);
      }
      if(b.width>5) {
        // Hanging shop signs and their brackets are overhead, clear of walking height.
        const signX=b.x+b.width*.21,signZ=b.z-b.depth/2-.22;
        a.beam('shop-sign-bracket',new Vector3(signX,3.3,signZ+.22),new Vector3(signX,3.3,signZ-.45),.075,a.iron);
        a.box('hanging-oak-sign',.7,.6,.08,signX,2.85,signZ-.3,a.timber);
        a.runeGlyph('shop-sign-mark',signX,2.85,signZ-.345,.3,a.bronze);
      }
    }
  }
}
