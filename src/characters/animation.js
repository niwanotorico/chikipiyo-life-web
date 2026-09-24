import {Quaternion,Vector3} from 'three';
import {updateCharacterExpression} from './expressions.js';
import {animateMeal} from './meal.js';
import {modelingBeat,modelingBeats,span,smooth,trackpadStroke,hopOffDuration} from './modeling-timeline.js';
const sleepRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
// ちきんのコーヒーカップ。翼の先（腕ローカル）でカップを握り、肩から見た向きだけを動かす。
// こうするとカップは必ず手先にあり、翼が胴体を突き抜ける角度にもならない。
const cupGrip=new Vector3(0,-.30,.05),cupGripDir=cupGrip.clone().normalize();
// 肩からカップ中心までの距離。翼の長さ(.304)より少し長く取り、翼の先がカップの手前側に触れる。
const cupReach=.40;
const cupRestDir=new Vector3(.10,-.38,.86).normalize();
const cupSipDir=new Vector3(-.18,.52,.84).normalize();
const cupDir=new Vector3(),standPoint=new Vector3(),upAxis=new Vector3(0,1,0),sideAxis=new Vector3(1,0,0);
export function animateCharacter(c,time){const t=c.elapsed,walking=c.phase==='walking',a=walking?'walk':c.action;
 updateCharacterExpression(c);
 c.arms.forEach(arm=>{
  arm.userData.restPosition??=arm.position.clone();
  arm.position.copy(arm.userData.restPosition);arm.scale.set(1,1,1);
  const visual=arm.children.find(o=>o.name.startsWith('GLB_Wing'));
  if(visual){visual.userData.restPosition??=visual.position.clone();visual.position.copy(visual.userData.restPosition);visual.userData.restScale??=visual.scale.clone();visual.scale.copy(visual.userData.restScale);}
 });
 c.rig.position.set(0,0,0);c.rig.rotation.set(0,0,0);c.rig.scale.set(1,1,1);c.head.scale.set(1,1,1);c.head.rotation.set(0,0,0);c.arms.forEach(p=>p.rotation.set(0,0,0));c.legs.forEach(p=>p.rotation.set(0,0,0));c.food.visible=false;c.vr.visible=a==='vr';c.broom.visible=false;c.vrControllers?.forEach(o=>o.visible=a==='vr');c.modelingHeadphones&&(c.modelingHeadphones.visible=a==='model'&&c.id==='piyo');
 c.rig.position.y=Math.sin(time*2.3)*.012;
 if(walking){c.rig.position.y=Math.abs(Math.sin(t*8))*.065;c.legs.forEach((p,i)=>p.rotation.x=Math.sin(t*8+i*Math.PI)*.48);c.arms.forEach((p,i)=>p.rotation.x=-Math.sin(t*8+i*Math.PI)*.35);}
 if(a==='sleep'&&c.target){
  // Use the room's pillow anchor and bed axis, cancelling the approaching root yaw.
  // Legacy furniture keeps its original world-Z bed and pillow offset.
  c.root.updateWorldMatrix(true,false);
  const bed=c.target.position;
  const yaw=c.target.sleepYaw??0, anchor=c.target.sleepAnchor??[bed[0],0,bed[2]-.52];
  c.rig.position.copy(c.root.worldToLocal(new Vector3(anchor[0]+Math.sin(yaw)*c.head.position.y,(c.target.sleepHeight??1.065)+(c.variant==='chicken'?(c.target.sleepLift??.10):0)-(c.target.sleepSink??0),anchor[2]+Math.cos(yaw)*c.head.position.y)));
  c.rig.quaternion.copy(c.root.getWorldQuaternion(new Quaternion()).invert()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw)).multiply(sleepRotation);
  c.head.scale.y=.98+Math.sin(t*1.7)*.012;
 }else c.head.scale.y=1;
 if(a==='relax'){c.rig.position.set(0,.48,.75);if(c.target?.seatAnchor){c.root.updateWorldMatrix(true,false);c.rig.position.copy(c.root.worldToLocal(new Vector3(...c.target.seatAnchor)));}c.rig.rotation.x=c.target?.seats?-.30:-.18;c.legs.forEach(p=>p.rotation.x=-1.25);if(c.target?.seats){const tilt=c.rig.rotation.x;c.rig.quaternion.copy(c.root.getWorldQuaternion(new Quaternion()).invert()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),c.target.face)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),tilt));}}
 if(a==='eat'){
  // ちきんはカップを持って、ときどき口元へ上げて少し上を向く。
  const sip=c.variant==='chicken'?Math.max(0,Math.sin(t*.85))**2:0;
  c.food.visible=c.variant==='chicken';
  if(c.food.visible){
   // 右の翼を持ち上げ、その先にカップを置く。左の翼は体側へ軽く添えるだけ。
   c.arms[0].rotation.x=-.22;
   cupDir.copy(cupRestDir).lerp(cupSipDir,sip).normalize();
   c.arms[1].quaternion.setFromUnitVectors(cupGripDir,cupDir);
   c.food.position.copy(c.arms[1].position).addScaledVector(cupDir,cupReach);
   c.food.rotation.set(-sip*.42,0,0);
   // 口はカップのある側にあるので、飲むときは顔をカップへ向けつつ上を向く。
   c.head.rotation.set(.12+Math.sin(t*3)*.035-sip*.46,sip*.42,0);
  }else{
   c.arms.forEach(p=>p.rotation.x=-.8);
   c.head.rotation.x=.12+Math.sin(t*3)*.035;
  }
 }
 if(a==='eat'&&c.target?.seatAnchor){c.root.updateWorldMatrix(true,false);const seat=new Vector3(...c.target.seatAnchor);if(!c.target.seats&&c.variant!=='chicken')seat.y+=.10;c.rig.position.copy(c.root.worldToLocal(seat));c.legs.forEach(p=>p.rotation.x=-1.15);}
 if(a==='print'){
  // 小さい二人は赤い椅子の上に立って前かがみで覗きこむ。ちきんは床から横で見守る。
  if(c.target?.standAnchor){
   c.root.updateWorldMatrix(true,false);
   c.rig.position.copy(c.root.worldToLocal(standPoint.set(...c.target.standAnchor)));
   c.rig.quaternion.copy(c.root.getWorldQuaternion(new Quaternion()).invert())
    .multiply(new Quaternion().setFromAxisAngle(upAxis,c.target.face))
    .multiply(new Quaternion().setFromAxisAngle(sideAxis,.12+Math.sin(t*1.6)*.03));
  }
  c.arms[1].rotation.x=-.7+Math.sin(t*3)*.15;c.arms[0].rotation.x=-.35;
  c.head.rotation.x=(c.target?.headTilt??.16)+Math.sin(t*1.3)*.04;
 }
 // ぴよみのハンバーガー：椅子へぴょん → いただきます → 両翼で持ってかぶりつく → ごちそうさま（meal.js）
 if(a==='eat'&&c.id==='piyomi'&&c.target?.id==='table')animateMeal(c,t,time);
 if(a==='model'&&c.id==='piyo')animateModeling(c,t,time);
 if(a==='piano'&&c.id==='piyomi'){
  // A low floor-playing pose: folded legs, a small rhythmic nod, and alternating wing taps.
  c.rig.rotation.x=.14+Math.sin(t*2.1)*.025;
  c.legs.forEach(p=>p.rotation.x=-1.45);
  c.head.rotation.x=.10+Math.sin(t*3.1)*.055;
  c.arms.forEach((arm,index)=>{
   const phase=t*5.4+index*Math.PI;
   const side=index?1:-1;
   const visual=arm.children.find(o=>o.name.startsWith('GLB_Wing'));
   if(visual){
    // Authored rigid wings extend sideways, not down. Rebase the drawing
    // around the inner, body-side attachment without changing its rest shape.
    arm.position.set(side*.075,.36,0);
    visual.position.add(arm.userData.restPosition.clone().sub(arm.position));
    const rest=new Vector3(side*.31,-.042,-.068).normalize();
    const reach=new Vector3(side*(.065+.018*Math.sin(t*1.7+index)),
     -.15+.014*Math.sin(phase),.29).normalize();
    arm.quaternion.setFromUnitVectors(rest,reach);
   }else{
    arm.rotation.x=-.92+Math.sin(phase)*.18;
    arm.rotation.z=-side*.13;
   }
  });
 }
 if(a==='vr'){c.head.rotation.y=Math.sin(t*1.5)*.55;c.arms.forEach((p,i)=>{p.rotation.x=-.9+Math.sin(t*3+i)*.4;p.rotation.z=Math.sin(t*2+i)*.3;});}
 if(a==='clean'){c.rig.rotation.z=Math.sin(t*3)*.08;c.arms[1].rotation.x=-.65+Math.sin(t*2.5)*.12;c.arms[0].rotation.x=-.3;}
 if(['idle','relax'].includes(a))c.head.rotation.y=Math.sin(t*.8)*.2;
}





