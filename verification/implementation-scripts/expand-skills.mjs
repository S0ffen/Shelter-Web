import fs from 'node:fs';
const perk=(id,name,tier,effect,effects,maxRank=3,requires=[])=>({id,name,tier,effect,effects,maxRank,requires});
const requires=(id,rank=3)=>[{id,rank}];
const settings={initialPoints:3,pointsPerDay:1,tierRequirements:[0,3,6,9],bonusDefaults:{meleeDamage:1,maxHealth:1,attackSpeed:1,movementSpeed:1,harvestBonus:0,harvestDamage:1,harvestRange:0,corruptionRate:1,buildingCost:1,buildingHealth:1,repairAmount:1,repairSpeed:1,armor:0,heavyDamage:1,meleeRange:0,carryWood:0,carryIron:0,explorer:0,campfire:0,enduranceRegen:0,slow:0,scavenger:0,cloak:0,transport:0,autoRepair:0,powerOutput:1,powerDemand:1,towerDamage:1,towerSpeed:1,recycle:0,barrage:0,demolition:0,moveTower:0,combatMaster:0},branches:{
combat:[
perk('weapon-mastery','Beginner Weapon Mastery',1,'Obrażenia miecza +8 / 16 / 24%',{meleeDamage:[.08,.16,.24]}),
perk('battle-tempo','Battle Tempo',1,'Szybkość ataków +5 / 10 / 15%',{attackSpeed:[.05,.1,.15]}),
perk('health-up','Health Up',1,'Maksymalne HP +10 / 20 / 30%',{maxHealth:[.1,.2,.3]}),
perk('weapon-mastery-ii','Intermediate Weapon Mastery',2,'Dalsze +10 / 20 / 30% obrażeń miecza',{meleeDamage:[.1,.2,.3]},3,requires('weapon-mastery')),
perk('combat-crafting','Combat Crafting',2,'Wzmocnione ostrze: +15% obrażeń i +0,4 m zasięgu',{meleeDamage:[.15],meleeRange:[.4]},1),
perk('armor','Armor Enhancement',2,'Redukcja obrażeń od wrogów o 8 / 16 / 24%',{armor:[.08,.16,.24]}),
perk('weapon-mastery-iii','Advanced Weapon Mastery',3,'Dalsze +15 / 30 / 45% obrażeń miecza',{meleeDamage:[.15,.3,.45]},3,requires('weapon-mastery-ii')),
perk('combat-master','Combat Master',3,'Przy niskim HP: osłona na 4 / 5 s, odnowienie 90 s',{combatMaster:[1,2]},2),
perk('special-mastery','Special Weapon Mastery',3,'Mocny atak: dodatkowe +20 / 40 / 60% obrażeń',{heavyDamage:[.2,.4,.6]}),
perk('barrage','Bombing Request · Arcane Barrage',4,'5: magiczny ostrzał wokół celownika, odnowienie 90 s',{barrage:[1]},1),
perk('stats-up','Stats Up',4,'+20% HP, +15% obrażeń, +5% ruchu',{maxHealth:[.2],meleeDamage:[.15],movementSpeed:[.05]},1)
],
survival:[
perk('beginner-harvest','Beginner Harvest',1,'Plecak +5/10/15 Wood i +3/6/9 Iron; harvesting +10/20/30%; ranga 3: +1 nagrody',{carryWood:[5,10,15],carryIron:[3,6,9],harvestDamage:[.1,.2,.3],harvestBonus:[0,0,1]}),
perk('speed-up','Speed Up',1,'Ruch szybszy o 5 / 10 / 20%',{movementSpeed:[.05,.1,.2]}),
perk('explorer','Explorer',1,'Wskazuje pobliskie Wood / również Iron / również zombie',{explorer:[1,2,3]}),
perk('advance-harvest','Advance Harvest',2,'Dodatkowa pojemność +5/10/15 Wood i +3/6/9 Iron; +1/1/2 nagrody',{carryWood:[5,10,15],carryIron:[3,6,9],harvestBonus:[1,1,2]},3,requires('beginner-harvest')),
perk('campfire','Campfire',2,'Ognisko wewnątrz Shelteru przywraca 2 HP/s i Psyche',{campfire:[1]},1),
perk('survival-crafting','Survival Crafting',2,'Narzędzie: +25% obrażeń źródeł i +1 m zasięgu',{harvestDamage:[.25],harvestRange:[1]},1),
perk('hunter','Hunter',3,'Trafienie mieczem spowalnia przeciwnika o 10/20/30% na 2 s',{slow:[.1,.2,.3]}),
perk('endurance','Endurance',3,'Psyche wyczerpuje się o 15/25/35% wolniej; regeneracja przy Psyche >50%',{corruptionRate:[-.15,-.25,-.35],enduranceRegen:[.33,.67,1]}),
perk('scavenger','Scavenger',3,'10/20/30% szans na materiał do plecaka z zabitego zombie',{scavenger:[.1,.2,.3]}),
perk('cloak','Cloak',4,'6: ukrycie na 15 s, pierwszy cios ×2; odnowienie 90 s',{cloak:[1]},1),
perk('resource-transport','Resource Transporting',4,'E pozwala zdalnie oddać pełny plecak do banku Shelteru',{transport:[1]},1)
],
engineer:[
perk('auto-repair','Auto Repair',1,'Podczas bezruchu: pobliska infrastruktura odzyskuje 1/3/5% HP/s',{autoRepair:[.01,.03,.05]}),
perk('beginner-engineer','Beginner Engineer',1,'HP konstrukcji +10/20/30%; szybsze naprawy',{buildingHealth:[.1,.2,.3],repairSpeed:[.1,.2,.3]}),
perk('blueprint','Improve Blueprint',1,'Budowa i rozbudowa tańsze o 5 / 10 / 15%',{buildingCost:[-.05,-.1,-.15]}),
perk('engineer-crafting','Engineer Crafting',2,'Młot: +30% napraw i +20% szybkości napraw',{repairAmount:[.3],repairSpeed:[.2]},1),
perk('intermediate-engineer','Intermediate Engineer',2,'Dalsze +10/20/30% HP i +5/10/15% wydajności generatorów',{buildingHealth:[.1,.2,.3],powerOutput:[.05,.1,.15]},3,requires('beginner-engineer')),
perk('electrical','Electrical Engineering',2,'Wieże i magazyny potrzebują o 10/20/30% mniej mocy',{powerDemand:[-.1,-.2,-.3]}),
perk('recycle','Recycle',3,'X: rozbiórka trafionej konstrukcji, zwrot 25/50/75% ceny',{recycle:[.25,.5,.75]}),
perk('expert-engineer','Expert Engineer',3,'Dalsze +10/20/30% HP konstrukcji i obrażeń wież',{buildingHealth:[.1,.2,.3],towerDamage:[.1,.2,.3]},3,requires('intermediate-engineer')),
perk('construction-master','Construction Master',3,'Szybkość wież +5/10/15%; naprawy +10/20/30% przy Psyche >50%',{towerSpeed:[.05,.1,.15],repairAmount:[.1,.2,.3]}),
perk('wrecking-team','Wrecking Team',4,'7: wybuch runy, 800 obrażeń wokół celu; odnowienie 90 s',{demolition:[1]},1),
perk('turret-moving','Turret Tower Moving',4,'V na wieży: przenieś ją przez podgląd budowania bez opłat',{moveTower:[1]},1)
]}};
fs.writeFileSync('shared/skills.json',JSON.stringify(settings,null,2)+'\n');
