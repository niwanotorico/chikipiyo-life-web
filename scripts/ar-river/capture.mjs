// 渓流AR 取り込み：ビルド済みの渓流ページ（dist-river）をヘッドレス Chromium で開き、
// 3人が釣りをしている（全員「待ち」）瞬間の切り出し範囲の中身と、地面の色（真上から焼いたテクスチャ）を JSON に書き出す。
//   npx vite build -c scripts/ar-river/vite.river.config.js  →  node scripts/ar-river/capture.mjs  → model-work/ar-river/capture.json
// 必要なもの：playwright（npm i --no-save playwright）と Chromium（環境変数 CHROMIUM で場所を指定できる）
import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
import {serve} from './serve.mjs';
import {RIVER_AR} from './config.js';
const root=new URL('../../',import.meta.url).pathname;
const dist=process.env.RIVER_DIST||root+'dist-river';
const outDir=process.env.AR_RIVER_WORK||root+'model-work/ar-river';
const server=await serve(dist);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:640,height:400}});
page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('[page]',m.text());});
await page.goto(server.url+RIVER_AR.captureUrl);
await page.waitForFunction(()=>window.__river&&window.__river.fishing,null,{timeout:60000});
const data=await page.evaluate(async({crop,tex})=>{
 const R=window.__river,{scene,renderer,frame,fishing,camp}=R;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 // 1) 時間を進めて、キャラ・キャンプの GLB が読み込まれ、3人とも投げ終わって「待ち」になるまで
 let ok=false;const render=renderer.render;renderer.render=()=>{};  // 取り込み中は描かない（シミュレーションだけ進める）
 for(let i=0;i<3000&&!ok;i++){
  frame(1/30);if(i%15===0)await sleep(30);
  ok=i>150&&camp.root.visible&&fishing.anglers.every(a=>a.state==='wait'&&a.t>1.2);
 }
 if(!ok)throw new Error('anglers not ready: '+fishing.anglers.map(a=>a.state).join(','));
 for(let i=0;i<8;i++)frame(1/30);
 renderer.render=render;
 scene.updateMatrixWorld(true);
 // 2) 形の取り出し
 const b64=ta=>{const u=new Uint8Array(ta.buffer,ta.byteOffset,ta.byteLength);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
 const pad=1.5,inCrop=(x,z)=>x>crop.x0-pad&&x<crop.x1+pad&&z>crop.z0-pad&&z<crop.z1+pad;
 const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const pathOf=o=>{const a=[];for(let p=o;p&&p!==scene;p=p.parent)a.unshift(p.name||p.type);return a.join('/');};
 const geoms={},meshes=[],lines=[],mats={};
 const addGeom=g=>{if(geoms[g.uuid])return g.uuid;const a={};for(const k of ['position','normal','color']){const at=g.attributes[k];if(at)a[k]={itemSize:at.itemSize,data:b64(new Float32Array(at.array))};}
  geoms[g.uuid]={attributes:a,index:g.index?b64(new Uint32Array(g.index.array)):null,groups:g.groups};return g.uuid;};
 const addMat=m=>{if(mats[m.uuid])return m.uuid;let key='';try{const k=m.customProgramCacheKey();if(typeof k==='string'&&k.startsWith('river'))key=k;}catch{}
  mats[m.uuid]={type:m.type,name:m.name,color:m.color?m.color.toArray():[1,1,1],emissive:m.emissive?m.emissive.toArray():[0,0,0],emissiveIntensity:m.emissiveIntensity??1,
   roughness:m.roughness??1,metalness:m.metalness??0,opacity:m.opacity,transparent:m.transparent,vertexColors:m.vertexColors,side:m.side,key,blending:m.blending};return m.uuid;};
 const M=new scene.matrixWorld.constructor(),W=new scene.matrixWorld.constructor(),P=new scene.position.constructor();
 scene.traverse(o=>{
  if(o.isLine&&!o.isLineSegments){if(!visible(o))return;const p=o.geometry.attributes.position,pts=[];for(let i=0;i<p.count;i++){P.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);pts.push(P.x,P.y,P.z);}lines.push({path:pathOf(o),color:o.material.color.toArray(),points:pts});return;}
  if(!o.isMesh||o.isSprite||!visible(o))return;
  const m=o.material;if(Array.isArray(m)||!m.visible||m.isShaderMaterial||m.isRawShaderMaterial||m.blending===2)return;
  if(o.name==='RiverTerrain')return;
  if(o.isInstancedMesh){
   const list=[],cols=[];
   for(let i=0;i<o.count;i++){o.getMatrixAt(i,M);if(Math.abs(M.determinant())<1e-9)continue;W.multiplyMatrices(o.matrixWorld,M);P.setFromMatrixPosition(W);if(!inCrop(P.x,P.z))continue;list.push(...W.elements);
    if(o.instanceColor)cols.push(o.instanceColor.getX(i),o.instanceColor.getY(i),o.instanceColor.getZ(i));}
   if(!list.length)return;
   meshes.push({path:pathOf(o),name:o.name,geom:addGeom(o.geometry),mat:addMat(m),instances:list,instanceColors:cols.length?cols:null});
   return;
  }
  o.geometry.computeBoundingSphere();P.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
  if(!inCrop(P.x,P.z))return;
  meshes.push({path:pathOf(o),name:o.name,geom:addGeom(o.geometry),mat:addMat(m),matrix:o.matrixWorld.elements.slice()});
 });
 const anglers=fishing.anglers.map(a=>({id:a.id,pos:a.pos.toArray(),float:a.float.position.toArray(),state:a.state,face:a.faceYaw}));
 const L=camp.layout;
 const campInfo={fire:L.fire.pos.toArray(),tent:L.tent.pos.toArray(),tentQuat:L.tent.quat.toArray(),tentCorners:L.tent.corners};
 // 3) 地面の色を真上から焼く（光・影・霧なしの素の色＝アルベド。水中は吸収の色とコースティクスを少しだけ残す）
 const terrain=scene.getObjectByName('RiverTerrain'),mat=terrain.material,orig=mat.onBeforeCompile;
 mat.onBeforeCompile=(sh,r)=>{orig(sh,r);sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
{vec3 alb=diffuseColor.rgb;
 if(vWP.y<0.){float d=-vWP.y;
  float c=caustic(vWP.xz*.33+vec2(uTime*.05,uTime*.16),uTime*.55);c+=.6*caustic(vWP.xz*.21-vec2(uTime*.07,-uTime*.05)+3.1,uTime*.43);c=min(c,1.3);
  alb*=exp(-vec3(.42,.10,.085)*d*1.1);
  alb+=alb*c*.55*smoothstep(.05,.35,d)*exp(-d*.3);}
 gl_FragColor=linearToOutputTexel(vec4(alb,1.));}`);};
 mat.customProgramCacheKey=()=>'river-albedo-bake';mat.needsUpdate=true;
 const hidden=[];scene.children.forEach(c=>{if(c!==terrain&&c.visible){hidden.push(c);c.visible=false;}});
 const fog=scene.fog;scene.fog=null;
 const cam=R.camera.clone();cam.children.length=0;
 cam.position.set((crop.x0+crop.x1)/2,80,(crop.z0+crop.z1)/2);cam.up.set(0,0,-1);cam.lookAt((crop.x0+crop.x1)/2,0,(crop.z0+crop.z1)/2);cam.updateMatrixWorld(true);
 const hw=(crop.x1-crop.x0)/2,hd=(crop.z1-crop.z0)/2;
 cam.projectionMatrix.makeOrthographic(-hw,hw,hd,-hd,1,200);cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
 renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);renderer.setSize(tex,tex,false);renderer.setRenderTarget(null);
 renderer.render(scene,cam);
 const terrainPng=renderer.domElement.toDataURL('image/png');
 hidden.forEach(c=>c.visible=true);scene.fog=fog;
 return {crop,geoms,mats,meshes,lines,anglers,camp:campInfo,terrainPng,time:R.shared.uTime.value};
},{crop:RIVER_AR.crop,tex:RIVER_AR.terrainTex});
mkdirSync(outDir,{recursive:true});
writeFileSync(outDir+'/terrain-albedo.png',Buffer.from(data.terrainPng.split(',')[1],'base64'));delete data.terrainPng;
writeFileSync(outDir+'/capture.json',JSON.stringify(data));
console.log(`meshes ${data.meshes.length}, geoms ${Object.keys(data.geoms).length}, mats ${Object.keys(data.mats).length}, lines ${data.lines.length}, anglers ${data.anglers.map(a=>a.id+':'+a.state).join(' ')}`);
await browser.close();await server.close();
