import {Box3,Matrix4,Ray,Vector3} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';

const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};

export function installBurgerMotion(root){
 // Circle.033 is the multi-material burger; the plate and Cube.060 stay put.
 const body=root.getObjectByName('Circle033');
 if(!body)throw new Error('Burger GLB is missing Circle033');
 root.updateWorldMatrix(true,true);
 const bounds=new Box3().setFromObject(body);
 // Cache a small collision envelope in burger-local space. Its current world
 // transform (including scale) is used each frame; the plate is never included.
 const inverse=body.matrixWorld.clone().invert(),points=[];
 body.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const matrix=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)points.push(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(matrix));
 });
 const hull=new ConvexHull().setFromPoints(points);
 root.userData.burgerMotion={body,rest:body.position.clone(),center:body.worldToLocal(bounds.getCenter(new Vector3())),radius:(bounds.max.z-bounds.min.z)/2,hull};
}
export function getBeakTip(actor){
 actor.head.updateWorldMatrix(true,true);
 const head=actor.head.getObjectByName('Head');
 if(!head)return null; // Keep the food at the hands until its authored head loads.
 const forward=new Vector3(0,0,1).transformDirection(actor.head.matrixWorld);
 const tip=new Vector3(),vertex=new Vector3(),inverseHead=actor.head.matrixWorld.clone().invert();let furthest=-Infinity,count=0;
 // The authored beak is the foremost geometry of Head. Expression meshes and
 // accessories are separate descendants and must not become the mouth anchor.
 const visit=node=>{
  if(node.name.startsWith('eye_'))return;
  if(node.isMesh){
   const matrix=new Matrix4().multiplyMatrices(inverseHead,node.matrixWorld);
   for(let i=0;i<node.geometry.attributes.position.count;i++){
    node.getVertexPosition(i,vertex).applyMatrix4(matrix);
    const distance=vertex.z;
    if(distance>furthest+1e-5){furthest=distance;tip.copy(vertex);count=1;}
    else if(Math.abs(distance-furthest)<=1e-5){tip.add(vertex);count++;}
   }
  }
  node.children.forEach(visit);
 };
 visit(head);
 if(!Number.isFinite(furthest))return null;
 actor.head.localToWorld(tip.divideScalar(count));
 return {tip,forward};
}
export function getBurgerContact(actor,motion){
 const beak=getBeakTip(actor);
 if(!beak)return null;
 const {tip,forward}=beak;
 const {body,center,hull}=motion;
 body.updateWorldMatrix(true,true);
 const worldCenter=body.localToWorld(center.clone());
 // Cast from the burger center toward the beak through its local envelope.
 // The resulting world-space radius follows rotation and nonuniform scale.
 const ray=new Ray(worldCenter.clone(),forward.clone().negate()).applyMatrix4(body.matrixWorld.clone().invert());
 const surface=hull.intersectRay(ray,new Vector3());
 if(!surface)return null;
 const radius=body.localToWorld(surface).distanceTo(worldCenter);
 return {tip,forward,radius,center:tip.clone().addScaledVector(forward,radius+.002)};
}

export function updateBurgerMotion(root,actor){
 const motion=root.userData.burgerMotion;
 root.visible=!!actor;
 if(!motion)return;
 const {body,rest}=motion;
 body.position.copy(rest);
}

export function installPotatoMotion(root){
 root.updateWorldMatrix(true,true);
 const bounds=new Box3().setFromObject(root),size=bounds.getSize(new Vector3());
 root.userData.potatoMotion={rest:root.position.clone(),center:bounds.getCenter(new Vector3()),mouthClearance:size.z/2+.018};
}

export function updatePotatoMotion(root,actor){
 const motion=root.userData.potatoMotion;
 root.visible=false;
 if(!motion||!actor)return;
 root.position.copy(motion.rest);
 // Three small fry bites during the ten-second meal, leaving the opening and
 // closing beats clear so the plate and burger remain readable.
 const elapsed=actor.elapsed-.5;
 if(elapsed<0||elapsed>=9)return;
 const t=elapsed%3;
 if(t<.1||t>=2.65)return;
 actor.root.updateWorldMatrix(true,true);root.updateWorldMatrix(true,true);
 const plate=root.localToWorld(motion.center.clone());
 const take=smooth(.1,.45,t),toMouth=smooth(.9,1.3,t),returnToWing=smooth(2.05,2.55,t);
 const wiggle=new Vector3(Math.sin(t*12)*.012,Math.sin(t*17)*.012,Math.cos(t*10)*.008);
 // The right-wing vicinity is expressed in rig-local coordinates, preserving
 // the authored shoulder attachment while the character remains seated.
 const wing=actor.rig.localToWorld(new Vector3(.13,.40,.39)).add(wiggle);
 const beak=getBeakTip(actor),mouth=beak?beak.tip.clone().addScaledVector(beak.forward,motion.mouthClearance):wing;
 const destination=plate.clone().lerp(wing,take).lerp(mouth,toMouth).lerp(wing,returnToWing);
 const parent=root.parent,delta=parent?parent.worldToLocal(destination).sub(parent.worldToLocal(plate)):destination.sub(plate);
 root.position.add(delta);root.visible=true;
 // Keep the existing gentle eating pose; only add a tiny reach rather than
 // rebasing or rotating the wing attachment pivots.
 actor.arms[0].rotation.x-=.05*take;actor.arms[1].rotation.x-=.10*take;
}

