import {Quaternion,Vector3} from 'three';
import {wingTip} from './animation.js';
import {getBeakTip} from '../world/burger-motion.js';
import {mealBeats,mealHopOff,mealBeat,burgerStage,biteCurve,burgerTurn,regripMotion,lastBite,span,smooth} from './meal-timeline.js';

// ---- ぴよみのハンバーガー ------------------------------------------------
// 椅子の横(spot)から座面へ跳び乗り、両翼でバーガーをはさんでかぶりつく。
// 体・頭・翼の姿勢をここで決め、バーガーとポテトの置き場所は c.meal に書き出す
// （burger-motion.js が同じフレームで読んで動かす）。時刻表は meal-timeline.js。
const up=new Vector3(0,1,0),xAxis=new Vector3(1,0,0),zAxis=new Vector3(0,0,1),noTurn=new Quaternion();
// 座面の上に立つ（小さな子がテーブルに届くように）。
const STAND=.08;
// ---- 食事中の翼 ----
// ぴよみの翼メッシュは胴の中心から横へのびる1枚板で、内側の半分は胴に埋まっている。
// 元の回転の中心（±.195）は翼の途中なので、そのまま前へ回すと胴の中の部分が後ろへ飛び出し、
// 以前は肩ごと前へずらしていた（翼が胸から生えて見える）。
// 食事中は、付け根＝回転の中心を胴の横の面の少し内側（肩）に固定し、翼メッシュを
// 「内側の端がちょうど肩に来る」位置へずらす。届かせるのは翼の回転と、翼を長さ方向にだけ
// のばす（腕を伸ばす）ことで行い、肩は動かさない。
const SHOULDER={x:.13,y:.345,z:-.02},REACH_SCALE=[.72,1.25];
// バーガーを持つ位置（体ローカル）と、持っている間の体の傾き（少しうしろへ＝胸の前に空間ができる）
const HOLD={y:.42,z:.31},HOLD_LEAN=-.08,HOLD_HEAD=-.07; // 持っている間は少しあごを上げる（くちばしがバーガーに乗らない）
// ポテトの場面（mealBeats.fry 4.7–6.3）の中の区切り（秒）
const FRY={down:[4.7,5.0],reach:[5.0,5.22],toBeak:[5.26,5.6],gulp:[5.6,5.78],back:[5.85,6.2],chew:[5.65,6.3]},FRY_PICK=5.15;
const angleLerp=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
const pulse=(t,a,b)=>Math.sin(Math.PI*span(t,[a,b]));
const V=()=>new Vector3();
const anchor=V(),spot=V(),fwd=V(),side=V(),pos=V(),tmp=V(),neutralBeak=V(),beak=V(),hold=V(),rest=V(),fryRest=V(),
 w0=V(),w1=V(),a0=V(),a1=V(),chest=V(),contact=V(),into=V(),mouth=V(),grabPt=V(),tableEdge=V(),home=V(),belly=V();
const q1=new Quaternion(),q2=new Quaternion(),q3=new Quaternion(),q4=new Quaternion();

// くちばしの先（頭ローカル）。頭の形から一度だけ測る。
function beakLocal(c){
 if(c.mealBeak&&c.mealBeak.source===c.visualSource)return c.mealBeak.local;
 const found=getBeakTip(c);
 const local=found?c.head.worldToLocal(found.tip.clone()):new Vector3(0,-.04,.26);
 c.mealBeak={source:c.visualSource,local};
 return local;
}

