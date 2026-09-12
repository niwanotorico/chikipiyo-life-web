import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadLatestRoom,animateRoom} from '../src/world/latest-room.js';
import {roomFurniture,roomObstacles} from '../src/world/room-layout.js';
import {characterDefinitions} from '../src/characters/config.js';
import {createCharacter} from '../src/characters/model.js';
import {animateCharacter} from '../src/characters/animation.js';
import {LifeSimulation} from '../src/simulation/life.js';
import {actions} from '../src/simulation/actions.js';
import {findPath} from '../src/simulation/navigation.js';
import {installRoomAccessories} from '../src/world/room-accessories.js';
import {loadCharacterVisual} from '../src/characters/gltf.js';
import {Box3} from 'three';

test('latest routes clear static furniture including dining chairs and kitchen',()=>{
 for(const start of [...characterDefinitions.map(c=>c.start),...roomFurniture.map(f=>f.spot)])for(const target of roomFurniture){
  const route=findPath(start,target.spot,roomObstacles);assert(route.length);
  const path=[start,...route];
  for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.1){
   const x=path[i-1][0]*(1-t)+path[i][0]*t,z=path[i-1][2]*(1-t)+path[i][2]*t;
   assert(!roomObstacles.some(o=>Math.abs(x-o.position[0])<o.footprint[0]/2+.20&&Math.abs(z-o.position[2])<o.footprint[1]/2+.20),`${target.id}: ${x},${z}`);
  }
 }
});

test('latest room actions arrive for every resident, reserve furniture, and pause',()=>{
 const furniture=roomFurniture.slice();furniture.obstacles=roomObstacles;
 assert(!('cook' in actions));assert(!('snack' in actions));assert(!('read' in actions));
 for(const def of characterDefinitions)for(const target of furniture){
  // 予約：席が分かれている家具（ソファ・テーブル）は同時に使えるが、それ以外はふさがる。
  const first=createCharacter(def),second=createCharacter(characterDefinitions.find(d=>d.id!==def.id));
  const booking=new LifeSimulation([first,second],furniture);
  assert(booking.command(first,target.id),`${def.name} → ${target.id}`);
  assert.equal(booking.command(second,target.id),!!target.seats,target.id);

  // 到着：歩行そのものは一人で確認する（相手役が通路に立つ状況は別テスト）。
  const c=createCharacter(def),sim=new LifeSimulation([c],furniture);
  assert(sim.command(c,target.id));
  sim.paused=true;sim.update(1);assert.equal(sim.time,0);sim.paused=false;
  for(let n=0;n<3000&&c.phase!=='acting';n++){sim.update(1/60);animateCharacter(c,sim.time);}
  assert.equal(c.phase,'acting');assert.equal(c.action,target.action);
  // 席が分かれている家具はキャラごとの spot が正解。
  assert(c.root.position.distanceTo(new Vector3(...c.target.spot))<.06,`${def.name} → ${target.id}`);
  assert(!sim.command(c,'kitchen'));assert(!sim.command(c,'fridge'));
 }
});

test('a resident passes a standing neighbour without getting stuck',()=>{
 const furniture=roomFurniture.slice();furniture.obstacles=roomObstacles;
 const bed=furniture.find(f=>f.id==='bed');
 const c=createCharacter(characterDefinitions[1]),blocker=createCharacter(characterDefinitions[0]);
 const sim=new LifeSimulation([c,blocker],furniture);
 Object.assign(blocker,{target:null,path:[],phase:'acting',action:'idle',remaining:1e6});
 blocker.root.position.set(bed.spot[0]+.1,0,bed.spot[2]);
 assert(sim.command(c,'bed'));
 for(let n=0;n<3000&&c.phase==='walking';n++)sim.update(1/60);
 assert.equal(c.phase,'acting');assert.equal(c.target?.id,'bed');
});

