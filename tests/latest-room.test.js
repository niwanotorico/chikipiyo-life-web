import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Matrix4,Quaternion,Raycaster,Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadLatestRoom,animateRoom} from '../src/world/latest-room.js';
import {roomFurniture,roomObstacles} from '../src/world/room-layout.js';
import {characterDefinitions} from '../src/characters/config.js';
import {createCharacter} from '../src/characters/model.js';
import {animateCharacter} from '../src/characters/animation.js';
import {LifeSimulation} from '../src/simulation/life.js';
import {actions} from '../src/simulation/actions.js';
import {findPath} from '../src/simulation/navigation.js';
import {installRoomAccessories,vacuumWandLength} from '../src/world/room-accessories.js';
import {installModelingHeadphones,modelingHeadphonesFit} from '../src/world/action-props.js';
import {loadCharacterVisual} from '../src/characters/gltf.js';
import {loadHumanActionProps} from './action-props-fixture.js';

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
  if(['model','piano'].includes(target.action)){
   const c=createCharacter(def),sim=new LifeSimulation([c],furniture);
   assert.equal(sim.command(c,target.id),target.action==='model'?def.id==='piyo':def.id==='piyomi',`${def.name} の専用アクション利用可否`);
   continue;
  }
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

test('ぴよきちはPC前でモデリングし、待機用と装着用ヘッドホンを切り替える',async()=>{
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf}),props=await loadHumanActionProps(scene,furniture);
 const piyo=createCharacter(characterDefinitions.find(c=>c.id==='piyo')),chiki=createCharacter(characterDefinitions.find(c=>c.id==='chiki'));
 scene.add(piyo.root,chiki.root);const worn=installModelingHeadphones(piyo,props.headphones);
 const simulation=new LifeSimulation([piyo,chiki],furniture),desk=furniture.find(f=>f.id==='desk');
 const chair=scene.getObjectByName('Cube001'),chairBounds=new Box3().setFromObject(chair),chairCenter=chairBounds.getCenter(new Vector3());
 const seat=new Raycaster(new Vector3(chairCenter.x,10,chairCenter.z),new Vector3(0,-1,0),0,20).intersectObject(chair,true)[0];
 assert(seat,'椅子座面の中央Raycastが当たる');assert(Math.abs(desk.standAnchor[1]-seat.point.y)<1e-6,'足元は座面上面に接地する');
 assert.equal(simulation.command(chiki,'desk'),false,'ちきんはモデリングしない');
 assert(simulation.command(piyo,'desk'));
 for(let i=0;i<3000&&piyo.phase!=='acting';i++)simulation.update(1/60);
 assert.equal(piyo.action,'model');assert(piyo.root.position.distanceTo(new Vector3(...desk.spot))<.06,'PC前まで移動する');
 // 跳び乗り（0〜.85秒）とヘッドホン装着が終わった作業中の姿勢で確認する。
 for(let i=0;i<180;i++)simulation.update(1/60);animateCharacter(piyo,3);animateRoom(furniture,[piyo],3);piyo.root.updateWorldMatrix(true,true);
 assert(piyo.rig.getWorldPosition(new Vector3()).distanceTo(new Vector3(...desk.standAnchor))<1e-6,'ぴよきちは床ではなく椅子座面に立つ');
 assert.equal(props.headphones.visible,false,'待機用は隠す');assert.equal(worn.visible,true,'頭の装着用を表示する');assert.equal(worn.parent,piyo.head,'頭の回転へ追従する');
 const laptopCenter=new Box3().setFromObject(scene.getObjectByName(desk.modelLaptopName)).getCenter(new Vector3()),forward=new Vector3(0,0,1).applyQuaternion(piyo.root.getWorldQuaternion(new Quaternion())).setY(0).normalize();
 const toLaptop=laptopCenter.sub(piyo.rig.getWorldPosition(new Vector3())).setY(0).normalize();
 assert(forward.dot(toLaptop)>.995,'くちばし正面（ローカル+Z）がPC画面中央を向く');
 // 装着側は机の待機姿勢ではなく、後頭部に沿わせた専用の傾き・大きさ・位置を使う。
 assert.deepEqual(worn.rotation.toArray().slice(0,3),[modelingHeadphonesFit.tilt,0,0],'装着側へ机上の回転を引き継がない');assert.equal(worn.scale.x,modelingHeadphonesFit.scale);assert.deepEqual(worn.position.toArray(),modelingHeadphonesFit.position);
 Object.assign(piyo,{action:'idle',target:null,phase:'acting'});animateCharacter(piyo,2);animateRoom(furniture,[piyo],2);
 assert.equal(props.headphones.visible,true,'終了時に待機用を戻す');assert.equal(worn.visible,false,'終了時に装着用を隠す');
});

