// 渓流AR（静止・試作）の組み立て：ブラウザ（ヘッドレス Chromium）の中で動く。build.mjs から呼ぶ。
// capture.json（渓流ページから取り込んだ 3人・キャンプ・岩・草木・魚・竿・糸）＋ terrain-albedo.png（地面の色）から、
//  - 地面：切り出し範囲を細かい格子で作り直し（heightAt）、色は焼いたテクスチャ
//  - 水面：半透明の板（深さで色と透け具合が変わるテクスチャ＋細かい法線の揺らぎで映り込み）
//  - 切り口：角を丸めて少し揺らした輪郭。側面は土の地層、川の部分は水の断面
//  - 頂点カラーの岩・草木・魚：Quick Look は頂点カラーを使わないので、色を 64 色に分けて 1 枚のパレットテクスチャへ
//  - 両面の素材（テントの布・草・バケツ）：USDZ は片面だけなので裏面を複製
// を組んで 1/6 に縮め、GLB（Android Scene Viewer）と USDZ（iPhone Quick Look）を書き出す。
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {USDZExporter} from 'three/addons/exporters/USDZExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {unzipSync,zipSync,strFromU8,strToU8} from 'three/addons/libs/fflate.module.js';
import {simplifyMeshForAR} from '../lib/ar-simplify.mjs';
import {heightAt,WATER_Y} from '../../src/river/terrain.js';
import {trimUsdNumbers} from '../../src/ar/dollhouse-anim-config.js';
import {RIVER_AR} from './config.js';

const C=RIVER_AR.crop,CX=(C.x0+C.x1)/2,CZ=(C.z0+C.z1)/2,HX=(C.x1-C.x0)/2,HZ=(C.z1-C.z0)/2,W=C.x1-C.x0,D=C.z1-C.z0;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

// ── 切り出しの輪郭：角を丸めた長方形＋ゆるい揺らぎ（負＝内側）──
const wob=(x,z)=>RIVER_AR.edgeWobble*(.55*Math.sin(x*.83+z*.31)+.3*Math.sin(x*.29-z*1.13+2.1)+.15*Math.sin((x+z)*2.3));
export function outlineSD(x,z){
 const r=RIVER_AR.corner,qx=Math.abs(x-CX)-(HX-r),qz=Math.abs(z-CZ)-(HZ-r);
 return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-r+wob(x,z)+RIVER_AR.edgeWobble*.35;
}
const sdGrad=(x,z)=>{const e=.01,gx=(outlineSD(x+e,z)-outlineSD(x-e,z))/(2*e),gz=(outlineSD(x,z+e)-outlineSD(x,z-e))/(2*e),l=Math.hypot(gx,gz)||1;return [gx/l,gz/l];};

// ── 取り込みデータの復元 ──
const unb64=(s,Type)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new Type(u.buffer);};
function decodeGeom(g){
 const geo=new T.BufferGeometry();
 for(const [k,a] of Object.entries(g.attributes))geo.setAttribute(k,new T.BufferAttribute(unb64(a.data,Float32Array),a.itemSize));
 if(g.index)geo.setIndex(new T.BufferAttribute(unb64(g.index,Uint32Array),1));
 return geo;
}
const triCount=g=>(g.index?g.index.count:g.attributes.position.count)/3;
// 裏面の複製（USDZ は両面素材を扱えない）
function withBackfaces(g){
 g=g.index?g.toNonIndexed():g.clone();
 const b=g.clone(),p=b.attributes.position,n=b.attributes.normal;
 for(let i=0;i<p.count;i+=3){for(const at of [p,n,b.attributes.uv,b.attributes.color].filter(Boolean)){for(let k=0;k<at.itemSize;k++){const t=at.getComponent(i+1,k);at.setComponent(i+1,k,at.getComponent(i+2,k));at.setComponent(i+2,k,t);}}}
 if(n)for(let i=0;i<n.count;i++)n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i));
 return mergeGeometries([g,b]);
}

// ── テクスチャを描く道具 ──
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function texFrom(cv,{srgb=true,repeat=false,mime='image/png'}={}){
 const t=new T.CanvasTexture(cv);t.flipY=false;t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;
 if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;t.userData.mimeType=mime;t.anisotropy=8;return t;
}
const lin2s=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
const s2lin=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
function vnoise(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}

