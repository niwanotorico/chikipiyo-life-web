import * as T from 'three';
import {heightAt,bankDistance} from './terrain.js';
import {createFireFx} from './campfire.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────────────────────
// 🏕️ キャンプ：3人の後ろの陸側に、テント＋焚火（Human の Blender）と、動く炎（Three.js）をまとめて出す
//  - 形：assets/props/camp.glb（model-work/human/export_camp.py で .blend の「26 tent」「25 fire」から書き出し）
//        テントと焚火の相対位置は Blender のまま。原点＝焚火の薪の中心の地面
//  - 動くもの：campfire.js（炎・熾火・火の粉・煙・地面の暖色の輪・光）を Human の薪の中心へ重ねる
//  - ON/OFF は季節と無関係。localStorage に保存。OFF の間は GLB も読まない（ふだんの渓流の重さは変わらない）
//  - 岸は陸側へ上り坂なので、テントと焚火はそれぞれ足元の地面の傾きに合わせて置く（真上から見た位置関係はそのまま）
// ─────────────────────────────────────────────────────────────

export const CAMP_KEY='chikipiyo.river.camp';
export function loadCampOn(storage=safeStorage()){try{return !!storage&&storage.getItem(CAMP_KEY)==='1';}catch{return false;}}
export function saveCampOn(on,storage=safeStorage()){try{storage&&storage.setItem(CAMP_KEY,on?'1':'0');}catch{}}
function safeStorage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch{return null;}}

// camp.glb（glTF・Y-up・原点＝薪の中心）の寸法。export_camp.py の camp-manifest.json と一致（テストで確認）
export const CAMP_GLB={
 logs:{min:[-.51,.037,-.405],max:[.51,.283,.405]},
 tent:{x:[-1.53,2.12],z:[-5.19,-1.06]},     // テントの地面に接する部分（杭まで）の x・z の範囲（9/29 寝袋入りモデル）
 fireRadius:.66,
 // テント自身の向きの箱：棟（ridge）の向き・中心と、棟に沿う along／横切る across の半分の長さ（杭・ロープ込み）
 tentFrame:{mid:[.2863,-3.1005],ridge:-1.1012,across:1.31,along:1.77,top:1.81,body:{across:1.15,along:1.6}},
};

