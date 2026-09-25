import * as T from 'three';
import {characterDefinitions} from '../characters/config.js';
import {createCharacter} from '../characters/model.js';
import {loadCharacterVisual} from '../characters/gltf.js';
import {heightAt,riverCenter,riverHalfWidth,WATER_Y} from './terrain.js';
import {rockGeometry} from './rocks.js';
import {patchSurface} from './materials.js';
import {rng} from './noise.js';

const characterUrls=import.meta.glob('../../assets/characters/{chicken,piyokichi,piyomi}.glb',{eager:true,query:'?url',import:'default'});
const urlFor=file=>Object.entries(characterUrls).find(([k])=>k.endsWith('/'+file))?.[1];
const FILES={chicken:'chicken.glb',chick:'piyokichi.glb',piyomi:'piyomi.glb'};

// ---- where everyone sits: the left bank, just downstream of the default view
const Z0=70;
function bankPoint(z,off){const c=riverCenter(z),hw=riverHalfWidth(z);return new T.Vector3(c-hw-off,0,z);}
function castPoint(from,dir){
 for(let d=6.5;d>3;d-=.25){const x=from.x+dir.x*d,z=from.z+dir.z*d;if(WATER_Y-heightAt(x,z)>.75)return new T.Vector3(x,WATER_Y,z);}
 return new T.Vector3(from.x+dir.x*4.5,WATER_Y,from.z+dir.z*4.5);
}
// 立ち位置と向き。竿は全員「本人の右の翼」（arms[0]、キャラのローカル -x 側）で持つ。
// 体はカメラへ 3/4 向き（turn）で、右の翼は川側の斜め前へ伸びる。
// elev は待機時の竿の仰角、butt は翼先より後ろに出るグリップの長さ、reach は翼を川側へ開く量、
// caughtYaw は釣れた魚を吊るす向き（体の正面から右＝川側へ。顔の真正面を避けた斜め前）。
const LAYOUT=[
 {id:'piyo',z:Z0-2.6,off:.55,aim:-.62,rod:1.8,sit:false,turn:.55,elev:.66,butt:.1,reach:.85,joyFwd:.15,joyOut:.55,caughtYaw:-1.05},
 {id:'chiki',z:Z0,off:1.05,aim:-.36,rod:2.5,sit:true,seatDrop:.063,legRest:-1.42,legSwing:.07,headPitch:.5,turn:.55,elev:.6,butt:.14,reach:.85,liftMax:0,drop:.95,joyFwd:.6,joyOut:.12,caughtYaw:-1.1},
 {id:'piyomi',z:Z0+2.4,off:.6,aim:-.16,rod:1.8,sit:false,turn:.35,elev:.7,butt:.1,reach:.95,drop:.65,caughtYaw:-1.15,twistMax:.55},
];
export function fishingSpot(){
 // カメラは川の上・やや上流側から岸を見る。3人が横に並んで見え、重ならない
 const base=LAYOUT.map(l=>{const p=bankPoint(l.z,l.off);p.y=heightAt(p.x,p.z);return p;});
 const mid=base[1],river=new T.Vector3(1,0,LAYOUT[1].aim).normalize(),hc=Math.atan2(river.x,river.z)+.5;
 const camPos=mid.clone().add(new T.Vector3(Math.sin(hc),0,Math.cos(hc)).multiplyScalar(6.8)).setY(mid.y+2.6);
 const anglers=LAYOUT.map((l,i)=>{
  const p=base[i];
  const dir=new T.Vector3(1,0,l.aim).normalize(),cast=castPoint(p,dir);
  // 体の向き：カメラに対して 3/4（顔と胸が見える）。右翼（竿・魚の側）がカメラ寄りになるよう turn だけ左へひねる。
  // こうすると釣れた魚（右斜め前＝川側）を見るとき、顔がカメラから逃げない
  const faceYaw=Math.atan2(camPos.x-p.x,camPos.z-p.z)+l.turn,face=new T.Vector3(Math.sin(faceYaw),0,Math.cos(faceYaw));
  // 竿の水平方向：体の正面からウキへ向けた角度（本人の右＝マイナス）。顔の前を横切らないよう -0.5 より内側へは振らない
  const rodYaw=T.MathUtils.clamp(Math.atan2(cast.x-p.x,cast.z-p.z)-faceYaw,-1.25,-.5);
  return {...l,pos:p,dir,cast,faceYaw,face,rodYaw};
 });
 return {anglers,clear:[{x:mid.x,z:mid.z,r:4.2}],fishHomes:anglers.flatMap(a=>[[a.cast.x+.8,a.cast.z+.5],[a.cast.x-.4,a.cast.z-.9]]),
  camera:{position:camPos,target:mid.clone().addScaledVector(river,.9).setY(mid.y+.65)}};
}