test('ぴよみだけが空き床でキーボードを演奏し、終了時に片付ける',async()=>{
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf}),props=await loadHumanActionProps(scene,furniture);
 const piyomi=createCharacter(characterDefinitions.find(c=>c.id==='piyomi')),piyo=createCharacter(characterDefinitions.find(c=>c.id==='piyo'));
 scene.add(piyomi.root,piyo.root);const sim=new LifeSimulation([piyomi,piyo],furniture),piano=furniture.find(f=>f.id==='piano');
 assert.equal(props.musicKeyboard.visible,false,'通常時は非表示');assert.equal(sim.command(piyo,'piano'),false,'ぴよきちは演奏しない');assert(sim.command(piyomi,'piano'));
 for(let i=0;i<3000&&piyomi.phase!=='acting';i++)sim.update(1/60);
 assert.equal(piyomi.action,'piano');assert(piyomi.root.position.distanceTo(new Vector3(...piano.spot))<.06,'キーボード前へ移動する');
 sim.update(.2);animateCharacter(piyomi,1);animateRoom(furniture,[piyomi],1);piyomi.root.updateWorldMatrix(true,true);
 const keyboardBounds=new Box3().setFromObject(props.musicKeyboard),forward=new Vector3(0,0,1).applyQuaternion(piyomi.root.getWorldQuaternion(new Quaternion())).setY(0).normalize();
 const toKeyboard=new Vector3(...piano.keyboardCenter).sub(piyomi.root.position).setY(0).normalize();
 assert.equal(props.musicKeyboard.visible,true,'演奏中だけ表示');assert(forward.dot(toKeyboard)>.995,'鍵盤を正面に見る');assert(keyboardBounds.min.y<=.01&&keyboardBounds.min.y>=-.01,'キーボードが床へ接地する');
 assert(piyomi.legs.every(leg=>leg.rotation.x<-.9),'低い演奏姿勢');assert(Math.abs(piyomi.arms[0].rotation.x-piyomi.arms[1].rotation.x)>.05,'左右の翼を交互に動かす');
 // 鍵盤は斜めに置かれるので、鍵盤の向き（白鍵の手前＝鍵盤ローカル +Z）にそろえて測る。
 const toKeyboardFrame=new Matrix4().makeRotationY(-piano.keyboardYaw),vertex=new Vector3(),keyboardLocal=new Box3();
 props.musicKeyboard.traverse(node=>{const positions=node.geometry?.attributes.position;if(!node.isMesh||!positions)return;for(let index=0;index<positions.count;index++)keyboardLocal.expandByPoint(vertex.fromBufferAttribute(positions,index).applyMatrix4(node.matrixWorld).applyMatrix4(toKeyboardFrame));});
 const localPoints=root=>{const out=[];root.traverse(node=>{const positions=node.geometry?.attributes.position;if(!node.isMesh||!positions)return;for(let index=0;index<positions.count;index++)out.push(vertex.fromBufferAttribute(positions,index).applyMatrix4(node.matrixWorld).applyMatrix4(toKeyboardFrame).clone());});return out;};
 const wingFront=Math.min(...piyomi.arms.flatMap(arm=>localPoints(arm).map(p=>p.z)));
 const bodyFront=Math.min(...localPoints(piyomi.body).filter(p=>p.y>=keyboardLocal.min.y&&p.y<=keyboardLocal.max.y).map(p=>p.z));
