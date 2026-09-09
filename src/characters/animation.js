import {Quaternion,Vector3} from 'three';
const sleepRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
export function animateCharacter(c,time){const t=c.elapsed,walking=c.phase==='walking',a=walking?'walk':c.action;
 c.rig.position.set(0,0,0);c.rig.rotation.set(0,0,0);c.head.rotation.set(0,0,0);c.arms.forEach(p=>p.rotation.set(0,0,0));c.legs.forEach(p=>p.rotation.set(0,0,0));c.book.visible=a==='read';c.food.visible=['eat','snack','cook'].includes(a);c.vr.visible=a==='vr';c.broom.visible=a==='clean';
 c.rig.position.y=Math.sin(time*2.3)*.012;
 if(walking){c.rig.position.y=Math.abs(Math.sin(t*8))*.065;c.legs.forEach((p,i)=>p.rotation.x=Math.sin(t*8+i*Math.PI)*.48);c.arms.forEach((p,i)=>p.rotation.x=-Math.sin(t*8+i*Math.PI)*.35);}
 if(a==='sleep'&&c.target){
  // Bed long axis is world Z; cancel the approaching root's yaw, including its turn-in.
  // Place the head over the pillow (bed-local z=-.52), independently of body height.
  c.root.updateWorldMatrix(true,false);
  const bed=c.target.position;
  c.rig.position.copy(c.root.worldToLocal(new Vector3(bed[0],c.variant==='chicken'?1.14:1.065,bed[2]-.52+c.head.position.y)));
  c.rig.quaternion.copy(c.root.getWorldQuaternion(new Quaternion()).invert()).multiply(sleepRotation);
  c.head.scale.y=.98+Math.sin(t*1.7)*.012;
 }else c.head.scale.y=1;
 if(a==='relax'){c.rig.position.set(0,.35,.75);c.rig.rotation.x=-.18;c.legs.forEach(p=>p.rotation.x=-1.15);}
 if(['read','eat'].includes(a)){c.arms.forEach(p=>p.rotation.x=-.8);c.head.rotation.x=.12+Math.sin(t*3)*.035;if(a==='eat')c.food.position.y=.76+Math.sin(t*4)*.13;}
 if(a==='cook'){c.arms[1].rotation.x=-.8+Math.sin(t*5)*.3;c.arms[0].rotation.x=-.7;c.food.position.y=.8;}
 if(a==='vr'){c.head.rotation.y=Math.sin(t*1.5)*.55;c.arms.forEach((p,i)=>{p.rotation.x=-.9+Math.sin(t*3+i)*.4;p.rotation.z=Math.sin(t*2+i)*.3;});}
 if(a==='clean'){c.rig.rotation.z=Math.sin(t*3)*.08;c.arms[1].rotation.x=-.5;c.broom.rotation.z=Math.sin(t*3)*.2;}
 if(['idle','snack','relax'].includes(a))c.head.rotation.y=Math.sin(t*.8)*.2;
}


