import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {heightAt,baseHeightAt,beachCut,BEACH,riverCenter,riverHalfWidth,bankDistance} from '../src/river/terrain.js';
import {createVegetation} from '../src/river/vegetation.js';
import {createRocks} from '../src/river/rocks.js';

// 釣り場（左岸・3人の後ろ）の河原をなだらかにした地形（terrain.js の beachCut）
const deg=g=>Math.atan(g)*180/Math.PI;
const grad=(f,x,z,e=.25)=>Math.hypot(f(x+e,z)-f(x-e,z),f(x,z+e)-f(x,z-e))/(2*e);
const at=(z,s)=>[riverCenter(z)-riverHalfWidth(z)-s,z];   // 左岸の、岸から s m の点

test('water, the bank where the three stand, and everything far away keep their height',()=>{
 for(let z=40;z<=100;z+=.5)for(let s=-8;s<=BEACH.s1;s+=.25){const [x]=at(z,s);assert.equal(heightAt(x,z),baseHeightAt(x,z));}
 for(const [x,z] of [[-30,70],[20,70],[0,40],[0,95],[riverCenter(70)+riverHalfWidth(70)+3,70]])assert.equal(heightAt(x,z),baseHeightAt(x,z));
 for(const [z,off] of [[67.4,.55],[70,1.05],[72.4,.6]]){const [x]=at(z,off);assert.equal(heightAt(x,z),baseHeightAt(x,z),'3人の足元');}
});

test('the camp area behind the anglers is a gentle, still bumpy river beach (not a flat pad)',()=>{
 const g0=[],g1=[],hs=[];
 for(let z=68;z<=74;z+=.5)for(let s=2.5;s<=5.3;s+=.25){const [x]=at(z,s);g0.push(deg(grad(baseHeightAt,x,z)));g1.push(deg(grad(heightAt,x,z)));hs.push(heightAt(x,z));}
 const med=a=>[...a].sort((p,q)=>p-q)[a.length>>1];
 assert.ok(med(g0)>11,'元は急な坂');
 assert.ok(med(g1)<8,`なだらか（中央値 ${med(g1).toFixed(1)}°）`);
 // 平らな台ではない：小さな凸凹と、奥へのゆるい上りが残る
 const sd=Math.sqrt(hs.reduce((a,h)=>a+(h-hs.reduce((p,q)=>p+q,0)/hs.length)**2,0)/hs.length);
 assert.ok(sd>.05,'高さに変化がある');
});

test('no steps: the reshaping blends smoothly into the original slope',()=>{
 let worst=0;
 for(let z=60;z<=82;z+=.5)for(let s=0;s<=14;s+=.25){const [x]=at(z,s);
  // 近い 2 点の高さの差が元の地形より急に大きくならない（段差・崖を作らない）
  for(const [dx,dz] of [[.25,0],[0,.25]]){const d1=Math.abs(heightAt(x+dx,z+dz)-heightAt(x,z)),d0=Math.abs(baseHeightAt(x+dx,z+dz)-baseHeightAt(x,z));worst=Math.max(worst,(d1-d0)/.25);}}
 assert.ok(worst<.35,`steepest extra slope ${worst.toFixed(2)}`);
 assert.equal(beachCut(BEACH.s1,70),0);
});

test('trees, bushes, grass and rocks keep their horizontal positions; only their height follows the ground',()=>{
 const shared={uTime:{value:0},uSunCol:{value:new T.Color()},uPebble:{value:null}};
 const view={clear:[{x:1.44,z:70,r:4.2}],focus:new T.Vector3(2.3,1,69.7),viewer:new T.Vector3(6,3,65)};
 const m=new T.Matrix4(),p=new T.Vector3();
 function snap(){const out=[];for(const mobile of [false,true]){const veg=createVegetation(shared,{mobile,...view});
  for(const l of veg.userData.lods)for(const im of [l.hi,l.lo])for(let i=0;i<im.count;i++){im.getMatrixAt(i,m);p.setFromMatrixPosition(m);out.push([l.hi.name,p.x,p.y,p.z]);}
  const g=veg.userData.grass;for(let i=0;i<g.count;i++){g.getMatrixAt(i,m);p.setFromMatrixPosition(m);out.push(['grass',p.x,p.y,p.z]);}
  createRocks(shared,{mobile,clear:view.clear}).group.children.forEach((im,j)=>{for(let i=0;i<im.count;i++){im.getMatrixAt(i,m);p.setFromMatrixPosition(m);out.push(['rock'+j,p.x,p.y,p.z]);}});}
  return out.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]-b[1]||a[3]-b[3]);}
 const now=snap(),keep=BEACH.s1;BEACH.s1=1e9;const orig=snap();BEACH.s1=keep;   // 整形なしの地形と比べる
 assert.equal(now.length,orig.length);
 let moved=0;
 for(let i=0;i<now.length;i++){const a=now[i],b=orig[i];assert.equal(a[0],b[0]);assert.equal(a[1],b[1]);assert.equal(a[3],b[3]);
  const want=b[2]+(heightAt(a[1],a[3])-baseHeightAt(a[1],a[3]));assert.ok(Math.abs(a[2]-want)<1e-4,'高さだけ地面に追従');if(a[2]!==b[2])moved++;}
 assert.ok(moved>0);
});
