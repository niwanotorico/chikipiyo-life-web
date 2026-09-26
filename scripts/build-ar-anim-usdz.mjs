// 動くAR箱庭：3人（ちきん・ぴよきち・ぴよみ）の日常＋プリンのぷるぷるを入れた USDZ（iPhone Quick Look 用）。
//   node scripts/build-ar-anim-usdz.mjs
// 入力：assets/ar/chikipiyo-dollhouse.glb（今の静止AR版と同じ家・配置・縮尺）＋ キャラクター・プリンの元データ
// 出力：assets/ar/chikipiyo-dollhouse-anim.usdz（マット調整済みの本番用。静止AR版の GLB・main.js・VR には一切触れない）
//
// 仕組み：アプリと同じ LifeSimulation と animateCharacter を、乱数を固定して Node 上で回し、各部品の動きを 24fps で記録。
// three.js の USDZExporter（model-viewer が iPhone 用にその場で使うのと同じ書き出し）で家を書き出したあと、
// 動く部品の xformOp:transform を時間サンプル（timeSamples）に差し替える。Quick Look は置いた瞬間から自動再生・ループする。
// 色補正はしない（A＝補正なしを基準）。質感だけマット寄り（ツヤを抑え、映り込みの強さ ior も下げる）。
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {USDZExporter} from 'three/addons/exporters/USDZExporter.js';
import {unzipSync,zipSync,strFromU8,strToU8} from 'three/addons/libs/fflate.module.js';
import {characterDefinitions} from '../src/characters/config.js';
import {createCharacter} from '../src/characters/model.js';
import {characterAssetPaths,installCharacterVisual} from '../src/characters/gltf.js';
import {animateCharacter} from '../src/characters/animation.js';
import {LifeSimulation} from '../src/simulation/life.js';
import {loadPudding} from '../src/world/pudding.js';
import {roomFurniture,roomObstacles} from '../src/world/room-layout.js';
import {DOLLHOUSE_FILE} from '../src/ar/dollhouse-config.js';
import {simplifyMeshForAR} from './lib/ar-simplify.mjs';
import {ANIM_USDZ_FILE,ANIM_FPS,ANIM_SEED,ANIM_MAX_SECONDS,DAILY_SCRIPT,HOME_YAW,seededRandom,puddingJiggle,loopSeconds,crossfadeWeight,reduceKeyframes,MATTE,matteMaterial,AR_CLOSEUP_PARTS,trimUsdNumbers} from '../src/ar/dollhouse-anim-config.js';

