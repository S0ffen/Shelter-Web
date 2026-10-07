import fs from 'node:fs';
let p='client/src/domain/SkillTree.ts',s=fs.readFileSync(p,'utf8');s=s.replace('SKILL_BRANCHES.flatMap(branch => settings.branches[branch]) as Perk[]','SKILL_BRANCHES.flatMap<Perk>(branch => settings.branches[branch] as Perk[])');fs.writeFileSync(p,s);
p='client/src/ui/Hud.ts';s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');s=s.replace('${sim.player.hp} <em>','${Math.ceil(sim.player.hp)} <em>');s=s.replace('night || sim.phase !== \'playing\' || !inBase(sim.player.position)',"sim.phase !== 'playing'");s=s.replace("boss.kind === 'overlord' ? 'CEL KOŃCOWY RUNU'", "boss.kind === 'overlord' ? (boss.hp/boss.maxHp<=.5 ? 'ENRAGED · WIĘKSZA SZYBKOŚĆ' : 'UNIKAJ KRĘGÓW · STRZEŻ SIĘ PRZYWOŁAŃ')");
const token="    this.nodes['skill-count'].textContent";
const i=s.indexOf(token);if(i<0)throw Error('HUD skills');
s=s.slice(0,i)+`    const explorer=sim.skills.bonuses.explorer;
    const nearest=(kind:string)=>sim.resourceNodes.filter(n=>!n.isDestroyed&&n.resourceType===kind).sort((a,b)=>Math.hypot(a.position.x-sim.player.position.x,a.position.z-sim.player.position.z)-Math.hypot(b.position.x-sim.player.position.x,b.position.z-sim.player.position.z))[0];
    const bearing=(p:{x:number,z:number})=>{const angle=Math.atan2(p.x-sim.player.position.x,p.z-sim.player.position.z)-sim.player.yaw;return ['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(angle/(Math.PI/4))+8)%8];};
    const scouting:string[]=[];
    if(explorer)for(const kind of explorer>=2?['wood','iron']:['wood']){const node=nearest(kind);if(node){const d=Math.hypot(node.position.x-sim.player.position.x,node.position.z-sim.player.position.z);if(d<=32)scouting.push(bearing(node.position)+' '+kind.toUpperCase()+' '+Math.ceil(d)+' m');}}
    if(explorer>=3){const enemy=sim.livingZombies.sort((a,b)=>Math.hypot(a.position.x-sim.player.position.x,a.position.z-sim.player.position.z)-Math.hypot(b.position.x-sim.player.position.x,b.position.z-sim.player.position.z))[0];if(enemy){const d=Math.hypot(enemy.position.x-sim.player.position.x,enemy.position.z-sim.player.position.z);if(d<20)scouting.push(bearing(enemy.position)+' ZOMBIE '+Math.ceil(d)+' m');}}
    this.nodes['explorer-readout'].textContent=scouting.join(' · ');
    this.nodes['ability-readout'].textContent=(['barrage','cloak','demolition'] as const).filter(key=>sim.skills.bonuses[key]).map((key)=>({barrage:'5 BARRAGE',cloak:'6 CLOAK',demolition:'7 WRECKING'}[key])+' · '+(sim.abilities[(key+'Cooldown') as 'barrageCooldown'|'cloakCooldown'|'demolitionCooldown']>0?Math.ceil(sim.abilities[(key+'Cooldown') as 'barrageCooldown'|'cloakCooldown'|'demolitionCooldown'])+'s':'READY')).join('   |   ');
`+s.slice(i);fs.writeFileSync(p,s);
p='shared/skills.json';const skills=JSON.parse(fs.readFileSync(p));skills.branches.engineer.find(p=>p.id==='auto-repair').effect+=' (2 Wood + 1 Iron/s)';fs.writeFileSync(p,JSON.stringify(skills,null,2)+'\n');
