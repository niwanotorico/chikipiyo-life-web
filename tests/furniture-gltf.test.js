import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Scene} from 'three';
import {createFurniture} from '../src/world/furniture.js';
import {loadFurnitureVisual,setVrDockHeadsetVisible} from '../src/world/furniture-gltf.js';

test('updated VR GLB replaces only the VR visual while preserving its clickable installation group',async()=>{
 const bytes=fs.readFileSync(new URL('../assets/furniture/vr.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const vr=createFurniture(new Scene()).find(f=>f.id==='vr'),position=vr.group.position.clone(),fallback=vr.group.children.slice();
 assert.equal(await loadFurnitureVisual(vr,'vr',{loadAsync:async()=>gltf}),true);
 assert.equal(vr.visualSource,'glb');assert.ok(vr.group.position.equals(position));
 assert.ok(fallback.every(o=>!o.visible));
 const imported=vr.group.getObjectByName('GLB_vr');let meshes=0;
 imported.traverse(o=>{if(o.isMesh){meshes++;assert.equal(o.userData.furnitureId,'vr');}});
 assert.ok(meshes>0);
});

test('VR dock hides only its headset while a resident is wearing it',()=>{
 const vr=createFurniture(new Scene()).find(f=>f.id==='vr'),headset=new (vr.group.constructor)();headset.name='Cube286';const controller=new (vr.group.constructor)();controller.name='controller';headset.add(controller);vr.group.add(headset);
 setVrDockHeadsetVisible(vr,false);assert.equal(headset.visible,false);assert.equal(controller.visible,false);
 setVrDockHeadsetVisible(vr,true);assert.equal(headset.visible,true);assert.equal(controller.visible,true);
});