test('bed blankets, VR pickup, vacuum and printing restore after interruption',async()=>{
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const furniture=await loadLatestRoom(new Scene(),'test',{loadAsync:async()=>gltf});
 const parts=tag=>{const result=[];for(const f of furniture)f.group.traverse(o=>{if(o.isMesh&&o.userData.roomPart===tag)result.push(o);});return result;};
 const actors=furniture.map(f=>({target:f,phase:'acting',elapsed:7}));
 animateRoom(furniture,actors,7);
 assert(parts('Blanket_idle').every(o=>!o.visible));assert(parts('Blanket_in_use').every(o=>o.visible));
 const vr=[];furniture.find(f=>f.id==='vr').group.traverse(o=>{if(o.isMesh&&o.userData.vrDockHeadset)vr.push(o);});
 assert(vr.length);assert(vr.every(o=>!o.visible));
 // 掃除機のグループ自体は原点のまま（動かすのは中の本体だけ）。
 assert.equal(furniture.find(f=>f.id==='vacuum').group.position.length(),0);
 assert(parts('edp_house').length);assert(parts('edp_house').every(o=>[].concat(o.material).every(m=>m.clippingPlanes?.length===1)));
 animateRoom(furniture,[],8);
 assert(parts('Blanket_idle').every(o=>o.visible));assert(parts('Blanket_in_use').every(o=>!o.visible));
 assert(vr.every(o=>o.visible));assert.equal(furniture.find(f=>f.id==='vacuum').group.position.length(),0);
 // 掃除中は本体もキャラの横へ移動し、ホースは短く、ノズルだけが手元で前後に動く。
 const vacuum=furniture.find(f=>f.id==='vacuum'),motion=vacuum.vacuumMotion,cleaner=createCharacter(characterDefinitions[0]);
 cleaner.root.position.set(-1.2,0,.6);cleaner.root.rotation.y=.9;
 Object.assign(cleaner,{target:{...vacuum,spot:[-1.2,0,.6],face:.9},phase:'acting',elapsed:0});
 const sampled=[],hoses=[];
 for(const elapsed of [.2,.9,1.6,2.3]){cleaner.elapsed=elapsed;animateCharacter(cleaner,elapsed);animateRoom(furniture,[cleaner],elapsed);
  sampled.push(motion.nozzle.position.clone());
  const dock=motion.carrier.localToWorld(new Vector3(4.27,.25,3.49).sub(motion.home));
  hoses.push(dock.distanceTo(cleaner.arms[1].getWorldPosition(new Vector3())));}
 assert.equal(vacuum.group.position.length(),0);
 assert(motion.rig.visible);
 // 本体はキャラの横か後ろ、1〜1.5キャラ分（.6〜1.1m）のところ。部屋の隅に置き去りにしない。
 const body=new Box3().setFromObject(motion.chassis).getCenter(new Vector3());
 const gap=Math.hypot(body.x-cleaner.root.position.x,body.z-cleaner.root.position.z);
 assert(gap>.5&&gap<1.15,`本体がキャラのそば: ${gap}`);
 assert(hoses.every(d=>d<1.2),`ホースが伸びきらない: ${hoses}`);
 assert(Math.max(...sampled.map(p=>p.x))-Math.min(...sampled.map(p=>p.x))>.05||Math.max(...sampled.map(p=>p.z))-Math.min(...sampled.map(p=>p.z))>.05);
 assert(sampled.every(p=>Math.abs(p.y-.065)<1e-6),'ノズルは床の高さのまま');
 // ワンドは短く、手元から伸びたまま固定しない。
 assert(sampled.every(p=>p.distanceTo(cleaner.arms[1].getWorldPosition(new Vector3()))<.95),'ノズルは手元のそば');
 animateRoom(furniture,[],30);assert(!motion.rig.visible);
 // 掃除が終わったら本体は定位置へ戻る。
 assert(new Box3().setFromObject(motion.chassis).getCenter(new Vector3()).distanceTo(motion.home)<1e-6);
 assert(parts('edp_house').every(o=>[].concat(o.material).every(m=>m.clippingPlanes===null)));
});

test('worn VR gear: each resident fits the latest Blender headset',async()=>{
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const furniture=await loadLatestRoom(new Scene(),'test',{loadAsync:async()=>gltf});
 for(const def of characterDefinitions){
  const c=createCharacter(def);installRoomAccessories(c,furniture);
  const worn=c.vr.children.find(o=>o.name==='Worn_Room_VR_headset');
  assert(worn,def.name);
  if(def.id==='chiki'){assert.deepEqual(worn.position.toArray(),[0,-.025,.025]);assert.equal(worn.scale.x,1.04);}
  else{
   assert(worn.position.y<0,`${def.name}: 少し下げる`);
   assert(worn.position.z>-.03,`${def.name}: 顔側へ寄せる`);
   assert(worn.scale.x>=1&&worn.scale.x<=1.1,`${def.name}: 最新バンドに合わせて目を覆う幅`);
  }
  assert.equal(c.vrControllers.length,2);
  c.vrControllers.forEach((o,i)=>{
   assert.equal(o.parent,c.arms[i],'コントローラーは左右の翼に付く');
   assert(o.position.y<0,'翼の先で握る');
   assert(Math.sign(o.position.x)===(i===0?-1:1),'左右が入れ替わらない');
  });
  Object.assign(c,{action:'vr',phase:'acting',elapsed:1,target:null});animateCharacter(c,1);
  assert.equal(c.vr.visible,true);assert(c.vrControllers.every(o=>o.visible));
  Object.assign(c,{action:'idle'});animateCharacter(c,1);
  assert.equal(c.vr.visible,false);assert(c.vrControllers.every(o=>!o.visible));
 }
});

