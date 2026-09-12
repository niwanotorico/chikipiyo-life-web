import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadLatestRoom,animateRoom} from '../src/world/latest-room.js';

test('printer tip follows revealed layers in XY, parks, and restores its cable after interruption',async()=>{
 const b=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const furniture=await loadLatestRoom(new Scene(),'test',{loadAsync:async()=>gltf});
 const printer=furniture.find(f=>f.id==='printer'),rig=printer.printerMotion;
 assert.equal(rig.head.children.length,5);assert.equal(rig.rail.children.length,3);assert.equal(rig.cables.length,1);
 const actor={target:printer,phase:'acting',elapsed:0};
 const positions=[];
 for(const elapsed of [1,3,6,9,12,13.9]){
  actor.elapsed=elapsed;animateRoom(furniture,[actor],elapsed);
  const tip=rig.tip.clone().add(rig.head.position),height=printer.printBottom+(printer.printTop-printer.printBottom)*elapsed/14;
  assert(Math.abs(tip.y-height-.045)<1e-6);
  assert(Math.abs(tip.x-rig.center.x)<=rig.size.x*.38+1e-6);
  assert(Math.abs(tip.z-rig.center.z)<=rig.size.z*.36+1e-6);
  assert.equal(rig.rail.position.y,rig.railLift);assert.equal(rig.rail.position.z,rig.head.position.z+rig.railForward);
  positions.push(tip);
 }
 assert(positions[0].y<positions.at(-1).y);
 assert(Math.max(...positions.map(p=>p.x))-Math.min(...positions.map(p=>p.x))>.1);
 assert(Math.max(...positions.map(p=>p.z))-Math.min(...positions.map(p=>p.z))>.1);
 actor.elapsed=15.6;animateRoom(furniture,[actor],15.6);assert(rig.head.position.distanceTo(new Vector3())<1e-6);
 animateRoom(furniture,[],17);animateRoom(furniture,[],18);
 assert.equal(rig.head.position.length(),0);assert.deepEqual(rig.rail.position.toArray(),[0,rig.railLift,rig.railForward]);
 for(const c of rig.cables)assert.deepEqual(c.mesh.geometry.attributes.position.array,c.rest);
 actor.elapsed=6;animateRoom(furniture,[actor],20);const before=rig.head.position.clone();
 animateRoom(furniture,[],20);assert(rig.head.position.equals(before));
 animateRoom(furniture,[],20.4);assert(rig.head.position.length()<before.length());
 animateRoom(furniture,[],21);assert.equal(rig.head.position.length(),0);
});

test('high cross rail clears furniture, windows, walls and upper beams for the entire cycle',async()=>{
 const b=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf});
 const printer=furniture.find(f=>f.id==='printer'),rig=printer.printerMotion;
 scene.updateMatrixWorld(true);
 const obstacles=[];
 scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData.furnitureId==='printer')return;
  const box=new Box3().setFromObject(mesh);
  // Exclude the tall external filament spool; it is part of the printer's supply.
  if(box.max.y<2.8||box.min.y>3.45)obstacles.push({name:mesh.name,box});
 });
 assert(obstacles.length>20);
 const upperY=rig.upper.map(({mesh})=>new Box3().setFromObject(mesh).min.y);
 for(let t=0;t<=17;t+=.05){
  animateRoom(furniture,t<16?[{target:printer,phase:'acting',elapsed:t}]:[],t);
  scene.updateMatrixWorld(true);
  const railBounds=new Box3().setFromObject(rig.rail);
  assert(railBounds.min.y>2.8);assert(railBounds.max.y<3.45);
  for(const o of obstacles)assert(!railBounds.intersectsBox(o.box),`t=${t}: ${o.name}`);
  rig.upper.forEach(({mesh},i)=>assert(Math.abs(new Box3().setFromObject(mesh).min.y-upperY[i])<1e-6));
  const nozzle=new Box3().setFromObject(rig.head.children.find(m=>m.name==='Mesh_60'));
  assert(Math.abs(nozzle.min.y-(rig.tip.y+rig.offset.y))<1e-6);
  assert.equal(rig.supports.position.z,rig.rail.position.z);
 }
});
