import * as T from 'three';

// ─────────────────────────────────────────────────────────────
// 季節の「舞うもの」：春＝桜の花びら、秋＝紅葉した葉、冬＝雪。夏はなし。
//  - 1 枚＝四角ポリ 1 つ、全部で 1 ドローコール。動きはすべて頂点シェーダーで計算（CPU は毎フレーム uniform を 3 つ書くだけ）
//  - 花びら・葉：川の上から舞い落ち → 水面に着いたら川の中心線（terrain.js の riverCenter と同じ式）に沿って下流（+z）へ流れ → 静かに沈む
//  - 雪：見ている人のまわりに降る。地面・水面に届いたらそのまま消える
//  - 見ている人（通常はカメラ、VR は頭）のまわり ±RANGE m をぐるっと巻き戻して使う。視点が動いても粒は飛ばない
// ─────────────────────────────────────────────────────────────

const KINDS={petal:0,leaf:1,snow:2};
const COUNTS={desktop:{petal:220,leaf:240,snow:700},mobile:{petal:110,leaf:120,snow:300}};
const RANGE=26;

const vert=`
attribute vec4 aSeed;
uniform float uTime,uKind,uRange;uniform vec3 uCenter;
varying vec2 vUv;varying float vFade;varying vec3 vN;varying vec4 vSeed;
#include <fog_pars_vertex>
float h1(float n){return fract(sin(n)*43758.5453);}
float rc(float z){return 7.*sin(z*.03)+3.5*sin(z*.083+1.3);}          // terrain.js riverCenter と同じ
float hw(float z){return 7.5+2.2*sin(z*.047+2.);}                    // riverHalfWidth（細かいノイズは省略）
float wrapTo(float v,float c){return c+mod(v-c+uRange,2.*uRange)-uRange;}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
void main(){
 vUv=uv;vSeed=aSeed;
 bool snow=uKind>1.5;
 float P=snow?mix(9.,14.,aSeed.x):mix(15.,24.,aSeed.x);
 float cyc=uTime/P+aSeed.y,ph=fract(cyc),ci=floor(cyc);
 float r1=h1(ci*12.9898+aSeed.z*78.233),r2=h1(ci*39.346+aSeed.w*11.135),r3=h1(ci*73.156+aSeed.x*52.235),r4=h1(ci*93.989+aSeed.y*67.345);
 vec3 wp;vec3 nrm=vec3(0.,0.,1.);float size;
 float fade=smoothstep(0.,.04,ph);
 if(snow){
  float t=ph*P;
  wp.x=wrapTo(r1*997.+sin(t*.9+r3*6.28)*.35+t*.25,uCenter.x);
  wp.z=wrapTo(r2*991.+cos(t*.7+r4*6.28)*.35,uCenter.z);
  wp.y=uCenter.y+9.-ph*13.;
  size=mix(.035,.07,r3);
  fade*=1.-smoothstep(.9,1.,ph);
  // 雪はカメラを向く小さな円
  vec4 mv=viewMatrix*vec4(wp,1.);mv.xy+=position.xy*size;
  vN=vec3(0.,1.,0.);
  vFade=fade*(1.-smoothstep(uRange-5.,uRange,max(abs(wp.x-uCenter.x),abs(wp.z-uCenter.z))));
  vec4 mvPosition=mv;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
  return;
 }
 // 花びら・葉：落ちる（35%）→ 流れる（65%）
 float fallT=.35,t=ph*P,tf=min(ph,fallT)*P,td=max(ph-fallT,0.)*P;
 float speed=mix(.35,.75,r3);
 float z=wrapTo(r1*997.+tf*.25+td*speed,uCenter.z);
 float lat=(r2*2.-1.)*.72+sin(td*.35+r4*6.28)*.08;
 float land=smoothstep(fallT-.01,fallT+.01,ph);
 float s=clamp(ph/fallT,0.,1.);
 float H=mix(4.,9.,r4);
 wp=vec3(rc(z)+lat*hw(z),mix(H*(1.-s),.035,land),z);
 wp.x+=(1.-land)*sin(t*1.7+r1*6.28)*.7*(1.-s);
 wp.z+=(1.-land)*cos(t*1.3+r2*6.28)*.4*(1.-s);
 size=uKind<.5?mix(.1,.14,r3):mix(.16,.24,r3);
 // 向き：落ちている間はひらひら回転、着水したら水面に寝かせてゆっくり回る
 float yaw=r1*6.28+t*(land>.5?.12:1.1);
 float tilt=mix(sin(t*2.3+r2*6.28)*1.4,-1.5708,land);
 mat3 R=rotY(yaw)*rotX(tilt);
 vec3 lp=R*(position*size);
 nrm=R*vec3(0.,0.,1.);
 wp+=lp;
 fade*=1.-smoothstep(.92,1.,ph);
 vN=nrm;
 vFade=fade*(1.-smoothstep(uRange-5.,uRange,abs(z-uCenter.z)));
 vec4 mvPosition=viewMatrix*vec4(wp,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;

const frag=`
uniform float uKind,uAmount,uAutumn;uniform vec3 uLight,uAmbient,uSunDir;
varying vec2 vUv;varying float vFade;varying vec3 vN;varying vec4 vSeed;
#include <fog_pars_fragment>
void main(){
 vec2 p=vUv*2.-1.;
 // 粒ごとの見え隠れ（季節の切り替え・範囲の端）は、半透明にせず間引きで表す（深度を書けるので水の屈折とも喧嘩しない）
 if(fract(vSeed.z*91.7+vSeed.w*13.3)>vFade*uAmount)discard;
 vec3 col;
 if(uKind>1.5){
  if(dot(p,p)>1.)discard;
  col=vec3(.9,.93,.97);
 }else if(uKind<.5){
  // 花びら：楕円＋先の切れ込み
  if(p.x*p.x/.36+p.y*p.y>1.)discard;
  if(length(p-vec2(0.,1.))<.28)discard;
  col=mix(vec3(.92,.5,.62),vec3(.98,.8,.84),smoothstep(-1.,.8,p.y));
 }else{
  float r=length(p),a=atan(p.y,p.x);
  if(vSeed.w<.55){
   // もみじ（5 裂）
   float lobe=.5+.5*pow(abs(cos(a*2.5+1.5708*.5)),.55);
   if(r>lobe*.98||(p.y<-.35&&abs(p.x)>.05&&r>.4))discard;
  }else{
   // 丸い葉（ぶな・なら系）
   if(p.x*p.x/.4+p.y*p.y>1.)discard;
  }
  float h=fract(vSeed.x*7.31+vSeed.w*3.1);
  // 舞う葉の色は木の色づきと揃える：秋のはじめは黄色（少し黄緑）ばかり、橙が増え、赤は紅葉のピークだけ
  float red=.35*smoothstep(.55,.95,uAutumn),ora=.33*smoothstep(.25,.7,uAutumn)+.05,grn=.3*(1.-smoothstep(.1,.45,uAutumn));
  col=h<red?vec3(.5,.04,.025):h<red+ora?vec3(.62,.2,.03):h<red+ora+grn?vec3(.42,.42,.07):vec3(.66,.44,.05);
  col*=.8+.3*(1.-length(p)*.5);
 }
 vec3 n=normalize(vN);
 float d=abs(dot(n,uSunDir));
 vec3 c=col*(uAmbient+uLight*d);
 gl_FragColor=vec4(c,1.);
 #include <fog_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function createRiverFall({shared,sun,sunDir,mobile=false}={}){
 const counts=mobile?COUNTS.mobile:COUNTS.desktop,max=Math.max(...Object.values(counts));
 const base=new T.PlaneGeometry(1,1);
 const g=new T.InstancedBufferGeometry();g.index=base.index;g.setAttribute('position',base.attributes.position);g.setAttribute('uv',base.attributes.uv);
 const seed=new Float32Array(max*4);let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 for(let i=0;i<seed.length;i++)seed[i]=rnd();
 g.setAttribute('aSeed',new T.InstancedBufferAttribute(seed,4));g.instanceCount=0;
 const mat=new T.ShaderMaterial({vertexShader:vert,fragmentShader:frag,fog:true,side:T.DoubleSide,
  uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uKind:{value:1},uRange:{value:RANGE},uCenter:{value:new T.Vector3()},uAmount:{value:0},uAutumn:{value:1},
   uLight:{value:new T.Color(1,1,1)},uAmbient:{value:new T.Color(.45,.47,.5)},uSunDir:{value:(sunDir||new T.Vector3(0,1,0)).clone()}}])});
 const mesh=new T.Mesh(g,mat);mesh.name='RiverSeasonFall';mesh.frustumCulled=false;mesh.visible=false;
 // level＝その季節の「舞う量」0〜1（日付で変わる。9 月末は落ち葉がちらほら、11 月はたくさん）
 let kind=null,next=null,amount=0,level=0;
 function applyKind(k){kind=k;if(k){mat.uniforms.uKind.value=KINDS[k];g.instanceCount=counts[k];}mesh.visible=!!k;}
 // mix＝{petal,leaf,snow}。いちばん多いものを舞わせる（2 種類同時には出さない＝1 ドローのまま）
 function setMix(mix={},{instant=false}={}){
  let best=null,v=.02;for(const k of Object.keys(KINDS))if((mix[k]||0)>v){v=mix[k];best=k;}
  next=best;level=best?Math.min(1,v):0;
  if(instant){applyKind(next);amount=level;mat.uniforms.uAmount.value=amount;}
 }
 const setKind=(k,opt)=>setMix(k?{[k]:1}:{},opt);
 const tmp=new T.Color();
 function update(dt,center){
  // 季節が変わったら今の粒を間引いて消してから、次の粒を少しずつ増やす
  if(next!==kind){amount=Math.max(0,amount-dt*2.2);if(amount===0)applyKind(next);}
  else if(kind&&amount!==level)amount=amount<level?Math.min(level,amount+dt*.7):Math.max(level,amount-dt*.7);
  mat.uniforms.uAmount.value=amount;
  if(!mesh.visible)return;
  mat.uniforms.uTime.value=shared.uTime.value;
  if(shared.season)mat.uniforms.uAutumn.value=shared.season.uSAutumn.value;
  if(center)mat.uniforms.uCenter.value.set(center.x,center.y,center.z);
  if(sun){tmp.copy(sun.color).multiplyScalar(sun.intensity*.22);mat.uniforms.uLight.value.copy(tmp);}
 }
 return {mesh,setMix,setKind,update,get level(){return level;},get kind(){return kind;},counts};
}
