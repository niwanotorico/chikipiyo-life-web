import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter} from '../src/characters/model.js';
import {characterDefinitions} from '../src/characters/config.js';
import {loadVrHeadsetVisual} from '../src/characters/vr-gltf.js';

for(const def of characterDefinitions)test(`${def.name}: supplied VR headset remains attached to the animated head`,async()=>{
 const bytes=fs.readFileSync(new URL('../assets/props/vr-headset.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const c=createCharacter(def),position=c.vr.position.clone();
 assert.equal(await loadVrHeadsetVisual(c,'headset',{loadAsync:async()=>gltf}),true);
 assert.equal(c.vr.parent,c.head);assert.ok(c.vr.position.equals(position));assert.equal(c.vrFallback.visible,false);assert.equal(c.vr.visualSource,'glb');
});