// 置き場所：焚火はちきんとぴよきち（上流側）の間の後ろ（位置・向きは前回のまま）
export const CAMP_PLACE={back:2.6,along:.3,yaw:2.78,fireTilt:.6};
// テント：3人の後ろで、木・葉・大きな岩・川・3人とぶつからない場所を、実際の木と岩の頂点で調べて決めた（2026-09-28）。
// 釣り場のまわり（ちきん中心 約5m）は木や茂みを生やさない所なので、テントが入るのはその内側だけ。
// 焚火から見て下流側 2.8m・棟は川と平行（入口が焚火のほう）。Blender の「入口の前 約1.2m に焚火」とほぼ同じ関係
// 第3版：向き・大きさはそのまま、3人から離すため陸側へ .3m・下流へ .2m（これ以上は後ろの茂みに当たる：すき間 .23m）。
// 第4版（2026-09-29）：地形側で釣り場の河原をなだらかにした（terrain.js の beachCut、テントの足元は約 2.6°）。
// テントの傾きは足元の地面に合わせる（最大 4°）。床は地面の凸凹の上に .12m 持ち上げ、黄色い裾が石に沈まない高さ
export const CAMP_TENT={dx:.06,dz:3.0,ridgeDeg:85,maxTilt:4,tilt:null,lift:.12};
const rot=(x,z,a)=>[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];   // Y 軸回り（three と同じ向き）
function fitPlane(cx,cz,samples){ // 足元の地面に最小二乗で平面を当てる：h = a x + b z + c（x,z は中心からの相対）
 let sxx=0,sxz=0,szz=0,sx=0,sz=0,sh=0,sxh=0,szh=0,n=0;
 for(const [x,z] of samples){const h=heightAt(cx+x,cz+z);sxx+=x*x;sxz+=x*z;szz+=z*z;sx+=x;sz+=z;sh+=h;sxh+=x*h;szh+=z*h;n++;}
 const M=new T.Matrix3().set(sxx,sxz,sx,sxz,szz,sz,sx,sz,n).invert(),v=new T.Vector3(sxh,szh,sh).applyMatrix3(M);
 return {a:v.x,b:v.y,c:v.z};
}
function tiltQuat(pl,yaw,amount){
 const n=new T.Vector3(-pl.a*amount,1,-pl.b*amount).normalize();
 return new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw));
}
// テントはほぼ水平・直立：地面の傾きには最大 maxTilt° しか合わせない。床はいちばん低い所に合わせる（浮かない）ので、
// 山側は床・杭が少し地面に入る（その量＝bury）
export function tentPose(cx,cz,ridgeDeg,maxTilt=CAMP_TENT.maxTilt,{tilt=null,lift=0}={}){
 const F=CAMP_GLB.tentFrame,th=ridgeDeg*Math.PI/180,u=[Math.cos(th),Math.sin(th)],v=[-u[1],u[0]];
 const W=(s,r)=>[cx+s*v[0]+r*u[0],cz+s*v[1]+r*u[1]];
 const hs=[];for(let i=-4;i<=4;i++)for(let j=-5;j<=5;j++){const s=F.body.across*i/4,r=F.body.along*j/5,[x,z]=W(s,r);hs.push([s,r,heightAt(x,z)]);}
 let sss=0,ssr=0,srr=0,ss=0,sr=0,sh=0,ssh=0,srh=0;for(const [s,r,h] of hs){sss+=s*s;ssr+=s*r;srr+=r*r;ss+=s;sr+=r;sh+=h;ssh+=s*h;srh+=r*h;}
 const pl=new T.Vector3(ssh,srh,sh).applyMatrix3(new T.Matrix3().set(sss,ssr,ss,ssr,srr,sr,ss,sr,hs.length).invert());
 let gs=pl.x,gr=pl.y;const g=Math.hypot(gs,gr),lim=Math.tan(maxTilt*Math.PI/180),slopeDeg=Math.atan(g)*180/Math.PI;
 if(g>lim){gs*=lim/g;gr*=lim/g;}
 if(tilt){gs=tilt[0];gr=tilt[1];}                                   // 傾きを固定（テント自身の向きでの床の勾配）
 let off=Infinity;for(const [s,r,h] of hs)off=Math.min(off,h-(gs*s+gr*r));
 off+=lift;                                                         // 床をいちばん低い地面から lift だけ持ち上げる
 let bury=0,float=0;for(const [s,r,h] of hs){bury=Math.max(bury,h-(gs*s+gr*r+off));float=Math.max(float,gs*s+gr*r+off-h);}
 const grad=[gs*v[0]+gr*u[0],gs*v[1]+gr*u[1]];                       // 世界座標での床の傾き
 const yaw=F.ridge-th;                                               // glTF の棟の向き → 世界の棟の向き
 const quat=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(-grad[0],1,-grad[1]).normalize())
  .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw));
 const toLocal=(x,z)=>{x-=cx;z-=cz;return [x*v[0]+z*v[1],x*u[0]+z*u[1]];};   // → [across, along]
 return {pos:new T.Vector3(cx,off,cz),quat,yaw,ridgeDeg,bury,float,gs,gr,slopeDeg,tiltDeg:Math.atan(Math.hypot(gs,gr))*180/Math.PI,toLocal,
  floorAt:(x,z)=>{const [s,r]=toLocal(x,z);return off+gs*s+gr*r;},
  corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>W(F.across*i,F.along*j))};
}
export function campLayout(spot,P=CAMP_PLACE,TP=CAMP_TENT){
 const [side,mid]=spot.anglers.map(a=>a.pos);
 const fx=(mid.x+side.x)/2-P.back,fz=(mid.z+side.z)/2+P.along;
 // 焚火：半径 .6m の地面に合わせて少しだけ傾ける（串がほぼ立ったまま）
 const ring=[];for(let i=0;i<12;i++){const a=i/12*6.283;ring.push([Math.cos(a)*.6,Math.sin(a)*.6],[Math.cos(a)*.3,Math.sin(a)*.3]);}ring.push([0,0]);
 const fp=fitPlane(fx,fz,ring);
 const fire={pos:new T.Vector3(fx,fp.c-.02,fz),quat:tiltQuat(fp,P.yaw,P.fireTilt),plane:fp};
 const tent=tentPose(fx+TP.dx,fz+TP.dz,TP.ridgeDeg,TP.maxTilt,{tilt:TP.tilt,lift:TP.lift||0}),F=CAMP_GLB.tentFrame;
 return {fire,tent,yaw:P.yaw,slopeDeg:tent.slopeDeg,
  // 草を隠す範囲（ON の間だけ）：テントの外形と焚火の円
  inside(x,z,pad=.15){
   const [s,r]=tent.toLocal(x,z);
   if(Math.abs(s)<F.across+pad&&Math.abs(r)<F.along+pad)return true;
   return Math.hypot(x-fx,z-fz)<CAMP_GLB.fireRadius+pad;
  }};
}

