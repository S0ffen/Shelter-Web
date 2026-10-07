import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';
import { SHELTER_DEPOSIT_ID } from '../src/world/ShelterLayout';
import { shelterHudState } from '../src/ui/HudState';

const start = () => { const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start(); return sim; };
describe('backpack and Shelter economy', () => {
  it('harvests outside to the backpack, requires interacting with the deposit cabinet and does not duplicate', () => {
    const sim = start(), node = sim.resourceNodes[0];
    sim.player.position = { x: node.position.x, z: node.position.z - 1.4 };
    sim.attack(node.id); sim.update(.7);
    expect(sim.carried.wood).toBe(3); expect(shelterHudState(sim).wood.current).toBe(0);
    sim.player.position = { x: 1.5, z: -7 }; sim.update(.01);
    expect(sim.resources.wood).toBe(0); expect(sim.carried.wood).toBe(3);
    sim.interact(SHELTER_DEPOSIT_ID);expect(sim.resources.wood).toBe(0);
    sim.player.position={x:6,z:5};sim.interact(SHELTER_DEPOSIT_ID);
    expect(sim.resources.wood).toBe(3); expect(sim.carried.wood).toBe(0);
    sim.update(.01); expect(sim.resources.wood).toBe(3);
  });
  it('deposits only what fits, independently for each resource, and transfers the rest when space opens', () => {
    const sim = start(); sim.resources.wood = 95; sim.resources.iron = 50;
    sim.carried.wood = 9; sim.carried.iron = 1; sim.player.position={x:6,z:5};sim.interact(SHELTER_DEPOSIT_ID);
    expect(sim.resources).toEqual({ wood: 100, iron: 50 }); expect(sim.carried).toEqual({ wood: 4, iron: 1 });
    sim.resourceManager.spend({ wood: 10, iron: 2 }); sim.interact(SHELTER_DEPOSIT_ID);
    expect(sim.resources).toEqual({ wood: 94, iron: 49 }); expect(sim.carried).toEqual({ wood: 0, iron: 0 });
  });
  it('cannot pay for building or repairs using carried materials and cannot deposit while paused', () => {
    const sim = start(); sim.carried.wood = 30; sim.carried.iron = 20;
    sim.player.position = { x: -10, z: -13 };
    expect(sim.placeBuilding('arcane-core', { x: -13, z: -13 }, 0).ok).toBe(false);
    sim.shelter.damage(30); sim.player.position = { x: 1.5, z: 1.5 };
    expect(sim.repairShelter()).toContain('wymaga');
    sim.pause(); sim.update(10); sim.depositResources(); expect(sim.resources.wood).toBe(0);
  });
  it('checkpoints backpack and bank separately and rejects overfilled or invalid backpacks', () => {
    const sim = start(); sim.carried.wood = 9; sim.resources.wood = 45;
    const saved = captureRun(sim), restored = start(); restoreRun(restored, saved);
    expect(restored.carried.wood).toBe(9); expect(restored.resources.wood).toBe(45);
    saved.carried.wood = 31; expect(parseRun(saved)).toBeNull();
    saved.carried.wood = -1; expect(parseRun(saved)).toBeNull();
  });
});
