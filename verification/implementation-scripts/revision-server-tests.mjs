import fs from 'node:fs';
const p='server/tests/Smoke.Tests.ps1';let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
s=s.replace('survival.dayDuration -eq 150','survival.dayDuration -eq 180');
s=s.replace('    $snapshot = @{',`    $skillConfig=Get-Content -Raw (Join-Path $projectRoot 'shared/skills.json') | ConvertFrom-Json -AsHashtable
    $perkLevels=@{};foreach($branch in $skillConfig.branches.Values){foreach($perk in $branch){$perkLevels[$perk.id]=0}}
    $snapshot = @{`);
s=s.replace('skills = @{ points = 4; levels = @{ combat = 0; survival = 0; engineer = 0 } };',`skills = @{ points = 4; levels = $perkLevels };
        abilities = @{ cloak=0; cloakCooldown=0; barrageCooldown=0; demolitionCooldown=0; shield=0; shieldCooldown=0; sinceDamage=0; idle=0; lastPosition=@{x=-6;z=-8} }; bossHazards=@();`);
s=s.replace('windup = 0; windupTarget = $null; attackCooldown', 'specialCooldown=3; summonCooldown=10; retreatTimer=0; slow=0; windup = 0; windupTarget = $null; attackCooldown');
s=s.replace('$combatSave.skills.levels.combat = 3;',"$combatSave.skills.levels['weapon-mastery'] = 1; $combatSave.skills.levels['health-up'] = 1; $combatSave.skills.levels['battle-tempo'] = 1;");
s=s.replace('1.4 / 1.15','1.4 / 1.05');
s=s.replace('$engineerSave.skills.levels.engineer = 2;',"$engineerSave.skills.levels['beginner-engineer'] = 2;");
s=s.replace("'fake-victory'))", "'fake-victory','skill-tier','skill-prerequisite','ability','hazard','boss-timer'))");
s=s.replace("'skill-level' { $bad.skills.levels.engineer = 4 }", "'skill-level' { $bad.skills.levels['health-up'] = 4 }\n            'skill-tier' { $bad.skills.levels['armor']=1;$bad.skills.points=3 }\n            'skill-prerequisite' { $bad.skills.levels['health-up']=3;$bad.skills.levels['weapon-mastery-ii']=1;$bad.skills.points=0 }\n            'ability' { $bad.abilities.cloak=1 }\n            'hazard' { $bad.bossHazards=@(@{id=4;position=@{x=0;z=75};remaining=1;radius=99;damage=32}) }\n            'boss-timer' { $bad.zombies[0].specialCooldown=100 }");
fs.writeFileSync(p,s);
