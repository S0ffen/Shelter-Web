import fs from 'node:fs';
const edit=(p,changes)=>{let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');for(const[a,b]of changes){if(!s.includes(a))throw Error(p+' missing '+a.slice(0,70));s=s.replace(a,b)}fs.writeFileSync(p,s)};
edit('client/src/building/BuildingSystem.ts',[
 ['  healthMultiplier = 1;','  healthMultiplier = 1;\n  powerOutputMultiplier = 1;\n  powerDemandMultiplier = 1;'],
 ['* CONFIG.power.coreOutput;','* Math.round(CONFIG.power.coreOutput * this.powerOutputMultiplier);'],
 ["return kind === 'magic-tower' ? CONFIG.power.towerDemand : kind === 'storehouse' ? CONFIG.power.storehouseDemand : 0;", "return Math.ceil((kind === 'magic-tower' ? CONFIG.power.towerDemand : kind === 'storehouse' ? CONFIG.power.storehouseDemand : 0) * this.powerDemandMultiplier);"],
 ['* CONFIG.power.storehouseDemand);',"* this.demand('storehouse'));"],
]);
edit('client/src/building/MagicTowerSystem.ts',[
 ['  private scanCountdown = 0;', '  damageMultiplier = 1;\n  speedMultiplier = 1;\n  demand = CONFIG.power.towerDemand as number;\n  private scanCountdown = 0;'],
 ['allocatedPower + CONFIG.power.towerDemand','allocatedPower + this.demand'],
 ['allocatedPower += CONFIG.power.towerDemand','allocatedPower += this.demand'],
 ['tower.cooldown = CONFIG.tower.cooldown;', 'tower.cooldown = CONFIG.tower.cooldown / this.speedMultiplier;'],
 ['damage(target.id, CONFIG.tower.damage)', 'damage(target.id, Math.round(CONFIG.tower.damage * this.damageMultiplier))'],
]);
edit('client/src/enemies/Zombie.ts', [['  windup = 0;', '  specialCooldown = 3;\n  summonCooldown = 10;\n  retreatTimer = 0;\n  slow = 0;\n  windup = 0;']]);
edit('client/src/enemies/ZombieAI.ts', [
 ['night = false): void', 'night = false, multiplier = 1): void'],
 ['(night ? NIGHT_SPEED_MULTIPLIER : 1) * dt', '(night ? NIGHT_SPEED_MULTIPLIER : 1) * multiplier * dt'],
]);
edit('client/src/domain/Simulation.ts', [
 ["import { SkillTree }", "import { PERKS, SkillTree }"],
 ["import type { SkillBranch } from './SkillTree';\n", ""],
 ["import { Zombie }", "import { freshAbilities, updatePassives, receivePlayerDamage, useAbility } from './SkillRuntime';\nimport { Zombie }"],
 ['  skills = new SkillTree();', '  skills = new SkillTree();\n  abilities = freshAbilities();\n  bossHazards: { id: number; position: Position; remaining: number; radius: number; damage: number }[] = [];'],
 ['    this.skills = new SkillTree();', '    this.skills = new SkillTree();\n    this.abilities = freshAbilities();\n    this.bossHazards = [];'],
 ['this.skills.bonuses.repairAmount)', 'this.repairMultiplier)'],
 ['this.repairCooldown = SHELTER_REPAIR.cooldown;', 'this.repairCooldown = SHELTER_REPAIR.cooldown / this.skills.bonuses.repairSpeed;'],
 ['node.distanceFrom(this.player.position) > strike.range)', 'node.distanceFrom(this.player.position) > strike.range + this.skills.bonuses.harvestRange)'],
 ['node.previewDamage(strike.damage)', 'node.previewDamage(Math.round(strike.damage * this.skills.bonuses.harvestDamage))'],
 ['node.damage(strike.damage)', 'node.damage(Math.round(strike.damage * this.skills.bonuses.harvestDamage))'],
 ['distance(this.player.position, zombie.position) > strike.range + 0.4', 'distance(this.player.position, zombie.position) > strike.range + this.skills.bonuses.meleeRange + 0.4'],
 ["this.damageZombie(zombie.id, Math.round(strike.damage * this.skills.bonuses.meleeDamage), 'sword');", "this.damageZombie(zombie.id, Math.round(strike.damage * this.skills.bonuses.meleeDamage * (kind === 'heavy' ? this.skills.bonuses.heavyDamage : 1) * (this.abilities.cloak > 0 ? 2 : 1)), 'sword');\n    this.abilities.cloak = 0;\n    if (this.skills.bonuses.slow > 0) zombie.slow = 2;"],
 ["  private damageZombie(id: string, amount: number, source: 'sword' | 'tower'): void", "  damageZombie(id: string, amount: number, source: 'sword' | 'tower'): void"],
 ['    zombie.damage(amount);', "    if (zombie.kind === 'overlord') amount = Math.round(amount * (1 - encounters.finalBoss.resistance));\n    zombie.damage(amount);"],
 ['      this.totalKills++;', "      this.totalKills++;\n      if (this.skills.bonuses.scavenger > 0 && this.spawner.random() < this.skills.bonuses.scavenger) { const kind = this.spawner.random() < .5 ? 'wood' : 'iron'; const amount = this.carriedManager.add(kind, 1); if (amount) this.events.push({ type:'resource-gained',kind,amount }); }"],
 ["this.towerSystem.projectiles.length = 0; this.events.push({ type: 'run-completed' })", "this.towerSystem.projectiles.length = 0; this.bossHazards = []; this.events.push({ type: 'run-completed' })"],
 ['    this.ensureGuardian();', '    this.ensureGuardian();\n    updatePassives(this, dt);\n    this.updateBossHazards(dt);'],
 ['this.player.damage(corruptionDamage);', 'receivePlayerDamage(this, corruptionDamage, true);'],
 ['      zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);', '      zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);\n      zombie.slow = Math.max(0, zombie.slow - dt);'],
 ['        this.ai.decide(zombie, this.player, obstacles);', "        this.ai.decide(zombie, this.player, obstacles);\n        if (this.abilities.cloak > 0 && zombie.intent === 'player') zombie.intent = zombie.mode === 'patrol' ? 'patrol' : 'shelter';"],
 ["const attackingPlayer = zombie.intent === 'player' &&", "const attackingPlayer = this.abilities.cloak === 0 && zombie.intent === 'player' &&"],
 ['this.player.damage(zombie.stats.damage);', 'receivePlayerDamage(this, zombie.stats.damage);'],
 ["this.ai.move(zombie, target, dt, obstacles, this.cycle.state.period === 'night');", "this.ai.move(zombie, target, dt, obstacles, this.cycle.state.period === 'night', zombie.slow > 0 ? 1 - this.skills.bonuses.slow : 1);"],
 ["  purchaseSkill(branch: SkillBranch): string {", "  purchaseSkill(id: string): string {"],
 ["    if (!this.skills.buy(branch)) return 'Brak punktów lub ścieżka ukończona';\n    if (branch === 'combat' && this.skills.levels.combat === 3) { this.swordCooldown /= this.skills.bonuses.attackSpeed; this.swordCooldownDuration /= this.skills.bonuses.attackSpeed; }", "    const reason = this.skills.reason(id); if (reason) return reason;\n    const before = this.skills.bonuses;\n    this.skills.buy(id);\n    this.swordCooldown *= before.attackSpeed / this.skills.bonuses.attackSpeed; this.swordCooldownDuration *= before.attackSpeed / this.skills.bonuses.attackSpeed;\n    this.repairCooldown *= before.repairSpeed / this.skills.bonuses.repairSpeed;"],
 ["    return 'Zdobyto ' + branch.toUpperCase() + ' ' + this.skills.levels[branch];", "    return `${PERKS.find(perk => perk.id === id)!.name} · ranga ${this.skills.levels[id]}`;"],
 ['    this.buildingSystem.healthMultiplier = this.skills.bonuses.buildingHealth;', "    this.buildingSystem.healthMultiplier = this.skills.bonuses.buildingHealth;\n    const bonuses = this.skills.bonuses;\n    this.carriedManager.setCapacity({ wood: CONFIG.resources.carriedCapacity.wood + bonuses.carryWood, iron: CONFIG.resources.carriedCapacity.iron + bonuses.carryIron });\n    this.buildingSystem.powerOutputMultiplier = bonuses.powerOutput; this.buildingSystem.powerDemandMultiplier = bonuses.powerDemand;\n    this.towerSystem.damageMultiplier = bonuses.towerDamage; this.towerSystem.speedMultiplier = bonuses.towerSpeed; this.towerSystem.demand = this.buildingSystem.demand('magic-tower');"],
 ["this.skills.bonuses.repairAmount), b.maxHp", "this.repairMultiplier), b.maxHp"],
 ["b.hp += amount; this.repairCooldown = SHELTER_REPAIR.cooldown;", "b.hp += amount; this.repairCooldown = SHELTER_REPAIR.cooldown / this.skills.bonuses.repairSpeed;"],
 ["!hasLineOfSight(this.player.position, SHELTER_DEPOSIT, this.obstacles)", "!hasLineOfSight(this.player.position, { x: SHELTER_DEPOSIT.x, z: SHELTER_DEPOSIT.z - SHELTER_DEPOSIT.depth / 2 - .05 }, this.obstacles)"],
 ["    if(targetId!==SHELTER_DEPOSIT_ID)return", "    if (this.skills.bonuses.transport > 0 && (this.carried.wood >= this.carriedManager.capacity.wood || this.carried.iron >= this.carriedManager.capacity.iron) && this.phase === 'playing' && targetId !== SHELTER_DEPOSIT_ID) { const amount = this.transferResources(); return amount.wood || amount.iron ? 'Zdalny transport materiałów wykonany' : 'Magazyn pełny'; }\n    if(targetId!==SHELTER_DEPOSIT_ID)return"],
 ["    for (const kind of ['wood', 'iron'] as const) {\n      deposited[kind]", "    return this.transferResources();\n  }\n  private transferResources(): ResourceCounts {\n    const deposited = { wood: 0, iron: 0 };\n    for (const kind of ['wood', 'iron'] as const) {\n      deposited[kind]"],
 ["  drainEvents(): GameEvent[]", "  emit(event: GameEvent): void { this.events.push(event); }\n  useAbility(kind: 'barrage' | 'cloak' | 'demolition', target: Position): string { return useAbility(this, kind, target); }\n  get repairMultiplier(): number { const rank = this.skills.levels['construction-master']; return this.skills.bonuses.repairAmount - (this.corruption.value >= 50 && rank ? [0,.1,.2,.3][rank] : 0); }\n  drainEvents(): GameEvent[]"],
]);
