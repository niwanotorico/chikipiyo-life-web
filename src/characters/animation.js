import {Quaternion,Vector3} from 'three';
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
 c.rig.position.set(0,0,0);c.rig.rotation.set(0,0,0);c.head.rotation.set(0,0,0);c.arms.forEach(p=>p.rotation.set(0,0,0));c.legs.forEach(p=>p.rotation.set(0,0,0));c.food.visible=false;c.vr.visible=a==='vr';c.broom.visible=false;c.vrControllers?.forEach(o=>o.visible=a==='vr');
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
 if(a==='vr'){c.head.rotation.y=Math.sin(t*1.5)*.55;c.arms.forEach((p,i)=>{p.rotation.x=-.9+Math.sin(t*3+i)*.4;p.rotation.z=Math.sin(t*2+i)*.3;});}
 if(a==='clean'){c.rig.rotation.z=Math.sin(t*3)*.08;c.arms[1].rotation.x=-.65+Math.sin(t*2.5)*.12;c.arms[0].rotation.x=-.3;}
 if(['idle','relax'].includes(a))c.head.rotation.y=Math.sin(t*.8)*.2;
}




