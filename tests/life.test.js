import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Euler} from 'three';
import {furnitureDefinitions as furniture} from '../src/world/furniture.js';
import {findPath} from '../src/simulation/navigation.js';
import {LifeSimulation} from '../src/simulation/life.js';
import {actions} from '../src/simulation/actions.js';
const character=(id,x=1.8,z=-1.3)=>({id,name:id,root:{position:new Vector3(x,0,z),rotation:new Euler()}});
test('all furniture destinations are mutually reachable',()=>{for(const from of furniture)for(const to of furniture){assert.ok(findPath(from.spot,to.spot,furniture).length,`${from.id} -> ${to.id}`);}});
test('reserved furniture cannot be taken by another character',()=>{const a=character('a'),b=character('b');const sim=new LifeSimulation([a,b],furniture);assert.equal(sim.command(a,'bed'),true);assert.equal(sim.command(b,'bed'),false);});
test('pause freezes simulation and commands reach an acting state after resume',()=>{const a=character('a');const sim=new LifeSimulation([a],furniture);assert.ok(sim.command(a,'sofa'));sim.paused=true;const before=a.root.position.clone();sim.update(2);assert.ok(a.root.position.equals(before));assert.equal(sim.time,0);sim.paused=false;for(let i=0;i<1200&&a.phase!=='acting';i++)sim.update(1/60);assert.equal(a.phase,'acting');assert.equal(a.action,'relax');});
test('the retired reading action is gone from every autonomous candidate',()=>{
 assert.equal('read' in actions,false);
 assert.equal(furniture.some(f=>f.action==='read'),false);
});
test('a floor click walks a character there and hands control back to autonomy',()=>{
 const a=character('a');const sim=new LifeSimulation([a],furniture);
 assert.equal(sim.moveTo(a,[99,0,99]),false,'部屋の外へは行かない');
 assert.ok(sim.moveTo(a,[1.9,0,1.6]));
 assert.equal(a.phase,'walking');assert.equal(a.target.id,'floor');
 for(let i=0;i<3000&&a.phase!=='acting';i++)sim.update(1/60);
 assert.equal(a.phase,'acting');
 assert.ok(Math.hypot(a.root.position.x-1.9,a.root.position.z-1.6)<.1);
 for(let i=0;i<600;i++)sim.update(1/60);
 assert.notEqual(a.target?.id,'floor','到着後は通常の自律行動へ戻る');
});
test('characters meeting head-on keep one side and pass each other',()=>{
 const a=character('a',-2,0),b=character('b',2,0);
 const sim=new LifeSimulation([a,b],[]);
 a.target={id:'floor',spot:[2,0,0],face:0};a.path=[[2,0,0]];a.phase='walking';a.action='idle';
 b.target={id:'floor',spot:[-2,0,0],face:0};b.path=[[-2,0,0]];b.phase='walking';b.action='idle';
 const sides=new Set();
 for(let i=0;i<1500&&(a.phase==='walking'||b.phase==='walking');i++){sim.update(1/60);if(a.avoidTimer)sides.add(a.avoidSide);}
 assert.equal(sides.size<=1,true,'回避方向がフレームごとに反転しない');
 assert.ok(a.root.position.x>1.5,'ちゃんとすれ違って向こう側まで行く');
 assert.ok(b.root.position.x<-1.5);
});
