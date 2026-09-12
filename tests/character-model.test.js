import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Scene,Raycaster,Vector3} from 'three';
import {createCharacter} from '../src/characters/model.js';
import {characterDefinitions} from '../src/characters/config.js';
import {animateCharacter} from '../src/characters/animation.js';
import {createFurniture} from '../src/world/furniture.js';
import {LifeSimulation} from '../src/simulation/life.js';
for(const def of characterDefinitions){
 test(`${def.name}: grounded rig and original VR/animation anchors`,()=>{
  const c=createCharacter(def);c.food.visible=c.vr.visible=c.broom.visible=false;
  assert.ok(Math.abs(new Box3().setFromObject(c.root).min.y-.01)<1e-6);
  assert.equal(c.head.position.y,def.variant==='chicken'?1.01:.69);
  assert.ok(c.body.position.y-c.body.scale.y>=.12);
  assert.equal(c.vr.parent,c.head);assert.deepEqual(c.vr.position.toArray(),[0,.025,def.variant==='chicken'?.34:.30]);
  assert.equal(c.arms.length,2);assert.equal(c.legs.length,2);
  assert.equal(c.book,undefined,'読書アクション用の本の小道具は残っていない');
  for(const action of ['idle','sleep','relax','eat','vr','clean','print']){
   Object.assign(c,{action,phase:'acting',elapsed:1});animateCharacter(c,1);c.root.updateMatrixWorld(true);
   assert.ok(c.head.matrixWorld.elements.every(Number.isFinite));assert.equal(c.vr.visible,action==='vr');
   // コーヒーカップを持つのは食事中のちきんだけ。
   assert.equal(c.food.visible,action==='eat'&&def.variant==='chicken',action);
  }
 });
 test(`${def.name}: all furniture commands arrive with the real model`,()=>{
  const furniture=createFurniture(new Scene());
  for(const f of furniture.filter(f=>f.action)){const c=createCharacter(def),sim=new LifeSimulation([c],furniture);
   assert.ok(sim.command(c,f.id));let n=0;while(c.phase==='walking'&&n++<5000){sim.update(1/60);animateCharacter(c,sim.time);}
   assert.equal(c.phase,'acting',f.id);assert.equal(c.action,f.action);
   assert.ok(c.root.position.distanceTo(new Vector3(...f.spot))<.06,f.id);
  }
 });
}
test('all furniture meshes retain raycast click ownership',()=>{
 const scene=new Scene(),furniture=createFurniture(scene);scene.updateMatrixWorld(true);
 for(const f of furniture){const ray=new Raycaster(new Vector3(f.position[0],5,f.position[2]),new Vector3(0,-1,0));
  const hits=ray.intersectObjects(furniture.map(x=>x.group),true);assert.ok(hits.length);assert.equal(hits[0].object.userData.furnitureId,f.id);
 }
});

test('both characters face away from the sofa backrest while relaxing',()=>{
 const furniture=createFurniture(new Scene()),sofa=furniture.find(f=>f.id==='sofa');
 assert.equal(sofa.face,0);
 for(const def of characterDefinitions){
  const c=createCharacter(def),sim=new LifeSimulation([c],furniture);
  Object.assign(c,{action:'relax',phase:'acting',target:sofa,remaining:10});
  sim.update(1);
  assert.equal(c.root.rotation.y,0,def.name);
 }
});

test('all three residents rest on the sofa cushion and sleep on the bed',()=>{
 const furniture=createFurniture(new Scene()),sofa=furniture.find(f=>f.id==='sofa'),bed=furniture.find(f=>f.id==='bed');
 for(const def of characterDefinitions){
  const c=createCharacter(def);Object.assign(c,{action:'relax',phase:'acting',elapsed:1,target:sofa});animateCharacter(c,1);c.root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(c.body).min.y>=.589,`${def.name} sofa body contact`);
  c.root.position.set(...bed.spot);Object.assign(c,{action:'sleep',phase:'acting',elapsed:1,target:bed});animateCharacter(c,1);c.root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(c.root).min.y>=.645,`${def.name} bed contact`);
 }
});