export function animateMeal(c,t,time){
 const T=c.target;if(!T?.seatAnchor)return;
 const left=c.remaining??Infinity,beat=mealBeat(t,left),arms=c.arms;
 const plate=T.meal;
 anchor.set(...T.seatAnchor);anchor.y+=STAND;spot.set(c.root.position.x,0,c.root.position.z);
 const face=T.face;fwd.set(Math.sin(face),0,Math.cos(face));side.set(Math.cos(face),0,-Math.sin(face));
 pos.copy(anchor);
 let yaw=face,lean=.06,roll=0,squash=0,h0=.08,h1=0,h2=0,bob=0,puff=0,wingBlend=1;
 const hopYaw=Math.atan2(anchor.x-spot.x,anchor.z-spot.z);

 // バーガーの状態（world）。既定はお皿の上。
 const meal=c.meal??(c.meal={burger:V(),fry:V(),burgerOnPlate:true,burgerScale:1,tilt:0,turn:0,stage:0,fryVisible:false,fryOnPlate:true,fryScale:1,plateScale:1});
 // stage：0 まるごと / 1 bite01 / 2 bite02 / 3 食べ終わり（お皿だけ）
 meal.stage=burgerStage(t);meal.turn=burgerTurn(t);meal.burgerOnPlate=true;meal.burgerScale=meal.stage>=3?0:1;meal.tilt=0;
 meal.fryVisible=false;meal.fryOnPlate=t<FRY_PICK;meal.fryScale=1;
 if(plate){rest.set(...plate.burger);fryRest.set(...plate.fry);}else{rest.copy(anchor).addScaledVector(fwd,.5).setY(anchor.y+.4);fryRest.copy(rest).addScaledVector(side,-.15);}
 const R=plate?.radius??.12;
 // お皿：着地でぽんっ、降りるときにしゅっと片付く
 const popIn=span(t,[.62,.95]),popOut=left<mealHopOff?span(mealHopOff-left,[.05,.4]):0;
 meal.plateScale=popIn<=0||popOut>=1?0:popIn>=1?1-smooth(popOut):1+2.7*(popIn-1)**3+1.7*(popIn-1)**2;

 // ---- 乗り降り ----
 if(beat==='hopOn'){
  const k=span(t,mealBeats.hopOn),crouch=.22,land=.82;
  if(k<crouch){const s=k/crouch;pos.copy(spot);squash=.14*Math.sin(Math.PI*s);yaw=angleLerp(c.root.rotation.y,hopYaw,smooth(s));lean=.25*s;}
  else if(k<land){const s=(k-crouch)/(land-crouch);pos.lerpVectors(spot,anchor,s);pos.y=anchor.y*s+.30*4*s*(1-s);yaw=angleLerp(hopYaw,face,smooth(s));lean=.25-.3*s;squash=-.08*Math.sin(Math.PI*s);}
  else{const s=(k-land)/(1-land);squash=.16*Math.sin(Math.PI*s);lean=.1*Math.sin(Math.PI*s);}
  // 翼は跳ぶ前に後ろへ、空中で広げる
  const flap=k<crouch?-.5*(k/crouch):k<land?-.5+1.6*Math.sin(Math.PI*(k-crouch)/(land-crouch)):0;
  for(let i=0;i<arms.length;i++){arms[i].rotation.z=(i?1:-1)*flap*.55;arms[i].rotation.x=flap<0?-flap*.5:0;}
  for(const l of c.legs)l.rotation.x=k>crouch&&k<land?-.5*Math.sin(Math.PI*(k-crouch)/(land-crouch)):0;
  place(c,yaw,lean,roll,squash,h0,h1,h2,bob,0);
  return;
 }
 if(beat==='hopOff'){
  const k=1-Math.max(0,left)/mealHopOff,crouch=.22,land=.82;
  if(k<crouch){squash=.12*Math.sin(Math.PI*k/crouch);}
  else if(k<land){const s=(k-crouch)/(land-crouch);pos.lerpVectors(anchor,spot,s);pos.y=anchor.y*(1-s)+.2*4*s*(1-s);roll=.25*Math.sin(Math.PI*s)*Math.sign(side.dot(tmp.subVectors(spot,anchor)));squash=-.06*Math.sin(Math.PI*s);}
  else{pos.copy(spot);squash=.12*Math.sin(Math.PI*(k-land)/(1-land));}
  for(let i=0;i<arms.length;i++)arms[i].rotation.z=(i?1:-1)*.7*Math.sin(Math.PI*k);
  for(const l of c.legs)l.rotation.x=0;
  place(c,yaw,lean,roll,squash,h0,h1,h2,bob,0);
  return;
 }

 // ---- 座面の上での演技 ----
 for(let i=0;i<c.legs.length;i++)c.legs[i].rotation.x=beat==='gochiso'?-.25*Math.max(0,Math.sin(t*6.5+i*Math.PI)):0;
 // 胸の前（大きな頭のあごの下で、翼を合わせられる所）
 chest.copy(anchor).addScaledVector(fwd,.29);chest.y+=.40;
 const setPose=()=>place(c,yaw,lean,roll,squash,h0,h1,h2,bob,puff);
 // くちばし：頭をまっすぐにしたとき（持つ位置の基準）と、今の頭の向きのとき（かじる位置）
 const measureNeutral=()=>{c.head.rotation.set(0,0,0);c.head.updateWorldMatrix(true,true);c.head.localToWorld(neutralBeak.copy(beakLocal(c)));};
 const actualBeak=()=>{c.head.updateWorldMatrix(true,true);return c.head.localToWorld(beak.copy(beakLocal(c)));};
 // 持つ位置：胸の前（体ローカル）。大きな頭の下に当たらない高さ・前後で、肩から翼が届くところ。
 const holdAt=()=>{c.rig.updateWorldMatrix(true,false);return c.rig.localToWorld(hold.set(0,HOLD.y,HOLD.z));};
 // 両翼の先でバーガーの左右（少し手前）をはさむ
 const holdWings=(center,s=1)=>{const r=R*s*.92+.004,back=-R*s*.3;w0.copy(center).addScaledVector(side,-r).addScaledVector(fwd,back);w1.copy(center).addScaledVector(side,r).addScaledVector(fwd,back);w0.y-=.01;w1.y-=.01;};
 const clasp=(gap)=>{w0.copy(chest).addScaledVector(side,-gap);w1.copy(chest).addScaledVector(side,gap);};
 const cheeks=(shake=0)=>{w0.copy(neutralBeak).addScaledVector(side,-.17).addScaledVector(fwd,-.06);w0.y-=.05-shake;w1.copy(neutralBeak).addScaledVector(side,.17).addScaledVector(fwd,-.06);w1.y-=.05+shake;};
 // もぐもぐ：ほっぺ（頭の横幅）がふくらみ、体と頭が小さくはずむ
 const chew=(k,rate=11)=>{puff=k*(.55+.45*Math.abs(Math.sin(t*rate)));bob+=.008*k*Math.abs(Math.sin(t*rate));h0+=.03*k*Math.sin(t*rate);};
 // 前の場面の翼の位置（a0,a1）から今の位置へ、k でなめらかにつなぐ
 const blendFrom=k=>{if(k<1){w0.lerpVectors(a0,w0,smooth(k));w1.lerpVectors(a1,w1,smooth(k));}};

 if(beat==='itadakimasu'){
  // 翼を胸の前で2回ぱちぱち → 合わせてぺこり。体は左右にゆれてわくわく。
  const k=span(t,mealBeats.itadakimasu),clap=Math.min(1,pulse(t,.9,1.12)+pulse(t,1.12,1.34));
  lean=.04+.12*pulse(t,1.1,1.5);h0=.02+.2*pulse(t,1.1,1.5);h1=.1*Math.sin(t*7)*(1-k);roll=.06*Math.sin(t*7)*(1-k);
  bob=.025*Math.abs(Math.sin(Math.PI*k*3));
  setPose();
  clasp(.045+.05*(1-clap));
  // 着地の姿勢（翼は体の横）から .2 秒でつなぐ
  wingBlend=smooth(span(t,[.8,1.0]));
 }else if(beat==='grab'||beat==='bite1'||beat==='bite2'||beat==='fry'&&t<FRY.down[1]){
  // 持ち上げ（お皿→口の前）→ かぶりつき×2 → お皿へ置く
  const reach=span(t,[1.5,1.8]),lift=smooth(span(t,[1.8,2.1])),down=smooth(span(t,FRY.down));
  const carry=lift*(1-down);
  let lunge=0,chewK=0;
  if(beat.startsWith('bite')){const b=biteCurve(t,beat);lunge=b.lunge;chewK=b.chew;}
  lean=.06+(HOLD_LEAN-.06)*carry+.18*smooth(reach)*(1-lift)+.18*down+.06*lunge;h0=.1+(HOLD_HEAD-.1)*carry+.14*smooth(reach)*(1-lift)+.12*down+.3*lunge;h1=.05*Math.sin(t*1.3)*(1-lunge);
  setPose();measureNeutral();holdAt();
  chew(chewK);setPose();
  // かぶりつき：頭を前へ下げ、バーガーもくちばしへ寄せる
  contact.copy(actualBeak()).addScaledVector(fwd,R*.5);contact.y-=.045;
  meal.burger.copy(rest).lerp(tmp.copy(hold).lerp(contact,lunge),carry);meal.burgerOnPlate=carry<=0;
  // 少し奥（見ている人の側）へ傾けて上のパンを見せる
  meal.tilt=.32*carry;
  // 持ち直し：翼を片方ずつ少しゆるめて持ち替える。バーガーはわずかに下がって傾き、回る（回転は burgerTurn）
  const g=regripMotion(t);
  if(g){meal.burger.y-=.008*g.all;meal.tilt+=.07*g.all;h1+=.04*g.all;}
  holdWings(meal.burger);
  if(g){w0.addScaledVector(side,-.018*g.right).addScaledVector(fwd,-.012*g.right);w0.y+=.014*g.right;w1.addScaledVector(side,.018*g.left).addScaledVector(fwd,-.012*g.left);w1.y+=.014*g.left;}
  if(reach<1){clasp(.045);a0.copy(w0);a1.copy(w1);holdWings(meal.burger);blendFrom(reach);}
 }else if(beat==='fry'){
  // 本人の右の翼（arms[0]）でポテトを1本つまんで、ぱくっ。もう片方はお皿の横のテーブルへ。
  const reachFry=smooth(span(t,FRY.reach)),toBeak=smooth(span(t,FRY.toBeak)),gulp=span(t,FRY.gulp),back=smooth(span(t,FRY.back));
  lean=.2*(1-toBeak)+.08*toBeak*(1-back)+.06*back;h0=.18*(1-toBeak)+.02*toBeak;h1=-.1*toBeak*(1-back);
  chew(Math.sin(Math.PI*span(t,FRY.chew)));
  setPose();
  mouth.copy(actualBeak()).addScaledVector(fwd,.02+.03*(1-gulp));mouth.y-=.005;
  grabPt.copy(fryRest);grabPt.y+=.015;
  meal.fry.copy(grabPt).lerp(mouth,toBeak);meal.fryVisible=t>=FRY_PICK&&gulp<1;meal.fryScale=1-smooth(gulp);
  // つままない方の翼は、胸の前でお皿の方へ軽く添えておく
  tableEdge.copy(chest).addScaledVector(side,.09).addScaledVector(fwd,.04);tableEdge.y-=.04;
  home.copy(chest).addScaledVector(side,-.10);home.y-=.08;
  holdWings(rest);a1.copy(w1);w1.lerpVectors(a1,tableEdge,reachFry);
  // 手元 → ポテト → くちばし → 胸の前
  if(t<FRY.toBeak[0])w0.lerp(grabPt,reachFry);
  else if(t<FRY.back[0])w0.copy(meal.fry);
  else w0.copy(mouth).lerp(home,back);
 }else if(beat==='bite3'){
  // もう一度はさんで、残りをぱくっ（ほっぺがいちばんふくらむ）→ 翼をほっぺの横でふるふる
  const L=lastBite,reach=smooth(span(t,L.reach)),lift=smooth(span(t,L.lift)),lunge=smooth(span(t,L.lunge)),gulp=span(t,L.gulp),settle=span(t,L.settle);
  const chewK=Math.sin(Math.PI*span(t,L.chew));
  lean=.06+(HOLD_LEAN-.06)*lift+.18*reach*(1-lift)+.08*lunge*(1-gulp);h0=.1+(HOLD_HEAD-.1)*lift+.14*reach*(1-lift)+.3*lunge*(1-gulp)-.08*chewK;h1=.14*Math.sin(t*3.2)*chewK;
  setPose();measureNeutral();holdAt();
  chew(chewK*1.25,12);setPose();
  const tip=actualBeak();
  contact.copy(tip).addScaledVector(fwd,R*.5);contact.y-=.045;
  into.copy(tip).addScaledVector(fwd,.01);
  meal.burger.copy(rest).lerp(tmp.copy(hold).lerp(contact,lunge).lerp(into,smooth(gulp)),lift);
  meal.burgerOnPlate=lift<=0;meal.burgerScale=1-smooth(gulp);meal.tilt=.32*lift;
  // 最後のひと口は bite02 の残りを口へ（段階は触れた瞬間に 3＝お皿だけ、になるので、縮む間は 2 のまま見せる）
  if(gulp<1)meal.stage=Math.min(meal.stage,2);
  if(gulp<1){
   holdWings(meal.burger,meal.burgerScale);
   // ポテトの後の翼（胸の前・テーブル）から、もう一度バーガーへ
   if(reach<1){home.copy(chest).addScaledVector(side,-.10);home.y-=.08;a0.copy(home);a1.copy(chest).addScaledVector(side,.09).addScaledVector(fwd,.04);a1.y-=.04;blendFrom(reach);}
  }else{
   holdWings(into,0);a0.copy(w0);a1.copy(w1);
   cheeks(Math.sin(t*16)*.012*chewK);blendFrom(settle);
  }
 }else{
  // ごちそうさま：少しそって、おなかをぽんぽん → 翼を合わせてぺこり
  const k=smooth(span(t,[7.9,8.2])),bow=pulse(t,8.8,9.2),together=smooth(span(t,[8.7,8.85]));
  lean=.06-.16*k*(1-together)+.14*bow;h0=.08-.2*k*(1-together)+.22*bow;h1=.12*Math.sin(t*2.6)*k*(1-together);h2=.08*Math.sin(t*2.6)*k*(1-together);
  bob=.012*Math.abs(Math.sin(t*6.5))*k*(1-together);
  setPose();measureNeutral();
  cheeks();a0.copy(w0);a1.copy(w1);
  belly.copy(anchor).addScaledVector(fwd,.19);belly.y+=.25;
  const pat=Math.sin(t*9);
  w0.copy(belly).addScaledVector(side,-.07).addScaledVector(fwd,.03*Math.max(0,pat));
  w1.copy(belly).addScaledVector(side,.07).addScaledVector(fwd,.03*Math.max(0,-pat));
  blendFrom(span(t,[7.9,8.15]));
  if(together>0){a0.copy(w0);a1.copy(w1);clasp(.045);blendFrom(together);}
  // 降りる直前は翼を体の横へ戻す
  wingBlend=1-smooth(span(-left,[-mealHopOff-.2,-mealHopOff]));
 }
 // 背中の軽い呼吸
 lean+=Math.sin(time*2.3)*.008;
 setPose();
 for(let i=0;i<arms.length;i++)reachFromShoulder(c,arms[i],i?1:-1,i?w1:w0,wingBlend);
}

