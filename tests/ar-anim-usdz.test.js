import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import {ANIM_USDZ_FILE,ANIM_FPS,DAILY_SCRIPT,PUDDING_PERIOD,seededRandom,puddingJiggle,loopSeconds,crossfadeWeight,reduceKeyframes,ANIM_POSTER_FILE,MATTE,matteMaterial} from '../src/ar/dollhouse-anim-config.js';

// 動くAR箱庭（3人の日常＋プリン・マット調整済み）の本番 USDZ。静止AR版（assets/ar/chikipiyo-dollhouse.glb）とは別ファイル
const url=new URL(`../${ANIM_USDZ_FILE}`,import.meta.url);
const bytes=readFileSync(url);
const usda=()=>strFromU8(unzipSync(new Uint8Array(bytes))['model.usda']);

test('animated USDZ is a Quick Look friendly package (stored, 64-byte aligned, model.usda first, not too heavy)',()=>{
 let at=0,first=null,n=0;
 while(bytes.readUInt32LE(at)===0x04034b50){
  const method=bytes.readUInt16LE(at+8),size=bytes.readUInt32LE(at+18),nameLen=bytes.readUInt16LE(at+26),extraLen=bytes.readUInt16LE(at+28);
  const name=bytes.subarray(at+30,at+30+nameLen).toString(),data=at+30+nameLen+extraLen;
  first??=name;n++;
  assert.equal(method,0,name+' must be stored (no compression)');
  assert.equal(data%64,0,name+' data must start on a 64-byte boundary');
  at=data+size;
 }
 assert.equal(first,'model.usda');assert.ok(n>10);
 assert.ok(bytes.length/1048576<11,'size '+(bytes.length/1048576).toFixed(1)+' MB (keep around 10 MB)');
});

test('animated USDZ: all three residents and the pudding move, and every track closes the loop',()=>{
 const u=usda();
 const end=+u.match(/endTimeCode = (\d+)/)[1];
 assert.match(u,new RegExp(`timeCodesPerSecond = ${ANIM_FPS}\\b`));
 assert.equal(end%(PUDDING_PERIOD*ANIM_FPS),0,'loop length is a multiple of the pudding period');
 assert.ok(end/ANIM_FPS>=15&&end/ANIM_FPS<=60,'loop '+end/ANIM_FPS+'s');
 assert.match(u,/preliminary:anchoring:type = "plane"/);
 const blocks=[...u.matchAll(/def Xform "(ANIM_[^"]+)"[\s\S]*?xformOp:transform\.timeSamples = \{([\s\S]*?)\n\s*\}/g)];
 for(const id of ['chiki','piyo','piyomi'])assert.ok(blocks.some(b=>b[1].endsWith(`Character_${id}`)),id+' walks (root is animated)');
 assert.ok(blocks.some(b=>/Pudding_jiggle/.test(b[1])),'pudding animated');
 for(const [,name,body] of blocks){
  const rows=body.trim().split('\n').map(r=>r.trim());
  assert.match(rows[0],/^0:/,name);assert.match(rows.at(-1),new RegExp(`^${end}:`),name);
  assert.equal(rows[0].replace(/^0:/,''),rows.at(-1).replace(new RegExp(`^${end}:`),''),name+' loops seamlessly (last == first)');
 }
});

test('daily script: each resident leaves, visits the sofa, and comes home',()=>{
 for(const id of ['chiki','piyo','piyomi']){const s=DAILY_SCRIPT[id];assert.ok(s.some(x=>x.go==='sofa'));assert.ok(s.at(-1).home);}
 const a=seededRandom(1),b=seededRandom(1);for(let i=0;i<5;i++)assert.equal(a(),b());
});

test('loop helpers: pudding period, crossfade, keyframe reduction',()=>{
 assert.equal(loopSeconds(27.9),28);assert.equal(loopSeconds(28.1),30);
 const s=puddingJiggle(0),e=puddingJiggle(PUDDING_PERIOD-1e-4);for(const k of ['sx','sy','rx','rz'])assert.ok(Math.abs(s[k]-e[k])<.01,k);
 assert.equal(crossfadeWeight(0,30),0);assert.equal(crossfadeWeight(30,30),1);assert.ok(crossfadeWeight(29.4,30)>0&&crossfadeWeight(29.4,30)<1);
 const line=Array.from({length:11},(_,i)=>[i*.1,0,0]);
 assert.deepEqual(reduceKeyframes(line).map(k=>k[0]),[0,10],'straight motion keeps only the ends');
 const bump=line.map((v,i)=>i===5?[.5,1,0]:v);assert.ok(reduceKeyframes(bump).map(k=>k[0]).includes(5));
});