// 水面の色と透け具合（深さで変える：浅瀬はほぼ透明の水色、淵はエメラルド）＋うっすら白い泡（岩のまわり・岸・瀬）
function waterTexture(size,rocks,P){
 const cv=canvas(size,size),g=cv.getContext('2d'),img=g.createImageData(size,size),d=img.data;
 const shallow=[.74,.95,.92],deep=[.07,.42,.40];
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=C.x0+(i+.5)/size*W,z=C.z0+(j+.5)/size*D,depth=Math.max(0,WATER_Y-heightAt(x,z));
  const k=smooth(.02,1.05,depth);
  let r=shallow[0]+(deep[0]-shallow[0])*k,gg=shallow[1]+(deep[1]-shallow[1])*k,b=shallow[2]+(deep[2]-shallow[2])*k;
  let a=P.alphaShallow+(P.alphaDeep-P.alphaShallow)*Math.pow(k,.8);
  // 流れの筋（流れ＝+z 方向に伸びた模様）
  const streak=vnoise(x*2.2,z*.35)*.6+vnoise(x*5.1+3,z*.9)*.4;
  // 泡：岸ぎわ・岩の下流・浅い瀬
  let foam=(1-smooth(.0,.06,depth))*.55;
  for(const [rx,rz,rr] of rocks){const dx=x-rx,dz=z-rz,dist=Math.hypot(dx,dz)-rr,down=.6+.4*Math.max(-1,Math.min(1,dz/(Math.hypot(dx,dz)+1e-3)));foam=Math.max(foam,(1-smooth(0,.45+.5*down,dist))*down);}
  const riffle=smooth(.15,.3,depth)*(1-smooth(.45,.8,depth))*smooth(.62,.8,vnoise(x*.1+7,z*.05));
  foam=Math.max(foam,riffle*.5);
  const fn=vnoise(x*6,z*2.2)*.6+vnoise(x*13,z*5)*.4;
  const f=smooth(.5,.78,fn*.8+foam*.5-.1)*foam;
  const hl=smooth(.72,.9,streak)*.12*(1-k*.5);                       // 明るい流れの筋
  r=r+(1-r)*(f*.85+hl);gg=gg+(1-gg)*(f*.85+hl);b=b+(1-b)*(f*.85+hl);a=Math.min(.95,a+f*.55+hl*.8);
  const o=(j*size+i)*4;d[o]=lin2s(r)*255;d[o+1]=lin2s(gg)*255;d[o+2]=lin2s(b)*255;d[o+3]=a*255;
 }
 g.putImageData(img,0,0);return cv;
}
// 切り口の土の断面：上から 表土（黒っぽい）→ 褐色の土 → 小石まじりの砂利。横方向はくり返し
function soilTexture(){
 const cv=canvas(512,512),g=cv.getContext('2d');
 const bands=[[0,'#3b3024'],[.08,'#4e3f2e'],[.3,'#6b5640'],[.55,'#7a6a55'],[.78,'#6f6655'],[1,'#5d584c']];
 const gr=g.createLinearGradient(0,0,0,512);for(const [o,c] of bands)gr.addColorStop(o,c);g.fillStyle=gr;g.fillRect(0,0,512,512);
 let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
 for(let k=0;k<2600;k++){const y=r()*512,deep=y/512,rad=(1+Math.pow(r(),3)*(deep>.5?9:4))*(.6+deep*.8),x=r()*512;
  const v=110+r()*90*(deep>.5?1:.6);g.fillStyle=`rgba(${v+10},${v},${v-15},${.35+deep*.45})`;g.beginPath();g.ellipse(x,y,rad*1.3,rad,r()*3,0,7);g.fill();
  if(x<rad*2)g.fillRect(x+512,y,1,1);}
 for(let k=0;k<60;k++){g.strokeStyle=`rgba(40,30,20,${.12+r()*.1})`;g.lineWidth=1+r()*2;g.beginPath();const y=r()*512;g.moveTo(0,y);for(let x=0;x<=512;x+=32)g.lineTo(x,y+Math.sin(x*.02+k)*4);g.stroke();}
 return cv;
}

