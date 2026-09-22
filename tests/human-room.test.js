import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {roomFurniture as furnitureDefinitions,roomObstacles} from '../src/world/room-layout.js';
const humanLayout=Object.fromEntries(furnitureDefinitions.map(f=>[f.id,f]));
import {findPath} from '../src/simulation/navigation.js';
import {characterDefinitions} from '../src/characters/config.js';
const furniture=furnitureDefinitions.map(d=>({...d,...humanLayout[d.id]}));
test('human source is unchanged and room contains no duplicate residents',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/room/human-room-manifest.json',import.meta.url)));
 assert.equal(createHash('sha256').update(readFileSync(new URL(`../${manifest.source.replaceAll('\\','/')}`,import.meta.url))).digest('hex'),manifest.sha256);
 const data=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 assert(!gltf.nodes.some(n=>/^(chicken|piyokichi|piyomi)/.test(n.name)));
 // Vacuum and keyboard are independent action GLBs, not room-GLB meshes.
 for(const f of furniture.filter(f=>!['vacuum','piano'].includes(f.id)))assert(gltf.nodes.some(n=>n.extras?.furnitureId===f.id),f.id);
});
test('all three residents can reach every human-layout interaction and leave each one',()=>{
 for(const start of [...characterDefinitions.map(c=>c.start),...furniture.map(f=>f.spot)])
  for(const f of furniture)assert(findPath(start,f.spot,roomObstacles).length,`${start} -> ${f.id}`);
});
import {Vector3} from 'three';
import {createCharacter} from '../src/characters/model.js';
import {animateCharacter} from '../src/characters/animation.js';
test('human bed pillow alignment survives all approach angles for three residents',()=>{
 for(const def of characterDefinitions)for(const yaw of [0,.7,Math.PI,-1.8]){
  const c=createCharacter(def);c.root.position.set(...humanLayout.bed.spot);c.root.rotation.y=yaw;
  Object.assign(c,{action:'sleep',phase:'acting',elapsed:2,target:humanLayout.bed});
  animateCharacter(c,2);c.root.updateMatrixWorld(true);
  const head=c.head.getWorldPosition(new Vector3());
  assert(Math.abs(head.x-humanLayout.bed.sleepAnchor[0])<1e-6);
  assert(Math.abs(head.z-humanLayout.bed.sleepAnchor[2])<1e-6);
  assert(head.x<c.body.getWorldPosition(new Vector3()).x);
 }
});
import {Scene,Box3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadLatestRoom as loadHumanRoom} from '../src/world/latest-room.js';
import {setVrDockHeadsetVisible} from '../src/world/furniture-gltf.js';
import {loadHumanActionProps} from './action-props-fixture.js';
test('human GLB installation preserves world bounds, multi-material click tags and VR pickup',async()=>{
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const before=new Box3().setFromObject(gltf.scene);
 const scene=new Scene(),items=await loadHumanRoom(scene,'test',{loadAsync:async()=>gltf});await loadHumanActionProps(scene,items);
 const after=new Box3().setFromObject(scene);
 assert(before.min.distanceTo(after.min)<1e-5&&before.max.distanceTo(after.max)<1e-5);
 for(const item of items){assert(item.group.children.length>0,item.id);item.group.traverse(o=>{if(o.isMesh)assert.equal(o.userData.furnitureId,item.id);});}
 const vr=items.find(f=>f.id==='vr'),headsets=vr.group.children.filter(o=>o.userData.vrDockHeadset);
 assert(headsets.length>0);
 setVrDockHeadsetVisible(vr,false);assert(headsets.every(o=>!o.visible));
 assert(vr.group.children.filter(o=>!o.userData.vrDockHeadset).every(o=>o.visible));
 setVrDockHeadsetVisible(vr,true);assert(headsets.every(o=>o.visible));
});
