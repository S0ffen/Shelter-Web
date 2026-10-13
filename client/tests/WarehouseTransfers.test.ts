import { expect, it } from 'vitest';
import { Simulation } from '../src/domain/Simulation';
import { SHELTER_DEPOSIT } from '../src/world/ShelterLayout';
const approach=()=>{const sim=new Simulation({settings:{dayPatrolCount:0}});sim.start();sim.player.position={x:SHELTER_DEPOSIT.x,z:SHELTER_DEPOSIT.z-2};sim.pause();return sim;};
it('lets the warehouse menu deposit selected quantities and leaves the rest in the backpack',()=>{
 const sim=approach();Object.assign(sim.carried,{wood:9,iron:7});Object.assign(sim.resources,{wood:95,iron:48});
 expect(sim.depositResources({wood:3,iron:5})).toEqual({wood:3,iron:2});expect(sim.resources).toEqual({wood:98,iron:50});expect(sim.carried).toEqual({wood:6,iron:5});
 expect(sim.depositResources({wood:100,iron:100})).toEqual({wood:2,iron:0});expect(sim.carried).toEqual({wood:4,iron:5});
});
it('withdraws +1/+5, clamps to backpack capacity and cannot duplicate or make negative materials',()=>{
 const sim=approach();Object.assign(sim.resources,{wood:9,iron:6});Object.assign(sim.carried,{wood:29,iron:18});
 expect(sim.withdrawResources({wood:5,iron:5})).toEqual({wood:1,iron:2});expect(sim.resources).toEqual({wood:8,iron:4});expect(sim.carried).toEqual({wood:30,iron:20});
 expect(sim.withdrawResources({wood:5,iron:5})).toEqual({wood:0,iron:0});
 sim.carried.wood=0;expect(sim.withdrawResources({wood:100,iron:0})).toEqual({wood:8,iron:0});expect(sim.resources.wood).toBe(0);
});
it.each([-1,.5,NaN,Infinity])('rejects malformed transfers atomically (%s)', amount=>{
 const sim=approach();sim.carried.wood=10;sim.resources.iron=10;
 expect(sim.depositResources({wood:amount,iron:1})).toEqual({wood:0,iron:0});expect(sim.withdrawResources({wood:1,iron:amount})).toEqual({wood:0,iron:0});
 expect(sim.carried).toEqual({wood:10,iron:0});expect(sim.resources).toEqual({wood:0,iron:10});
});
it('refuses menu transfers from outside, behind walls, while dead or after the run ends',()=>{
 const sim=approach();sim.carried.wood=10;sim.resources.iron=10;sim.player.position.z=10;
 expect(sim.depositResources()).toEqual({wood:0,iron:0});sim.player.position={x:SHELTER_DEPOSIT.x,z:SHELTER_DEPOSIT.z-2};sim.player.hp=0;
 expect(sim.withdrawResources({wood:0,iron:5})).toEqual({wood:0,iron:0});sim.player.hp=100;sim.phase='won';expect(sim.depositResources()).toEqual({wood:0,iron:0});
});
