import { CreateBox, Mesh, StandardMaterial, Color3, Scene } from '../rendering/babylon';
import { ARENA_GATES } from './ArenaLayout';
/** The visible gate and player collider share the exact saved arena boundary. */
export class ArenaView {
 private readonly gates:Mesh[]=[];
 constructor(scene:Scene){
  const seal=new StandardMaterial('arena-seal',scene);seal.diffuseColor=Color3.FromHexString('#263f59');seal.emissiveColor=Color3.FromHexString('#144f78');seal.alpha=.58;
  for(const [index,gate]of ARENA_GATES.entries()){
   const wall=CreateBox('final-arena-gate-'+index,{width:gate.width,height:gate.height,depth:gate.depth},scene);
   wall.position.set(gate.x,gate.height/2,gate.z);wall.material=seal;wall.checkCollisions=true;wall.isPickable=true;wall.metadata={arenaGate:true};wall.setEnabled(false);this.gates.push(wall);
  }
 }
 update(active:boolean):void{for(const gate of this.gates)gate.setEnabled(active);}
 dispose():void{for(const gate of this.gates)gate.dispose();}
}
