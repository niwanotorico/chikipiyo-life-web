import * as T from 'three';

// 焚火の「動くもの」だけ：炎・熾火・火の粉・煙・地面の暖色の輪・暖かい光。
// 石・薪・串・焼き魚は Human の Blender（assets/props/camp.glb）を使う（camp.js）。ここは形を持たない。
// 原点＝薪の中心の地面。size は薪の半径（m）。ground(x,z) は原点からの相対座標での地面の高さ（相対）。

function tongueGeometry(h,w){ // 炎の舌：7 角のしずく型（ローポリでかわいく）
 const pts=[[0,0],[.55,.06],[.95,.2],[1,.36],[.8,.56],[.45,.78],[0,1]].map(([x,y])=>new T.Vector2(x*w,y*h));
 const g=new T.LatheGeometry(pts,7);g.deleteAttribute('uv');return g;
}
function radialTexture(stops){
 const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');
 const gr=g.createRadialGradient(32,32,0,32,32,32);for(const [o,c] of stops)gr.addColorStop(o,c);
 g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;return t;
}
const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(29);

// 炎の基準の大きさ（薪の半径 .3m のとき）。Human の薪に合わせて size/.3 倍する
export const FLAME_BASE=.3;
export function createFireFx({mobile=false,size=FLAME_BASE,baseY=.1,ground=()=>0,light:withLight=!mobile}={}){
 const R=rnd,k=size/FLAME_BASE;
 const group=new T.Group();group.name='CampfireFx';

 // 熾火：薪の下でゆっくり明滅する円盤（地面に沿わせる）
 const emberMat=new T.MeshBasicMaterial({color:new T.Color(0xff5a14).multiplyScalar(1.6),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
 const emberGeo=new T.CircleGeometry(.62*size,12);emberGeo.rotateX(-Math.PI/2);
 {const p=emberGeo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i))+.02);}
 const ember=new T.Mesh(emberGeo,emberMat);group.add(ember);

 // 炎：外側の赤橙 → 橙 → 芯の黄色。重ねて描いて 2D の絵のように層が見える（奥行きは書かない）
 const layers=[
  {hex:0xff4a1a,b:1.5,list:[[0,0,.62,.2],[.1,.05,.42,.12],[-.09,-.06,.45,.12],[.02,-.12,.38,.1]]},
  {hex:0xff9424,b:1.7,list:[[0,.02,.42,.14],[-.06,.07,.28,.08]]},
  {hex:0xffe25a,b:1.9,list:[[0,.04,.24,.09]]},
 ];
 const flames=[],fire=new T.Group();fire.position.y=baseY;fire.scale.setScalar(k);group.add(fire);
 layers.forEach((ly,li)=>{
  const mat=new T.MeshBasicMaterial({color:new T.Color(ly.hex).multiplyScalar(ly.b),transparent:true,opacity:.96,depthWrite:false});
  for(const [x,z,h,w] of ly.list){
   const f=new T.Mesh(tongueGeometry(h,w),mat);f.position.set(x,0,z);f.renderOrder=5+li;fire.add(f);
   flames.push({mesh:f,ph:R()*10,sp:7+R()*4,sway:(R()-.5)*.25,li});
  }
 });

 // 地面の暖色の輪：uv から丸く減衰（テクスチャの四角い縁が出ない）＋地面の起伏に沿わせたグリッド
 const glowMat=new T.ShaderMaterial({uniforms:{uColor:{value:new T.Color(0xff7a30)},uAmt:{value:.5}},transparent:true,depthWrite:false,
  blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 uColor;uniform float uAmt;varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;float a=pow(max(0.,1.-d),2.2)*uAmt;gl_FragColor=vec4(uColor*a,1.);}'});
 const gs=3.2*Math.max(1,k),glowGeo=new T.PlaneGeometry(gs,gs,16,16);glowGeo.rotateX(-Math.PI/2);
 {const p=glowGeo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i))+.05);}
 const glow=new T.Mesh(glowGeo,glowMat);group.add(glow);
 const halo=new T.Sprite(new T.SpriteMaterial({map:radialTexture([[0,'rgba(255,170,90,1)'],[.35,'rgba(255,120,50,.55)'],[1,'rgba(255,90,30,0)']]),color:0xffa050,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.28}));
 halo.scale.setScalar(1.3*k);halo.position.y=baseY+.3*k;halo.renderOrder=9;group.add(halo);

 // 火の粉（少し）と、うすい煙
 const NS=mobile?8:14,sp=new Float32Array(NS*3),sv=[];
 for(let i=0;i<NS;i++)sv.push({t:R(),a:R()*6.28,r:R()*.12,v:.5+R()*.5});
 const sparkGeo=new T.BufferGeometry();sparkGeo.setAttribute('position',new T.BufferAttribute(sp,3));
 const sparks=new T.Points(sparkGeo,new T.PointsMaterial({color:new T.Color(0xffb040).multiplyScalar(2),size:.035,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
 sparks.frustumCulled=false;sparks.renderOrder=10;group.add(sparks);
 const smokeMap=radialTexture([[0,'rgba(235,232,228,.9)'],[.5,'rgba(220,218,214,.45)'],[1,'rgba(220,218,214,0)']]);
 const NSm=mobile?3:4,smoke=Array.from({length:NSm},(_,i)=>{const sm=new T.Sprite(new T.SpriteMaterial({map:smokeMap,transparent:true,depthWrite:false,opacity:0}));sm.renderOrder=4;sm.userData.t=i/NSm;group.add(sm);return sm;});

 // 暖かい光：PC だけ（スマホ・Quest は輪と光の絵だけ）。影は落とさない
 let light=null;
 if(withLight){light=new T.PointLight(0xff8a3c,2.2,4.5*Math.max(1,k),2);light.position.set(0,baseY+.35*k,0);group.add(light);}

 function update(dt,time){
  for(const f of flames){
   const s=1+.14*Math.sin(time*f.sp+f.ph)+.07*Math.sin(time*f.sp*1.73+f.ph*2.1);
   f.mesh.scale.set(1/Math.sqrt(s),s,1/Math.sqrt(s));
   f.mesh.rotation.z=f.sway+.06*Math.sin(time*3.1+f.ph);f.mesh.rotation.x=.05*Math.sin(time*2.7+f.ph*1.3);f.mesh.rotation.y+=dt*(.4+f.li*.2);
  }
  const flick=.85+.1*Math.sin(time*11.3)+.06*Math.sin(time*23.7+1.1);
  emberMat.color.setHex(0xff5a14).multiplyScalar(1.3+.4*Math.sin(time*2.3)**2);
  glowMat.uniforms.uAmt.value=.5*flick;halo.material.opacity=.26*flick;
  if(light)light.intensity=2.2*flick;
  for(let i=0;i<NS;i++){const p=sv[i];p.t+=dt*p.v*.55;if(p.t>1){p.t-=1;p.a=R()*6.28;p.r=R()*.12;}
   sp[i*3]=Math.cos(p.a+p.t*3)*(p.r+p.t*.12)*k;sp[i*3+1]=baseY+(.1+p.t*1.3)*k;sp[i*3+2]=Math.sin(p.a+p.t*3)*(p.r+p.t*.12)*k;}
  sparkGeo.attributes.position.needsUpdate=true;
  for(const sm of smoke){const u=sm.userData;u.t=(u.t+dt*.12)%1;const t=u.t;
   sm.position.set((Math.sin(t*4+time*.3)*.08+t*.25)*k,baseY+(.6+t*1.9)*k,t*.1*k);sm.scale.setScalar((.35+t*1.1)*k);sm.material.opacity=.3*Math.sin(t*Math.PI);}
 }
 return {group,update,light,flames:fire};
}
