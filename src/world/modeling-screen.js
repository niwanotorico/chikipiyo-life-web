import {AdditiveBlending,Box3,LinearFilter,WebGLRenderTarget,BufferAttribute,BufferGeometry,CanvasTexture,Color,DoubleSide,Float32BufferAttribute,Group,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,Points,PointsMaterial,RingGeometry,SRGBColorSpace,Vector3} from 'three';
import {modelingBeat,modelingProgress,trackpadStroke,clamp01,smooth} from '../characters/modeling-timeline.js';

// ノートPCの画面に「ぴよきちのモデリングソフト」を映す。
// 画面は部屋GLBの既存メッシュ（2三角形の平面）をそのまま使い、使っていない間は元の消灯マテリアルに戻す。

// 画面で組み立てるのは、3Dプリンターが刷る黄色いおうちと同じ形。
const V=[
 [-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],          // 0-3 床
 [-.5,.78,-.5],[.5,.78,-.5],[.5,.78,.5],[-.5,.78,.5],  // 4-7 壁の上
 [0,1.3,-.5],[0,1.3,.5],                               // 8-9 棟
 [-.64,.66,-.62],[.64,.66,-.62],[.64,.66,.62],[-.64,.66,.62],// 10-13 軒先
 [0,1.3,-.62],[0,1.3,.62],                             // 14-15 屋根の棟（はみ出し）
];
const wall='#ffd449',roof='#ffb938',door='#e8912c',win='#9fd4e6';
const F=[
 {v:[3,2,6,9,7],c:wall},{v:[1,0,4,8,5],c:wall},{v:[2,1,5,6],c:wall},{v:[0,3,7,4],c:wall},
 {v:[13,12,15],c:roof,skip:true},{v:[13,15,14,10],c:roof},{v:[12,11,14,15],c:roof},
 {v:[-1],door:true,c:door},{v:[-2],window:true,c:win},
].filter(f=>!f.skip);
const E=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7],[4,8],[5,8],[7,9],[6,9],[8,9],[10,11],[11,12],[12,13],[13,10],[10,14],[11,14],[13,15],[12,15],[14,15]];
// 扉と窓は正面／側面へ少し浮かせた四角。
const doorQuad=[[-.14,0,.502],[.14,0,.502],[.14,.46,.502],[-.14,.46,.502]];
const winQuad=[[.502,.34,-.18],[.502,.34,.18],[.502,.6,.18],[.502,.6,-.18]];

// 面の明るさ：モデル空間の外向き法線を回して、左上からの光と比べる。
function faceLight(face,yaw){
 const src=face.door?doorQuad:face.window?winQuad:face.v.map(k=>V[k]);
 const c=src.reduce((s,q)=>s.map((v,i)=>v+q[i]/src.length),[0,0,0]);
 const a=src[0],b=src[1],d=src[2],e1=b.map((v,i)=>v-a[i]),e2=d.map((v,i)=>v-a[i]);
 let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
 const len=Math.hypot(...n)||1;n=n.map(v=>v/len);
 if(n[0]*c[0]+n[1]*(c[1]-.5)+n[2]*c[2]<0)n=n.map(v=>-v);
 const nx=n[0]*Math.cos(yaw)+n[2]*Math.sin(yaw),nz=-n[0]*Math.sin(yaw)+n[2]*Math.cos(yaw);
 return .72+.3*Math.max(0,-.45*nx+.75*n[1]+.5*nz);
}
// 画面とホログラムで同じ向きに回す。考え中はゆっくり、完成後はくるくる。
export const modelYaw=(beat,time)=>.55+time*(beat==='done'||beat==='hopOff'?1.6:beat==='think'?.25:.55);
function mix(a,b,t){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);const ch=s=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t);return `rgb(${ch(16)},${ch(8)},${ch(0)})`;}
function shade(hex,k){const p=parseInt(hex.slice(1),16),ch=s=>Math.min(255,Math.round(((p>>s)&255)*k));return '#'+[16,8,0].map(s=>ch(s).toString(16).padStart(2,'0')).join('');}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}