// 翼メッシュの寸法（翼ローカル）を一度だけ測る：内側の端（胴の中心側）の位置と、翼の先。
function wingRig(c,arm,side){
 const visual=arm.children.find(o=>o.name.startsWith('GLB_Wing'));
 if(!visual)return null;
 if(arm.userData.mealRig?.source===c.visualSource)return arm.userData.mealRig;
 const tipArm=wingTip(arm,c.visualSource);if(!tipArm)return null;
 visual.updateWorldMatrix(true,true);
 const inv=visual.matrixWorld.clone().invert(),v=V();let inner=null,best=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
 visual.traverse(m=>{
  if(!m.isMesh)return;
  const mm=inv.clone().multiply(m.matrixWorld),pos=m.geometry.attributes.position;
  for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(mm);const d=-side*v.x;if(d>best){best=d;inner=v.clone();}minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);minZ=Math.min(minZ,v.z);maxZ=Math.max(maxZ,v.z);}
 });
 const rp=visual.userData.restPosition??visual.position,rs=(visual.userData.restScale??visual.scale).x;
 // 翼の先を翼メッシュのローカルへ（wingTip は腕ローカル・休みの姿勢）
 const tip=tipArm.clone().sub(rp).divideScalar(rs);
 arm.userData.mealRig={source:c.visualSource,visual,inner:new Vector3(inner.x,(minY+maxY)/2,(minZ+maxZ)/2),tip,rs};
 return arm.userData.mealRig;
}

