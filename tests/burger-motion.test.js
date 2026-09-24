import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {getBeakTip,installBurgerMotion,installPotatoMotion,updateBurgerMotion,updatePotatoMotion} from '../src/world/burger-motion.js';
import {createCharacter} from '../src/characters/model.js';
import {installCharacterVisual} from '../src/characters/gltf.js';
import {characterDefinitions} from '../src/characters/config.js';
import {animateCharacter,wingTip} from '../src/characters/animation.js';
import {mealLook,biteContact,burgerStage} from '../src/characters/meal-timeline.js';
import {roomFurniture} from '../src/world/room-layout.js';

async function asset(path){
 const b=readFileSync(new URL(`../assets/${path}.glb`,import.meta.url));
 return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
}
const worldCenter=o=>new Box3().setFromObject(o).getCenter(new Vector3());
const visibleInWorld=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};

async function setup(){
 const burger=await asset('props/burger'),potato=await asset('props/potato-single');
 const bites=[await asset('props/burger_bite01'),await asset('props/burger_bite02')];
 const plate=installBurgerMotion(burger,bites);installPotatoMotion(potato);
 const c=createCharacter(characterDefinitions.find(d=>d.id==='piyomi'));
 installCharacterVisual(c,await asset('characters/piyomi'));
 const seat=roomFurniture.find(f=>f.id==='table').seats.piyomi;
 // 歩いてきた向き（椅子の方ではなく進行方向）のまま止まったところから始める
 c.root.position.set(...seat.spot);c.root.rotation.y=-Math.PI/2;
 Object.assign(c,{phase:'acting',action:'eat',target:{id:'table',seats:true,...seat,meal:plate}});
 const frame=t=>{c.elapsed=t;c.remaining=10-t;animateCharacter(c,t);updateBurgerMotion(burger,c);updatePotatoMotion(potato,c);burger.updateWorldMatrix(true,true);potato.updateWorldMatrix(true,true);c.root.updateWorldMatrix(true,true);};
 return {burger,potato,plate,c,frame,seat};
}

test('lightweight burger.glb and the two bitten stages line up on the same plate',async()=>{
 const burger=await asset('props/burger');
 for(const name of ['14_Dessert_|_Circle001','Circle033','potato_ALL','potato_single'])assert(burger.getObjectByName(name),`${name} present`);
 const bites=[await asset('props/burger_bite01'),await asset('props/burger_bite02')];
 const full=worldCenter(burger.getObjectByName('Circle033'));
 const plate=installBurgerMotion(burger,bites);
 const {stages}=burger.userData.burgerMotion;
 assert.equal(stages.length,3,'full / bite01 / bite02');
 assert.deepEqual(stages.slice(1).map(o=>o.name),['burgar_bite01','burgar_bite02']);
 for(const stage of stages){
  assert.equal(stage.parent,burger,'bitten stages travel with the plate set');
  // 食べかけは同じ置き場所・同じ大きさ（かじった分だけ -Z 側が欠ける）
  const box=new Box3().setFromObject(stage);
  assert(Math.abs(box.max.z-(full.z+plate.radius))<.01&&Math.abs(box.max.y-new Box3().setFromObject(stages[0]).max.y)<.01);
 }
 assert(new Box3().setFromObject(stages[2]).min.z>new Box3().setFromObject(stages[0]).min.z+.01,'bite02 is missing the piyomi side');
 // 軽量化した burger.glb の中身はそのまま（お皿・ポテトの山は動かさない）
 assert(worldCenter(burger.getObjectByName('Circle033')).distanceTo(full)<1e-9);
 assert.equal(plate.burger.length,3);assert(plate.radius>.1&&plate.radius<.14,'burger radius measured from the model');
 // つまむ1本は、お皿のポテトの山のすぐ横
 assert(new Vector3(...plate.fry).distanceTo(new Vector3(...plate.burger))<.25);
});

