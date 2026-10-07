import type { Simulation } from '../domain/Simulation';

/** The top panel always describes the base, never the backpack. */
export function shelterHudState(sim: Simulation) {
  const power = sim.buildingSystem.power;
  return {
    wood: { maximum: sim.resourceManager.capacity.wood, current: sim.resources.wood },
    iron: { maximum: sim.resourceManager.capacity.iron, current: sim.resources.iron },
    power: { maximum: power.generated, current: power.available },
    day: sim.cycle.state.day, night: sim.cycle.state.period === 'night', kills: sim.totalKills,
    remaining: `${Math.floor(Math.ceil(sim.cycle.secondsRemaining) / 60)}:${String(Math.ceil(sim.cycle.secondsRemaining) % 60).padStart(2, '0')} remaining`,
  };
}
