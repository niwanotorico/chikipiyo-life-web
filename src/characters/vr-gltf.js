import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const vrHeadsetAssetPath='../assets/props/vr-headset.glb';
// The supplied headset is authored around its center; move that center from the visor plane
// toward the face so its strap wraps the head instead of projecting in front of it.
const headsetOffset=[0,-.11,-.28];

// The existing vr group remains the animation visibility switch and head attachment.
export function installVrHeadsetVisual(character,scene){
 let meshes=0;
 scene.traverse(o=>{if(o.isSkinnedMesh)throw new Error('VR headset must not use a skinned armature');if(o.isMesh)meshes++;});
 if(!meshes)throw new Error('VR headset GLB has no meshes');
 scene.position.set(...headsetOffset);
 scene.name='GLB_vr-headset';character.vr.add(scene);
 character.vrFallback.visible=false;
 character.vr.visualSource='glb';
}

export async function loadVrHeadsetVisual(character,url,loader=new GLTFLoader()){
 if(!url){character.vr.visualSource='procedural';return false;}
 try{const gltf=await loader.loadAsync(url);installVrHeadsetVisual(character,gltf.scene);return true;}
 catch(error){character.vr.visualSource='procedural';character.vr.visualLoadError=error instanceof Error?error.message:String(error);return false;}
}