const root=new URL('../',import.meta.url);
const read=p=>{const b=readFileSync(new URL(p,root));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const loader=new GLTFLoader();

// 1) 今の静止AR版と同じ家（縮尺・原点・配置そのまま）。静止の3人を外して、動く3人に入れ替える
const dollhouse=(await loader.parseAsync(read(DOLLHOUSE_FILE),'')).scene;
const house=dollhouse.getObjectByName('ChikipiyoDollhouse');
if(!house)throw new Error('ChikipiyoDollhouse node missing in '+DOLLHOUSE_FILE);
for(const d of characterDefinitions)house.getObjectByName(`Character_${d.id}`)?.removeFromParent();

// 2) 3人：アプリと同じ createCharacter＋installCharacterVisual。食べ物・VRゴーグル・ほうきは持たない
// 記録中はアプリと同じ「原点・等倍」の世界（simWorld）に置く（座る位置などを世界座標で計算するため）。書き出し前に家へ移す
const simWorld=new T.Group(),characters=[];
for(const def of characterDefinitions){
 const c=createCharacter(def);
 installCharacterVisual(c,(await loader.parseAsync(read(characterAssetPaths[c.variant].replace('../','')),'')).scene);
 c.root.name=`Character_${def.id}`;simWorld.add(c.root);characters.push(c);
}
// 静止AR版と同じ強さで軽量化（見えている部品だけ。表情の切り替え用など非表示のメッシュは書き出されない）
let tb=0,ta=0;
for(const c of characters){const meshes=[];c.root.traverse(o=>{if(o.isMesh)meshes.push(o);});for(const m of meshes){const r=await simplifyMeshForAR(m);tb+=r.before;ta+=r.after;}}
console.log(`characters triangles ${tb} -> ${ta}`);

// 2b) AR 近接品質：近くで見られやすい部品（AR_CLOSEUP_PARTS）は、軽量化前の元データから弱めに間引き直して差し替える
const room=(await loader.parseAsync(read('assets/room/human-room.glb'),'')).scene;
const furnitureOf=o=>{for(let p=o;p;p=p.parent)if(p.userData?.furnitureId)return p.userData.furnitureId;return null;};
const closeupLog=[];
for(const part of AR_CLOSEUP_PARTS.filter(p=>p.furnitureId)){
 const src=[],dst=new Map();
 room.traverse(o=>{if(o.isMesh&&furnitureOf(o)===part.furnitureId)src.push(o);});
 house.traverse(o=>{if(o.isMesh&&furnitureOf(o)===part.furnitureId)dst.set(o.name,o);});
 if(!src.length)throw new Error(`closeup part ${part.id}: no source meshes`);
 let before=0,after=0;
 for(const s of src){
  const d=dst.get(s.name);if(!d)throw new Error(`closeup part ${part.id}: ${s.name} not found in the AR dollhouse`);
  before+=d.geometry.index?d.geometry.index.count/3:d.geometry.attributes.position.count/3;
  const m=new T.Mesh(s.geometry,d.material);const r=await simplifyMeshForAR(m,{ratio:part.ratio});d.geometry=m.geometry;after+=r.after;
 }
 closeupLog.push(`${part.label} ${Math.round(before)} → ${Math.round(after)} tris (ratio ${part.ratio})`);
}
// VR機器：静止ARでは「ぴよみが身に着けている」のでテーブルから外してある。動くARでは台の上に置いたまま見せる
house.getObjectByName('VR_dock_gear')?.removeFromParent();
{
 const gear=(await loader.parseAsync(read('assets/props/vr-gear.glb'),'')).scene;gear.name='VR_dock_gear';
 const part=AR_CLOSEUP_PARTS.find(p=>p.prop==='vr-gear');let before=0,after=0;
 const meshes=[];gear.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const m of meshes){m.material=new T.MeshStandardMaterial({name:m.material.name,color:m.material.color,roughness:m.material.roughness??.8,metalness:0});const r=await simplifyMeshForAR(m,{ratio:part?.ratio??null});before+=r.before;after+=r.after;}
 house.add(gear);closeupLog.push(`VR機器 ${Math.round(before)} → ${Math.round(after)} tris (ratio ${part?.ratio})`);
}
console.log('closeup: '+closeupLog.join(' / '));

// 3) プリン：アプリと同じ loadPudding でテーブルの皿の上に置き、底を支点にする入れ物（Jiggle）に入れる
const table={...roomFurniture.find(f=>f.id==='table'),group:room};
const tmp=new T.Scene();tmp.add(room);
const pudding=await loadPudding(tmp,'pudding',table,{loadAsync:async()=>loader.parseAsync(read('assets/props/pudding.glb'),'')});
if(!pudding)throw new Error('pudding failed to load');
pudding.root.updateMatrixWorld(true);
const pBox=new T.Box3().setFromObject(pudding.root);
const jiggle=new T.Group();jiggle.name='Pudding_jiggle';
jiggle.position.set((pBox.min.x+pBox.max.x)/2,pBox.min.y,(pBox.min.z+pBox.max.z)/2);
// 家の座標（縮小前のメートル）で組んでから家に入れる：tmp シーンは原点・等倍なので attach しても大きさが変わらない
tmp.add(jiggle);jiggle.updateMatrixWorld(true);jiggle.attach(pudding.root);house.add(jiggle);
pudding.root.traverse(o=>{if(o.isMesh){o.morphTargetInfluences=undefined;o.morphTargetDictionary=undefined;o.geometry.morphAttributes={};}});

