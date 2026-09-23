import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadLatestRoom,animateRoom} from '../src/world/latest-room.js';
import {characterDefinitions} from '../src/characters/config.js';
import {createCharacter} from '../src/characters/model.js';
import {installCharacterVisual} from '../src/characters/gltf.js';
import {animateCharacter,wingTip} from '../src/characters/animation.js';
import {LifeSimulation} from '../src/simulation/life.js';
import {installModelingHeadphones} from '../src/world/action-props.js';
import {modelingBeat,modelingBeats,modelingProgress,hopOffDuration} from '../src/characters/modeling-timeline.js';
import {drawModelingScreen} from '../src/world/modeling-screen.js';
import {loadHumanActionProps} from './action-props-fixture.js';

const parse=path=>{const b=readFileSync(new URL(path,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
// 2D Canvas の代わり：どの呼び出しも受け付けるだけのスタブ。
const stubContext=()=>new Proxy({},{get:(t,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
const fakeCanvas=()=>({width:0,height:0,getContext:()=>stubContext()});

async function setup(){
 const scene=new Scene(),furniture=await loadLatestRoom(scene,'test',{loadAsync:async()=>parse('../assets/room/human-room.glb')},{createCanvas:fakeCanvas});
 const props=await loadHumanActionProps(scene,furniture);
 const piyo=createCharacter(characterDefinitions.find(c=>c.id==='piyo'));scene.add(piyo.root);
 installCharacterVisual(piyo,(await parse('../assets/characters/piyokichi.glb')).scene);
 const worn=installModelingHeadphones(piyo,props.headphones);
 const sim=new LifeSimulation([piyo],furniture),desk=furniture.find(f=>f.id==='desk');
 assert(sim.command(piyo,'desk'));
 for(let i=0;i<4000&&piyo.phase!=='acting';i++)sim.update(1/60);
 assert.equal(piyo.action,'model');
 // 到着フレームの経過時間を0から数え直す
 const step=(to)=>{while(piyo.phase==='acting'&&piyo.action==='model'&&piyo.elapsed<to){sim.update(1/60);animateCharacter(piyo,sim.time);animateRoom(furniture,[piyo],sim.time);}scene.updateMatrixWorld(true);};
 return {scene,furniture,props,piyo,worn,sim,desk,step};
}

test('モデリングの14秒は順番に並んだ場面でできていて、画面の進行は0から1へ増えるだけ',()=>{
 const names=['hopOn','headphones','build','think','idea','finish','done'];
 names.slice(1).forEach((name,i)=>assert.equal(modelingBeats[name][0],modelingBeats[names[i]][1],name));
 assert.equal(modelingBeat(0),'hopOn');assert.equal(modelingBeat(3),'build');assert.equal(modelingBeat(6),'think');assert.equal(modelingBeat(12,2),'done');
 assert.equal(modelingBeat(13.6,14-13.6),'hopOff','残り時間が少なくなったら椅子から降りる');
 let last=-1;for(let t=0;t<=14;t+=.05){const p=modelingProgress(t);assert(p>=last-1e-9&&p>=0&&p<=1);last=p;}
 assert.equal(modelingProgress(.5),0);assert.equal(modelingProgress(13),1);
});

test('PC画面の描画は作業に合わせてツールと進行が変わる（Canvasスタブ）',()=>{
 const tools=[3,6.5,10,12.5].map(t=>drawModelingScreen(stubContext(),512,352,t,t));
 assert.deepEqual(tools.map(s=>s.tool),[0,2,3,3],'点→面→色の順にツールが切り替わる');
 assert(tools[0].progress<tools[1].progress&&tools[1].progress<tools[2].progress&&tools[3].progress===1);
});

test('ぴよきちは椅子の横から座面へ跳び乗り、終わりに横へ降りる（瞬間移動しない）',async()=>{
 const {piyo,desk,step}=await setup();
 const floor=piyo.root.position.clone(),anchor=new Vector3(...desk.standAnchor),rig=()=>piyo.rig.getWorldPosition(new Vector3());
 assert(Math.hypot(floor.x-anchor.x,floor.z-anchor.z)<.9,'椅子のすぐ横から跳ぶ');
 animateCharacter(piyo,0);piyo.root.updateMatrixWorld(true);
 assert(rig().distanceTo(floor)<.02,'到着直後は床の上');
 let prev=rig(),peak=0;
 while(piyo.elapsed<modelingBeats.hopOn[1]){step(piyo.elapsed+1/60);const p=rig();assert(p.distanceTo(prev)<.08,`1フレームで飛ばない ${piyo.elapsed.toFixed(2)}`);peak=Math.max(peak,p.y);prev=p;}
 assert(peak>anchor.y+.05,'座面より高く弧を描く');
 step(2);assert(rig().distanceTo(anchor)<1e-6,'着地後は座面上');
 step(14-hopOffDuration-.05);prev=rig();
 while(piyo.phase==='acting'&&piyo.action==='model'){const before=rig();step(piyo.elapsed+1/60);if(piyo.phase!=='acting')break;assert(rig().distanceTo(before)<.08);prev=rig();}
 assert(prev.distanceTo(piyo.root.position.clone().setY(0))<.06,'最後は床の上、次の行動へそのまま歩き出せる');
});

test('作業中は両翼の先がノートPCの天面に届き、画面とホログラムが点く',async()=>{
 const {scene,piyo,desk,props,worn,step}=await setup();
 const laptop=new Box3().setFromObject(scene.getObjectByName(desk.modelLaptopName));
 step(.3);assert.equal(desk.modelingScreen.mesh.material,desk.modelingScreen.offMaterial,'跳んでいる間はPCは消えたまま');
 assert.equal(worn.visible,false,'ヘッドホンは着地してからかぶる');
 for(const t of [2.5,3.3,4.8,9,10.7]){
  step(t);
  piyo.arms.forEach((arm,i)=>{
   const tip=arm.localToWorld(wingTip(arm,piyo.visualSource).clone());
   assert(Math.abs(tip.y-desk.typing.surfaceY)<.06,`翼${i}の先がPCの天面の高さ t=${t} y=${tip.y.toFixed(3)}`);
   assert(tip.x>laptop.min.x&&tip.x<laptop.max.x&&tip.z>laptop.min.z&&tip.z<laptop.max.z,`翼${i}の先がノートPCの上 t=${t}`);
  });
 }
 assert.equal(desk.modelingScreen.mesh.material,desk.modelingScreen.onMaterial,'作業中は画面が点く');
 assert(desk.modelingHologram.root.visible,'ホログラムが浮かぶ');
 assert.equal(props.headphones.visible,false);assert.equal(worn.visible,true);assert.equal(worn.scale.x,worn.userData.baseScale);
 step(14-hopOffDuration+.1);assert.equal(worn.visible,false,'降りる前に外す');assert.equal(props.headphones.visible,true,'机へ戻す');
});

test('ヘッドホンはトサカの後ろで後頭部に沿い、頭にめり込まず浮きもしない',async()=>{
 const {piyo,worn,step}=await setup();
 step(3);piyo.root.updateMatrixWorld(true);
 const inv=piyo.head.matrixWorld.clone().invert(),v=new Vector3();
 const headPts=[],bandPts=[];
 piyo.head.traverse(o=>{
  if(!o.isMesh)return;let inWorn=false,hidden=false;for(let n=o;n&&n!==piyo.head;n=n.parent){if(n===worn)inWorn=true;if(!n.visible&&n!==worn)hidden=true;}
  if(hidden)return;const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);(inWorn?(o.name==='Circle024'?bandPts:null):headPts)?.push(v.clone());}
 });
 // トサカ：頭の球から上へはみ出した部分
 const C=new Vector3(0,.007,.02),crest=headPts.filter(p=>p.y>.2&&Math.hypot(p.x/.315,(p.y-C.y)/.315,(p.z-C.z)/.292)>1.06);
 assert(crest.length>20,'トサカを検出');
 const topBand=bandPts.filter(p=>Math.abs(p.x)<.13&&p.y>.18);assert(topBand.length>10,'頭頂部のバンドを検出');
 // バンドはトサカを貫かず、その後ろを通る（トサカの重心より後ろ・最短距離1cm以上）
 const crestCenterZ=crest.reduce((a,p)=>a+p.z,0)/crest.length,bandTopZ=topBand.reduce((a,p)=>a+p.z,0)/topBand.length;
 assert(bandTopZ<crestCenterZ,`バンドはトサカの後ろ ${bandTopZ.toFixed(3)} < ${crestCenterZ.toFixed(3)}`);
 const clear=Math.min(...bandPts.map(b=>Math.min(...crest.map(c=>c.distanceTo(b)))));
 assert(clear>.01,`トサカとバンドがぶつからない ${clear.toFixed(3)}`);
 // 頭頂部のバンドと頭の表面の最短距離：浮かず（<2.5cm）、深く刺さらない
 const back=headPts.filter(h=>h.z<.05&&h.y>.05),near=Math.min(...topBand.map(b=>Math.min(...back.map(h=>h.distanceTo(b)))));
 assert(near<.012,`バンドが後頭部から浮いていない ${near.toFixed(3)}`);
});

test('起動時のシェーダー事前コンパイルは画面とホログラムを一時的に点けて、元に戻す',async()=>{
 const {prewarmModelingScene}=await import('../src/world/modeling-screen.js');
 const {desk}=await setup();
 const screen=desk.modelingScreen,holo=desk.modelingHologram,seen={};
 const renderer={compile(){seen.material=screen.mesh.material;seen.holo=holo.root.visible&&holo.faces.every(m=>m.visible);},initTexture(t){seen.texture=t;}};
 const before=[screen.mesh.material,holo.root.visible,holo.faces.map(m=>m.visible)];
 assert(prewarmModelingScene(renderer,new Scene(),null,desk));
 assert.equal(seen.material,screen.onMaterial,'コンパイル時は点灯マテリアル');assert(seen.holo,'コンパイル時はホログラムが見えている');assert.equal(seen.texture,screen.texture);
 assert.deepEqual([screen.mesh.material,holo.root.visible,holo.faces.map(m=>m.visible)],before,'終わったら元の見た目');
});
