import {Box3,Group,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {captureRoomAccessories,installVacuumMotion} from './room-accessories.js';
import {installBurgerMotion,installPotatoMotion} from './burger-motion.js';

const propNames=['vacuum','headphones','music-keyboard','burger','potato-single','vr-gear'];

function setShadows(root){root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});}

function centeredAssetCopy(root){
 // The first child has the Blender waiting transform. Remove that transform so
 // the worn version uses the headphone's authored local X/Y/Z axes instead.
 const asset=root.children[0];if(!asset)throw new Error('Headphones GLB has no asset root');
 root.updateWorldMatrix(true,true);const inverseAsset=asset.matrixWorld.clone().invert(),copy=new Group(),bounds=new Box3();
 asset.traverse(object=>{if(!object.isMesh)return;const mesh=object.clone(false),localMatrix=inverseAsset.clone().multiply(object.matrixWorld);localMatrix.decompose(mesh.position,mesh.quaternion,mesh.scale);copy.add(mesh);bounds.union(new Box3().setFromObject(mesh));});
 const center=bounds.getCenter(new Vector3());copy.children.forEach(mesh=>mesh.position.sub(center));return copy;
}

// The source GLB stays in its human-authored waiting position. The worn copy
// keeps those meshes/materials but is recentered at the character head pivot.
export function installModelingHeadphones(character,source){
 const worn=centeredAssetCopy(source);worn.name='Worn_Modeling_Headphones';
 // Headphone local X is the ear-to-ear axis, Y is up, and Z faces forward.
 // These values fit the piyokichi head without inheriting the desk pose.
 worn.rotation.set(0,0,0);worn.scale.setScalar(.52);worn.position.set(0,.12,-.015);worn.visible=false;
 character.head.add(worn);character.modelingHeadphones=worn;return worn;
}

// These GLBs retain their Blender world transforms, so adding them to the
// scene restores their approved waiting positions without moving room meshes.
export async function loadActionProps(scene,furniture,urls,loader=new GLTFLoader()){
 const entries=await Promise.all(propNames.map(async name=>[name,(await loader.loadAsync(urls[name])).scene]));
 const props=Object.fromEntries(entries);
 for(const root of Object.values(props))setShadows(root);

 const vacuum=furniture.find(item=>item.id==='vacuum');
 props.vacuum.traverse(object=>{if(object.isMesh)object.userData.furnitureId='vacuum';});
 vacuum.group.add(props.vacuum);installVacuumMotion(vacuum,scene);

 scene.add(props.headphones);
 props.musicKeyboard=props['music-keyboard'];props.musicKeyboard.visible=false;
 const piano=furniture.find(item=>item.id==='piano');
 if(piano){
  props.musicKeyboard.traverse(object=>{if(object.isMesh)object.userData.furnitureId='piano';});piano.group.add(props.musicKeyboard);props.musicKeyboard.updateWorldMatrix(true,true);const bounds=new Box3().setFromObject(props.musicKeyboard),center=bounds.getCenter(new Vector3());
  piano.position=[center.x,0,center.z];piano.footprint=[bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z];
 piano.spot=[center.x,0,bounds.min.z-.30];piano.face=0;piano.keyboardCenter=[center.x,bounds.min.y,center.z];
 }else scene.add(props.musicKeyboard);
 // burger.glb already contains its serving plate (14_Dessert_|_Circle001).
 // Keep the authored table placement and toggle the complete set as one prop.
 props.burger.visible=false;props.burger.name='Piyomi_Burger_Set';scene.add(props.burger);
 installBurgerMotion(props.burger);
 props.potatoSingle=props['potato-single'];props.potatoSingle.visible=false;props.potatoSingle.name='Piyomi_Held_Potato';scene.add(props.potatoSingle);
 installPotatoMotion(props.potatoSingle);

 const vr=furniture.find(item=>item.id==='vr');
 vr.dockGear=props['vr-gear'];vr.dockGear.userData.vrDockHeadset=true;vr.group.add(vr.dockGear);
 vr.dockGear.traverse(object=>{if(object.isMesh)object.userData.furnitureId='vr';});
 vr.dockGear.getObjectByName('VR_headset').traverse(object=>{if(object.isMesh)object.userData.vrDockHeadset=true;});
 furniture.accessories={...furniture.coffeeAccessories,...captureRoomAccessories(vr.dockGear,['VR_headset','VR_handL','VR_handR'])};
 furniture.actionProps=props;
 return props;
}