// 4) 生活シミュレーション（アプリと同じ）を乱数固定で回し、監督（DAILY_SCRIPT）が順番に行動を渡す
const random=Math.random;Math.random=seededRandom(ANIM_SEED);
const furniture=roomFurniture.slice();furniture.obstacles=roomObstacles;
const log=[];
const sim=new LifeSimulation(characters,furniture,m=>log.push(`${sim.time.toFixed(1)}s ${m}`));
const home=new Map(characters.map(c=>[c,c.root.position.clone()]));
const queue=new Map(characters.map(c=>[c,(DAILY_SCRIPT[c.id]||[]).slice()]));
const parked=new Set();
sim.choose=c=>{
 const step=queue.get(c).shift();
 if(!step){Object.assign(c,{phase:'acting',action:'idle',remaining:1e9});parked.add(c);return;}   // 帰宅後はその場でひとやすみ（前を向いたまま）
 if(step.wait!=null){Object.assign(c,{target:null,action:'idle',phase:'acting',remaining:step.wait,elapsed:0});return;}
 if(step.go){if(!sim.command(c,step.go))throw new Error(`${c.id} cannot go to ${step.go}`);return;}
 if(step.home){const h=home.get(c);if(!sim.moveTo(c,[h.x,0,h.z]))throw new Error(`${c.id} cannot walk home`);c.target.face=HOME_YAW;}
};
characters.forEach(c=>{c.remaining=0;});   // 最初の一歩から監督の順番で

const animated=[];
for(const c of characters)c.root.traverse(o=>animated.push(o));
animated.push(jiggle);
const dt=1/ANIM_FPS,frames0=[];
function applyPose(t){
 for(const c of characters)animateCharacter(c,sim.time);
 const j=puddingJiggle(t);jiggle.scale.set(j.sx,j.sy,j.sx);jiggle.rotation.set(j.rx,0,j.rz);
 for(const o of animated)o.updateMatrix();
}
const samples=new Map(animated.map(o=>[o,[]]));
applyPose(0);for(const o of animated)samples.get(o).push(o.matrix.clone());
let settledAt=null;
for(let f=1;f<=ANIM_MAX_SECONDS*ANIM_FPS;f++){
 sim.update(dt);applyPose(f*dt);
 for(const o of animated)samples.get(o).push(o.matrix.clone());
 const calm=parked.size===characters.length&&characters.every(c=>Math.abs(Math.atan2(Math.sin(c.root.rotation.y-HOME_YAW),Math.cos(c.root.rotation.y-HOME_YAW)))<.02&&c.root.position.distanceTo(home.get(c))<.08);
 if(calm&&settledAt==null)settledAt=f*dt;
 if(settledAt!=null&&f*dt>=loopSeconds(settledAt+.8))break;
}
Math.random=random;
if(settledAt==null)throw new Error('characters did not come home within '+ANIM_MAX_SECONDS+'s\n'+log.join('\n'));
const LOOP=loopSeconds(settledAt+.8),frames=Math.round(LOOP*ANIM_FPS);

// 5) ループの継ぎ目：最後の少しの時間で、最初のポーズへなめらかに寄せる（最後のフレーム＝最初のフレーム）
const pa=new T.Vector3(),pb=new T.Vector3(),qa=new T.Quaternion(),qb=new T.Quaternion(),sa=new T.Vector3(),sb=new T.Vector3();
for(const o of animated){
 const s=samples.get(o);s.length=frames+1;
 s[0].decompose(pb,qb,sb);
 for(let f=0;f<=frames;f++){
  const w=f===frames?1:crossfadeWeight(f*dt,LOOP);if(!w)continue;
  s[f].decompose(pa,qa,sa);s[f]=new T.Matrix4().compose(pa.lerp(pb,w),qa.slerp(qb,w),sa.lerp(sb,w));
 }
}
// 最初のポーズで書き出す（家の中へ移す。家の座標＝simWorld の座標なので各部品のローカル行列はそのまま）
for(const c of characters)house.add(c.root);
for(const o of animated){samples.get(o)[0].decompose(o.position,o.quaternion,o.scale);o.updateMatrix();}
const moving=animated.filter(o=>{const s=samples.get(o);return s.some(m=>m.elements.some((v,i)=>Math.abs(v-s[0].elements[i])>1e-7));});
moving.forEach((o,i)=>{o.name=`ANIM_${i}_${(o.name||o.type).replace(/[^A-Za-z0-9_]/g,'')}`;});
for(const o of animated)samples.set(o,samples.get(o).map(m=>m.elements.slice()));

