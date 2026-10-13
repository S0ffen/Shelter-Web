import { Color3, CreateBox, CreateCylinder, CreatePolyhedron, CreateSphere, CreateTorus, Mesh, StandardMaterial, Vector3, VertexData } from './babylon';
import type { PBRMaterial, Scene, TransformNode } from './babylon';
import { surfaceMaterial, surfaceMaterialInstance } from './SurfaceMaterials';
import { environmentMaterial, environmentMaterialInstance, tileArtBox, tileRoofSlope } from './EnvironmentMaterials';
import type { ArtMaterial } from './EnvironmentMaterials';

/** Visual geometry only. Gameplay volumes and pick targets belong to their existing views. */
export class FantasyArt {
  readonly stone: PBRMaterial;
  readonly timber: PBRMaterial;
  readonly plaster: PBRMaterial;
  readonly slate: PBRMaterial;
  readonly iron: StandardMaterial;
  readonly bronze: StandardMaterial;
  readonly dark: StandardMaterial;
  readonly rune: StandardMaterial;
  readonly ember: StandardMaterial;
  readonly moss: StandardMaterial;

  constructor(readonly scene: Scene, private readonly parent?: TransformNode, private readonly override?: StandardMaterial) {
    this.stone = environmentMaterial(scene, 'stone');
    this.timber = this.shared('old-oak', () => { const m=environmentMaterialInstance(scene,'wood','old-oak'); m.albedoColor.set(.94,.92,.88); return m; });
    this.plaster = this.shared('lime-plaster', () => { const m=environmentMaterialInstance(scene,'stone','lime-plaster'); m.albedoColor.set(1,.97,.91); return m; });
    this.slate = environmentMaterial(scene, 'slate');
    this.iron = surfaceMaterial(scene, 'armor');
    this.bronze = this.shared('old-bronze', () => { const m=surfaceMaterialInstance(scene,'metal','old-bronze'); m.diffuseColor.set(.66,.53,.3); return m; });
    this.dark = this.flat('deep-recess', '#111914');
    this.rune = this.flat('muted-ward-rune', '#7ca58e', '#385f52');
    this.ember = this.flat('warm-lantern-glass', '#f1bf72', '#bb6c30');
    this.moss = this.flat('creeping-moss', '#303a2c');
  }