// ── k-means：三角形の色（sRGB 空間）を K 色へ ──
function kmeans(cols,K,iters=10){
 const n=cols.length/3,cent=new Float32Array(K*3),assign=new Uint16Array(n);
 for(let k=0;k<K;k++){const i=Math.floor((k+.5)/K*n);cent.set([cols[i*3],cols[i*3+1],cols[i*3+2]],k*3);}
 for(let it=0;it<iters;it++){
  const sum=new Float64Array(K*3),cnt=new Uint32Array(K);
  for(let i=0;i<n;i++){let best=0,bd=1e9;for(let k=0;k<K;k++){const a=cols[i*3]-cent[k*3],b=cols[i*3+1]-cent[k*3+1],c=cols[i*3+2]-cent[k*3+2],dd=a*a+b*b+c*c;if(dd<bd){bd=dd;best=k;}}
   assign[i]=best;sum[best*3]+=cols[i*3];sum[best*3+1]+=cols[i*3+1];sum[best*3+2]+=cols[i*3+2];cnt[best]++;}
  for(let k=0;k<K;k++)if(cnt[k])for(let c=0;c<3;c++)cent[k*3+c]=sum[k*3+c]/cnt[k];
 }
 return {cent,assign};
}

export async function buildRiverAR({capture,terrainImage,params={}}){
 const P={grid:.3,alphaShallow:.05,alphaDeep:.5,waterSize:1024,paletteK:48,grassKeep:.55,charRatio:.36,foliageGain:1.25,grassGain:1.15,rockGain:1.1,...params};
 const log=[],stats={};
 const matCache=new Map();
 const std=o=>{const key=JSON.stringify(o,(k,v)=>v&&v.isTexture?v.uuid:typeof v==='number'?+v.toFixed(3):v);if(!matCache.has(key)){const m=new T.MeshStandardMaterial(o);matCache.set(key,m);}return matCache.get(key);};
 const world=new T.Group();world.name='ChikipiyoRiverAR_world';
 const bins=new Map();                        // material → [geometry…]（最後に素材ごとに 1 メッシュへまとめる）
 const catTris={};
 const put=(mat,geo,cat)=>{if(!bins.has(mat))bins.set(mat,{cat,list:[]});bins.get(mat).list.push(geo);catTris[cat]=(catTris[cat]||0)+triCount(geo);};

 // ═══ 1) 地面：切り出し範囲の格子 ═══
 const s=P.grid,nx=Math.ceil((W+2)/s)+1,nz=Math.ceil((D+2)/s)+1,x0=C.x0-1,z0=C.z0-1;
 const vx=new Float32Array(nx*nz),vz=new Float32Array(nx*nz),dd=new Float32Array(nx*nz);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i;vx[k]=x0+i*s;vz[k]=z0+j*s;dd[k]=outlineSD(vx[k],vz[k]);}
 const tris=[];
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){
  const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
  for(const t of [[a,c,b],[b,c,d]]){const mx=Math.max(dd[t[0]],dd[t[1]],dd[t[2]]),mn=Math.min(dd[t[0]],dd[t[1]],dd[t[2]]);if(mx<s*.7&&mn<0)tris.push(t);}
 }
 // 境界の辺（1 つの三角形にしか属さない辺）を探して、その頂点を輪郭の線の上へ寄せる
 const edgeKey=(a,b)=>a<b?a*1e7+b:b*1e7+a,edges=new Map();
 for(const t of tris)for(let e=0;e<3;e++){const a=t[e],b=t[(e+1)%3],k=edgeKey(a,b);const v=edges.get(k);if(v)v.n++;else edges.set(k,{a,b,n:1});}
 const boundary=[...edges.values()].filter(e=>e.n===1),onEdge=new Set();boundary.forEach(e=>{onEdge.add(e.a);onEdge.add(e.b);});
 for(const k of onEdge){for(let it=0;it<3;it++){const d=outlineSD(vx[k],vz[k]),[gx,gz]=sdGrad(vx[k],vz[k]);vx[k]-=gx*d;vz[k]-=gz*d;}}
 const used=new Map(),pos=[],uv=[],idx=[];
 const vid=k=>{if(used.has(k))return used.get(k);const n=used.size;used.set(k,n);pos.push(vx[k],heightAt(vx[k],vz[k]),vz[k]);uv.push((vx[k]-C.x0)/W,(vz[k]-C.z0)/D);return n;};
 for(const t of tris)idx.push(vid(t[0]),vid(t[1]),vid(t[2]));
 const terrain=new T.BufferGeometry();terrain.setAttribute('position',new T.Float32BufferAttribute(pos,3));terrain.setAttribute('uv',new T.Float32BufferAttribute(uv,2));terrain.setIndex(idx);terrain.computeVertexNormals();
 const tTex=new T.Texture(terrainImage);tTex.flipY=false;tTex.colorSpace=T.SRGBColorSpace;tTex.userData.mimeType='image/jpeg';tTex.anisotropy=8;tTex.needsUpdate=true;
 put(std({name:'Riverbed_Ground',map:tTex,roughness:.93,metalness:0}),terrain,'地面');
 let minH=1e9,maxH=-1e9;for(let i=1;i<pos.length;i+=3){minH=Math.min(minH,pos[i]);maxH=Math.max(maxH,pos[i]);}
 const baseY=minH-.12;                          // ジオラマの底（床に接する面）：川底のいちばん深い所の少し下（ARで 2cm）

 // ═══ 2) 切り口：土の断面（全周）と水の断面（川が横切る所）═══
 const soilTex=texFrom(soilTexture(),{repeat:true,mime:'image/jpeg'});
 const soil={p:[],u:[]},wsec={p:[]};
 const H=(k)=>heightAt(vx[k],vz[k]);
 for(const e of boundary){
  // 外向きになる順に並べる（辺の向き × 上 が輪郭の外向きと同じ向き）
  let a=e.a,b=e.b;const dx=vx[b]-vx[a],dz=vz[b]-vz[a],[gx,gz]=sdGrad((vx[a]+vx[b])/2,(vz[a]+vz[b])/2);
  if(-dz*gx+dx*gz<0)[a,b]=[b,a];   // 外向き法線 = (dz, -dx) ... 反時計回りでそろえる
  const ha=H(a),hb=H(b),ua=(vx[a]+vz[a])/4,ub=ua+Math.hypot(dx,dz)/4;
  const va=y=>(maxH-y)/(maxH-baseY);
  // 土：地面の高さ → 底
  soil.p.push(vx[a],ha,vz[a], vx[a],baseY,vz[a], vx[b],hb,vz[b],  vx[b],hb,vz[b], vx[a],baseY,vz[a], vx[b],baseY,vz[b]);
  soil.u.push(ua,va(ha), ua,va(baseY), ub,va(hb),  ub,va(hb), ua,va(baseY), ub,va(baseY));
  // 水：川底 → 水面
  if(ha<WATER_Y||hb<WATER_Y){const ta=Math.min(ha,WATER_Y),tb=Math.min(hb,WATER_Y);
   wsec.p.push(vx[a],WATER_Y,vz[a], vx[a],ta,vz[a], vx[b],WATER_Y,vz[b],  vx[b],WATER_Y,vz[b], vx[a],ta,vz[a], vx[b],tb,vz[b]);}
 }
 const fixWinding=(arr)=>{ // 外から見て表になるよう、法線が輪郭の外を向く向きにそろえる
  for(let i=0;i<arr.length;i+=9){const ax=arr[i],az=arr[i+2],bx=arr[i+3],by=arr[i+4],bz=arr[i+5],cx=arr[i+6],cy=arr[i+7],cz=arr[i+8],ay=arr[i+1];
   const ux=bx-ax,uy=by-ay,uz=bz-az,wx=cx-ax,wy=cy-ay,wz=cz-az,nx=uy*wz-uz*wy,nz=ux*wy-uy*wx,[gx,gz]=sdGrad((ax+bx+cx)/3,(az+bz+cz)/3);
   if(nx*gx+nz*gz<0){for(let k=0;k<3;k++){const t=arr[i+3+k];arr[i+3+k]=arr[i+6+k];arr[i+6+k]=t;}if(arr.uvs){const j=i/9*6;for(let k=0;k<2;k++){const t=arr.uvs[j+2+k];arr.uvs[j+2+k]=arr.uvs[j+4+k];arr.uvs[j+4+k]=t;}}}}
 };
 soil.p.uvs=soil.u;fixWinding(soil.p);fixWinding(wsec.p);
 const soilGeo=new T.BufferGeometry();soilGeo.setAttribute('position',new T.Float32BufferAttribute(soil.p,3));soilGeo.setAttribute('uv',new T.Float32BufferAttribute(soil.u,2));soilGeo.computeVertexNormals();
 put(std({name:'Diorama_SoilSection',map:soilTex,roughness:1,metalness:0}),soilGeo,'断面');

 // ═══ 3) 水面：川の部分だけ（y=0 の板）。法線を少し揺らして映り込みに表情をつける ═══
 const rocksFoam=[];
 for(const m of capture.meshes){if(capture.mats[m.mat].key!=='river-surface-rock'||!m.instances)continue;
  for(let i=0;i<m.instances.length;i+=16){const e=m.instances.slice(i,i+16),sx=Math.hypot(e[0],e[1],e[2]),sy=Math.hypot(e[4],e[5],e[6]);const y=e[13];const r=Math.max(sx,Math.hypot(e[8],e[9],e[10]));if(y+sy*.9>WATER_Y-.15&&y-sy<WATER_Y&&outlineSD(e[12],e[14])<r*.4)rocksFoam.push([e[12],e[14],sx*.85]);}}
 const wpos=[],wuv=[],wnor=[],widx=[],wused=new Map();
 const wid=k=>{if(wused.has(k))return wused.get(k);const n=wused.size;wused.set(k,n);const x=vx[k],z=vz[k];wpos.push(x,WATER_Y,z);wuv.push((x-C.x0)/W,(z-C.z0)/D);
  const a=(vnoise(x*1.7,z*.8)-.5)*.16+(vnoise(x*4.3+5,z*2.1)-.5)*.08,b=(vnoise(x*1.3+9,z*.6)-.5)*.16+(vnoise(x*3.7,z*1.9+2)-.5)*.08,l=Math.hypot(a,1,b);wnor.push(a/l,1/l,b/l);return n;};
 for(const t of tris){if(Math.min(H(t[0]),H(t[1]),H(t[2]))<WATER_Y+.03)widx.push(wid(t[0]),wid(t[1]),wid(t[2]));}
 const waterGeo=new T.BufferGeometry();waterGeo.setAttribute('position',new T.Float32BufferAttribute(wpos,3));waterGeo.setAttribute('normal',new T.Float32BufferAttribute(wnor,3));waterGeo.setAttribute('uv',new T.Float32BufferAttribute(wuv,2));waterGeo.setIndex(widx);
 const waterTex=texFrom(waterTexture(P.waterSize,rocksFoam,P));
 put(std({name:'River_WaterSurface',map:waterTex,transparent:true,roughness:.06,metalness:0,depthWrite:false}),waterGeo,'水');
 const wsGeo=new T.BufferGeometry();wsGeo.setAttribute('position',new T.Float32BufferAttribute(wsec.p,3));wsGeo.computeVertexNormals();
 put(std({name:'River_WaterSection',color:new T.Color(.16,.56,.52),transparent:true,opacity:.5,roughness:.1,metalness:0,depthWrite:false}),wsGeo,'水');

 // ═══ 4) 取り込んだ物 ═══
 const geos={};for(const [id,g] of Object.entries(capture.geoms))geos[id]=decodeGeom(g);
 const palette=[];                             // {cat, geo(非インデックス・world), triCol(sRGB)}
 const M=new T.Matrix4(),N3=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3();
 const inside=(x,z,pad=0)=>outlineSD(x,z)<-pad;
 const toWorld=(g,m)=>{const w=g.clone();w.applyMatrix4(m);return w;};
 function addPalette(cat,g,colorFn){
  g=g.index?g.toNonIndexed():g;if(!g.attributes.normal)g.computeVertexNormals();
  const p=g.attributes.position,nm=g.attributes.normal,c=g.attributes.color,tc=new Float32Array(p.count);  // p.count/3 三角形 × 3色
  const out=new Float32Array(p.count/3*3);
  for(let t=0;t<p.count/3;t++){let r=0,gg=0,b=0;
   for(let k=0;k<3;k++){const i=t*3+k;const base=c?[c.getX(i),c.getY(i),c.getZ(i)]:[1,1,1];const col=colorFn(base,p.getX(i),p.getY(i),p.getZ(i),nm.getY(i));r+=col[0];gg+=col[1];b+=col[2];}
   out[t*3]=lin2s(Math.min(1,r/3));out[t*3+1]=lin2s(Math.min(1,gg/3));out[t*3+2]=lin2s(Math.min(1,b/3));}
  g.deleteAttribute('color');palette.push({cat,geo:g,col:out});
 }
 const underwater=(col,y)=>{if(y>=WATER_Y)return col;const d=WATER_Y-y;return [col[0]*Math.exp(-.42*d*1.1),col[1]*Math.exp(-.1*d*1.1),col[2]*Math.exp(-.085*d*1.1)];};
 const rockColor=(b,x,y,z,ny)=>{let c=[b[0]*.6*P.rockGain,b[1]*.6*P.rockGain,b[2]*.58*P.rockGain];
  const mn=vnoise(x*1.7+y*2,z*1.7),moss=smooth(.5,.85,ny+(mn-.5)*.55)*smooth(.35,.9,y)*.92;const mc=[.12*(.7+.6*mn),.21*(.7+.6*mn),.045*(.7+.6*mn)];
  c=c.map((v,i)=>v+(mc[i]-v)*moss);const wet=.55+.45*smooth(-.03,.28,y);return underwater(c.map(v=>v*wet),y);};
 const catCount={},keptRocks=[];
 for(const m of capture.meshes){
  const mt=capture.mats[m.mat],g0=geos[m.geom],key=mt.key,path=m.path;
  const list=m.instances?Array.from({length:m.instances.length/16},(_,i)=>new T.Matrix4().fromArray(m.instances,i*16)):[new T.Matrix4().fromArray(m.matrix)];
  const ic=m.instanceColors;
  if(key==='river-surface-rock'){
   list.forEach(mm=>{const p=v.setFromMatrixPosition(mm),e=mm.elements,r=Math.max(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[8],e[9],e[10]));if(!inside(p.x,p.z,-r*.4))return;
    const g=toWorld(g0,mm),q=g.attributes.position;
    for(let i=0;i<q.count;i++){
     if(q.getY(i)<baseY+.03)q.setY(i,baseY+.03);                                   // 床の下へ突き抜けない
     const d=outlineSD(q.getX(i),q.getZ(i));if(d>-.02){const [gx,gz]=sdGrad(q.getX(i),q.getZ(i));q.setX(i,q.getX(i)-gx*(d+.02));q.setZ(i,q.getZ(i)-gz*(d+.02));}  // 切り口からはみ出す所は断面で平らに切る
    }
    g.deleteAttribute('normal');g.computeVertexNormals();
    addPalette('岩',g,rockColor);if(p.y+Math.hypot(e[4],e[5],e[6])*.9>WATER_Y-.15&&p.y-Math.hypot(e[4],e[5],e[6])<WATER_Y)keptRocks.push([p.x,p.z,r*.85]);});continue;}
  if(key==='river-foliage'){
   list.forEach((mm,i)=>{const p=v.setFromMatrixPosition(mm);if(!inside(p.x,p.z,.4))return;const t=ic?[ic[i*3],ic[i*3+1],ic[i*3+2]]:[1,1,1];
    if(!g0.boundingBox)g0.computeBoundingBox();const bb=g0.boundingBox.clone().applyMatrix4(mm);if([[bb.min.x,bb.min.z],[bb.max.x,bb.min.z],[bb.min.x,bb.max.z],[bb.max.x,bb.max.z]].some(([x,z])=>outlineSD(x,z)>3))return;   // 樹冠が切り口から大きくはみ出す木（3m 超）は入れない。枝が少し張り出すのは自然なので残す
    addPalette('草木',toWorld(g0,mm),b=>[b[0]*t[0]*.94*P.foliageGain,b[1]*t[1]*.94*P.foliageGain,b[2]*t[2]*.94*P.foliageGain]);});continue;}
  if(key==='river-grass'){
   list.forEach((mm,i)=>{const p=v.setFromMatrixPosition(mm);if(!inside(p.x,p.z,.25)||hash(p.x,p.z)>P.grassKeep)return;const t=ic?[ic[i*3],ic[i*3+1],ic[i*3+2]]:[1,1,1];
    addPalette('草',withBackfaces(toWorld(g0,mm)),b=>[b[0]*t[0]*P.grassGain,b[1]*t[1]*P.grassGain,b[2]*t[2]*P.grassGain]);});continue;}
  if(key.startsWith('river-surface')){       // 魚
   list.forEach(mm=>{const p=v.setFromMatrixPosition(mm);if(!inside(p.x,p.z,.4))return;addPalette('魚',toWorld(g0,mm),(b,x,y)=>underwater(b,y));});continue;}
  // ここから下は素材の色をそのまま使う物（キャラ・キャンプ・竿・ウキ・バケツ・炎）
  const isChar=/GLB_/.test(path),isTent=/CampTent/.test(path),isFx=/CampfireFx/.test(path),isCamp=/RiverCamp/.test(path);
  const cat=isChar?'3人':isCamp?(isFx?'焚火の炎':'キャンプ'):'釣り道具';
  let mat;
  if(mt.type==='MeshBasicMaterial'){      // 炎・熾火：光る素材に
   const c=new T.Color().fromArray(mt.color),e=c.clone();const mx=Math.max(e.r,e.g,e.b);if(mx>1)e.multiplyScalar(1/mx);
   mat=std({name:'Campfire_Flame',color:e.clone().multiplyScalar(.6),emissive:e,emissiveIntensity:1,roughness:1,metalness:0,transparent:mt.transparent,opacity:mt.transparent?.88:1});
  }else{
   mat=std({name:mt.name||'mat',color:new T.Color().fromArray(mt.color),emissive:new T.Color().fromArray(mt.emissive),emissiveIntensity:mt.emissiveIntensity,
    roughness:Math.max(mt.roughness,isChar?.75:.45),metalness:Math.min(mt.metalness,.3),transparent:!!(mt.transparent&&mt.opacity<1),opacity:mt.transparent?mt.opacity:1});
  }
  for(const mm of list){
   let g=toWorld(g0,mm);for(const k of Object.keys(g.attributes))if(!['position','normal'].includes(k))g.deleteAttribute(k);
   if(!g.attributes.normal)g.computeVertexNormals();
   if(isChar&&triCount(g)>1500){const tmp=new T.Mesh(g);await simplifyMeshForAR(tmp,{ratio:P.charRatio});g=tmp.geometry;}
   if(mt.side===T.DoubleSide&&!isChar&&!/CampFire\//.test(path))g=withBackfaces(g);
   put(mat,g,cat);
  }
 }
 // 釣り糸：細いチューブ（ARで太さ約1mm）
 const lineMat=std({name:'Fishing_Line',color:new T.Color(.92,.92,.88),roughness:.5,metalness:0});
 for(const l of capture.lines){const pts=[];for(let i=0;i<l.points.length;i+=3)pts.push(new T.Vector3(l.points[i],l.points[i+1],l.points[i+2]));
  const clean=pts.filter((p,i)=>i===0||p.distanceTo(pts[i-1])>1e-4);if(clean.length<2)continue;
  const tube=new T.TubeGeometry(new T.CatmullRomCurve3(clean),Math.max(24,clean.length*3),.006,4,false);tube.deleteAttribute('uv');put(lineMat,tube,'釣り道具');}

 // ═══ 5) パレット：頂点カラーの物を 64 色に分けて 1 枚のテクスチャへ ═══
 {
  let total=0;for(const it of palette)total+=it.col.length/3;
  const all=new Float32Array(total*3);let o=0;for(const it of palette){all.set(it.col,o);o+=it.col.length;}
  const K=P.paletteK,G=Math.max(8,2**Math.ceil(Math.log2(Math.ceil(Math.sqrt(K))))),cell=16,{cent,assign}=kmeans(all,K,12);
  const cv=canvas(G*cell,G*cell),g=cv.getContext('2d');
  for(let k=0;k<K;k++){g.fillStyle=`rgb(${Math.round(cent[k*3]*255)},${Math.round(cent[k*3+1]*255)},${Math.round(cent[k*3+2]*255)})`;g.fillRect((k%G)*cell,Math.floor(k/G)*cell,cell,cell);}
  const palTex=texFrom(cv);palTex.minFilter=T.LinearFilter;palTex.generateMipmaps=false;palTex.magFilter=T.NearestFilter;
  const palMat=std({name:'Nature_Palette',map:palTex,roughness:.9,metalness:0});
  let t0=0;
  for(const it of palette){
   const nT=it.col.length/3,uvs=new Float32Array(nT*6);
   for(let t=0;t<nT;t++){const k=assign[t0+t],u=((k%G)+.5)/G,vv=(Math.floor(k/G)+.5)/G;for(let c=0;c<3;c++){uvs[t*6+c*2]=u;uvs[t*6+c*2+1]=vv;}}
   t0+=nT;it.geo.setAttribute('uv',new T.BufferAttribute(uvs,2));put(palMat,it.geo,it.cat);
  }
  stats.paletteColors=K;
 }

 // ═══ 6) 素材ごとに 1 メッシュへまとめる ═══
 const cats={};
 for(const [mat,{cat,list}] of bins){
  const want=['position','normal',...(mat.map?['uv']:[])];
  const norm=list.map(g=>{g=g.index?g:g;for(const k of Object.keys(g.attributes))if(!want.includes(k))g.deleteAttribute(k);if(!g.attributes.normal)g.computeVertexNormals();
   if(mat.map&&!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   return g.index?g:g;});
  const idxd=norm.every(g=>g.index),nonIdx=norm.map(g=>idxd?g:(g.index?g.toNonIndexed():g));
  let merged=mergeGeometries(nonIdx,false);if(!merged)throw new Error('merge failed: '+mat.name);
  if(!merged.index)merged=mergeVertices(merged,1e-5);
  {const ix=merged.index.array,p=merged.attributes.position,keep=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();   // つぶれた三角形を捨てる
   for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-14)keep.push(ix[i],ix[i+1],ix[i+2]);}
   merged.setIndex(keep);}
  const mesh=new T.Mesh(merged,mat);mesh.name=(mat.name||'mesh').replace(/[^\w]/g,'_');world.add(mesh);
  cats[cat]=(cats[cat]||0)+triCount(merged);
 }
 stats.triangles=Object.fromEntries(Object.entries(catTris).map(([k,v])=>[k,Math.round(v)]));
 stats.trianglesTotal=Math.round(Object.values(cats).reduce((a,b)=>a+b,0));
 stats.materials=bins.size;stats.meshes=world.children.length;

 // ═══ 7) 縮小・原点（切り出しの中心・ジオラマの底＝床）═══
 const top=new T.Group();top.name='ChikipiyoRiverAR';top.add(world);
 const sc=RIVER_AR.scale;world.scale.setScalar(sc);world.position.set(-CX*sc,-baseY*sc,-CZ*sc);top.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(top),size=box.getSize(new T.Vector3());
 stats.meshBoxes=world.children.map(m=>{const b=new T.Box3().setFromObject(m);return m.name+' '+[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(v=>v.toFixed(2)).join(',');});
 stats.sizeAR={x:+size.x.toFixed(3),y:+size.y.toFixed(3),z:+size.z.toFixed(3)};
 stats.baseY=baseY;stats.maxH=maxH;
 const texSet=new Set();world.traverse(o=>{if(o.material?.map)texSet.add(o.material.map);});stats.textures=[...texSet].map(t=>`${t.image.width}x${t.image.height}${t.userData.mimeType==='image/jpeg'?' jpg':' png'}`);

 // ═══ 8) 書き出し ═══
 const glb=await new GLTFExporter().parseAsync(top,{binary:true});
 let usdz=await new USDZExporter().parseAsync(top,{quickLookCompatible:true,maxTextureSize:2048});
 usdz=await compactUsdz(usdz,[tTex,soilTex]);
 return {glb:new Uint8Array(glb),usdz,stats,transform:{cx:CX,cz:CZ,baseY,scale:sc}};
}