test('piyomi hops onto the chair, holds the burger in both wings, bites it down and says gochisousama',async()=>{
 const {burger,potato,plate,c,frame,seat}=await setup();
 const motion=burger.userData.burgerMotion,body=motion.body,fry=burger.getObjectByName('potato_single');
 const rest=new Vector3(...plate.burger);
 let prevRig=null,prevBurger=null,held=0,bothFries=0;const order=[];
 for(let i=0;i<=600;i++){
  const t=i/60;frame(t);
  const rig=c.rig.getWorldPosition(new Vector3());
  // 瞬間移動しない（床→座面もぴょんと跳ぶ）
  if(prevRig)assert(rig.distanceTo(prevRig)<.09,`body does not teleport at ${t.toFixed(2)}s`);
  prevRig=rig;
  // お皿のポテトと、つまんだポテトが同時に見えない（二重にならない）
  if(visibleInWorld(fry)&&potato.visible)bothFries++;
  if(!burger.visible)continue;
  const cur=motion.stages.find(visibleInWorld);
  if(!cur){prevBurger=null;continue;}
  const center=worldCenter(cur);
  if(prevBurger&&t>1)assert(center.distanceTo(prevBurger)<.08,`burger does not jump at ${t.toFixed(2)}s`);
  prevBurger=center;
  if(center.distanceTo(rest)>.05)held++;
  // 見えているバーガーは常に1つの段階だけ
  const shown=motion.stages.map((o,k)=>visibleInWorld(o)?k:-1).filter(k=>k>=0);
  assert(shown.length<=1,`one burger stage at a time (${t.toFixed(2)}s)`);
  if(shown.length&&shown[0]!==order.at(-1))order.push(shown[0]);
 }
 assert.equal(bothFries,0,'the fry on the plate hides while piyomi holds it');
 assert(held>150,'the burger spends seconds off the plate');
 assert.deepEqual(order,[0,1,2],'full → bite01 → bite02, then only the plate');

 // 着地前はお皿が出ていない、着地後は出ている
 frame(.3);assert(!burger.visible,'plate appears with the landing, not before');
 frame(1.2);assert(burger.visible&&body.visible);
 // 持っている間（もぐもぐ中）：両翼の先がバーガーの左右に触れている
 frame(3.1);
 const center=worldCenter(motion.stages[burgerStage(3.1)]),r=motion.radius;
 for(const arm of c.arms){
  arm.updateWorldMatrix(true,true);
  const {visual,tip:local}=arm.userData.mealRig;
  const tip=visual.localToWorld(local.clone());
  assert(tip.distanceTo(center)<r+.06,`wing tip reaches the burger (${tip.distanceTo(center).toFixed(3)})`);
 }
 assert(center.y>rest.y+.04,'burger is lifted above the plate');
 // かぶりつきの瞬間：くちばしがバーガーのふちに入っていて、そこで段階が変わる
 for(const [name,stage] of [['bite1',1],['bite2',2]]){
  frame(biteContact(name)-1/120);
  const before=motion.stages[stage-1];
  assert(getBeakTip(c).tip.distanceTo(worldCenter(before))<motion.radius*1.05,`beak meets the burger at ${name}`);
  frame(biteContact(name)+1/120);assert(visibleInWorld(motion.stages[stage]),`${name} swaps to stage ${stage}`);
 }
 // 表情：持ち上げて見つめる間は目ぱっちり、かじったら ^^
 frame((mealLook[0]+mealLook[1])/2);assert(c.expressionMeshes.normal.every(m=>m.visible));
 frame(3);assert(c.expressionMeshes.happy.every(m=>m.visible));
 // 食べ終わり：バーガーはもう無い、お皿とポテトの山は残る
 frame(8.6);assert.equal(burgerStage(8.6),3);assert(motion.stages.every(o=>!visibleInWorld(o)),'burger eaten');assert(burger.visible,'plate stays until hop-off');
 assert(visibleInWorld(burger.getObjectByName('potato_ALL')));
 // 最後は床（spot）に戻り、お皿は片付く
 frame(10);
 const end=c.rig.getWorldPosition(new Vector3());
 assert(Math.abs(end.x-seat.spot[0])<.03&&Math.abs(end.z-seat.spot[2])<.03&&end.y<.05,'back on the floor at the spot');
 assert(!burger.visible,'plate cleared');
 updateBurgerMotion(burger,null);updatePotatoMotion(potato,null);
 assert(!burger.visible&&!potato.visible);
 // 片付けたら元の置き場所・形に戻っている（次の食事でまた同じ場所に出る）
 assert(worldCenter(body).distanceTo(rest)<1e-6);
 assert(!motion.stages[1].visible&&!motion.stages[2].visible);
});