// 描画ごとの一時配列を作らないよう、投影先・面リスト・グラデーションは使い回す（12fps で更新）。
const windowDots=[['#ff8f73',.03],['#ffd166',.07],['#8fd6a8',.11]];
const P=V.map(()=>new Float64Array(3)),doorP=doorQuad.map(()=>new Float64Array(3)),winP=winQuad.map(()=>new Float64Array(3));
const gridA=new Float64Array(3),gridB=new Float64Array(3),gridC=new Float64Array(3),gridD=new Float64Array(3),strokeBuf=[0,0];
const faceItems=F.map((face,i)=>({face,i,z:0,pts:face.door?doorP:face.window?winP:face.v.map(k=>P[k])})),faceOrder=faceItems.slice();
const byDepth=(a,b)=>a.z-b.z,gradients=new WeakMap(),fonts=new Map();
function viewportGradient(g,vy,vh){
 let c=gradients.get(g);
 if(!c||c.vy!==vy||c.vh!==vh){const grad=g.createLinearGradient(0,vy,0,vy+vh);grad.addColorStop(0,'#8fb5ac');grad.addColorStop(1,'#5f857d');c={vy,vh,grad};gradients.set(g,c);}
 return c.grad;
}
const titleFont=h=>{let f=fonts.get(h);if(!f){f=`bold ${Math.round(h*.05)}px sans-serif`;fonts.set(h,f);}return f;};