  private shared<T extends ArtMaterial>(name: string, make: () => T): T {
    return this.scene.getMaterialByName(name) as T ?? make();
  }
  flat(name: string, hex: string, glow?: string): StandardMaterial {
    return this.shared(name, () => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = Color3.FromHexString(hex); m.specularColor.set(.03,.03,.03);
      if(glow) m.emissiveColor = Color3.FromHexString(glow);
      return m;
    });
  }
  finish(mesh: Mesh, mat: ArtMaterial, x: number, y: number, z: number): Mesh {
    mesh.parent = this.parent ?? null;
    mesh.position.set(x,y,z); mesh.material=this.override ?? mat;
    mesh.isPickable=false; mesh.checkCollisions=false; mesh.receiveShadows=true;
    mesh.metadata={artOnly:true};
    return mesh;
  }
  box(name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: ArtMaterial=this.stone): Mesh {
    const mesh=this.finish(CreateBox(name,{width:w,height:h,depth:d},this.scene),mat,x,y,z);
    if(!this.override) tileArtBox(mesh,w,h,d,mat);
    return mesh;
  }
  cylinder(name: string, diameter: number, height: number, x: number, y: number, z: number, mat: ArtMaterial=this.stone, top=diameter, sides=8): Mesh {
    return this.finish(CreateCylinder(name,{diameterBottom:diameter,diameterTop:top,height,tessellation:sides},this.scene),mat,x,y,z);
  }
  sphere(name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: ArtMaterial=this.stone): Mesh {
    const mesh=this.finish(CreateSphere(name,{diameter:1,segments:8},this.scene),mat,x,y,z); mesh.scaling.set(w,h,d); return mesh;
  }
  crystal(name: string, size: number, x: number, y: number, z: number, mat: ArtMaterial=this.rune): Mesh {
    const mesh=this.finish(CreatePolyhedron(name,{type:1,size},this.scene),mat,x,y,z); mesh.scaling.set(.8,1.75,.8); return mesh;
  }
  beam(name: string, a: Vector3, b: Vector3, width: number, mat: ArtMaterial=this.timber): Mesh {
    const mid=a.add(b).scale(.5);
    const mesh=this.box(name,width,width,Vector3.Distance(a,b),mid.x,mid.y,mid.z,mat);
    mesh.lookAt(b); return mesh;
  }
  ring(name: string, diameter: number, x: number, y: number, z: number, thickness=.035, mat: ArtMaterial=this.bronze): Mesh {
    return this.finish(CreateTorus(name,{diameter,thickness,tessellation:24},this.scene),mat,x,y,z);
  }
  runeGlyph(name: string, x: number, y: number, z: number, size: number, mat: ArtMaterial=this.rune, rotation=0): void {
    const point=(dx:number,dy:number)=>new Vector3(x+dx*Math.cos(rotation),y+dy,z+dx*Math.sin(rotation));
    for(const [a,b] of [[[-.3,0],[0,.5]],[[0,.5],[.3,0]],[[0,.5],[0,-.5]],[[0,-.2],[.3,.05]]] as const)
      this.beam(name,point(a[0]*size,a[1]*size),point(b[0]*size,b[1]*size),size*.055,mat);
  }
  /** Gabled slate roof inside the approved footprint; only the eave extends by 8 cm overhead. */
  roof(name: string, width: number, depth: number, x: number, eave: number, z: number, rise: number, gable: ArtMaterial=this.plaster, damaged=false): void {
    const slope=Math.hypot(width/2,rise),angle=Math.atan2(rise,width/2);
    for(const side of [-1,1]) {
      const roofDepth=damaged&&side===1 ? depth*.68 : depth;
      const roofZ=damaged&&side===1 ? z-depth*.16 : z;
      const mesh=this.box(name+'-slates',slope+.08,.14,roofDepth+.16,x+side*width/4,eave+rise/2,roofZ,this.slate);
      mesh.rotation.z=-side*angle;
      if (!this.override) tileRoofSlope(mesh,side,roofZ);
      this.box(name+'-eave',.14,.18,depth+.16,x+side*width/2,eave,z,this.timber);
    }
    const vertices=new VertexData();
    vertices.positions=[-width/2,0,-depth/2,width/2,0,-depth/2,0,rise,-depth/2,-width/2,0,depth/2,width/2,0,depth/2,0,rise,depth/2];
    vertices.indices=[0,1,2,3,5,4]; vertices.normals=[0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1];
    vertices.uvs=[0,0,width/2,0,width/4,rise/2,0,0,width/2,0,width/4,rise/2];
    const triangle=new Mesh(name+'-gable',this.scene); vertices.applyToMesh(triangle); this.finish(triangle,gable,x,eave,z);
    for(const side of [-1,1]) {
      this.beam(name+'-gable-frame',new Vector3(x-width/2,eave,z+side*(depth/2+.04)),new Vector3(x,eave+rise,z+side*(depth/2+.04)),.16);
      this.beam(name+'-gable-frame',new Vector3(x+width/2,eave,z+side*(depth/2+.04)),new Vector3(x,eave+rise,z+side*(depth/2+.04)),.16);
      this.box(name+'-king-post',.14,rise,.15,x,eave+rise/2,z+side*(depth/2+.05),this.timber);
    }
    this.box(name+'-ridge',.15,.15,depth+.16,x,eave+rise,z,this.timber);
    if(damaged) for(let dx=0;dx<width/2;dx+=.65)
      this.beam(name+'-exposed-rafter',new Vector3(x,eave+rise,z+depth*.39),new Vector3(x+dx,eave+rise-rise*dx/(width/2),z+depth*.39),.09);
  }
  lantern(name: string, x: number, y: number, z: number): void {
    this.box(name+'-glass',.18,.28,.18,x,y,z,this.ember);
    for(const side of [-1,1]) {
      this.box(name+'-rim',.29,.06,.29,x,y+side*.17,z,this.iron);
      this.box(name+'-cage',.025,.33,.025,x+side*.115,y,z-.115,this.iron);
      this.box(name+'-cage',.025,.33,.025,x+side*.115,y,z+.115,this.iron);
    }
    this.cylinder(name+'-cap',.35,.16,x,y+.27,z,this.iron,0,4);
  }
  barrel(name: string, x: number, y: number, z: number, size=1): void {
    this.cylinder(name,.6*size,.78*size,x,y+.4*size,z,this.timber,.53*size,10);
    for(const height of [.12,.66]) this.ring(name+'-hoop',.57*size,x,y+height*size,z,.045*size,this.iron);
  }
}