test('static AR dollhouse stays a separate file; poster for the iPhone link exists',()=>{
 assert.ok(existsSync(new URL('../assets/ar/chikipiyo-dollhouse.glb',import.meta.url)));
 assert.notEqual(ANIM_USDZ_FILE,'assets/ar/chikipiyo-dollhouse.glb');
 assert.ok(existsSync(new URL(`../${ANIM_POSTER_FILE}`,import.meta.url)));
});

test('matte finish is baked in: rough, non-metallic, softer reflections',()=>{
 const u=usda();
 const nums=k=>[...u.matchAll(new RegExp(`float inputs:${k} = ([\\d.]+)`,'g'))].map(m=>+m[1]);
 const rough=nums('roughness');
 assert.ok(rough.length>100);
 assert.ok(Math.min(...rough)>=MATTE.pudding.roughness-1e-6);
 assert.ok(rough.reduce((x,y)=>x+y,0)/rough.length>.85,'mostly matte');
 assert.ok(nums('metallic').every(v=>v===0));
 assert.ok(nums('ior').length===rough.length&&nums('ior').every(v=>Math.abs(v-MATTE.ior)<1e-6));
});

test('matte material rules',()=>{
 const wall=matteMaterial({h:30/360,s:.44,l:.8,roughness:.72});assert.ok(wall.roughness>=.95&&wall.s<.44&&wall.l===.8);
 const mint=matteMaterial({h:151/360,s:.33,l:.67,roughness:.5});assert.equal(mint.roughness,1);
 const white=matteMaterial({h:0,s:0,l:1,roughness:.2});assert.equal(white.roughness,1);assert.ok(white.l<1&&white.l>.95);
 const vivid=matteMaterial({h:6/360,s:1,l:.59,roughness:.78});assert.ok(vivid.s>=.95);
 const piyo=matteMaterial({h:41/360,s:1,l:.67,roughness:.72},'character');assert.ok(piyo.s>=.97&&piyo.l===.67&&piyo.roughness>=.85);
 const pudding=matteMaterial({h:35/360,s:.6,l:.7,roughness:.4},'pudding');assert.equal(pudding.roughness,MATTE.pudding.roughness);
});

test('AR close-up parts: sofa and VR gear keep more detail (shared with the static AR)',async()=>{
 const {AR_CLOSEUP_PARTS}=await import('../src/ar/dollhouse-anim-config.js');
 const {roomFurniture}=await import('../src/world/room-layout.js');
 const ids=new Set(roomFurniture.map(f=>f.id));
 assert.ok(AR_CLOSEUP_PARTS.some(p=>p.id==='sofa'));assert.ok(AR_CLOSEUP_PARTS.some(p=>p.prop==='vr-gear'));
 for(const p of AR_CLOSEUP_PARTS){assert.ok(p.furnitureId?ids.has(p.furnitureId):existsSync(new URL(`../assets/props/${p.prop}.glb`,import.meta.url)),p.id);assert.ok(p.ratio>0&&p.ratio<=1,p.id);}
});

test('animated AR shows the VR gear on the table',()=>{
 const u=usda();
 assert.match(u,/def Xform "VR_dock_gear"/);
 const gear=u.slice(u.indexOf('def Xform "VR_dock_gear"'));
 for(const n of ['VR_headset','VR_handL','VR_handR'])assert.ok(gear.includes(`"${n}"`),n);
});

test('number trimming keeps geometry lines valid and leaves other lines alone',async()=>{
 const {trimUsdNumbers}=await import('../src/ar/dollhouse-anim-config.js');
 const src='\t\tpoint3f[] points = [(-0.4532101, 1.200000, 3.141593e-8)]\n\t\tnormal3f[] normals = [(0.7071068, -0.7071068, 0.0000000)]\n\t\tint[] faceVertexIndices = [0, 1, 2]\n\t\tfloat inputs:roughness = 0.699999988079071';
 const out=trimUsdNumbers(src).split('\n');
 assert.equal(out[0],'\t\tpoint3f[] points = [(-0.45321, 1.2, 3.1416e-8)]');
 assert.equal(out[1],'\t\tnormal3f[] normals = [(0.707, -0.707, 0)]');
 assert.equal(out[2],src.split('\n')[2]);assert.equal(out[3],src.split('\n')[3]);
});