// 純粋な描画。g は CanvasRenderingContext2D 互換。テストではスタブを渡す。
export function drawModelingScreen(g,w,h,t,time){
 const p=modelingProgress(t),beat=modelingBeat(t);
 // 背景とウィンドウ枠（部屋と同じミント寄りのやわらかい配色）
 g.fillStyle='#2e4643';g.fillRect(0,0,w,h);
 g.fillStyle='#3f5f59';g.fillRect(0,0,w,h*.085);
 for(let i=0;i<windowDots.length;i++){g.fillStyle=windowDots[i][0];g.beginPath();g.arc(w*windowDots[i][1],h*.043,h*.022,0,Math.PI*2);g.fill();}
 g.fillStyle='#e9f5ef';g.font=titleFont(h);g.textAlign='center';g.textBaseline='middle';g.fillText('piyo_house.blend',w*.5,h*.045);
 // 左のツール列：いまの作業のツールが光る
 const tool=p<.3?0:p<.55?1:p<.8?2:3;
 for(let i=0;i<4;i++){const x=w*.018,y=h*(.13+i*.105),s=h*.08;g.fillStyle=i===tool?'#ffd449':'#50706a';roundRect(g,x,y,s,s,s*.25);g.fill();
  g.fillStyle=i===tool?'#3b3320':'#a9c9bf';g.beginPath();
  if(i===0)g.arc(x+s/2,y+s/2,s*.14,0,Math.PI*2);
  if(i===1){g.fillRect(x+s*.2,y+s*.46,s*.6,s*.08);}
  if(i===2)g.fillRect(x+s*.28,y+s*.28,s*.44,s*.44);
  if(i===3){g.arc(x+s/2,y+s/2,s*.24,0,Math.PI*2);}
  g.fill();}
 // 右のパネル：レイヤーと色見本
 const px=w*.8;g.fillStyle='#365350';g.fillRect(px,h*.085,w-px,h);
 for(let i=0;i<5;i++){g.fillStyle=i===Math.min(4,Math.floor(p*5))?'#5f8a81':'#46655f';roundRect(g,px+w*.02,h*(.13+i*.075),w*.16,h*.05,h*.015);g.fill();}
 g.fillStyle=p>=.8?'#ffd449':'#cfd8d4';roundRect(g,px+w*.03,h*.56,w*.14,h*.13,h*.03);g.fill();
 // ビューポート
 const vx=w*.085,vy=h*.1,vw=px-vx-w*.012,vh=h*.8;
 g.fillStyle=viewportGradient(g,vy,vh);roundRect(g,vx,vy,vw,vh,h*.02);g.fill();
 g.save();roundRect(g,vx,vy,vw,vh,h*.02);g.clip();
 // 回転：考え中はゆっくり、完成後はくるくる
 const yaw=modelYaw(beat,time),pitch=.42,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const cx0=vx+vw*.5,cy0=vy+vh*.62,f=vh*1.3,camD=3.1;
 const proj=(out,x,y,z)=>{const rx=x*cy+z*sy,rz=-x*sy+z*cy,ry=y-.55;const yy=ry*cp-rz*sp,zz=ry*sp+rz*cp;const d=camD-zz;out[0]=cx0+rx*f/d;out[1]=cy0-yy*f/d;out[2]=zz;return out;};
 // 床グリッド
 g.strokeStyle='rgba(205,240,226,.28)';g.lineWidth=Math.max(1,h*.004);
 for(let i=-4;i<=4;i++){const a=proj(gridA,i*.3,0,-1.2),b=proj(gridB,i*.3,0,1.2),c=proj(gridC,-1.2,0,i*.3),d=proj(gridD,1.2,0,i*.3);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.moveTo(c[0],c[1]);g.lineTo(d[0],d[1]);g.stroke();}
 for(let i=0;i<V.length;i++)proj(P[i],V[i][0],V[i][1],V[i][2]);
 // 面：奥から順に
 const faceT=clamp01((p-.55)/.25),colorT=clamp01((p-.8)/.2);
 if(faceT>0){
  for(let i=0;i<doorQuad.length;i++)proj(doorP[i],doorQuad[i][0],doorQuad[i][1],doorQuad[i][2]);
  for(let i=0;i<winQuad.length;i++)proj(winP[i],winQuad[i][0],winQuad[i][1],winQuad[i][2]);
  for(let i=0;i<faceItems.length;i++){const item=faceItems[i];let z=0;for(let k=0;k<item.pts.length;k++)z+=item.pts[k][2];item.z=z/item.pts.length;faceOrder[i]=item;}
  const visibleCount=Math.ceil(faceT*F.length);
  faceOrder.sort(byDepth);
  for(let n=0;n<faceOrder.length;n++){
   const {face,pts,i}=faceOrder[n];
   if(i>=visibleCount)continue;
   if((face.door||face.window)&&colorT<=0)continue;
   const light=faceLight(face,yaw);
   g.fillStyle=mix(shade('#d9e1dd',light),shade(face.c,light),smooth(colorT));
   g.beginPath();for(let k=0;k<pts.length;k++){const q=pts[k];if(k)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1]);}g.closePath();g.fill();
  }
 }
 // 線：少しずつつながる（面が張られると薄くなる）
 const wireT=clamp01((p-.3)/.25);
 if(wireT>0){
  g.strokeStyle=`rgba(255,246,214,${.95-.75*faceT})`;g.lineWidth=h*.012;g.lineCap='round';
  const n=wireT*E.length;
  for(let i=0;i<E.length&&i<n;i++){const k=Math.min(1,n-i),A=P[E[i][0]],B=P[E[i][1]];g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k);g.stroke();}
 }
 // 点：ぽつぽつ現れる
 const dotT=clamp01(p/.3);
 if(dotT>0&&faceT<1){
  const n=dotT*P.length;
  for(let i=0;i<P.length&&i<n;i++){const q=P[i],pop=Math.min(1,(n-i)*2),r=h*.021*(pop<1?1+(1-pop)*.8:1)*(1-.6*faceT);g.fillStyle='#ffe98a';g.beginPath();g.arc(q[0],q[1],r,0,Math.PI*2);g.fill();}
 }
 // 完成：きらきら
 if(beat==='done'||beat==='hopOff'){
  for(let i=0;i<6;i++){const a=time*1.3+i*Math.PI/3,r=vh*(.32+.05*Math.sin(time*3+i)),x=cx0+Math.cos(a)*r*1.2,y=vy+vh*.45+Math.sin(a)*r*.7,s=h*(.018+.012*Math.sin(time*6+i));
   g.fillStyle='#fff3b0';g.beginPath();g.moveTo(x,y-s*2);g.lineTo(x+s*.5,y-s*.5);g.lineTo(x+s*2,y);g.lineTo(x+s*.5,y+s*.5);g.lineTo(x,y+s*2);g.lineTo(x-s*.5,y+s*.5);g.lineTo(x-s*2,y);g.lineTo(x-s*.5,y-s*.5);g.closePath();g.fill();}
  g.fillStyle='#8fd6a8';g.beginPath();g.arc(vx+vw*.88,vy+vh*.14,h*.055,0,Math.PI*2);g.fill();
  g.strokeStyle='#ffffff';g.lineWidth=h*.014;g.beginPath();g.moveTo(vx+vw*.855,vy+vh*.14);g.lineTo(vx+vw*.875,vy+vh*.17);g.lineTo(vx+vw*.91,vy+vh*.11);g.stroke();
 }
 // カーソル：右の翼のトラックパッド操作と同じ軌跡
 if(beat==='build'||beat==='finish'||beat==='think'){
  trackpadStroke(t,strokeBuf);const u=strokeBuf[0],v=strokeBuf[1],x=cx0+u*vw*.22,y=vy+vh*.45+v*vh*.2,s=h*.05;
  g.fillStyle='#ffffff';g.strokeStyle='#2e4643';g.lineWidth=h*.006;g.beginPath();g.moveTo(x,y);g.lineTo(x,y+s);g.lineTo(x+s*.3,y+s*.72);g.lineTo(x+s*.68,y+s*.7);g.closePath();g.fill();g.stroke();
 }
 g.restore();
 // 下の進行バー
 g.fillStyle='#223633';roundRect(g,vx,h*.925,vw,h*.035,h*.017);g.fill();
 g.fillStyle=p>=.8?'#ffd449':'#8fd6a8';roundRect(g,vx,h*.925,Math.max(h*.035,vw*p),h*.035,h*.017);g.fill();
 return {progress:p,beat,tool};
}