// ---- ぴよきちのモデリング ------------------------------------------------
// 椅子の横(spot)から座面(standAnchor)へ跳び乗り、翼の先を実際にキーボードと
// トラックパッドへ置いて作業する。root はシミュレーションのもの（spot で PC を向く）
// なので、体の位置と向きはワールド座標で決めて rig へ変換する。
const up=new Vector3(0,1,0),mTmp=new Vector3(),mTmp2=new Vector3(),mHead=new Vector3(),mQ=new Quaternion(),mQ2=new Quaternion();
const beatOrder=['hopOn','headphones','build','think','idea','finish','done','hopOff'];
const angleLerp=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;

// 翼の先：自然に垂らしたときの一番下（外寄り）の頂点＝指先（腕ローカル、回転なし）。
// 「一番遠い頂点」だと翼の後ろ端が選ばれ、前へ向けたときに翼の面が上を向いてしまう。見た目が差し替わったら測り直す。
export function wingTip(arm,source){
 if(arm.userData.tip&&arm.userData.tipSource===source)return arm.userData.tip;
 arm.updateWorldMatrix(true,true);
 const inverse=arm.matrixWorld.clone().invert(),v=new Vector3();let best=null,far=-Infinity;
 arm.traverse(o=>{
  if(!o.isMesh)return;for(let n=o;n&&n!==arm;n=n.parent)if(!n.visible)return;
  const pos=o.geometry.attributes.position,m=inverse.clone().multiply(o.matrixWorld);
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);const d=-v.y+.3*Math.abs(v.x)-.3*Math.abs(v.z);if(d>far){far=d;best=v.clone();}}
 });
 arm.userData.tip=best;arm.userData.tipSource=source;return best;
}

