import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CAMP_KEY,loadCampOn,saveCampOn,CAMP_GLB,CAMP_TENT,campLayout,webSafeMaterial} from '../src/river/camp.js';
import {heightAt,riverCenter,riverHalfWidth,bankDistance} from '../src/river/terrain.js';
import {createVegetation} from '../src/river/vegetation.js';
import {createRocks} from '../src/river/rocks.js';

const GLB=new URL('../assets/props/camp.glb',import.meta.url),MANIFEST=JSON.parse(fs.readFileSync(new URL('../assets/props/camp-manifest.json',import.meta.url)));
// fishing.js の立ち位置（LAYOUT の z と岸からの距離）と同じ並び。fishing.js はキャラの GLB を読むので node では import しない
const anglers=[[67.4,.55],[70,1.05],[72.4,.6]].map(([z,off])=>{const x=riverCenter(z)-riverHalfWidth(z)-off;return {pos:new T.Vector3(x,heightAt(x,z),z)};});
const spot={anglers,camera:{position:new T.Vector3(5.9,3,64.9)}};
const mem=(init={})=>{const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};
async function loadCamp(){const b=fs.readFileSync(GLB);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}

test('camp ON/OFF is remembered, starts OFF, and survives blocked storage',()=>{
 assert.equal(loadCampOn(mem()),false,'first visit = いつもの渓流');
 const s=mem();saveCampOn(true,s);assert.equal(s.m.get(CAMP_KEY),'1');assert.equal(loadCampOn(s),true);
 saveCampOn(false,s);assert.equal(loadCampOn(s),false);
 assert.equal(loadCampOn({getItem(){throw new Error('blocked');}}),false);
 assert.doesNotThrow(()=>saveCampOn(true,{setItem(){throw new Error('quota');}}));
});

test('camp.glb comes from the human Blend: tent + fire only, no flame mesh, sizes match the code',async()=>{
 assert.equal(MANIFEST.sourceUnchanged,true);
 assert.ok(MANIFEST.bytes<1.2e6,'GLB は 1.2MB 未満');
 const g=await loadCamp(),kinds={tent:0,fire:0},mats=new Set();
 g.scene.traverse(o=>{if(!o.isMesh)return;let q=o;while(q&&!q.userData.campPart)q=q.parent;assert.ok(q,'every mesh belongs to tent or fire');
  kinds[q.userData.campPart]+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;mats.add(o.material.name.trim());
  assert.ok(!o.geometry.attributes.uv,'no UV (no textures)');});
 assert.ok(kinds.tent>0&&kinds.tent<=40000,`tent tris ${kinds.tent}`);
 assert.ok(kinds.fire>0&&kinds.fire<=5000,`fire tris ${kinds.fire}`);
 for(const m of mats)assert.ok(!/fire|flame|hono|api/i.test(m),'炎の材質は GLB に無い（炎は Three.js）: '+m);
 // コードの寸法（薪・テントの足元）が書き出し結果と一致
 const L=MANIFEST.logsGltf;for(let i=0;i<3;i++){assert.ok(Math.abs(L.min[i]-CAMP_GLB.logs.min[i])<.01);assert.ok(Math.abs(L.max[i]-CAMP_GLB.logs.max[i])<.01);}
 const F=MANIFEST.tentFootprintGltf;for(const k of ['x','z'])for(let i=0;i<2;i++)assert.ok(Math.abs(F[k][i]-CAMP_GLB.tent[k][i])<.01,k);
 assert.ok(Math.abs((L.min[0]+L.max[0])/2)<.01&&Math.abs((L.min[2]+L.max[2])/2)<.01,'原点＝薪の中心（炎をここに重ねる）');
});

