import fs from 'node:fs';
const update=(p,fn)=>fs.writeFileSync(p,JSON.stringify(fn(JSON.parse(fs.readFileSync(p,'utf8'))),null,2)+'\n');
update('shared/encounters.json',v=>{Object.assign(v.finalBoss,{windup:.7,slamRadius:4.4,attackRange:3.8,resistance:.2,enrageThreshold:.5,enrageSpeed:1.4,enrageCooldown:.75,spellInterval:6,spellWindup:1,spellRadius:3,spellDamage:32,summonInterval:12,minionLimit:6,resetAfter:6});return v});
update('shared/zombies.json',v=>{Object.assign(v.types.overlord,{hp:7800,speed:3.6,damage:42,attackCooldown:1.9});return v});
update('shared/checkpoint.json',v=>({...v,version:12}));
let s=fs.readFileSync('client/src/domain/Simulation.ts','utf8');
const a=s.indexOf('  private updateGuardian('),b=s.indexOf('  purchaseSkill(',a);
if(a<0||b<0)throw Error('boss replacement');
s=s.slice(0,a)+`  private updateBossHazards(dt: number): void {
    for (let i = this.bossHazards.length - 1; i >= 0; i--) {
      const hazard = this.bossHazards[i]; hazard.remaining = Math.max(0,hazard.remaining-dt);
      if (hazard.remaining > 0) continue;
      if (distance(this.player.position,hazard.position) <= hazard.radius) { receivePlayerDamage(this,hazard.damage); this.events.push({type:'player-hit',damage:hazard.damage}); }
      this.events.push({type:'boss-slam',zombieId:'curse-overlord',position:{...hazard.position}}); this.bossHazards.splice(i,1);
    }
  }
  private updateGuardian(zombie: Zombie, dt: number, decide: boolean, obstacles: readonly Footprint[]): void {
    const spec = zombie.kind === 'overlord' ? encounters.finalBoss : encounters.forgeGuardian;
    const final = zombie.kind === 'overlord', enraged = final && zombie.hp / zombie.maxHp <= encounters.finalBoss.enrageThreshold;
    const chase = this.abilities.cloak === 0 && distance(this.player.position,zombie.origin) <= spec.leashRange && distance(zombie.position,this.player.position) <= spec.aggroRange;
    zombie.intent = chase ? 'player' : 'guard';
    if (final) {
      zombie.retreatTimer = chase || this.abilities.cloak > 0 ? 0 : zombie.retreatTimer+dt;
      if (zombie.retreatTimer >= encounters.finalBoss.resetAfter) { zombie.hp=zombie.maxHp; zombie.windup=0; zombie.windupTarget=null; this.bossHazards=[]; this.zombies=this.zombies.filter(z=>!z.id.startsWith('boss-minion-')); zombie.summonCooldown=10; }
      if (chase) {
        zombie.specialCooldown = Math.max(0,zombie.specialCooldown-dt); zombie.summonCooldown = Math.max(0,zombie.summonCooldown-dt);
        if (zombie.specialCooldown === 0 && hasLineOfSight(zombie.position,this.player.position,obstacles)) {
          zombie.specialCooldown=encounters.finalBoss.spellInterval*(enraged?.75:1);
          this.bossHazards.push({id:this.spawner.nextId++,position:{...this.player.position},remaining:encounters.finalBoss.spellWindup,radius:encounters.finalBoss.spellRadius,damage:encounters.finalBoss.spellDamage});
          this.events.push({type:'action-blocked',message:'CURSE OVERLORD · opuść czerwony krąg!'});
        }
        if (zombie.summonCooldown === 0) {
          zombie.summonCooldown=encounters.finalBoss.summonInterval;
          let available=encounters.finalBoss.minionLimit-this.zombies.filter(z=>z.alive&&z.id.startsWith('boss-minion-')).length;
          for (let i=0;i<12&&available>0;i++) {
            const angle=this.spawner.random()*Math.PI*2,point={x:zombie.position.x+Math.sin(angle)*4,z:zombie.position.z+Math.cos(angle)*4};
            if (isBlocked(point,.4,obstacles)||distance(point,this.player.position)<2) continue;
            const minion=new Zombie('boss-minion-'+this.spawner.nextId++,point,'fast'); minion.mode='patrol';this.zombies.push(minion); available--; if(available<=encounters.finalBoss.minionLimit-2)break;
          }
        }
      }
    }
    if (zombie.windup > 0) {
      zombie.windup=Math.max(0,zombie.windup-dt);
      if (zombie.windup===0&&zombie.windupTarget) {
        const target=zombie.windupTarget;this.events.push({type:'boss-slam',zombieId:zombie.id,position:target});
        if (distance(this.player.position,target)<=spec.slamRadius&&hasLineOfSight(zombie.position,this.player.position,obstacles)) { receivePlayerDamage(this,zombie.stats.damage);this.events.push({type:'player-hit',damage:zombie.stats.damage}); }
        zombie.windupTarget=null;
      }
      return;
    }
    if (chase&&distance(zombie.position,this.player.position)<=spec.attackRange&&hasLineOfSight(zombie.position,this.player.position,obstacles)) {
      if (zombie.attackCooldown===0) { zombie.attackCooldown=zombie.stats.attackCooldown*(enraged?encounters.finalBoss.enrageCooldown:1);zombie.windup=spec.windup;zombie.windupTarget={...this.player.position};this.events.push({type:'boss-windup',zombieId:zombie.id,position:{...zombie.windupTarget}}); }
      return;
    }
    const target=chase?this.player.position:zombie.origin;
    if (decide) { zombie.route=this.refreshNavigation().routeTo(zombie.position,target);zombie.routeIndex=0; }
    while(zombie.routeIndex<zombie.route.length-1&&distance(zombie.position,zombie.route[zombie.routeIndex])<.25)zombie.routeIndex++;
    const waypoint=zombie.route[zombie.routeIndex];
    if(waypoint)this.ai.move(zombie,waypoint,dt,obstacles,false,(enraged?encounters.finalBoss.enrageSpeed:1)*(zombie.slow>0?1-this.skills.bonuses.slow:1));
  }
`+s.slice(b);fs.writeFileSync('client/src/domain/Simulation.ts',s);
