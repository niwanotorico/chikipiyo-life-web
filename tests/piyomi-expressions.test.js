import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter} from '../src/characters/model.js';
import {characterDefinitions} from '../src/characters/config.js';
import {loadCharacterVisual} from '../src/characters/gltf.js';
import {animateCharacter} from '../src/characters/animation.js';

async function load(action='idle'){
 const c=createCharacter(characterDefinitions.find(d=>d.id==='piyomi'));
 Object.assign(c,{action,phase:'acting',elapsed:0,target:{id:'table',position:[0,0,0]}});
 const bytes=fs.readFileSync(new URL('../assets/characters/piyomi.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.equal(await loadCharacterVisual(c,'piyomi',{loadAsync:async()=>gltf}),true,c.visualLoadError);
 return c;
}
function check(c,expected){
 for(const [name,meshes] of Object.entries(c.expressionMeshes)){
  assert.equal(meshes.length,1,`${name}: authored pair present`);
  for(const mesh of meshes){
   assert.equal(mesh.visible,name===expected,`${name} visibility`);
   assert.equal(mesh.parent.name,'Head');
  }
 }
 assert.equal(Object.values(c.expressionMeshes).flat().filter(o=>o.visible).length,1);
}
test('authored piyomi expressions are exclusive and reset on transitions',async()=>{
 const c=await load();
 const rootPosition=c.root.position.clone();
 const pivots=[c.rig,c.head,...c.arms,...c.legs];
 check(c,'normal');
 for(const [action,phase,target,expected] of [
  ['eat','acting','table','happy'],['idle','acting','table','normal'],
  ['piano','acting','music-keyboard','happy'],['sleep','acting','bed','sleep'],
  ['piano','walking','music-keyboard','normal'],['sleep','walking','bed','normal'],
  ['sleep','acting','bed','sleep'],['idle','acting','bed','normal'],
  ['eat','acting','sofa','normal'],['vr','acting','vr','normal'],
 ]){
  Object.assign(c,{action,phase,target:{id:target,position:[0,0,0]}});
  animateCharacter(c,0);
  check(c,expected);
  assert(c.root.position.equals(rootPosition));
  assert.deepEqual([c.rig,c.head,...c.arms,...c.legs],pivots);
 }
});
test('loading during an action sets the expression before the first frame',async()=>{
 for(const [action,expected] of [['sleep','sleep'],['piano','happy'],['eat','happy']]){
  check(await load(action),expected);
 }
});
