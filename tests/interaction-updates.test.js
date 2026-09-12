import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {characterDefinitions} from '../src/characters/config.js';
import {createCharacter} from '../src/characters/model.js';
import {LifeSimulation} from '../src/simulation/life.js';
import {roomFurniture,roomObstacles} from '../src/world/room-layout.js';
import {loadLatestRoom,animateRoom} from '../src/world/latest-room.js';
import {installRoomAccessories} from '../src/world/room-accessories.js';
import {animateCharacter} from '../src/characters/animation.js';

const setup=()=>{const cs=characterDefinitions.map(createCharacter),fs=roomFurniture.slice();fs.obstacles=roomObstacles;return {cs,sim:new LifeSimulation(cs,fs)};};
test('drag releases the seat, freezes autonomy, rejects walls/furniture, and resumes from the drop',()=>{
 const {cs,sim}=setup(),c=cs[0];cs.slice(1).forEach(o=>o.remaining=1e6);assert(sim.command(c,'sofa'));
 sim.beginDrag(c);assert.equal(c.target,null);const elapsed=c.elapsed;
 sim.update(10);assert.equal(c.elapsed,elapsed);assert(!sim.command(c,'bed'));
 assert(!sim.dragTo(c,[10,0,10]));assert(!sim.dragTo(c,roomFurniture.find(f=>f.id==='sofa').position));
 assert(sim.dragTo(c,[-1,0,0]));sim.endDrag(c);assert.deepEqual(c.root.position.toArray(),[-1,0,0]);
 sim.update(.9);assert.equal(c.dragging,false);assert(c.target);
 sim.beginDrag(c);const start=c.root.position.clone();assert(sim.dragTo(c,[-1,0,-1]));sim.endDrag(c,true);assert(c.root.position.equals(start));
});
test('three sofa reservations stay distinct while walkers may overlap softly',()=>{
 const {cs,sim}=setup();for(const c of cs)assert(sim.command(c,'sofa'));
 assert.equal(new Set(cs.map(c=>c.target.reservationKey)).size,3);
 assert(cs[1].target.seatAnchor[0]<cs[0].target.seatAnchor[0]);assert(cs[2].target.seatAnchor[0]>cs[0].target.seatAnchor[0]);
});
test('autonomous vacuum chooses varying clear floor areas with room for the rigid wand',()=>{
 const {cs,sim}=setup(),c=cs[0],positions=new Set();
 for(let i=0;i<20;i++){assert(sim.command(c,'vacuum'));const [x,,z]=c.target.spot;assert(sim.clearFloor(x,z,.85));positions.add(c.target.spot.join(','));c.target=null;}
 assert(positions.size>1);
});
test('coffee uses the same mesh/material and restores the table cup on drag interruption',async()=>{
 const raw=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 const fs=await loadLatestRoom(new Scene(),'test',{loadAsync:async()=>gltf});
 const cs=characterDefinitions.map(createCharacter),c=cs[0],sim=new LifeSimulation(cs,fs);installRoomAccessories(c,fs);
 const table=fs.find(f=>f.id==='table'),cups=[];table.group.traverse(o=>{if(o.userData.roomAccessory==='08_Coffee_|_Vert001')cups.push(o)});
 assert(cups.length);const held=[];c.food.traverse(o=>{if(o.isMesh)held.push(o)});
 assert.equal(held.length,cups.length);for(const o of held)assert(cups.some(m=>m.geometry===o.geometry&&m.material===o.material));
 Object.assign(c,{target:sim.getTarget(c,'table'),phase:'acting',action:'eat',elapsed:2});animateCharacter(c,2);animateRoom(fs,cs,2);
 assert(c.food.visible);assert(cups.every(o=>!o.visible));
 sim.beginDrag(c);animateCharacter(c,2);animateRoom(fs,cs,2);assert(!c.food.visible);assert(cups.every(o=>o.visible));
});