// ---- small props
function makeRod(length){
 const root=new T.Group(),joints=[],n=5,seg=length/n;
 // 竹竿: bamboo tan with a darker wrapped grip
 const blank=new T.MeshStandardMaterial({color:0xd2b06a,roughness:.55}),cork=new T.MeshStandardMaterial({color:0x7a4a2a,roughness:.8});
 let parent=root;
 for(let i=0;i<n;i++){
  const j=new T.Group();j.position.y=i?seg:0;parent.add(j);
  const r0=T.MathUtils.lerp(.028,.009,i/n),r1=T.MathUtils.lerp(.028,.009,(i+1)/n);
  const g=new T.CylinderGeometry(r1,r0,seg,7);g.translate(0,seg/2,0);const m=new T.Mesh(g,i?blank:cork);m.castShadow=true;j.add(m);
  if(i){const node=new T.Mesh(new T.TorusGeometry(r0*1.05,r0*.35,5,10),cork);node.rotation.x=Math.PI/2;j.add(node);}
  joints.push(j);parent=j;
 }
 const tip=new T.Group();tip.position.y=seg;parent.add(tip);
 const reel=new T.Mesh(new T.CylinderGeometry(.045,.045,.05,12),new T.MeshStandardMaterial({color:0xd8d8d0,roughness:.4,metalness:.5}));
 reel.rotation.z=Math.PI/2;reel.position.set(.05,seg*.55,0);joints[0].add(reel);
 return {root,joints,tip};
}
function makeFloat(){
 const g=new T.Group();
 const top=new T.Mesh(new T.SphereGeometry(.065,16,10,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:0xff4b2b,roughness:.35,emissive:0x551000}));
 const bot=new T.Mesh(new T.SphereGeometry(.065,16,10,0,Math.PI*2,Math.PI/2,Math.PI/2),new T.MeshStandardMaterial({color:0xfdfbf2,roughness:.4}));
 bot.scale.y=1.6;const stick=new T.Mesh(new T.CylinderGeometry(.008,.008,.12,6),top.material);stick.position.y=.1;
 g.add(top,bot,stick);g.traverse(o=>o.castShadow=true);
 const hit=new T.Mesh(new T.SphereGeometry(.7,8,6),new T.MeshBasicMaterial({visible:false}));g.add(hit);g.userData.hit=hit;
 return g;
}
function bubbleTexture(kind){
 const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');
 g.fillStyle=kind==='bite'?'#ffd84a':'#ffffff';g.strokeStyle='#3b3226';g.lineWidth=6;
 g.beginPath();g.arc(64,58,44,0,7);g.fill();g.stroke();
 g.beginPath();g.moveTo(52,96);g.lineTo(64,122);g.lineTo(74,96);g.fill();
 g.fillStyle='#3b3226';
 if(kind==='bite'){g.fillRect(56,26,16,40);g.beginPath();g.arc(64,80,8,0,7);g.fill();}
 else{ // little star
  g.fillStyle='#ff9a3c';g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?14:34;g.lineTo(64+Math.cos(a)*r,58+Math.sin(a)*r);}g.closePath();g.fill();}
 const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;return t;
}
function makeBucket(){
 const g=new T.Group(),m=new T.MeshStandardMaterial({color:0x4a90c8,roughness:.5,side:T.DoubleSide});
 const b=new T.Mesh(new T.CylinderGeometry(.2,.16,.3,20,1,true),m);b.position.y=.15;const bottom=new T.Mesh(new T.CircleGeometry(.16,20),m);bottom.rotation.x=-Math.PI/2;bottom.position.y=.005;
 const water=new T.Mesh(new T.CircleGeometry(.19,20),new T.MeshStandardMaterial({color:0x6fc8c0,roughness:.1,transparent:true,opacity:.8}));water.rotation.x=-Math.PI/2;water.position.y=.22;
 const handle=new T.Mesh(new T.TorusGeometry(.2,.008,6,24,Math.PI),new T.MeshStandardMaterial({color:0xcccccc,metalness:.6,roughness:.3}));handle.position.y=.3;
 g.add(b,bottom,water,handle);g.traverse(o=>{o.castShadow=true;o.receiveShadow=true;});return g;
}