// USDZ の仕上げ：地面・断面のテクスチャを JPEG に（PNG だと 2048² で数 MB）、形状の数値の桁を詰める、64 バイト境界で詰め直す
async function compactUsdz(usdz,jpegTextures){
 const files=unzipSync(usdz);
 let usda=strFromU8(files['model.usda']);
 for(const t of jpegTextures){
  const name=`textures/Texture_${t.source.id}_${t.flipY}.png`;if(!files[name])continue;
  const bmp=await createImageBitmap(new Blob([files[name]],{type:'image/png'}));const cv=canvas(bmp.width,bmp.height);cv.getContext('2d').drawImage(bmp,0,0);
  const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.86));
  const jname=name.replace(/\.png$/,'.jpg');delete files[name];files[jname]=new Uint8Array(await blob.arrayBuffer());
  usda=usda.split(`@${name}@`).join(`@${jname}@`);
 }
 files['model.usda']=strToU8(usda);
 const trimSt=t=>t.split('\n').map(l=>l.includes('texCoord2f[] primvars:st')?l.replace(/-?\d+\.\d+(?:e[-+]?\d+)?/g,n=>String(+(+n).toFixed(4))):l).join('\n');   // UV は小数 4 桁（2048 のテクスチャで 0.2 画素）
 for(const k in files)if(k.startsWith('geometries/'))files[k]=strToU8(trimSt(trimUsdNumbers(strFromU8(files[k]))));
 const ordered={'model.usda':files['model.usda']};for(const k in files)if(k!=='model.usda')ordered[k]=files[k];
 let offset=0;
 for(const name in ordered){const file=ordered[name];offset+=34+name.length;const mod=offset&63;if(mod!==4)ordered[name]=[file,{extra:{12345:new Uint8Array(64-mod)}}];offset=file.length;}
 return zipSync(ordered,{level:0});
}
