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
  const c=createCharacter(def);c.book.visible=c.food.visible=c.vr.visible=c.broom.visible=false;
  assert.ok(Math.abs(new Box3().setFromObject(c.root).min.y-.01)<1e-6);
  assert.equal(c.head.position.y,def.variant==='chicken'?1.01:.78);
  assert.ok(c.body.position.y-c.body.scale.y>=.12);
  assert.equal(c.vr.parent,c.head);assert.deepEqual(c.vr.position.toArray(),[0,.025,def.variant==='chicken'?.34:.30]);
  assert.equal(c.arms.length,2);assert.equal(c.legs.length,2);
  for(const action of ['idle','sleep','relax','eat','cook','vr','read','clean','snack']){
   Object.assign(c,{action,phase:'acting',elapsed:1});animateCharacter(c,1);c.root.updateMatrixWorld(true);
   assert.ok(c.head.matrixWorld.elements.every(Number.isFinite));assert.equal(c.vr.visible,action==='vr');
   assert.equal(c.book.visible,action==='read');
  }
 });
 test(`${def.name}: all furniture commands arrive with the real model`,()=>{
  const furniture=createFurniture(new Scene());
  for(const f of furniture){const c=createCharacter(def),sim=new LifeSimulation([c],furniture);
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


test('piyokichi is clearly smaller, with both soles on the floor',()=>{
 const sizes=characterDefinitions.map(d=>{const c=createCharacter(d);c.props.visible=false;c.vr.visible=false;const b=new Box3();c.root.updateMatrixWorld(true);c.rig.traverseVisible(o=>{if(o.isMesh)b.expandByObject(o);});return b.getSize(new Vector3());});
 assert.ok(sizes[1].y<sizes[0].y*.85);assert.ok(sizes[1].x<sizes[0].x*.9);
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