assert(bodyFront>keyboardLocal.max.z,'鍵盤の高さで身体はめり込まない');// テストは GLB を読まない予備モデル（翼が小さい）で測るので、手前の縁から 10cm 以内を許容。
 assert(wingFront-keyboardLocal.max.z<.10,'通常姿勢の翼先が鍵盤へ自然に届く距離にある');
 assert(Math.abs(piyomi.root.rotation.y-piano.face)<.02||Math.abs(Math.abs(piyomi.root.rotation.y-piano.face)-2*Math.PI)<.02,'鍵盤の向きに合わせて座る');
 Object.assign(piyomi,{action:'idle',target:null,phase:'acting'});animateCharacter(piyomi,2);animateRoom(furniture,[piyomi],2);
 assert.equal(props.musicKeyboard.visible,false,'終了時は非表示へ戻す');
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
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf});await loadHumanActionProps(scene,furniture);
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
 Object.assign(cleaner,{action:'clean',target:{...vacuum,spot:[-1.2,0,.6],face:.9},phase:'acting',elapsed:0});
 const sampled=[],hoses=[],feet=[];
 for(const elapsed of [.2,.9,1.6,2.3]){cleaner.elapsed=elapsed;animateCharacter(cleaner,elapsed);animateRoom(furniture,[cleaner],elapsed);
  sampled.push(motion.nozzle.position.clone());
  // その場で掃除：root と rig は動かさず、足先は床の同じ所に残る
  assert.deepEqual(cleaner.root.position.toArray(),[-1.2,0,.6]);assert.equal(cleaner.rig.position.length(),0,'rig を平行移動しない');
  feet.push(cleaner.legs.map(leg=>leg.localToWorld(new Vector3(0,-.24,0))));
  // ワンドは固定長：伸び縮みさせず、手元とノズルの距離もいつも同じ
  assert.deepEqual(motion.wand.scale.toArray(),[1,1,1],'ワンドの scale は変えない');
  const tipToTip=cleaner.arms[1].localToWorld(new Vector3(.10,-.22,.035)).distanceTo(motion.nozzle.position);
  assert(Math.abs(tipToTip-vacuumWandLength)<1e-6,`ワンドの長さが一定: ${tipToTip}`);
  const dock=motion.carrier.localToWorld(new Vector3(4.27,.25,3.49).sub(motion.home));
  hoses.push(dock.distanceTo(cleaner.arms[1].getWorldPosition(new Vector3())));}
 assert(feet.every(f=>f.every((p,i)=>p.distanceTo(feet[0][i])<.015)),'足元が床を滑らない');
 assert.equal(vacuum.group.position.length(),0);
 assert(motion.rig.visible);
 for(const name of ['Cube052','Cube052_1','Cube052_2'])assert(vacuum.group.getObjectByName(name).visible,`${name}: canister must remain visible during cleaning`);
 const socket=vacuum.group.getObjectByName('Cube052_1');
 const hoseStart=motion.hose.geometry.parameters.path.getPoint(0);
 assert(new Box3().setFromObject(socket).containsPoint(hoseStart),'hose starts inside the actual canister socket');
 // 本体はキャラの横か後ろ、1〜1.5キャラ分（.6〜1.1m）のところ。部屋の隅に置き去りにしない。
 const body=new Box3().setFromObject(motion.chassis).getCenter(new Vector3());
 const gap=Math.hypot(body.x-cleaner.root.position.x,body.z-cleaner.root.position.z);
 assert(gap>.5&&gap<1.15,`本体がキャラのそば: ${gap}`);
 assert(hoses.every(d=>d<1.2),`ホースが伸びきらない: ${hoses}`);
 assert(Math.max(...sampled.map(p=>p.x))-Math.min(...sampled.map(p=>p.x))>.05&&Math.max(...sampled.map(p=>p.z))-Math.min(...sampled.map(p=>p.z))>.05);
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
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>gltf});await loadHumanActionProps(scene,furniture);
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
 const pair=characterDefinitions.filter(d=>['piyo','piyomi'].includes(d.id)).map(createCharacter);
 const sharedChair=new LifeSimulation(pair,roomFurniture);
 assert(sharedChair.command(pair[0],'printer'));
 assert.equal(sharedChair.command(pair[1],'printer'),false,'one resident at a time on the printer chair');
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