// 翼の先がワールドの target に触れるように腕を回す。届かない分／余る分は肩を少しだけ前後させる。
// slide：肩を target の方へずらせる最大量。stretch：届かないときに翼を少しだけ大きくしてよい倍率（1＝しない）。
export function reachWing(c,arm,target,{slide=.07,stretch=1}={}){
 const tip=wingTip(arm,c.visualSource);if(!tip)return;
 c.rig.updateWorldMatrix(true,false);
 const local=c.rig.worldToLocal(mTmp.copy(target)).sub(arm.position),dist=local.length(),len=tip.length();
 local.normalize();
 const shift=Math.max(-slide,Math.min(slide,dist-len));
 arm.position.addScaledVector(local,shift);
 arm.scale.setScalar(Math.min(stretch,Math.max(1,(dist-shift)/len)));
 arm.quaternion.setFromUnitVectors(mTmp2.copy(tip).normalize(),local);
}

// 毎フレームの一時オブジェクトを作らないよう、姿勢は使い回しの入れ物へ書き込む。
const makePose=()=>({lean:0,y:0,roll:0,head:[0,0,0],wings:[new Vector3(),new Vector3()]});
const poseNow=makePose(),posePrev=makePose(),stroke=[0,0],earTmp=new Vector3();
const thinkIn=[modelingBeats.think[0],modelingBeats.think[0]+.5],headphonePop=[1.0,1.3];
const mAnchor=new Vector3(),mSpot=new Vector3(),mFwd=new Vector3(),mSide=new Vector3(),mKey=new Vector3(),mPad=new Vector3(),mPos=new Vector3(),mQ3=new Quaternion(),mQ4=new Quaternion();
const xAxis=new Vector3(1,0,0),zAxis=new Vector3(0,0,1),frame={fwd:mFwd,side:mSide,key:mKey,pad:mPad,head:mHead};
const setPose=(out,lean,y,roll,h0,h1,h2)=>{out.lean=lean;out.y=y;out.roll=roll;out.head[0]=h0;out.head[1]=h1;out.head[2]=h2;return out;};