// ---- splash particles + ripple rings
function makeEffects(){
 const N=240,pos=new Float32Array(N*3),life=new Float32Array(N),vel=new Float32Array(N*3);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));
 const pts=new T.Points(geo,new T.PointsMaterial({color:0xf4fbfb,size:.07,transparent:true,opacity:.9,depthWrite:false}));pts.frustumCulled=false;
 const rings=[];const ringGeo=new T.RingGeometry(.85,1,48);ringGeo.rotateX(-Math.PI/2);
 const group=new T.Group();group.add(pts);
 for(let i=0;i<14;i++){const r=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));r.visible=false;r.userData.t=1;group.add(r);rings.push(r);}
 let next=0;const R=rng(3);
 for(let i=0;i<N;i++)pos[i*3+1]=-99;
 return {group,
  splash(p,n=18,power=1){for(let k=0;k<n;k++){const i=next=(next+1)%N;pos[i*3]=p.x;pos[i*3+1]=WATER_Y+.02;pos[i*3+2]=p.z;const a=R()*6.28,s=(.4+R()*.9)*power;vel[i*3]=Math.cos(a)*s*.6;vel[i*3+1]=(1.2+R()*1.6)*power;vel[i*3+2]=Math.sin(a)*s*.6;life[i]=1;}},
  ripple(p,size=1){const r=rings.find(r=>r.userData.t>=1)??rings[0];r.position.set(p.x,WATER_Y+.012,p.z);r.userData.t=0;r.userData.size=size;r.visible=true;},
  update(dt){
   for(let i=0;i<N;i++){if(life[i]<=0)continue;life[i]-=dt*1.4;vel[i*3+1]-=9.8*dt;pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;if(pos[i*3+1]<WATER_Y||life[i]<=0){life[i]=0;pos[i*3+1]=-99;}}
   geo.attributes.position.needsUpdate=true;
   for(const r of rings){if(r.userData.t>=1)continue;r.userData.t+=dt*.7;const t=r.userData.t;r.scale.setScalar((.1+t*1.1)*r.userData.size);r.material.opacity=(1-t)*.55;if(t>=1)r.visible=false;}
  }};
}

// 翼の付け根（肩）を支点に回す：ピボット位置を補正して、付け根の点 S が動かないようにする
function setWing(w,q){w.pivot.quaternion.copy(q);w.pivot.position.copy(w.S).applyQuaternion(q).negate().add(w.S).add(w.rest);}
function measureWings(c,wings){
 c.root.updateMatrixWorld(true);
 const keep=wings.map(w=>[w.pivot.position.clone(),w.pivot.quaternion.clone()]);
 wings.forEach(w=>{w.pivot.position.copy(w.rest);w.pivot.quaternion.identity();});
 c.rig.updateMatrixWorld(true);
 const toRig=new T.Matrix4().copy(c.rig.matrixWorld).invert(),v=new T.Vector3();
 const vertsOf=(root,skip)=>{const out=[];root.traverse(o=>{if(!o.isMesh||skip?.(o))return;let n=o,vis=true;while(n&&n!==c.root){if(!n.visible)vis=false;n=n.parent;}if(!vis)return;
  const pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i++)out.push(v.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld).applyMatrix4(toRig).clone());});return out;};
 const under=(o,roots)=>{let n=o;while(n){if(roots.includes(n))return true;n=n.parent;}return false;};
 const body=vertsOf(c.rig,o=>under(o,[...c.arms,...c.legs,c.head,c.props]));
 for(const w of wings){
  const pts=vertsOf(w.pivot);if(!pts.length)continue;
  const y0=w.rest.y,bx=Math.max(...body.filter(p=>Math.abs(p.y-y0)<.12).map(p=>Math.abs(p.x)),0);
  const top=Math.max(...pts.map(p=>p.y));
  // 付け根：胴体の輪郭（|x|≈bx）付近で、いちばん上にある部分の中心
  let band=pts.filter(p=>Math.abs(Math.abs(p.x)-bx)<.035&&p.y>top-.09);
  if(band.length<4)band=pts.filter(p=>p.y>top-.06);
  const S=band.reduce((acc,p)=>acc.add(p),new T.Vector3()).multiplyScalar(1/band.length);
  let far=S;for(const p of pts)if(p.distanceTo(S)>far.distanceTo(S))far=p;
  w.S.copy(S).sub(w.rest);w.len=far.distanceTo(S);w.dir.copy(far).sub(S).normalize();
 }
 wings.forEach((w,i)=>{w.pivot.position.copy(keep[i][0]);w.pivot.quaternion.copy(keep[i][1]);});
}