function defaultCanvas(){return typeof document==='undefined'?null:document.createElement('canvas');}

// 画面メッシュ：ノートPCの子メッシュのうち、平らで座面側を向いた一番大きい面。
export function findLaptopScreen(laptop,towards){
 let best=null;laptop.updateWorldMatrix(true,true);
 laptop.traverse(o=>{
  if(!o.isMesh)return;const pos=o.geometry.attributes.position,idx=o.geometry.index,count=idx?idx.count:pos.count;
  const a=new Vector3(),b=new Vector3(),c=new Vector3(),normal=new Vector3();let area=0,planar=true,first=null;
  for(let i=0;i<count;i+=3){
   const at=k=>idx?idx.getX(k):k;
   a.fromBufferAttribute(pos,at(i)).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(pos,at(i+1)).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(pos,at(i+2)).applyMatrix4(o.matrixWorld);
   const n=new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a));const s=n.length()/2;if(s<1e-9)continue;n.normalize();
   if(!first)first=n.clone();else if(first.dot(n)<.99)planar=false;area+=s;normal.addScaledVector(n,s);
  }
  if(!planar||!first)return;normal.normalize();
  if(normal.dot(towards)<.7)return;
  if(!best||area>best.area)best={mesh:o,area,normal};
 });
 return best;
}

export function installModelingScreen(desk,laptop,viewer,{createCanvas=defaultCanvas,width=512,height=352}={}){
 const canvas=createCanvas();if(!canvas)return null;
 const towards=new Vector3(...viewer).sub(new Vector3().setFromMatrixPosition(laptop.matrixWorld)).setY(0).normalize();
 const found=findLaptopScreen(laptop,towards);if(!found)throw new Error('Laptop screen surface missing');
 const {mesh,normal}=found;
 // 画面平面の右（u）と上（v）へ投影してUVを作る。見る人から見て右が u=1、上が v=1。
 const geometry=mesh.geometry.clone(),pos=geometry.attributes.position;
 const u=new Vector3(0,1,0).cross(normal).normalize(),v=new Vector3().crossVectors(normal,u).normalize();
 const pts=[];for(let i=0;i<pos.count;i++)pts.push(new Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
 const us=pts.map(q=>q.dot(u)),vs=pts.map(q=>q.dot(v)),u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs);
 const uv=new Float32Array(pos.count*2);pts.forEach((q,i)=>{uv[2*i]=(us[i]-u0)/(u1-u0);uv[2*i+1]=(vs[i]-v0)/(v1-v0);});
 geometry.setAttribute('uv',new BufferAttribute(uv,2));mesh.geometry=geometry;
 canvas.width=width;canvas.height=height;
 // 毎回の転送で縮小版（ミップマップ）を作り直さない。画面は小さく映るので線形補間で十分。
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=LinearFilter;texture.magFilter=LinearFilter;
 const screen={mesh,canvas,context:canvas.getContext('2d'),texture,offMaterial:mesh.material,
  onMaterial:new MeshBasicMaterial({map:texture,toneMapped:false}),aspect:(u1-u0)/(v1-v0),lastDraw:-1,active:false};
 desk.modelingScreen=screen;return screen;
}

