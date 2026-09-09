import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const vrHeadsetAssetPath='../assets/props/vr-headset.glb';

// The existing vr group remains the animation visibility switch and head attachment.
export function installVrHeadsetVisual(character,scene){
 let meshes=0;
 scene.traverse(o=>{if(o.isSkinnedMesh)throw new Error('VR headset must not use a skinned armature');if(o.isMesh)meshes++;});
 if(!meshes)throw new Error('VR headset GLB has no meshes');
 while(scene.children.length)character.vr.add(scene.children[0]);
 character.vrFallback.visible=false;
 character.vr.visualSource='glb';
}

export async function loadVrHeadsetVisual(character,url,loader=new GLTFLoader()){
 if(!url){character.vr.visualSource='procedural';return false;}
 try{const gltf=await loader.loadAsync(url);installVrHeadsetVisual(character,gltf.scene);return true;}
 catch(error){character.vr.visualSource='procedural';character.vr.visualLoadError=error instanceof Error?error.message:String(error);return false;}
}