const shoulder=V(),toTarget=V(),tipNow=V(),restArm=V(),vPos=V(),qReach=new Quaternion();
// 肩を固定したまま、翼の先を target（ワールド）へ。k は食事中の翼の効き（0＝ふだんの翼、1＝食事中）。
function reachFromShoulder(c,arm,side,target,k){
 const rig=wingRig(c,arm,side);
 if(!rig||k<=0)return;
 const {visual,inner,tip,rs}=rig;
 restArm.copy(arm.userData.restPosition??arm.position);
 shoulder.set(side*SHOULDER.x,SHOULDER.y,SHOULDER.z);
 // 付け根から見た目標
 c.rig.updateWorldMatrix(true,false);
 c.rig.worldToLocal(toTarget.copy(target)).sub(shoulder);
 const dist=toTarget.length();
 // 翼を長さ方向（翼ローカルX）にだけ s 倍して、付け根→先の距離を目標までの距離に合わせる（範囲内で）
 const ty=rs*(tip.y-inner.y),tz=rs*(tip.z-inner.z),tx=rs*Math.abs(tip.x-inner.x);
 const s=Math.max(REACH_SCALE[0],Math.min(REACH_SCALE[1],Math.sqrt(Math.max(0,dist*dist-ty*ty-tz*tz))/tx));
 // 内側の端が付け根（腕の原点）に来るように翼メッシュを置く
 vPos.set(-rs*s*inner.x,-rs*inner.y,-rs*inner.z);
 tipNow.set(rs*s*(tip.x-inner.x),ty,tz);
 qReach.setFromUnitVectors(tipNow.normalize(),toTarget.normalize());
 // ふだんの翼（休みの付け根・メッシュ位置・回転なし）となめらかにつなぐ
 arm.position.lerpVectors(restArm,shoulder,k);
 arm.quaternion.slerpQuaternions(noTurn,qReach,k);
 visual.position.lerpVectors(visual.userData.restPosition??visual.position,vPos,k);
 const base=visual.userData.restScale??visual.scale;
 visual.scale.set(base.x*(1+(s-1)*k),base.y,base.z);
}

// 体の配置（ワールドの位置と向き → root ローカル）と頭。
function place(c,yaw,lean,roll,squash,h0,h1,h2,bob,puff){
 c.root.updateWorldMatrix(true,false);
 c.rig.position.copy(c.root.worldToLocal(tmp.copy(pos))).y+=bob;
 c.rig.quaternion.copy(c.root.getWorldQuaternion(q1).invert()).multiply(q2.setFromAxisAngle(up,yaw)).multiply(q3.setFromAxisAngle(xAxis,lean)).multiply(q4.setFromAxisAngle(zAxis,roll));
 c.rig.scale.set(1+squash*.5,1-squash,1+squash*.5);
 c.head.rotation.set(h0,h1,h2);
 c.head.scale.set(1+puff*.07,1-puff*.035,1+puff*.05);
 c.rig.updateWorldMatrix(true,true);
}
