import economy from '../../../shared/economy.json';
import combat from '../../../shared/combat.json';
import { BASE_POWER, SHELTER_CORE } from '../world/ShelterLayout';

export const CONFIG = {
  simulationStep: 1 / 30,
  aiInterval: 0.2,
  player: { hp: 100, speed: 5.2, spawn: { x: 1.5, z: -7 } },
  sword: { ...combat.quick, heavy: combat.heavy },
  resources: { capacity: economy.shelterCapacity, storehouseBonus: economy.storehouseBonus, carriedCapacity: economy.carriedCapacity },
  power: { coreOutput: BASE_POWER.generatorOutput, towerDemand: BASE_POWER.towerDemand, storehouseDemand: BASE_POWER.storehouseDemand },
  tower: { range: 12, damage: 25, cooldown: 1.2, projectileSpeed: 10, projectileLifetime: 3, scanInterval: 0.2 },
  zombie: { aggroRange: 5, attackRange: 1.5 },
  shelter: { attackRange: 1.35, position: { x: SHELTER_CORE.x, z: SHELTER_CORE.z }, halfWidth: SHELTER_CORE.width / 2, halfDepth: SHELTER_CORE.depth / 2 },
} as const;