// ヘッドボードの前面（枕より高い位置にある板のいちばん手前のx）。
const headboardFront=mesh=>{
 const position=mesh.geometry.attributes.position,point=new Vector3();let front=-Infinity;
 mesh.updateWorldMatrix(true,false);
 for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  if(point.y>.9&&Math.abs(point.z-2.63)<1.2)front=Math.max(front,point.x);}
 return front;
};
test('sleeping heads rest on the pillow and clear the headboard',async()=>{
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf});
 scene.updateMatrixWorld(true);
 const pillow=new Box3().setFromObject(scene.getObjectByName('Plane073'));
 const front=headboardFront(scene.getObjectByName('Plane073_1'));
 const bed=furniture.find(f=>f.id==='bed');
 const files={chicken:'chicken.glb',chick:'piyokichi.glb',piyomi:'piyomi.glb'};
 for(const def of characterDefinitions){
  const c=createCharacter(def);
  // 出荷している見た目（GLB）で確かめる。
  const raw=readFileSync(new URL(`../assets/characters/${files[def.variant]}`,import.meta.url));
  const visual=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  assert.equal(await loadCharacterVisual(c,'x',{loadAsync:async()=>visual}),true);
  c.root.position.set(...bed.spot);c.root.rotation.y=.7;
  Object.assign(c,{action:'sleep',phase:'acting',elapsed:2,target:bed});
  animateCharacter(c,2);c.root.updateMatrixWorld(true);
  const head=c.head.getWorldPosition(new Vector3());
  assert(head.x>pillow.min.x&&head.x<pillow.max.x,`${def.name}: 頭が枕の上にある`);
  assert(head.y>pillow.max.y,`${def.name}: 頭が枕にめり込まない`);
  const rig=new Box3(),point=new Vector3();let above=Infinity;
  c.rig.traverseVisible(o=>{if(!o.isMesh)return;rig.expandByObject(o);
   const position=o.geometry.attributes.position;o.updateWorldMatrix(true,false);
   for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);if(point.y>.9)above=Math.min(above,point.x);}});
  assert(above>front,`${def.name}: トサカ・頭頂部がヘッドボードにめり込まない`);
  assert(rig.max.x<bed.max[0],`${def.name}: 足がベッドからはみ出さない`);
  // 背中はマットレス天面（.792）より下へ沈み、おなかは掛け布団の中に収まる。
  const torso=new Box3().setFromObject(c.rig.children.find(o=>o.name==='GLB_Body'));
  const blanketTop=new Box3().setFromObject(scene.getObjectByName('Plane008_1')).max.y;
  const drop=def.variant==='chicken'?bed.blanketDropChicken:bed.blanketDrop;
  assert(torso.min.y<.792,`${def.name}: 背中がマットレスへ沈む`);
  assert(torso.max.y<blanketTop-drop,`${def.name}: おなかが布団から浮かない`);
 }
});

test('3Dプリンター：小さい二人は赤い椅子の上、ちきんは床、全員が造形物を見る',()=>{
 const printer=roomFurniture.find(f=>f.id==='printer');
 // ビルドプレート中心（Blender実測 edp_house）。
 const plate=[4.1465,-3.019];
 assert(printer.seats,'キャラごとの立ち位置がある');
 for(const [id,seat] of Object.entries(printer.seats)){
  const at=seat.standAnchor?[seat.standAnchor[0],seat.standAnchor[2]]:[seat.spot[0],seat.spot[2]];
  const want=Math.atan2(plate[0]-at[0],plate[1]-at[1]);
  const off=Math.atan2(Math.sin(seat.face-want),Math.cos(seat.face-want));
  assert(Math.abs(off)<.05,`${id}: 造形物の方を向く (${off})`);
  assert(seat.headTilt<0,`${id}: 造形物を見上げる`);
 }
 assert(!printer.seats.chiki.standAnchor,'ちきんは椅子に立たず横から見守る');
 for(const id of ['piyo','piyomi']){
  const [x,y,z]=printer.seats[id].standAnchor;
  // 赤い椅子（Cube.002）の座面：x 4.07..4.73 / z -2.09..-1.39 / 天面 y=.61。
  assert(x>4.10&&x<4.70,`${id}: 座面の内側 x`);
  assert(z>-2.05&&z<-1.43,`${id}: 座面の内側 z`);
  assert(y>.50&&y<=.61,`${id}: 座面の高さに立つ`);
  assert(findPath(characterDefinitions[0].start,printer.seats[id].spot,roomObstacles).length,`${id}: 椅子の前まで歩ける`);
 }
 const apart=Math.hypot(printer.seats.piyo.standAnchor[0]-printer.seats.piyomi.standAnchor[0],
  printer.seats.piyo.standAnchor[2]-printer.seats.piyomi.standAnchor[2]);
 assert(apart>.4,`二人が重ならない: ${apart}`);
 // 実際に歩いて到着したあと、足もとが椅子の座面に乗る（ちきんは床のまま）。
 const furniture=roomFurniture.slice();furniture.obstacles=roomObstacles;
 for(const def of characterDefinitions){
  const c=createCharacter(def),sim=new LifeSimulation([c],furniture);
  assert(sim.command(c,'printer'),def.name);
  for(let n=0;n<3000&&c.phase!=='acting';n++)sim.update(1/60);
  assert.equal(c.action,'print');
  animateCharacter(c,1);c.root.updateMatrixWorld(true);
  const foot=c.rig.getWorldPosition(new Vector3());
  if(def.id==='chiki')assert(foot.y<.05,'ちきんは床に立つ');
  else assert(foot.distanceTo(new Vector3(...printer.seats[def.id].standAnchor))<1e-6,`${def.name}: 座面の上に立つ`);
 }
});