// actor が作業中なら画面を点けて描き、いなければ消灯マテリアルへ戻す。
export const screenInterval=1/12;
export function updateModelingScreen(screen,actor,time){
 if(!screen)return null;
 const active=!!actor;
 if(active!==screen.active){screen.mesh.material=active?screen.onMaterial:screen.offMaterial;screen.active=active;screen.lastDraw=-1;}
 if(!active)return null;
 // 画面の更新（Canvas描画＋GPU転送）は1秒12回。回転や点の出現はこれで十分なめらか。
 if(screen.lastDraw>=0&&time-screen.lastDraw<screenInterval&&time>=screen.lastDraw)return screen.state;
 screen.lastDraw=time;
 screen.state=drawModelingScreen(screen.context,screen.canvas.width,screen.canvas.height,actor.elapsed??0,time);
 screen.texture.needsUpdate=true;return screen.state;
}

// ---- ノートPCの上に浮かぶ小さなホログラム ---------------------------------
// 「小さな未来のおうち」らしく、画面の中の家がPCの上にもふわっと浮かぶ。
// いつものカメラ（ぴよきちの背中側）からでも、何を作っているか分かるようにするため。
const holoScale=.22;
export function installModelingHologram(desk,laptop,viewer){
 const bounds=new Box3().setFromObject(laptop),center=bounds.getCenter(new Vector3());
 const toward=new Vector3(viewer[0]-center.x,0,viewer[2]-center.z).normalize();
 const root=new Group();root.name='Modeling_Hologram';root.visible=false;
 // 画面の上端より少し上、ヒンジ側（奥）に浮かべる
 root.position.set(center.x-toward.x*.12,bounds.max.y+.16,center.z-toward.z*.12);
 const model=new Group();model.scale.setScalar(holoScale);root.add(model);
 const glow=m=>{m.transparent=true;m.depthWrite=false;return m;};
 const ring=new Mesh(new RingGeometry(.14,.158,48),glow(new MeshBasicMaterial({color:0x8fe0bd,opacity:.5,side:DoubleSide,blending:AdditiveBlending})));
 ring.rotation.x=-Math.PI/2;ring.position.y=-.035;root.add(ring);
 const dotGeometry=new BufferGeometry();dotGeometry.setAttribute('position',new Float32BufferAttribute(V.flat(),3));
 const dots=new Points(dotGeometry,glow(new PointsMaterial({color:0xffb52e,size:.07,sizeAttenuation:true})));
 const edgeGeometry=new BufferGeometry();edgeGeometry.setAttribute('position',new Float32BufferAttribute(E.flatMap(([a,b])=>[...V[a],...V[b]]),3));
 const lines=new LineSegments(edgeGeometry,glow(new LineBasicMaterial({color:0xf29a1f,opacity:1})));
 const faces=F.map(face=>{
  const pts=face.door?doorQuad:face.window?winQuad:face.v.map(k=>V[k]),pos=[];
  for(let i=1;i<pts.length-1;i++)pos.push(...pts[0],...pts[i],...pts[i+1]);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));
  const m=new Mesh(g,glow(new MeshBasicMaterial({color:0xd9e1dd,opacity:0,side:DoubleSide})));m.userData.color=new Color(face.c);m.visible=false;return m;
 });
 model.add(...faces,lines,dots);
 root.traverse(o=>{o.raycast=()=>{};o.castShadow=false;o.receiveShadow=false;o.userData.furnitureId=desk.id;});
 desk.group.add(root);
 const holo={root,model,ring,dots,lines,faces,clay:new Color(0xf1e6c8),shown:0};
 desk.modelingHologram=holo;return holo;
}