const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const lerp=T.MathUtils.lerp;

export function createFishing({scene,fish,camera,dom,shared,onScore,onEvent}){
 const spot=fishingSpot(),fx=makeEffects();scene.add(fx.group);
 const R=rng(21),anglers=[];
 const rockMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.95,envMapIntensity:.45});patchSurface(rockMat,'rock',shared);
 const lineMat=new T.LineBasicMaterial({color:0xf2f2ea,transparent:true,opacity:.85});
 const tmp3=new T.Vector3(),qTmp=new T.Quaternion(),eTmp=new T.Euler(),tmp=new T.Vector3(),tmp2=new T.Vector3(),grip=new T.Vector3(),gripDir=new T.Vector3(),rodDir=new T.Vector3();

 for(const a of spot.anglers){
  const def=characterDefinitions.find(d=>d.id===a.id);
  const c=createCharacter({...def,start:[a.pos.x,a.pos.y,a.pos.z]});
  c.root.rotation.y=a.faceYaw;
  c.root.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  scene.add(c.root);
  
  const big=def.variant==='chicken';
  let seatY=0;
  if(a.sit){ // a flat boulder to sit on
   const rock=new T.Mesh(rockGeometry(4,3),rockMat);
   rock.scale.set(.55,.36,.5);rock.position.set(a.pos.x-a.face.x*.12,a.pos.y+.02,a.pos.z-a.face.z*.12);rock.rotation.y=R()*6;rock.castShadow=rock.receiveShadow=true;scene.add(rock);
   rock.geometry.computeBoundingBox();seatY=rock.geometry.boundingBox.max.y*.36+.02;
  }
  const rod=makeRod(a.rod);rod.root.rotation.order='YXZ';c.props.add(rod.root); // props survives the GLB swap (other rig children are hidden)
  // 翼は「肩の付け根」を支点に回す。GLB の翼はピボットと付け根がずれていることがある（ぴよみ）ので、
  // 読み込み後に付け根（胴体の輪郭と接するいちばん上の部分）と翼先を測っておく。
  const wings=c.arms.map(pivot=>({pivot,rest:pivot.position.clone(),S:new T.Vector3(),dir:new T.Vector3(0,-1,0),len:big?.36:.26}));
  const measure=()=>measureWings(c,wings);
  measure();
  const float=makeFloat();scene.add(float);
  const line=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:26},()=>new T.Vector3())),lineMat);line.frustumCulled=false;scene.add(line);
  const bubble=new T.Sprite(new T.SpriteMaterial({map:bubbleTexture('bite'),depthTest:false,transparent:true}));bubble.scale.setScalar(.42);bubble.renderOrder=10;bubble.visible=false;scene.add(bubble);
  const star=new T.Sprite(new T.SpriteMaterial({map:bubbleTexture('star'),depthTest:false,transparent:true}));star.scale.setScalar(.42);star.renderOrder=10;star.visible=false;scene.add(star);
  if(a.id==='piyomi'){const b=makeBucket();b.position.set(a.pos.x-.15,a.pos.y-.02,a.pos.z+.55);scene.add(b);}
  loadCharacterVisual(c,urlFor(FILES[def.variant])).then(()=>{c.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});measure();});
  anglers.push({...a,c,big,seatY,rod,wings,float,line,bubble,star,state:'ready',t:0,delay:.8+R()*2.5,elev0:a.elev,elev:a.elev,twist:0,rodYawNow:a.rodYaw,look3:a.cast.clone(),bend:0,
   floatPos:new T.Vector3(),hook:new T.Vector3(),from:new T.Vector3(),to:new T.Vector3(),target:a.cast.clone(),fish:null,score:0,tapped:false,head:0});
 }

 // 視線の先（ワールド座標）
 function lookTarget(a,out){
  switch(a.state){
   case 'nibble':case 'bite':case 'fight':case 'miss':return out.copy(a.floatPos);
   case 'lift':case 'caught':return a.fish?a.fish.root.getWorldPosition(out):out.copy(a.floatPos);
   case 'release':if(a.fish&&a.t<.45)return a.fish.root.getWorldPosition(out);
  }
  return out.copy(a.target).lerp(a.pos,.3).setY(WATER_Y); // 水面
 }
 function set(a,state){a.state=state;a.t=0;}
 function tipWorld(a,out){a.rod.tip.getWorldPosition(out);return out;}
 function newTarget(a){a.target.copy(a.cast).add(tmp.set((R()-.5)*1.2,0,(R()-.5)*1.6));if(WATER_Y-heightAt(a.target.x,a.target.z)<.5)a.target.copy(a.cast);}

 function updateLine(a,time){
  const tip=tipWorld(a,tmp),pts=a.line.geometry.attributes.position,end=a.floatPos;
  const slack=a.state==='wait'||a.state==='nibble'?.35:a.state==='fight'?.02:.12;
  const n=20;
  for(let i=0;i<=n;i++){const t=i/n;const x=lerp(tip.x,end.x,t),z=lerp(tip.z,end.z,t);let y=lerp(tip.y,end.y,t)-Math.sin(t*Math.PI)*slack*tip.distanceTo(end)*.15;pts.setXYZ(i,x,y,z);}
  // below the float, down to the hook
  const inWater=a.state==='wait'||a.state==='nibble'||a.state==='bite';
  for(let i=n+1;i<26;i++){const t=(i-n)/5;pts.setXYZ(i,lerp(end.x,a.hook.x,inWater?t:0),lerp(end.y,a.hook.y,inWater?t:0),lerp(end.z,a.hook.z,inWater?t:0));}
  pts.needsUpdate=true;
 }

 function pose(a,time,dt){
  const c=a.c,t=a.t;
  c.rig.position.set(0,0,0);c.rig.rotation.set(0,0,0);c.head.rotation.set(0,0,0);
  c.vr.visible=false;c.broom.visible=false;c.food.visible=false;c.vrControllers?.forEach(o=>o.visible=false);if(c.modelingHeadphones)c.modelingHeadphones.visible=false;
  c.legs.forEach(l=>l.rotation.set(0,0,0));
  // 座り：お尻が岩の上面に軽く乗る高さまで下げ（seatDrop）、そのぶん足を前へ少し上げて岩にめり込まないようにする
  if(a.sit){c.rig.position.y=a.seatY-.12-(a.seatDrop??0);c.legs.forEach((l,i)=>l.rotation.x=(a.legRest??-1.25)+Math.sin(time*1.4+i*2)*(a.legSwing??.12));c.rig.rotation.x=-.08;}
  else c.rig.position.y=Math.sin(time*2.1+a.z)*.01;
  let elev=a.elev0,bend=.05,hop=0;
  switch(a.state){
   case 'cast':{const w=Math.min(t/.55,1),f=T.MathUtils.clamp((t-.55)/.25,0,1);elev=t<.55?lerp(a.elev0,1.3,ease(w)):lerp(1.3,.3,ease(f));bend=t<.55?-.08*w:.25*(1-f);break;}
   case 'wait':elev=a.elev0+Math.sin(time*.9+a.z)*.02;break;
   case 'nibble':elev=a.elev0-.02;bend=.08+Math.max(0,Math.sin(t*14))*.05;break;
   case 'bite':elev=a.elev0-.04+(a.tapped?.2:0);bend=.22;break;
   case 'fight':elev=1.05+Math.sin(t*9)*.08;bend=.55+Math.sin(t*13)*.12;c.rig.rotation.x=-.12;break;
   case 'lift':elev=lerp(1.05,.98,ease(Math.min(t/.7,1)));bend=.35;break;
   case 'caught':elev=.98;bend=.3+Math.sin(time*9)*.05;hop=Math.abs(Math.sin(t*7))*(t<1.6?.12:0);break;
   case 'release':elev=lerp(.98,a.elev0,ease(Math.min(t/.8,1)));bend=.1;break;
   case 'miss':elev=a.elev0-.1;bend=0;break;
   case 'retrieve':elev=lerp(a.elev0,.95,Math.sin(Math.min(t/.8,1)*Math.PI));bend=.1;break;
  }
  a.elev+=(elev-a.elev)*Math.min(1,dt*(a.state==='cast'?30:6));a.bend+=(bend-a.bend)*Math.min(1,dt*8);
  // 本人の右の翼（arms[0]）を斜め前・外へ伸ばし、その翼先でグリップを握る（肩の付け根が支点）
  const [right,left]=a.wings;
  const lift=T.MathUtils.clamp((a.elev-a.elev0)*.35,-.1,a.liftMax??.3);
  gripDir.set(-a.reach,-(a.drop??.5)+lift,.6).normalize();
  qTmp.setFromUnitVectors(right.dir,gripDir);setWing(right,qTmp);
  grip.copy(right.rest).add(right.S).addScaledVector(gripDir,right.len*.9);
  // 左の翼：ふだんは体の横でリラックス、釣れた！で肩を支点にパタパタよろこぶ
  let raise=0;
  if(a.state==='caught')raise=Math.min(a.t/.25,1)*(.7+Math.abs(Math.sin(a.t*7))*.3);
  else if(a.state==='release')raise=Math.max(0,1-a.t/.5)*.75;
  // 肩を支点に回す。下向きの翼（ちきん・ぴよきち）は前へ振り上げ、横向きの翼（ぴよみ）は上下にパタパタ。
  // どちらも頭・フードの下へ入り込まない向きだけを使う
  const sway=Math.sin(time*1.1+a.z)*.05;
  if(Math.abs(left.dir.y)>.6)eTmp.set(-.2-raise*(a.joyFwd??.6)+sway,0,.18+raise*(a.joyOut??.3));
  else eTmp.set(-.15+sway,0,-.08-raise*.55);
  qTmp.setFromEuler(eTmp);setWing(left,qTmp);
  // ---- 視線：待機は水面、アタリはウキ、やりとり〜釣れたは魚。まず胴体を少し向け、残りを首で向く
  lookTarget(a,tmp3);
  a.look3.lerp(tmp3,1-Math.exp(-dt*(a.state==='lift'||a.state==='caught'?8:3.5)));
  let rel=Math.atan2(a.look3.x-a.pos.x,a.look3.z-a.pos.z)-a.faceYaw;rel=Math.atan2(Math.sin(rel),Math.cos(rel));
  const tw=a.twistMax??.38;a.twist+=(T.MathUtils.clamp(rel*.45,-tw,tw)-a.twist)*Math.min(1,dt*4);
  c.root.rotation.y=a.faceYaw+a.twist;
  const headYaw=T.MathUtils.clamp(rel-a.twist,a.state==='cast'?-.1:-.65,.72); // 竿のある右側へは回しすぎない（振りかぶり中は正面）
  const headWY=a.pos.y+c.rig.position.y+c.head.position.y;
  // headPitch：見下ろす角度の効き具合（ちきんは 0.5 ＝ 視線の方向は保ったまま、あごを引きすぎない）
  const pitch=T.MathUtils.clamp(Math.atan2(headWY-a.look3.y,Math.hypot(a.look3.x-a.pos.x,a.look3.z-a.pos.z))*(a.headPitch??1),-.45,.55);
  // 竿は世界の中で同じ向きを保つ（胴体をひねった分だけ逆に戻す）。釣れたら魚を川側の斜め前へ
  const yawGoal=a.state==='lift'||a.state==='caught'||(a.state==='release'&&a.t<.4)?a.caughtYaw:a.rodYaw;
  a.rodYawNow+=(yawGoal-a.rodYawNow)*Math.min(1,dt*3);
  const ry=Math.min(a.rodYawNow-a.twist,-.6); // 胴体をひねっても竿が顔の前へ回り込まないように
  a.rod.root.rotation.set(Math.PI/2-a.elev,ry,0);
  rodDir.set(Math.sin(ry)*Math.cos(a.elev),Math.sin(a.elev),Math.cos(ry)*Math.cos(a.elev));
  a.rod.root.position.copy(grip).addScaledVector(rodDir,-a.butt);
  a.rod.joints.forEach((j,i)=>{if(i)j.rotation.x=a.bend*(i/a.rod.joints.length)*.55;});
  c.rig.position.y+=hop;c.head.rotation.set(pitch,headYaw,0,'YXZ');
  // ぴよみの目：釣れたら ^^
  if(c.expressionMeshes){const e=a.state==='caught'?'happy':'normal';for(const [n,ms] of Object.entries(c.expressionMeshes))ms.forEach(m=>m.visible=n===e);}
 }

 function hookFish(a){
  const f=a.fish;if(!f)return;f.lured=null;f.hooked=true;
 }

 function update(dt,time){
  fx.update(dt);
  for(const a of anglers){
   a.t+=dt;const t=a.t;
   const tip=tipWorld(a,tmp2);
   switch(a.state){
    case 'ready':{a.floatPos.set(tip.x,tip.y-.35,tip.z);if(t>a.delay){newTarget(a);set(a,'cast');}break;}
    case 'cast':{
     if(t<.62)a.floatPos.set(tip.x,tip.y-.35+Math.min(t,.5)*.4,tip.z);
     else{if(!a.flying){a.flying=true;a.from.copy(a.floatPos);}
      const k=Math.min((t-.62)/.75,1);a.floatPos.lerpVectors(a.from,a.target,k);a.floatPos.y=lerp(a.from.y,WATER_Y,k)+Math.sin(k*Math.PI)*1.6;
      if(k>=1){a.flying=false;fx.splash(a.target,10,.5);fx.ripple(a.target,.6);onEvent?.('land',a,a.target);a.floatPos.copy(a.target);set(a,'wait');a.fish=null;a.waitFor=1.5+R()*3;}}
     break;}
    case 'wait':case 'nibble':case 'bite':{
     const sink=a.state==='bite'?-.14-Math.min(t,.3)*.2:a.state==='nibble'&&Math.sin(t*14)>.6?-.035:0;
     a.floatPos.set(a.target.x+Math.sin(time*.5+a.z)*.04,WATER_Y+Math.sin(time*2.4+a.z)*.008+sink+.02,a.target.z+Math.cos(time*.4)*.04);
     a.hook.set(a.floatPos.x+.05,Math.max(WATER_Y-.55,heightAt(a.floatPos.x,a.floatPos.z)+.15),a.floatPos.z+.2);
     if(a.state==='wait'){
      if(t>a.waitFor&&!a.fish)a.fish=fish.lure(a.hook);
      if(a.fish&&a.fish.root.position.distanceTo(a.hook)<.45){set(a,'nibble');a.nibbleFor=1.2+R()*2;}
      if(t>16)set(a,'retrieve');
     }else if(a.state==='nibble'){
      if(Math.sin(t*14)>.97)fx.ripple(a.floatPos,.25);
      if(t>a.nibbleFor){set(a,'bite');a.tapped=false;fx.splash(a.floatPos,6,.3);fx.ripple(a.floatPos,.5);}
     }else{
      a.bubble.visible=true;a.bubble.position.copy(a.c.root.position).y+=(a.big?1.75:1.25)+Math.abs(Math.sin(t*10))*.05;
      if(a.tapped||t>1.1){a.bubble.visible=false;
       if(a.tapped||R()<.72){hookFish(a);set(a,'fight');a.fightFrom=a.floatPos.clone();}
       else{set(a,'miss');if(a.fish){fish.release(a.fish,{dart:true});a.fish=null;}fx.splash(a.floatPos,8,.4);}}
     }
     break;}
    case 'fight':{
     // the fish runs about and is drawn toward the bank in front of the angler
     const k=Math.min(t/2.4,1),shore=tmp.copy(a.pos).addScaledVector(a.dir,1.9);shore.y=WATER_Y;
     a.floatPos.lerpVectors(a.fightFrom,shore,ease(k));a.floatPos.x+=Math.sin(t*5)*.35*(1-k);a.floatPos.z+=Math.cos(t*3.7)*.3*(1-k);a.floatPos.y=WATER_Y+.02;
     if(a.fish){const fp=a.fish.root.position;fp.set(a.floatPos.x,WATER_Y-.12,a.floatPos.z);a.fish.root.rotation.set(0,Math.atan2(-(tip.x-fp.x),-(tip.z-fp.z))+Math.sin(t*14)*.5,0);a.fish.tail.rotation.y=Math.sin(t*30)*.6;}
     if(Math.random()<dt*9)fx.splash(a.floatPos,4,.5);if(Math.random()<dt*3)fx.ripple(a.floatPos,.4);
     if(k>=1){set(a,'lift');fx.splash(a.floatPos,26,.9);fx.ripple(a.floatPos,.8);onEvent?.('lift',a,a.floatPos);a.from.copy(a.floatPos);}
     break;}
    case 'lift':case 'caught':{
     const k=a.state==='lift'?Math.min(t/.7,1):1;
     const hang=tmp.set(tip.x+Math.sin(time*2.2)*.12,tip.y-.75,tip.z+Math.cos(time*1.7)*.08);
     a.floatPos.lerpVectors(a.from,hang,ease(k));a.floatPos.y+=Math.sin(k*Math.PI)*.6;
     if(a.fish){const fr=a.fish.root;fr.position.copy(a.floatPos).y-=.28;fr.rotation.order='YXZ';fr.rotation.set(Math.PI/2,time*1.3,0);a.fish.tail.rotation.y=Math.sin(time*(a.state==='lift'?30:12))*.6;a.fish.body.rotation.y=Math.sin(time*9)*.15;}
     if(a.state==='lift'&&k>=1){set(a,'caught');a.score++;onScore?.(a.id,a.score);}
     if(a.state==='caught'){a.star.visible=t<2.2;a.star.position.copy(a.c.root.position).y+=(a.big?1.8:1.3)+t*.08;if(t>2.8){a.star.visible=false;set(a,'release');a.from.copy(a.floatPos);}}
     break;}
    case 'release':{
     const k=Math.min(t/.8,1),drop=tmp.copy(a.pos).addScaledVector(a.dir,2.4);drop.y=WATER_Y;
     if(a.fish){const fr=a.fish.root;fr.position.lerpVectors(a.from,drop,k);fr.position.y+=Math.sin(k*Math.PI)*.8-.28*(1-k);fr.rotation.x+=dt*8;}
     a.floatPos.set(tip.x,tip.y-.35,tip.z);
     if(k>=1){if(a.fish){fx.splash(drop,14,.6);fx.ripple(drop,.6);onEvent?.('release',a,drop);a.fish.root.position.copy(drop).y=-.3;fish.release(a.fish,{dart:true});a.fish=null;}set(a,'ready');a.delay=1+R()*2.5;}
     break;}
    case 'miss':{a.floatPos.y=WATER_Y+.02+Math.max(0,.1-t*.2);if(t>1.6)set(a,'retrieve');break;}
    case 'retrieve':{
     if(a.fish){a.fish.lured=null;a.fish=null;}
     if(!a.from2){a.from2=a.floatPos.clone();}
     const k=Math.min(t/.8,1);a.floatPos.lerpVectors(a.from2,tmp.set(tip.x,tip.y-.35,tip.z),ease(k));a.floatPos.y+=Math.sin(k*Math.PI)*.7;
     if(k>=1){a.from2=null;set(a,'ready');a.delay=.6+R()*1.5;}
     break;}
   }
   if(a.state!=='bite')a.bubble.visible=false;
   pose(a,time,dt);
   a.c.root.updateMatrixWorld(true);
   a.float.position.copy(a.floatPos);a.float.rotation.z=a.state==='fight'?Math.sin(t*20)*.4:Math.sin(time*1.7+a.z)*.08;
   updateLine(a,time);
  }
 }

 // tap the float while it is sinking to set the hook ("合わせ")
 const ray=new T.Raycaster(),ndc=new T.Vector2();let down=null;
 dom.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 dom.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8)return;const r=dom.getBoundingClientRect();
  ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
  trySetHook(ray);
 });
 // 画面タップ・VRコントローラーの両方から使う「合わせ」判定（当たったら true）
 function trySetHook(rc){
  let hit=false;
  for(const a of anglers){if((a.state==='bite'||a.state==='nibble')&&rc.intersectObject(a.float.userData.hit,false).length){if(a.state==='nibble'){set(a,'bite');}a.tapped=true;hit=true;}}
  return hit;
 }

 return {anglers,update,spot,trySetHook};
}
