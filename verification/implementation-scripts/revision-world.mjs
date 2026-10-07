import fs from 'node:fs';
const edit=(p,changes)=>{let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');for(const[a,b]of changes){if(!s.includes(a))throw Error(p+' '+a.slice(0,60));s=s.replace(a,b)}fs.writeFileSync(p,s)};
edit('client/src/world/World.ts',[
 ['  readonly shelterCrystal: Mesh;', '  private readonly campfire: Mesh;\n  readonly shelterCrystal: Mesh;'],
 ['    this.buildShelter();', `    this.buildShelter();
    const fireBase=CreateCylinder('campfire-brazier',{diameter:1.1,height:.4,tessellation:12},scene);fireBase.position.set(-2,.2,7);fireBase.material=this.occupiedPad;fireBase.isPickable=false;fireBase.metadata={dynamicDetail:true};
    this.campfire=CreateSphere('campfire-flame',{diameter:.6,segments:8},scene);this.campfire.position.set(-2,.65,7);this.campfire.scaling.y=1.5;this.campfire.material=this.material('campfire-embers','#ffad56','#df7431');this.campfire.isPickable=false;this.campfire.metadata={dynamicDetail:true};this.campfire.setEnabled(false);`],
 ['buildings: readonly Building[] = []): void', 'buildings: readonly Building[] = [], campfireEnabled = false): void'],
 ['    const', '    const'],
]);
let world=fs.readFileSync('client/src/world/World.ts','utf8');
world=world.replace('    this.shelterCrystal.rotation.y', '    this.campfire.setEnabled(campfireEnabled);this.campfire.scaling.y=1.3+Math.sin(time*8)*.2;\n    this.shelterCrystal.rotation.y');
world=world.replace('mesh.isPickable ||','mesh.metadata?.dynamicDetail || mesh.isPickable ||');
fs.writeFileSync('client/src/world/World.ts',world);
edit('client/src/ui/Hud.ts',[
 ['2:30 remaining','3:00 remaining'],
 ['      <div class="hit-marker"', '      <div id="explorer-readout" class="explorer-readout"></div><div id="ability-readout" class="ability-readout"></div>\n      <div class="hit-marker"'],
 ["for (const id of ['end-statistics'", "for (const id of ['explorer-readout','ability-readout','end-statistics'"],
 ['<kbd>N</kbd> Umiejętności</span>', '<kbd>N</kbd> Umiejętności</span><span><kbd>E</kbd> Depozyt</span>'],
]);