// ---- 石・薪・串・焼き魚・テントは Blender のマテリアルをそのまま使う（2026-09-28 から魚も Blender 側で色付け。Web 独自の着色はしない）

// Blender のマテリアルはそのまま使う。ただし Web で重くなる／壊れる設定だけ外す（色・粗さ・形は同じ）：
//  - 透過（Transmission）：リュックの素材（Interior・Converted_LightStainless_Steel）が 1 になっている。
//    three.js では透過物が画面にあるだけで場面全体をもう一度描く（キャンプ ON で描画が +65%）ので、不透明にする
//  - UV の無いテクスチャ：camp.glb は UV を書き出さない。リンク切れの画像（Mix_Mix.png など）は外して数値だけ使う
export function webSafeMaterial(mat,geo){
 if(!mat||!(mat.transmission>0||mat.metalnessMap||mat.roughnessMap||mat.normalMap||mat.map))return mat;
 const m=new T.MeshStandardMaterial({name:mat.name,color:mat.color.clone(),roughness:mat.roughness,metalness:mat.metalness,side:mat.side,
  map:geo.attributes.uv?mat.map:null,normalMap:geo.attributes.uv?mat.normalMap:null,metalnessMap:geo.attributes.uv?mat.metalnessMap:null,roughnessMap:geo.attributes.uv?mat.roughnessMap:null});
 return m;
}

