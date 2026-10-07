import fs from 'node:fs';
const edit=(p,changes)=>{let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');for(const[a,b]of changes){if(!s.includes(a))throw Error(p+' '+a.slice(0,75));s=s.replace(a,b)}fs.writeFileSync(p,s)};
edit('client/src/persistence/RunSnapshot.ts', [
 ['SKILL_BRANCHES, skillBonuses','SKILL_BRANCHES, branchSpent, validSkillLevels, skillBonuses'],
 ["export interface RunSnapshot {", "export interface RunSnapshot {\n  abilities: Simulation['abilities'];\n  bossHazards: Simulation['bossHazards'];"],
 ['windup: number; windupTarget:', 'specialCooldown:number; summonCooldown:number; retreatTimer:number; slow:number; windup: number; windupTarget:'],
 ["    encounters: { ...sim.encounters },", "    encounters: { ...sim.encounters },\n    abilities: sim.abilities, bossHazards:sim.bossHazards,"],
 ['windup: zombie.windup, windupTarget:', 'specialCooldown:zombie.specialCooldown,summonCooldown:zombie.summonCooldown,retreatTimer:zombie.retreatTimer,slow:zombie.slow,windup: zombie.windup, windupTarget:'],
 ['const speed = skills.levels.combat === 3 ? SKILL_SETTINGS.bonuses.attackSpeed : 1;', 'const speed = validSkillLevels(skills.levels) ? skillBonuses(skills.levels).attackSpeed : 1;'],
 ['Math.round(CONFIG.player.hp * SKILL_SETTINGS.bonuses.maxHealth)', '200'],
 ["if (!object(value.skills) || !object(value.skills.levels) || Object.keys(value.skills.levels).length !== 3 || !SKILL_BRANCHES.every(branch => integer((value.skills as Data).levels && ((value.skills as Data).levels as Data)[branch], 0, 3)) || !integer(value.skills.points, 0, 100003))", "if (!object(value.skills) || !validSkillLevels(value.skills.levels) || !integer(value.skills.points, 0, 100003))"],
 ['SKILL_BRANCHES.reduce((sum, branch) => sum + levels[branch], 0)', 'SKILL_BRANCHES.reduce((sum, branch) => sum + branchSpent(levels,branch), 0)'],
 ['  const definitions = createResourceNodes();', `  if (!object(value.abilities) || !position(value.abilities.lastPosition) || !['cloak','cloakCooldown','barrageCooldown','demolitionCooldown','shield','shieldCooldown'].every(key=>number((value.abilities as Data)[key],0,key==='cloak'?15:key==='shield'?5:90)) || !number(value.abilities.sinceDamage,0,3600) || !number(value.abilities.idle,0,3600)) return null;
  if (!array(value.bossHazards,16) || !uniqueIds(value.bossHazards) || !value.bossHazards.every(mark=>integer(mark.id,1,1e9)&&position(mark.position)&&number(mark.remaining,0,1)&&mark.radius===3&&mark.damage===32)) return null;
  const bonuses=skillBonuses(levels);
  if ((value.abilities.cloak as number)>0&&!bonuses.cloak || (value.abilities.shield as number)>0&&!bonuses.combatMaster || (value.bossHazards.length && value.encounters.finalBossDefeated)) return null;
  const definitions = createResourceNodes();`],
 ['CONFIG.resources.carriedCapacity.wood)', 'CONFIG.resources.carriedCapacity.wood + bonuses.carryWood)'],
 ['CONFIG.resources.carriedCapacity.iron)', 'CONFIG.resources.carriedCapacity.iron + bonuses.carryIron)'],
 ["!['patrol', 'siege', 'guard'].includes(String(zombie.mode))", "!number(zombie.specialCooldown,0,60)||!number(zombie.summonCooldown,0,60)||!number(zombie.retreatTimer,0,6)||!number(zombie.slow,0,2)||!['patrol', 'siege', 'guard'].includes(String(zombie.mode))"],
 ['  Object.assign(sim.corruption, saved.corruption);', '  Object.assign(sim.corruption, saved.corruption);\n  sim.abilities=structuredClone(saved.abilities);sim.bossHazards=structuredClone(saved.bossHazards);'],
]);
edit('client/src/domain/Simulation.ts', [['zombie.retreatTimer+dt;', 'Math.min(encounters.finalBoss.resetAfter,zombie.retreatTimer+dt);']]);
edit('server/CheckpointValidator.cs', [
 ['    public static string? Validate(JsonElement value)', `    private static readonly JsonElement[] Perks = Skills.GetProperty("branches").EnumerateObject().SelectMany(branch => branch.Value.EnumerateArray()).ToArray();
    private static Dictionary<string,double>? SkillBonuses(JsonElement levels) {
        if (!Object(levels) || levels.EnumerateObject().Count()!=Perks.Length) return null;
        var bonuses=Skills.GetProperty("bonusDefaults").EnumerateObject().ToDictionary(p=>p.Name,p=>p.Value.GetDouble());
        foreach(var perk in Perks) if(!N(levels,perk.GetProperty("id").GetString()!,0,perk.GetProperty("maxRank").GetInt32(),true)) return null;
        foreach(var branch in Skills.GetProperty("branches").EnumerateObject()) {
            var spent=branch.Value.EnumerateArray().Sum(perk=>Field(levels,perk.GetProperty("id").GetString()!).GetInt32());
            foreach(var perk in branch.Value.EnumerateArray()) {
                var rank=Field(levels,perk.GetProperty("id").GetString()!).GetInt32(); if(rank==0)continue;
                if(spent-rank<Skills.GetProperty("tierRequirements")[perk.GetProperty("tier").GetInt32()-1].GetInt32() || perk.GetProperty("requires").EnumerateArray().Any(req=>Field(levels,req.GetProperty("id").GetString()!).GetInt32()<req.GetProperty("rank").GetInt32())) return null;
                foreach(var effect in perk.GetProperty("effects").EnumerateObject())bonuses[effect.Name]+=effect.Value[rank-1].GetDouble();
            }
        }
        return bonuses;
    }
    public static string? Validate(JsonElement value)`],
 ["        if (!Object(levels) || levels.EnumerateObject().Count() != 3 || !N(skills, \"points\", 0, 100003, true) || !new[] { \"combat\", \"survival\", \"engineer\" }.All(branch => N(levels, branch, 0, 3, true))) return \"Invalid skills\";\n        var combatLevel = Field(levels, \"combat\").GetInt32(); var engineerLevel = Field(levels, \"engineer\").GetInt32();\n        var attackSpeed = combatLevel >= 3 ? Skills.GetProperty(\"bonuses\").GetProperty(\"attackSpeed\").GetDouble() : 1;", "        var bonuses=SkillBonuses(levels);\n        if (bonuses==null || !N(skills,\"points\",0,100003,true)) return \"Invalid skills\";\n        var attackSpeed=bonuses[\"attackSpeed\"];"],
 ['var maxPlayerHp = combatLevel >= 2 ? Math.Round(100 * Skills.GetProperty("bonuses").GetProperty("maxHealth").GetDouble()) : 100;', 'var maxPlayerHp = Math.Round(100 * bonuses["maxHealth"]);'],
 ['var buildingHealth = engineerLevel >= 2 ? Skills.GetProperty("bonuses").GetProperty("buildingHealth").GetDouble() : 1;', 'var buildingHealth = bonuses["buildingHealth"];'],
 ['Field(levels, "combat").GetInt32() + Field(levels, "survival").GetInt32() + Field(levels, "engineer").GetInt32()', 'levels.EnumerateObject().Sum(p=>p.Value.GetInt32())'],
 ['Economy.GetProperty("carriedCapacity").GetProperty("wood").GetDouble(), true)', 'Economy.GetProperty("carriedCapacity").GetProperty("wood").GetDouble()+bonuses["carryWood"], true)'],
 ['Economy.GetProperty("carriedCapacity").GetProperty("iron").GetDouble(), true)', 'Economy.GetProperty("carriedCapacity").GetProperty("iron").GetDouble()+bonuses["carryIron"], true)'],
 ['!N(zombie, "windup", 0, 2)', '!N(zombie,"specialCooldown",0,60) || !N(zombie,"summonCooldown",0,60) || !N(zombie,"retreatTimer",0,6) || !N(zombie,"slow",0,2) || !N(zombie, "windup", 0, 2)'],
 ['        var spawner = Field(value, "spawner");', `        var abilities=Field(value,"abilities");var hazards=Field(value,"bossHazards");
        if(!Position(Field(abilities,"lastPosition")) || !N(abilities,"cloak",0,15) || !N(abilities,"shield",0,5) || !new[]{"cloakCooldown","barrageCooldown","demolitionCooldown","shieldCooldown"}.All(key=>N(abilities,key,0,90)) || !N(abilities,"sinceDamage",0,3600) || !N(abilities,"idle",0,3600) || (Field(abilities,"cloak").GetDouble()>0&&bonuses["cloak"]==0) || (Field(abilities,"shield").GetDouble()>0&&bonuses["combatMaster"]==0))return "Invalid ability state";
        if(!Array(hazards,16)||!Unique(hazards)||hazards.EnumerateArray().Any(mark=>!N(mark,"id",1,1e9,true)||!Position(Field(mark,"position"))||!N(mark,"remaining",0,1)||!N(mark,"radius",3,3)||!N(mark,"damage",32,32))||(hazards.GetArrayLength()>0&&Field(encounters,"finalBossDefeated").GetBoolean()))return "Invalid boss hazards";
        var spawner = Field(value, "spawner");`],
]);
