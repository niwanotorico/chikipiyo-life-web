import test from 'node:test';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import fs from 'node:fs';
import {createCharacter} from '../src/characters/model.js';
import {characterDefinitions} from '../src/characters/config.js';
import {loadCharacterVisual} from '../src/characters/gltf.js';
import {animateCharacter} from '../src/characters/animation.js';

// A real self-contained GLB, generated in memory (six rigid triangle parts).
function fixture(){
 const names=['Body','Head','Wing_L','Wing_R','Leg_L','Leg_R'];
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1,2,3,4,5]}],nodes:names.map((name,i)=>({name,mesh:0,translation:[i*.1,.5,0]})),meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[.1,.1,0]}]};
 const text=JSON.stringify(json),padded=text+' '.repeat((4-text.length%4)%4),bytes=new TextEncoder().encode(padded),buffer=new ArrayBuffer(12+8+bytes.length+8+36),view=new DataView(buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,bytes.length,true);view.setUint32(16,0x4e4f534a,true);new Uint8Array(buffer,20,bytes.length).set(bytes);const at=20+bytes.length;view.setUint32(at,36,true);view.setUint32(at+4,0x004e4942,true);new Float32Array(buffer,at+8,9).set([0,0,0,.1,0,0,0,.1,0]);return buffer;
}
test('missing and failed GLBs keep procedural appearance and never reject',async()=>{
 const c=createCharacter(characterDefinitions[0]);let calls=0;
 assert.equal(await loadCharacterVisual(c,undefined,{loadAsync(){calls++;}}),false);assert.equal(calls,0);
 assert.equal(await loadCharacterVisual(c,'bad',{loadAsync:async()=>{throw new Error('404');}}),false);
 assert.equal(c.visualSource,'procedural');assert.equal(c.body.visible,true);assert.equal(c.visualLoadError,'404');
});
test('invalid part names leave all original meshes intact',async()=>{
 const gltf=await new GLTFLoader().parseAsync(fixture(),'');gltf.scene.children[1].name='Wrong';
 const c=createCharacter(characterDefinitions[0]),children=c.rig.children.slice();
 assert.equal(await loadCharacterVisual(c,'invalid',{loadAsync:async()=>gltf}),false);assert.deepEqual(c.rig.children,children);assert.equal(c.body.visible,true);
});
for(const def of characterDefinitions)test(`${def.name}: real GLB attaches during sleep without replacing anchors`,async()=>{
 const c=createCharacter(def),original=[c.root,c.rig,c.head,...c.arms,...c.legs,c.vr,c.props];
 Object.assign(c,{action:'sleep',phase:'acting',elapsed:2,target:{position:[-3.7,0,2]}});animateCharacter(c,2);
 const rootPosition=c.root.position.clone(),rootRotation=c.root.quaternion.clone();
 const gltf=await new GLTFLoader().parseAsync(fixture(),'');
 assert.equal(await loadCharacterVisual(c,'valid',{loadAsync:async()=>gltf}),true);
 assert.deepEqual([c.root,c.rig,c.head,...c.arms,...c.legs,c.vr,c.props],original);assert.ok(c.root.position.equals(rootPosition));assert.ok(c.root.quaternion.equals(rootRotation));assert.equal(c.root.scale.x,1);assert.equal(c.body.visible,false);assert.equal(c.vr.parent,c.head);
 Object.assign(c,{action:'idle',elapsed:0});animateCharacter(c,0);c.root.position.set(0,0,0);c.root.rotation.set(0,0,0);c.root.updateMatrixWorld(true);
 const head=c.head.getObjectByName('Head');assert.ok(head.getWorldPosition(new Vector3()).distanceTo(new Vector3(.1,.5,0))<1e-6);
 Object.assign(c,{action:'vr'});animateCharacter(c,1);assert.equal(c.vr.visible,true);assert.equal(head.parent.parent,c.head);
});

test('piyomi release GLB has six rigid parts and attaches to the small-character pivots',async()=>{
 const bytes=fs.readFileSync(new URL('../assets/characters/piyomi.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 for(const name of ['Body','Head','Wing_L','Wing_R','Leg_L','Leg_R'])assert.ok(gltf.scene.getObjectByName(name),name);
 const c=createCharacter(characterDefinitions.find(def=>def.id==='piyomi'));
 assert.equal(await loadCharacterVisual(c,'piyomi',{loadAsync:async()=>gltf}),true);
 assert.equal(c.visualSource,'glb');assert.equal(c.head.position.y,.69);
});
