import {Group,Plane,Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const REQUIRED_SHAPES=['Squish','Wobble','Wobble_Y'];

export async function loadPudding(scene,url,table,loader=new GLTFLoader()){
 try{
  const gltf=await loader.loadAsync(url),root=new Group(),meshes=[];
  root.name='Interactive_Pudding';root.add(gltf.scene);
  gltf.scene.traverse(object=>{
   if(!object.isMesh)return;
   if(!REQUIRED_SHAPES.every(name=>object.morphTargetDictionary?.[name]!==undefined))throw new Error('Pudding GLB is missing jiggle shape keys');
   object.castShadow=true;object.receiveShadow=true;object.userData.interactivePudding=true;meshes.push(object);
  });
  if(!meshes.length)throw new Error('Pudding GLB has no meshes');
  const home=new Vector3(table.position[0],table.max[1]+.005,table.position[2]);
  root.position.copy(home);root.rotation.y=-.18;root.scale.setScalar(2.6);scene.add(root);
  return {
   root,meshes,home,dragging:false,returning:false,
   dragPlane:new Plane(),dragPoint:new Vector3(),grabOffset:new Vector3(),
   previousPoint:home.clone(),velocity:new Vector3(),returnVelocity:new Vector3(),
   offset:new Vector3(),springVelocity:new Vector3(),localAcceleration:new Vector3(),
  };
 }catch(error){
  console.warn('Pudding could not be loaded:',error);return null;
 }
}

export function ownsPudding(pudding,object){
 if(!pudding)return false;
 for(let node=object;node;node=node.parent)if(node===pudding.root)return true;
 return false;
}

export function beginPuddingDrag(pudding,ray,camera){
 if(!pudding)return false;
 const normal=camera.getWorldDirection(new Vector3());
 pudding.dragPlane.setFromNormalAndCoplanarPoint(normal,pudding.root.position);
 if(!ray.intersectPlane(pudding.dragPlane,pudding.dragPoint))return false;
 pudding.grabOffset.copy(pudding.root.position).sub(pudding.dragPoint);
 pudding.dragging=true;pudding.returning=false;pudding.returnVelocity.set(0,0,0);
 // A tap should still produce a small, satisfying wobble.
 pudding.springVelocity.y+=.16;
 return true;
}

export function movePudding(pudding,ray){
 if(!pudding?.dragging||!ray.intersectPlane(pudding.dragPlane,pudding.dragPoint))return false;
 pudding.root.position.copy(pudding.dragPoint).add(pudding.grabOffset);
 pudding.root.position.x=clamp(pudding.root.position.x,-5.4,5.4);
 pudding.root.position.y=clamp(pudding.root.position.y,pudding.home.y,3.2);
 pudding.root.position.z=clamp(pudding.root.position.z,-4.2,4.4);
 return true;
}

export function releasePudding(pudding){
 if(!pudding?.dragging)return false;
 pudding.dragging=false;pudding.returning=true;return true;
}

function applyMorphs(pudding){
 const values={
  Wobble:clamp(pudding.offset.x/.025,-1,1),
  Wobble_Y:clamp(-pudding.offset.z/.025,-1,1),
  Squish:clamp(-pudding.offset.y/.032,-1,1),
 };
 for(const mesh of pudding.meshes)for(const [name,value] of Object.entries(values))mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]]=value;
}

export function animatePudding(pudding,elapsed){
 if(!pudding)return;
 const dt=clamp(elapsed,.001,.05);
 if(pudding.returning){
  const acceleration=pudding.home.clone().sub(pudding.root.position).multiplyScalar(48).addScaledVector(pudding.returnVelocity,-10);
  pudding.returnVelocity.addScaledVector(acceleration,dt);
  pudding.root.position.addScaledVector(pudding.returnVelocity,dt);
  if(pudding.root.position.distanceToSquared(pudding.home)<1e-6&&pudding.returnVelocity.lengthSq()<1e-5){
   pudding.root.position.copy(pudding.home);pudding.returnVelocity.set(0,0,0);pudding.returning=false;
  }
 }

 const currentVelocity=pudding.root.position.clone().sub(pudding.previousPoint).multiplyScalar(1/dt);
 pudding.previousPoint.copy(pudding.root.position);
 const acceleration=currentVelocity.clone().sub(pudding.velocity);
 pudding.velocity.copy(currentVelocity);
 // Convert world acceleration into the unscaled local axes used by the Blender shape keys.
 const inverse=new Quaternion().copy(pudding.root.quaternion).invert();
 pudding.localAcceleration.copy(acceleration).applyQuaternion(inverse).divide(pudding.root.scale);
 if(pudding.localAcceleration.length()>2)pudding.localAcceleration.setLength(2);
 pudding.springVelocity.addScaledVector(pudding.localAcceleration,-.6);

 const steps=Math.max(1,Math.ceil(dt/(1/240))),step=dt/steps;
 for(let index=0;index<steps;index++){
  pudding.springVelocity.multiplyScalar(1-7.5*step).addScaledVector(pudding.offset,-240*step);
  pudding.offset.addScaledVector(pudding.springVelocity,step);
  for(const axis of ['x','y','z'])if(Math.abs(pudding.offset[axis])>.034){
   pudding.offset[axis]=Math.sign(pudding.offset[axis])*.034;pudding.springVelocity[axis]*=.25;
  }
 }
 applyMorphs(pudding);
}
