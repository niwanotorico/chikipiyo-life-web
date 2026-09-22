import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {getBeakTip,installBurgerMotion,installPotatoMotion,updateBurgerMotion,updatePotatoMotion} from '../src/world/burger-motion.js';
import {createCharacter} from '../src/characters/model.js';
import {installCharacterVisual} from '../src/characters/gltf.js';
import {characterDefinitions} from '../src/characters/config.js';
import {animateCharacter} from '../src/characters/animation.js';
import {roomFurniture} from '../src/world/room-layout.js';

async function asset(path){
 const b=readFileSync(new URL(`../assets/${path}.glb`,import.meta.url));
 return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
}

test('piyomi keeps the burger set on the plate and eats a single fry three times',async()=>{
 const burger=await asset('props/burger'),potato=await asset('props/potato-single');
 installBurgerMotion(burger);installPotatoMotion(potato);
 const body=burger.userData.burgerMotion.body,burgerRest=body.position.clone();
 const stationary=['14_Dessert_|_Circle001','Circle033','Cube060'].map(name=>burger.getObjectByName(name).matrixWorld.clone());
 const {center,mouthClearance}=potato.userData.potatoMotion;
 const c=createCharacter(characterDefinitions.find(d=>d.id==='piyomi'));
 installCharacterVisual(c,await asset('characters/piyomi'));
 const seat=roomFurniture.find(f=>f.id==='table').seats.piyomi;
 c.root.position.set(...seat.spot);c.root.rotation.y=seat.face;
 Object.assign(c,{phase:'acting',action:'eat',target:{id:'table',seats:true,...seat}});
 const frame=t=>{c.elapsed=t;animateCharacter(c,t);updateBurgerMotion(burger,c);updatePotatoMotion(potato,c);burger.updateWorldMatrix(true,true);potato.updateWorldMatrix(true,true);return potato.localToWorld(center.clone());};
 let visible=false,cycles=0,previous=frame(0);
 assert(burger.visible,'meal starts with the complete burger set visible');assert(!potato.visible,'single fry is hidden before the first bite');
 for(let i=1;i<=1000;i++){
  const point=frame(i/100),next=potato.visible;
  if(next&&!visible)cycles++;
  visible=next;
  if(next)assert(point.distanceTo(previous)<.025,`no fry teleport at frame ${i}`);
  previous=point;
  assert(body.position.equals(burgerRest),'burger body never leaves the plate');
  ['14_Dessert_|_Circle001','Circle033','Cube060'].forEach((name,index)=>assert(burger.getObjectByName(name).matrixWorld.equals(stationary[index]),`${name} stays fixed`));
 }
 assert.equal(cycles,3,'three small fry bites');
 for(const t of [2,5,8]){
  const point=frame(t),beak=getBeakTip(c);
  assert(point.distanceTo(beak.tip)>.04,'fry center stays outside the beak');
  assert(point.distanceTo(beak.tip)<mouthClearance+.02,'fry stops immediately in front of the beak');
  assert(c.expressionMeshes.happy.every(mesh=>mesh.visible),'happy expression remains active');
 }
 frame(10);assert(!potato.visible,'fry hides after the final bite');
 updateBurgerMotion(burger,null);updatePotatoMotion(potato,null);
 assert(!burger.visible,'burger set hides when the meal ends');assert(!potato.visible,'fry also hides when the meal ends');
});