export function createCamp({scene,spot,url,mobile=false,vegetation=null,initial=false,loadGLB}){
 const L=campLayout(spot),root=new T.Group();root.name='RiverCamp';root.visible=false;scene.add(root);
 const firePivot=new T.Group(),tentPivot=new T.Group();firePivot.name='CampFire';tentPivot.name='CampTent';
 firePivot.position.copy(L.fire.pos);firePivot.quaternion.copy(L.fire.quat);
 tentPivot.position.copy(L.tent.pos);tentPivot.quaternion.copy(L.tent.quat);
 root.add(firePivot,tentPivot);
 // 炎は薪の中心から真上へ（焚火の傾きには付いていかない）。地面の輪は足元の起伏に沿わせる
 const logs=CAMP_GLB.logs,logR=Math.max(logs.max[0]-logs.min[0],logs.max[2]-logs.min[2])/2;
 const flameAt=new T.Vector3(0,(logs.min[1]+logs.max[1])/2,0).applyMatrix4(firePivot.matrix.compose(firePivot.position,firePivot.quaternion,firePivot.scale));
 const fx=createFireFx({mobile,size:logR*.62,baseY:flameAt.y-L.fire.pos.y,light:false,
  ground:(x,z)=>heightAt(flameAt.x+x,flameAt.z+z)-L.fire.pos.y});
 fx.group.position.set(flameAt.x,L.fire.pos.y,flameAt.z);root.add(fx.group);
 // 暖かい光（PC のみ）は OFF の間も場面に置いたまま明るさ 0。ON/OFF でライトの数が変わると、
 // 全部の材質のシェーダーが作り直しになって一瞬止まるため
 let light=null;
 if(!mobile){light=new T.PointLight(0xff8a3c,0,5,2);light.position.set(flameAt.x,flameAt.y+.45,flameAt.z);light.name='CampLight';scene.add(light);}

 // ON の間だけ、テントの床・焚火の下から生える草を隠す（OFF で元に戻す）
 const grass=vegetation&&vegetation.userData.grass,hidden=[];
 function hideGrass(on){
  if(!grass)return;
  const m=new T.Matrix4(),v=new T.Vector3(),zero=new T.Matrix4().makeScale(0,0,0);
  if(on&&!hidden.length){
   for(let i=0;i<grass.count;i++){grass.getMatrixAt(i,m);v.setFromMatrixPosition(m);if(L.inside(v.x,v.z)){hidden.push([i,m.clone()]);grass.setMatrixAt(i,zero);}}
  }else if(!on){for(const [i,mm] of hidden)grass.setMatrixAt(i,mm);hidden.length=0;}
  grass.instanceMatrix.needsUpdate=true;
 }

 let on=false,loaded=null;
 function load(){
  if(loaded)return loaded;
  const loader=loadGLB||(u=>new GLTFLoader().loadAsync(u));
  loaded=loader(url).then(gltf=>{
   const tent=new T.Group(),fire=new T.Group();
   // 焚火とテントを、それぞれの支点（焚火＝原点、テント＝外形の中心）からの相対位置に置き直す
   tent.position.set(-CAMP_GLB.tentFrame.mid[0],0,-CAMP_GLB.tentFrame.mid[1]);tentPivot.add(tent);firePivot.add(fire);
   const parts=[];gltf.scene.traverse(o=>{if(o.isMesh)parts.push(o);});
   gltf.scene.updateMatrixWorld(true);
   for(const o of parts){
    let part=o;for(let q=o;q;q=q.parent)if(q.userData&&q.userData.campPart){part=q;break;}
    const kind=part.userData.campPart,dst=kind==='tent'?tent:fire;
    const geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);
    const add=(g,mat)=>{const mesh=new T.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=o.name;dst.add(mesh);return mesh;};
    add(geo,webSafeMaterial(o.material,geo));
   }
   return {tent,fire};
  }).catch(e=>{console.warn('[camp]',e);loaded=null;throw e;});
  return loaded;
 }
 function set(v,{save=true}={}){
  on=!!v;if(save)saveCampOn(on);
  if(on){load().then(()=>{if(on){root.visible=true;hideGrass(true);}}).catch(()=>{});}
  else{root.visible=false;hideGrass(false);if(light)light.intensity=0;}
  for(const f of subs)f(on);
 }
 const subs=new Set();
 function update(dt,time){
  if(!on||!root.visible)return;
  fx.update(dt,time);
  if(light)light.intensity=2.4*(.85+.1*Math.sin(time*11.3)+.06*Math.sin(time*23.7+1.1));
 }
 if(initial)set(true,{save:false});
 return {root,layout:L,update,set,load,get on(){return on;},toggle(){set(!on);},onChange(f){subs.add(f);return ()=>subs.delete(f);},light,fx};
}

// 画面の 🏕️ ボタン：音量ボタンと同じ丸ボタン。押すたびにキャンプ ON/OFF
export function mountCampToggle(camp,parent,{after=null}={}){
 const b=document.createElement('button');b.type='button';b.className='camp-toggle';b.textContent='🏕️';
 const show=()=>{const l=camp.on?'キャンプ（ON）':'キャンプ（OFF）';b.setAttribute('aria-pressed',String(camp.on));b.setAttribute('aria-label',l);b.title=l;};
 b.addEventListener('click',()=>camp.toggle());camp.onChange(show);show();
 if(after&&after.parentNode===parent)after.after(b);else parent.prepend(b);
 return b;
}