test('piyokichi is clearly smaller, with both soles on the floor',()=>{
 const sizes=characterDefinitions.map(d=>{const c=createCharacter(d);c.props.visible=false;c.vr.visible=false;const b=new Box3();c.root.updateMatrixWorld(true);c.rig.traverseVisible(o=>{if(o.isMesh)b.expandByObject(o);});return b.getSize(new Vector3());});
 assert.ok(sizes[1].y<sizes[0].y*.75);assert.ok(sizes[1].x<sizes[0].x*.8);
});
for(const def of characterDefinitions)test(`${def.name}: sleep head stays at pillow for every approach yaw`,()=>{
 const bed=createFurniture(new Scene()).find(f=>f.id==='bed');
 for(const yaw of [0,.7,Math.PI,-1.8]){
  const c=createCharacter(def);c.root.position.set(...bed.spot);c.root.rotation.y=yaw;
  Object.assign(c,{action:'sleep',phase:'acting',elapsed:2,target:bed});animateCharacter(c,2);c.root.updateMatrixWorld(true);
  const head=c.head.getWorldPosition(new Vector3()),body=c.body.getWorldPosition(new Vector3());
  assert.ok(Math.abs(head.x-bed.position[0])<1e-6);assert.ok(Math.abs(head.z-(bed.position[2]-.52))<1e-6);
  assert.ok(head.z<body.z,'head points to pillow, not foot of bed');
  const bounds=new Box3();c.rig.traverseVisible(o=>{if(o.isMesh)bounds.expandByObject(o);});
  assert.ok(bounds.min.x>bed.position[0]-.975&&bounds.max.x<bed.position[0]+.975);
  assert.ok(bounds.min.z>bed.position[2]-1.06&&bounds.max.z<bed.position[2]+1.06);
  Object.assign(c,{action:'eat'});animateCharacter(c,0);assert.equal(c.rig.rotation.x,0);assert.equal(c.rig.rotation.y,0);assert.equal(c.rig.position.z,0);
 }
});


test('only chikin holds the coffee cup, raising it to the beak while looking up',()=>{
 for(const def of characterDefinitions){
  const c=createCharacter(def);
  const sample=elapsed=>{Object.assign(c,{action:'eat',phase:'acting',elapsed,target:{}});animateCharacter(c,elapsed);
   return {visible:c.food.visible,cup:c.food.position.clone(),pitch:c.head.rotation.x};};
  if(def.variant!=='chicken'){assert.equal(sample(2).visible,false,`${def.name}の食べ物は机の上に常設`);continue;}
  const rest=sample(0),sip=sample(1.85);
  assert.equal(rest.visible,true);assert.equal(sip.visible,true);
  assert(sip.cup.y-rest.cup.y>.3,'カップを口元へ上げる');
  assert(sip.cup.distanceTo(c.head.position)<rest.cup.distanceTo(c.head.position)-.15,'カップが口元へ寄る');
  assert(sip.pitch<rest.pitch-.3,'少し上を向く');
  // カップは翼の先にある（手先で持っているように見せる）。胴体にはめり込ませない。
  for(const [name,shot] of [['手元',0],['口元',1.85]]){
   sample(shot);
   const tip=new Vector3(0,-.30,.05).applyQuaternion(c.arms[1].quaternion).add(c.arms[1].position);
   assert(tip.distanceTo(c.food.position)<.11,`${name}: カップが翼の先にある`);
   assert(c.food.position.distanceTo(c.arms[1].position)>tip.distanceTo(c.arms[1].position),`${name}: カップは翼の先の外側`);
   // 胴体は半径 .28 / 高さ .17..(chicken).82 のふくらみ。翼の先がそこへ入らないこと。
   assert(Math.hypot(tip.x,tip.z)>.30||tip.y>.86,`${name}: 翼が胴体にめり込まない`);
  }
 }
});