const at=(target,base,f=0,s=0,y=0)=>{target.copy(base).addScaledVector(mFwd,f).addScaledVector(mSide,s);target.y+=y;return target;};
// arms[1] は体の +X（本人の左）＝キーボード、arms[0] は -X（本人の右）＝トラックパッド。
function typingPose(out,t,rate,burst,lean){
 const on=Math.max(0,Math.sin(t*1.25))>(burst?.0:-.4)?1:0;
 const tap=on*Math.max(0,Math.sin(t*rate))**2*.035;
 trackpadStroke(t,stroke);const u=stroke[0],v=stroke[1];
 at(out.wings[0],mPad,v*.035,u*.045,.004);at(out.wings[1],mKey,Math.sin(t*rate*.5)*.02,Math.sin(t*rate*.21)*.03,tap);
 // 背中からも打鍵が分かるよう、キーを打つたびに肩が小さく左右へゆれる
 return setPose(out,lean,0,on*Math.sin(t*rate*.5)*.035,.06+Math.sin(t*2.1)*.02+on*Math.sin(t*rate*.5)*.012,Math.sin(t*.9)*.05,0);
}

// frame の fwd/side/key/pad/head は使い回しの mFwd/mSide/mKey/mPad/mHead。
function modelingPose(c,beat,t,frame,out){
 const key=frame.key,pad=frame.pad,head=frame.head,w0=out.wings[0],w1=out.wings[1];
 switch(beat){
  case 'headphones':{
   const k=Math.sin(Math.PI*span(t,modelingBeats.headphones));
   at(w0,pad).lerp(at(earTmp,head,.02,-.30,.05),k);at(w1,key).lerp(at(earTmp,head,.02,.30,.05),k);
   return setPose(out,.04,0,0,-.05*k,0,0);
  }
  case 'build':return typingPose(out,t,13,false,.15);
  case 'finish':{typingPose(out,t,17,true,.19);out.head[0]+=.02;out.head[1]*=.6;out.head[2]=0;return out;}
  case 'think':{
   const k=smooth(span(t,thinkIn));
   at(w0,head,.26,-.05,-.16);at(w1,key,-.02,0,.006);
   return setPose(out,-.05,0,0,-.13-Math.sin(t*1.6)*.03,.12+Math.sin(t*.8)*.06,.2*k);
  }
  case 'idea':{
   const k=Math.sin(Math.PI*span(t,modelingBeats.idea));
   at(w0,head,.1,-.28,.12*k-.1);at(w1,head,.1,.28,.12*k-.1);
   return setPose(out,.02,.09*k,0,-.2*k,0,0);
  }
  case 'done':{
   const wave=Math.sin(t*9);
   at(w0,head,.02,-.44,-.16+wave*.07);at(w1,head,.02,.44,-.16-wave*.07);
   return setPose(out,-.04,.035*Math.abs(Math.sin(t*6.5)),0,-.16,Math.sin(t*3)*.1,Math.sin(t*6.5)*.06);
  }
  default:at(w0,pad);at(w1,key);return setPose(out,.1,0,0,0,0,0);
 }
}

