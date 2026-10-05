import { BASE_POWER, SHELTER_HALL } from '../world/ShelterLayout';

export const CONFIG = {
  simulationStep: 1 / 30,
  aiInterval: 0.2,
  player: { hp: 100, speed: 4, spawn: { x: 1.5, z: -7 } },
  sword: { damage: 34, cooldown: 0.65, range: 3 },
  resources: { capacity: { wood: 100, iron: 50 }, storehouseBonus: { wood: 50, iron: 25 } },
  power: { coreOutput: BASE_POWER.generatorOutput, towerDemand: BASE_POWER.towerDemand, storehouseDemand: BASE_POWER.storehouseDemand },
  tower: { range: 12, damage: 25, cooldown: 1.2, projectileSpeed: 10, projectileLifetime: 3, scanInterval: 0.2 },
  zombie: { hp: 100, speed: 1.3, aggroRange: 5, attackRange: 1.5, damage: 10, attackCooldown: 1.2 },
  shelter: { hp: 300, damage: 18, attackRange: 1.35, position: { x: SHELTER_HALL.x, z: SHELTER_HALL.z }, halfWidth: SHELTER_HALL.width / 2, halfDepth: SHELTER_HALL.depth / 2 },
} as const;