export function updateModelingHologram(holo,actor,time,dt=1/60){
 if(!holo)return;
 holo.shown=Math.max(0,Math.min(1,holo.shown+(actor?1:-1)*dt*3));
 holo.root.visible=holo.shown>0;
 if(!holo.root.visible)return;
 const t=actor?.elapsed??14,p=actor?modelingProgress(t):1,beat=actor?modelingBeat(t,actor.remaining):'done';
 const appear=holo.shown;holo.root.scale.setScalar(.6+.4*smooth(appear));
 holo.model.rotation.y=modelYaw(beat,time);
 holo.model.position.y=.012*Math.sin(time*2.2);
 holo.ring.material.opacity=(.3+.15*Math.sin(time*3))*appear;
 const dotT=clamp01(p/.3),wireT=clamp01((p-.3)/.25),faceT=clamp01((p-.55)/.25),colorT=clamp01((p-.8)/.2);
 holo.dots.geometry.setDrawRange(0,Math.ceil(dotT*V.length));holo.dots.visible=dotT>0&&faceT<1;holo.dots.material.opacity=appear;
 holo.lines.geometry.setDrawRange(0,2*Math.floor(wireT*E.length));holo.lines.visible=wireT>0;holo.lines.material.opacity=(1-.55*smooth(colorT))*appear;
 const n=faceT*F.length;
 holo.faces.forEach((m,i)=>{
  const k=clamp01(n-i),detail=F[i].door||F[i].window;
  m.visible=k>0&&(!detail||colorT>0);
  m.material.opacity=(.6+.32*smooth(colorT))*k*appear;
  m.material.color.copy(holo.clay).lerp(m.userData.color,smooth(colorT));
 });
}

// 着地して画面とホログラムが初めて出る瞬間にシェーダーのコンパイルが走ると、スマホでは一瞬止まる。
// 起動時に一度だけ「点いた状態」で compile しておき、すぐ元に戻す（見た目は変わらない）。
export function prewarmModelingScene(renderer,scene,camera,desk){
 const screen=desk?.modelingScreen,holo=desk?.modelingHologram;if(!renderer?.compile||(!screen&&!holo))return false;
 const restore=[];
 const show=o=>{restore.push([o,o.visible]);o.visible=true;};
 if(screen){restore.push([screen.mesh,screen.mesh.material,'material']);screen.mesh.material=screen.onMaterial;}
 if(holo)holo.root.traverse(show);
 try{
  renderer.compile(scene,camera);if(screen)renderer.initTexture?.(screen.texture);
  // 透過（transmission）素材が残っている場合、その下準備パスでは別の出力色空間のシェーダーが要る。
  // compile() では作られないので、小さな画面外ターゲットへ1回だけ描いて用意する。
  // その1回は画面メッシュだけを描く（ほかの物の不要なシェーダーまで作らない）。
  let transmissive=false;scene.traverse(o=>{if(o.isMesh&&o.visible)for(const m of [].concat(o.material))if(m?.transmission>0)transmissive=true;});
  if(screen&&transmissive&&renderer.setRenderTarget&&camera){
   const hidden=[];scene.traverse(o=>{if((o.isMesh||o.isPoints||o.isLine)&&o!==screen.mesh&&o.visible){o.visible=false;hidden.push(o);}});
   const target=new WebGLRenderTarget(4,4),previous=renderer.getRenderTarget();
   try{renderer.setRenderTarget(target);renderer.render(scene,camera);}
   finally{renderer.setRenderTarget(previous);target.dispose();for(const o of hidden)o.visible=true;}
  }
 }
 finally{for(const [o,v,key] of restore.reverse()){if(key)o.material=v;else o.visible=v;}}
 return true;
}