function animateModeling(c,t,time){
 const T=c.target;if(!T?.standAnchor)return;
 const left=c.remaining??Infinity,beat=modelingBeat(t,left);
 // 床側は実際に立ち止まった root 位置（到着判定は5cmの誤差を許すため spot そのものではない）。
 const anchor=mAnchor.set(T.standAnchor[0],T.standAnchor[1],T.standAnchor[2]),spot=mSpot.set(c.root.position.x,0,c.root.position.z),face=T.face;
 const fwd=mFwd.set(Math.sin(face),0,Math.cos(face)),side=mSide.set(Math.cos(face),0,-Math.sin(face));
 const front=T.typing?T.typing.front:.24,surface=(T.typing?T.typing.surfaceY:anchor.y+.31)+.012;
 mKey.copy(anchor).addScaledVector(fwd,front+.10).addScaledVector(side,.16).setY(surface);
 mPad.copy(anchor).addScaledVector(fwd,front+.08).addScaledVector(side,-.15).setY(surface);
 const pos=mPos.copy(anchor);let yaw=face,lean=0,roll=0,squash=0,wings=null,h0=0,h1=0,h2=0;
 const hopYaw=Math.atan2(anchor.x-spot.x,anchor.z-spot.z),arms=c.arms;
 if(beat==='hopOn'){
  const k=span(t,modelingBeats.hopOn),crouch=.2,land=.84;
  if(k<crouch){const s=k/crouch;pos.copy(spot);squash=.14*Math.sin(Math.PI*s);yaw=angleLerp(c.root.rotation.y,hopYaw,smooth(s));lean=.25*s;}
  else if(k<land){const s=(k-crouch)/(land-crouch);pos.lerpVectors(spot,anchor,s);pos.y=anchor.y*s+.34*4*s*(1-s);yaw=angleLerp(hopYaw,face,smooth(s));lean=.25-.3*s;squash=-.08*Math.sin(Math.PI*s);}
  else{const s=(k-land)/(1-land);squash=.16*Math.sin(Math.PI*s);lean=.1*Math.sin(Math.PI*s);}
  // 翼は跳ぶ前に後ろへ、空中で広げる
  const flap=k<crouch?-.5*(k/crouch):k<land?-.5+1.6*Math.sin(Math.PI*(k-crouch)/(land-crouch)):0;
  for(let i=0;i<arms.length;i++){arms[i].rotation.z=(i?1:-1)*flap*.55;arms[i].rotation.x=flap<0?-flap*.5:0;}
  const legX=k>crouch&&k<land?-.5*Math.sin(Math.PI*(k-crouch)/(land-crouch)):0;
  for(const l of c.legs)l.rotation.x=legX;
 }else if(beat==='hopOff'){
  const k=1-Math.max(0,left)/hopOffDuration,crouch=.22,land=.82;
  // 前を向いたまま、椅子の横へ横っとび（終了時に root の向きと一致させるため）
  if(k<crouch){squash=.12*Math.sin(Math.PI*k/crouch);}
  else if(k<land){const s=(k-crouch)/(land-crouch);pos.lerpVectors(anchor,spot,s);pos.y=anchor.y*(1-s)+.2*4*s*(1-s);roll=.25*Math.sin(Math.PI*s)*Math.sign(side.dot(mTmp.subVectors(spot,anchor)));squash=-.06*Math.sin(Math.PI*s);}
  else{pos.copy(spot);squash=.12*Math.sin(Math.PI*(k-land)/(1-land));}
  for(let i=0;i<arms.length;i++)arms[i].rotation.z=(i?1:-1)*.7*Math.sin(Math.PI*k);
 }
 // 体の配置：ワールドの位置と向き → root ローカル
 c.root.updateWorldMatrix(true,false);
 c.rig.position.copy(c.root.worldToLocal(mTmp.copy(pos)));
 if(beat!=='hopOn'&&beat!=='hopOff'){
  mHead.copy(anchor);mHead.y+=c.head.position.y;
  const pose=modelingPose(c,beat,t,frame,poseNow);
  // 場面の切り替わり .3 秒は前の場面の姿勢からなめらかにつなぐ
  const start=modelingBeats[beat]?.[0]??0,blend=smooth((t-start)/.3);
  const prevBeat=beatOrder[beatOrder.indexOf(beat)-1];
  if(blend<1&&prevBeat&&prevBeat!=='hopOn'){
   const prev=modelingPose(c,prevBeat,t,frame,posePrev);
   pose.lean=prev.lean+(pose.lean-prev.lean)*blend;pose.y=prev.y+(pose.y-prev.y)*blend;
   for(let i=0;i<3;i++)pose.head[i]=prev.head[i]+(pose.head[i]-prev.head[i])*blend;
   pose.roll=prev.roll+(pose.roll-prev.roll)*blend;
   for(let i=0;i<2;i++)pose.wings[i].copy(prev.wings[i].lerp(pose.wings[i],blend));
  }
  lean=pose.lean;roll=pose.roll;h0=pose.head[0];h1=pose.head[1];h2=pose.head[2];wings=pose.wings;c.rig.position.y+=pose.y;
  // 背中の軽い呼吸
  lean+=Math.sin(time*2.3)*.01;
 }
 c.rig.quaternion.copy(c.root.getWorldQuaternion(mQ).invert())
  .multiply(mQ2.setFromAxisAngle(up,yaw))
  .multiply(mQ3.setFromAxisAngle(xAxis,lean))
  .multiply(mQ4.setFromAxisAngle(zAxis,roll));
 c.rig.scale.set(1+squash*.5,1-squash,1+squash*.5);
 c.head.rotation.set(h0,h1,h2);
 if(wings)for(let i=0;i<arms.length;i++)reachWing(c,arms[i],wings[i]);
 // ヘッドホン：着地してから両翼でかぶる（ぽんっと出る）
 const worn=c.modelingHeadphones;
 if(worn){
  worn.userData.baseScale??=worn.scale.x;
  // 降りる直前には外して机へ戻す（机の待機用が同時に戻る）。
  const k=left<hopOffDuration?0:span(t,headphonePop),pop=k<=0?0:k>=1?1:1+2.7*(k-1)**3+1.7*(k-1)**2;
  worn.visible=pop>0;worn.scale.setScalar(worn.userData.baseScale*Math.max(.001,pop));
 }
}