async function exportUsdz(file,{ior=null}={}){
const top=dollhouse;top.updateMatrixWorld(true);
const usdz=await new USDZExporter().parseAsync(top,{quickLookCompatible:true});

// 6) 動く部品の transform を timeSamples に差し替え、ステージにループ情報を書く
const files=unzipSync(usdz);
// 形状ファイルの数値の桁を詰める（見た目は同じ・容量だけ軽く）
for(const k in files)if(k.startsWith('geometries/'))files[k]=strToU8(trimUsdNumbers(strFromU8(files[k])));
let usda=strFromU8(files['model.usda']);
const fmt=e=>`( (${e[0]}, ${e[1]}, ${e[2]}, ${e[3]}), (${e[4]}, ${e[5]}, ${e[6]}, ${e[7]}), (${e[8]}, ${e[9]}, ${e[10]}, ${e[11]}), (${e[12]}, ${e[13]}, ${e[14]}, ${e[15]}) )`;
const round=m=>m.map(v=>+v.toFixed(5));
const lines=usda.split('\n');let keyCount=0;
for(const o of moving){
 const at=lines.findIndex(l=>l.includes(`def Xform "${o.name}"`));
 if(at<0)throw new Error('prim not found: '+o.name);
 const k=lines.findIndex((l,i)=>i>at&&l.includes('matrix4d xformOp:transform ='));
 const indent=lines[k].match(/^\s*/)[0];
 const keys=reduceKeyframes(samples.get(o));keyCount+=keys.length;
 const ts=keys.map(([f,m])=>`${indent}\t${f}: ${fmt(round(m))},`).join('\n');
 lines[k]=`${indent}matrix4d xformOp:transform.timeSamples = {\n${ts}\n${indent}}`;
}
usda=lines.join('\n').replace('\tupAxis = "Y"\n',`\tupAxis = "Y"\n\tstartTimeCode = 0\n\tendTimeCode = ${frames}\n\ttimeCodesPerSecond = ${ANIM_FPS}\n\tframesPerSecond = ${ANIM_FPS}\n`);
if(!usda.includes('timeCodesPerSecond'))throw new Error('header patch failed');
if(ior!=null){usda=usda.replace(/(\t+)float inputs:metallic = /g,`$1float inputs:ior = ${ior}\n$1float inputs:metallic = `);if(!usda.includes('inputs:ior'))throw new Error('ior patch failed');}
files['model.usda']=strToU8(usda);
console.log(`time samples ${keyCount} (all frames would be ${moving.length*(frames+1)})`);

// 7) USDZ に詰め直す（非圧縮・64バイト境界。USDZExporter と同じやり方。model.usda を先頭に）
const ordered={'model.usda':files['model.usda']};for(const k in files)if(k!=='model.usda')ordered[k]=files[k];
let offset=0;
for(const name in ordered){
 const file=ordered[name];offset+=34+name.length;
 const mod=offset&63;if(mod!==4)ordered[name]=[file,{extra:{12345:new Uint8Array(64-mod)}}];
 offset=file.length;
}
const out=zipSync(ordered,{level:0});
const outUrl=new URL(file,root);mkdirSync(new URL('./',outUrl),{recursive:true});
writeFileSync(outUrl,out);
return out;
}
// 6) 質感：マット調整（家まわりはほぼマット・白とミントは完全マット・キャラの色はほぼそのまま）
const partOf=o=>{for(let p=o;p;p=p.parent){if(p.name==='Pudding_jiggle'||/Pudding/.test(p.name))return 'pudding';if(/Character_/.test(p.name))return 'character';}return 'house';};
const matParts=new Map();
dollhouse.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))if(!matParts.has(m))matParts.set(m,partOf(o));});
const partCount={},hsl={};
for(const [m,part] of matParts){
 m.color.getHSL(hsl);const r=matteMaterial({...hsl,roughness:m.roughness},part);
 m.color.setHSL(r.h,r.s,r.l);m.roughness=r.roughness;m.metalness=r.metalness;partCount[part]=(partCount[part]||0)+1;
}
const OUT_FILE=process.env.AR_ANIM_OUT||ANIM_USDZ_FILE;   // 検証版を別名で書き出すとき用
const out=await exportUsdz(OUT_FILE,{ior:MATTE.ior});
console.log(log.join('\n'));
console.log(`settled ${settledAt.toFixed(2)}s → loop ${LOOP}s (${frames+1} frames @ ${ANIM_FPS}fps), animated prims ${moving.length}, matte materials: ${Object.entries(partCount).map(([k,v])=>k+' '+v).join(' / ')}`);
console.log(`usdz ${(out.byteLength/1048576).toFixed(2)} MB → ${OUT_FILE}`);
