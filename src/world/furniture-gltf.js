import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const furnitureAssetPaths={vr:'../assets/furniture/vr.glb'};

// Keep the interaction group and its local installation origin; only replace its drawing.
export function installFurnitureVisual(furniture,scene){
 let meshes=0;
 scene.traverse(o=>{
  if(o.isSkinnedMesh)throw new Error('Furniture GLB must not use a skinned armature');
  if(o.isMesh){meshes++;o.userData.furnitureId=furniture.id;}
 });
 if(!meshes)throw new Error('Furniture GLB has no meshes');
 const visual=new Group();visual.name=`GLB_${furniture.id}`;
 while(scene.children.length)visual.add(scene.children[0]);
 furniture.group.children.forEach(o=>{o.visible=false;});
 furniture.group.add(visual);
 furniture.visualSource='glb';
}

export async function loadFurnitureVisual(furniture,url,loader=new GLTFLoader()){
 if(!url){furniture.visualSource='procedural';return false;}
 try{
  const gltf=await loader.loadAsync(url);
  installFurnitureVisual(furniture,gltf.scene);
  return true;
 }catch(error){
  furniture.visualSource='procedural';
  furniture.visualLoadError=error instanceof Error?error.message:String(error);
  return false;
 }
}

// The dock's headset is picked up by a resident; its table and controllers remain visible.
export function setVrDockHeadsetVisible(furniture,visible){
 furniture?.group.traverse(o=>{if(o.userData.vrDockHeadset||o.name==='Cube286')o.traverse(part=>{part.visible=visible;});});
}


