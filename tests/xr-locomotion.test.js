import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {rotateAroundY,traceArc,deadzone} from '../src/xr/xr-locomotion.js';
import {riverFloor,walkable,canStand,xrStartPose,WADE_DEPTH} from '../src/river/xr-river.js';
import {heightAt,riverCenter,WATER_Y} from '../src/river/terrain.js';

test('snap turn keeps the head where it is (matches Object3D.rotation.y)',()=>{
 const rig=new T.Object3D();rig.position.set(2,0,5);rig.updateMatrixWorld();
 const headLocal=new T.Vector3(.4,1.6,-.3),head=headLocal.clone().applyMatrix4(rig.matrixWorld);
 const a=-Math.PI/6,p=rotateAroundY(rig.position,head,a);
 rig.position.set(p.x,0,p.z);rig.rotation.y+=a;rig.updateMatrixWorld();
 const after=headLocal.clone().applyMatrix4(rig.matrixWorld);
 assert.ok(after.distanceTo(head)<1e-9);
});

test('teleport arc lands on the ground in front',()=>{
 const flat=()=>0,r=traceArc({x:0,y:1.2,z:0},new T.Vector3(0,.5,-1).normalize(),flat);
 assert.ok(r.hit);assert.equal(r.hit.y,0);assert.ok(r.hit.z<-2&&Math.abs(r.hit.x)<1e-9);
 assert.equal(traceArc({x:0,y:1,z:0},{x:0,y:1,z:0},flat,{maxSteps:5}).hit,null);
});

test('stick deadzone',()=>{assert.equal(deadzone(.1),0);assert.equal(deadzone(1),1);assert.equal(deadzone(-1),-1);});

test('river floor lets you wade the shallows but not sink in deep pools',()=>{
 const z=40,x=riverCenter(z);
 assert.ok(riverFloor(x,z)>=WATER_Y-WADE_DEPTH-1e-9);
 const bank=x+30;assert.equal(riverFloor(bank,z),heightAt(bank,z));
 assert.equal(canStand(0,500),false);
 // cannot walk straight up a cliff
 let cliff=null;for(let s=0;s<60&&!cliff;s+=.5){const a=x+8+s,b=a+.4;if(heightAt(b,z)-heightAt(a,z)>.3)cliff=[a,b];}
 if(cliff)assert.equal(walkable(cliff[0],z,cliff[1],z),false);
});

test('VR start pose stands near the anglers, facing them, not in deep water',()=>{
 const z=60,x=riverCenter(z)+9.5,y=heightAt(x,z);
 const anglers=[-2.5,0,2.5].map(dz=>({pos:new T.Vector3(x,y,z+dz)}));
 const spot={anglers,camera:{position:new T.Vector3(riverCenter(z),2.5,z+2)}};
 const p=xrStartPose(spot),mid=anglers[1].pos;
 assert.ok(heightAt(p.x,p.z)>WATER_Y-.3);
 const d=Math.hypot(p.x-mid.x,p.z-mid.z);assert.ok(d>=2.2&&d<=5.01,'distance '+d);
 const fwd=new T.Vector3(0,0,-1).applyEuler(new T.Euler(0,p.yaw,0));
 assert.ok(fwd.dot(new T.Vector3(mid.x-p.x,0,mid.z-p.z).normalize())>.99);
});
