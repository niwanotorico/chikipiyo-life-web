import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {roomFurniture as furnitureDefinitions,roomObstacles} from '../src/world/room-layout.js';
const humanLayout=Object.fromEntries(furnitureDefinitions.map(f=>[f.id,f]));
import {findPath} from '../src/simulation/navigation.js';
import {characterDefinitions} from '../src/characters/config.js';
const furniture=furnitureDefinitions.map(d=>({...d,...humanLayout[d.id]}));
test('human source is unchanged and room contains no duplicate residents',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/room/human-room-manifest.json',import.meta.url)));
 const sourceUrl=new URL(`../${manifest.source.replaceAll('\\','/')}`,import.meta.url);
 if(existsSync(sourceUrl)){
  assert.equal(createHash('sha256').update(readFileSync(sourceUrl)).digest('hex'),manifest.sha256);
 }else{
  // The authoring .blend is intentionally local-only; CI validates the published assets instead.
  assert.equal(manifest.sourceUnchanged,true);
  assert.match(manifest.sha256,/^[a-f0-9]{64}$/);
 }
 const data=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 assert(data.byteLength>20);
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 assert.equal(gltf.asset?.version,'2.0');
 assert(gltf.meshes?.length>0&&gltf.meshes.length<=manifest.meshes?.length);
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

test('台帳に載せた透過素材だけを不透明にし、透過の描き直しパスをなくす（実アセット）',async()=>{
 const {loadLatestRoom}=await import('../src/world/latest-room.js');
 const {loadHumanActionProps}=await import('./action-props-fixture.js');
 const {opaqueTransmissionTargets}=await import('../src/world/transmission.js');
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const warnings=[],warn=console.warn;console.warn=m=>warnings.push(String(m));
 try{
  const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf});await loadHumanActionProps(scene,furniture);
  const left=[],opaque=[];scene.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material)){if(m.transmission>0)left.push(o.name);if(m.userData.opaqueFrom)opaque.push(o.name);}});
  assert.deepEqual(left,[],'シーンに透過素材が残らない');
  for(const t of opaqueTransmissionTargets)assert(opaque.includes(t.mesh),`台帳の対象が不透明化された: ${t.mesh}`);
  assert.deepEqual(warnings.filter(w=>w.includes('[transmission]')),[],'台帳と実アセットが一致している');
 }finally{console.warn=warn;}
});

test('台帳にない透過素材（ガラス・同じ名前の別メッシュ・値が変わった素材）は変更しない',async()=>{
 const {Mesh,BoxGeometry,MeshPhysicalMaterial,Group}=await import('three');
 const {applyOpaqueTransmissionTargets}=await import('../src/world/transmission.js');
 const target={asset:'test',mesh:'Page',parent:'book',material:'white',transmission:.24,color:'ffffff'};
 const white=new MeshPhysicalMaterial({color:0xffffff,transmission:.24});white.name='white';
 const glass=new MeshPhysicalMaterial({transmission:.9});glass.name='glass';
 const changed=new MeshPhysicalMaterial({color:0xffffff,transmission:.3});changed.name='white';
 const root=new Group(),book=new Group();book.name='book';root.add(book);
 const add=(parent,name,m)=>{const mesh=new Mesh(new BoxGeometry(),m);mesh.name=name;parent.add(mesh);return mesh;};
 const page=add(book,'Page',white),sameMaterialOther=add(root,'Curtain',white),window_=add(root,'Window',glass);
 const otherBook=new Group();otherBook.name='book2';root.add(otherBook);const tweaked=add(otherBook,'Page',changed);
 const warnings=[];const report=applyOpaqueTransmissionTargets(root,'test',{targets:[target],warn:m=>warnings.push(m)});
 assert.equal(page.material.transmission,0,'台帳の対象は不透明');
 assert.notEqual(page.material,white,'元の素材は書き換えずコピーを使う');assert.equal(white.transmission,.24);
 assert.equal(sameMaterialOther.material,white,'同じ素材を使う台帳外のメッシュは透過のまま');
 assert.equal(window_.material.transmission,.9,'ガラスは変更しない');
 assert.equal(tweaked.material.transmission,.3,'親が違う・値が違うものは変更しない');
 assert.equal(report.applied.length,1);assert.equal(report.unlisted.length,3);
 assert(warnings.some(w=>w.includes('台帳にない透過素材')),'台帳外の透過素材を知らせる');
 const missing=[];applyOpaqueTransmissionTargets(new Group(),'test',{targets:[target],warn:m=>missing.push(m)});
 assert(missing.some(w=>w.includes('見つからない')),'アセットが変わったら知らせる');
});
