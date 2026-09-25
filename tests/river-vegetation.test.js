import test from 'node:test';
import assert from 'node:assert/strict';
import {treeGeometry,TREE_KINDS,createVegetation} from '../src/river/vegetation.js';

const tris=g=>g.index.count/3;

test('every tree kind builds a near and a lighter far LOD with colours',()=>{
 for(const kind of TREE_KINDS){
  const hi=treeGeometry(kind,1,0),lo=treeGeometry(kind,1,1);
  for(const g of [hi,lo]){
   for(const a of ['position','normal','color'])assert.ok(g.attributes[a],`${kind} ${a}`);
   assert.ok(g.index,`${kind} indexed`);
   for(const v of g.attributes.position.array)assert.ok(Number.isFinite(v),`${kind} finite`);
  }
  assert.ok(tris(hi)<=1800,`${kind} near budget ${tris(hi)}`);
  assert.ok(tris(lo)<=320,`${kind} far budget ${tris(lo)}`);
  assert.ok(tris(lo)*3<tris(hi),`${kind} far LOD is much lighter`);
 }
});

test('tree shapes differ: cedars are tall and narrow, spread trees are wide, bushes are low',()=>{
 const size=k=>{const g=treeGeometry(k,1,0);g.computeBoundingBox();const b=g.boundingBox;return {h:b.max.y,w:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)};};
 const cedar=size('cedar'),round=size('round'),spread=size('spread'),bush=size('bush');
 assert.ok(cedar.h>round.h&&cedar.h/cedar.w>round.h/round.w);
 assert.ok(spread.w>round.w*.95);
 assert.ok(bush.h<1.6);
});

test('LOD swaps instances between near and far meshes without losing any',()=>{
 const veg=createVegetation({uTime:{value:0}},{mobile:true,viewer:{x:0,z:60}});
 const {lods,update,nearRadius}=veg.userData;
 const total=lods.reduce((a,l)=>a+l.count,0),shown=()=>lods.reduce((a,l)=>a+l.hi.count+l.lo.count,0),near=()=>lods.reduce((a,l)=>a+l.hi.count,0);
 assert.equal(shown(),total);
 const n0=near();assert.ok(n0>0&&n0<total);
 assert.equal(update({x:0,z:60.5}),false,'tiny moves do not rebuild');
 assert.equal(update({x:0,z:-120}),true);
 assert.equal(shown(),total);
 // everything in the near mesh really is near
 for(const l of lods)for(let i=0;i<l.hi.count;i++){const e=l.hi.instanceMatrix.array;assert.ok(Math.hypot(e[i*16+12],e[i*16+14]+120)<nearRadius+5.01);}
});