test('fire keeps the Blender materials as-is: stones, wood, and the grilled fish have their own material',async()=>{
 const g=await loadCamp();g.scene.updateMatrixWorld(true);const fire={};
 g.scene.traverse(o=>{if(!o.isMesh)return;let q=o;while(q&&!q.userData.campPart)q=q.parent;if(q.userData.campPart!=='fire')return;
  const b=new T.Box3().setFromObject(o,true);fire[o.material.name.trim()]={box:b,tris:(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3};});
 assert.deepEqual(Object.keys(fire).sort(),['abu','kayu','マテリアル.004'].sort(),'石（abu）・薪と串（kayu）・焼き魚（Blender で追加した材質）');
 const fish=fire['マテリアル.004'];
 assert.ok(fish.tris>500,'魚3匹');
 assert.ok(fish.box.min.y>.3&&fire.abu.box.max.y<.35,'魚は石より上（串の上）');
});

test('tent stands upright behind the three anglers, next to the fire, on land',()=>{
 const L=campLayout(spot),t=L.tent,F=CAMP_GLB.tentFrame;
 assert.ok(t.tiltDeg<=CAMP_TENT.maxTilt+1e-9,'ほぼ水平・直立（斜面には最大 4° だけ）');
 assert.ok(t.slopeDeg<6,`テントの足元の河原はなだらか（${t.slopeDeg.toFixed(1)}°）`);
  // 床は少し持ち上げてある（lift）：川側（カメラ側）の床の端は地面から 20cm 以上は浮かず、山側（カメラから見えない側）も 55cm 以上は埋まらない
 assert.ok(t.float<.2&&t.bury<.55,`float ${t.float.toFixed(2)} bury ${t.bury.toFixed(2)}`);
 assert.ok(Math.abs(t.tiltDeg-t.slopeDeg)<1e-6,'4° 未満の足元には、そのまま合わせる');
 for(const [x,z] of t.corners)assert.ok(bankDistance(x,z)>1.5,'川にはみ出さない');
 for(const a of anglers){const [s,r]=t.toLocal(a.pos.x,a.pos.z);
  assert.ok(Math.hypot(Math.max(0,Math.abs(s)-F.across),Math.max(0,Math.abs(r)-F.along))>=1,'3人から 1m 以上');
  assert.ok(t.pos.x<a.pos.x-1,'3人の後ろ（川は +x）');}
 // 焚火は Blender と同じく入口（棟の端）の前：端から .5〜2m、横ずれ 1.5m 以内
 const [fs_,fr]=t.toLocal(L.fire.pos.x,L.fire.pos.z);
 assert.ok(fr<0&&-fr-F.along>.5&&-fr-F.along<2&&Math.abs(fs_)<1.5,`fire ${fs_.toFixed(2)},${fr.toFixed(2)}`);
});

// fishing.js の fishingSpot() と同じ式（fishing.js はキャラの GLB を読むので node では import できない）
function fishingView(){
 const mid=anglers[1].pos,river=new T.Vector3(1,0,-.36).normalize(),hc=Math.atan2(river.x,river.z)+.5;
 const cam=mid.clone().add(new T.Vector3(Math.sin(hc),0,Math.cos(hc)).multiplyScalar(6.8)).setY(mid.y+2.6);
 return {clear:[{x:mid.x,z:mid.z,r:4.2}],focus:mid.clone().addScaledVector(river,.9).setY(mid.y+.65),viewer:cam};
}
test('no tree, leaf or big rock pokes into the tent (PC and phone vegetation)',async()=>{
 const L=campLayout(spot),t=L.tent,F=CAMP_GLB.tentFrame,view=fishingView();
 const shared={uTime:{value:0},uSunCol:{value:new T.Color()},uPebble:{value:null}};
 const inv=new T.Matrix4().compose(t.pos,t.quat,new T.Vector3(1,1,1)).invert()
  .premultiply(new T.Matrix4().makeRotationY(F.ridge-Math.PI/2));            // → テント自身の向き（across=x, along=z）
 const m=new T.Matrix4(),w=new T.Vector3(),A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),q=new T.Vector3();
 const bary=[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3]];
 // テントの実際の形（棟から横へ離れるほど低い三角屋根）：GLB の頂点から、横位置ごとの一番高い所を取る
 const g=await loadCamp();g.scene.updateMatrixWorld(true);const toTent=new T.Matrix4().makeRotationY(F.ridge-Math.PI/2),roof=new Array(28).fill(0),v=new T.Vector3();
 g.scene.traverse(o=>{if(!o.isMesh||o.parent.userData.campPart!=='tent')return;const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);v.x-=F.mid[0];v.z-=F.mid[1];v.applyMatrix4(toTent);const b=Math.min(27,Math.floor(Math.abs(v.x)/1.4*28));roof[b]=Math.max(roof[b],v.y);}});
 const roofAt=ax=>{const b=Math.min(27,Math.floor(ax/1.4*28));let r=0;for(let k=Math.max(0,b-1);k<=Math.min(27,b+1);k++)r=Math.max(r,roof[k]);return Math.max(r,F.top*(1-ax/1.2));};
 // すき間：テントの外形からの水平距離・屋根からの高さ・床下の深さのうち大きいもの（どれかが正なら外）
 function clearance(im,geo,isRock){
  let best=Infinity;const p=geo.attributes.position,idx=geo.index,n=idx?idx.count/3:p.count/3,gi=k=>idx?idx.getX(k):k;
  for(let i=0;i<im.count;i++){im.getMatrixAt(i,m);w.setFromMatrixPosition(m);if(w.distanceTo(t.pos)>8)continue;
   for(let k=0;k<n;k++){A.fromBufferAttribute(p,gi(k*3));B.fromBufferAttribute(p,gi(k*3+1));C.fromBufferAttribute(p,gi(k*3+2));
    for(const [a,b,c] of bary){q.set(0,0,0).addScaledVector(A,a).addScaledVector(B,b).addScaledVector(C,c).applyMatrix4(m);
     if(isRock&&q.y<heightAt(q.x,q.z)+.08)continue;                      // 地面に埋まっている部分は数えない
     const l=q.clone().applyMatrix4(inv),ax=Math.abs(l.x),az=Math.abs(l.z);
     const d=Math.max(Math.hypot(Math.max(0,ax-1.4),Math.max(0,az-F.along)),l.y-roofAt(Math.min(ax,1.4)),-.1-l.y);
     best=Math.min(best,d);}}}
  return best;
 }
 for(const mobile of [false,true]){
  const veg=createVegetation(shared,{mobile,clear:view.clear,focus:view.focus,viewer:view.viewer});
  let tree=Infinity;for(const l of veg.userData.lods)for(const im of [l.hi,l.lo])tree=Math.min(tree,clearance(im,l.hi.geometry,false));
  const rocks=createRocks(shared,{mobile,clear:view.clear});let rock=Infinity;for(const im of rocks.group.children)rock=Math.min(rock,clearance(im,im.geometry,true));
  assert.ok(tree>.1,`${mobile?'phone':'PC'}: nearest tree/leaf ${tree.toFixed(2)}m`);
  assert.ok(rock>.1,`${mobile?'phone':'PC'}: nearest rock ${rock.toFixed(2)}m`);
 }
});

test('bedding and backpack keep their Blender colours but never render as costly transmissive glass',async()=>{
 const g=await loadCamp();const names=new Set();
 g.scene.traverse(o=>{if(!o.isMesh)return;names.add(o.material.name);const m=webSafeMaterial(o.material,o.geometry);
  assert.ok(!(m.transmission>0),`${o.material.name}: 透過なし（Web で場面を二度描かない）`);
  assert.ok(m.color.equals(o.material.color),`${o.material.name}: 色は Blender のまま`);
  assert.equal(m.roughness,o.material.roughness);
  if(!o.geometry.attributes.uv)for(const k of ['map','normalMap','metalnessMap','roughnessMap'])assert.ok(!m[k],'UV なしのテクスチャは使わない');});
 for(const n of ['マテリアル.005','Interior','Converted_LightStainless_Steel'])assert.ok(names.has(n),'テントの中の寝袋・リュック: '+n);
});
