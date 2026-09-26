import {Box3,Euler,Group,Matrix4,Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {captureRoomAccessories,installVacuumMotion} from './room-accessories.js';
import {installBurgerMotion,installPotatoMotion} from './burger-motion.js';
import {applyOpaqueTransmissionTargets} from './transmission.js';

const propNames=['vacuum','headphones','music-keyboard','burger','burger_bite01','burger_bite02','potato-single','vr-gear'];
// 食べかけバーガーは無くても動く（古い確認ページ用）。無ければまるごとのまま最後にぱくっと食べる。
const optionalProps=new Set(['burger_bite01','burger_bite02']);

function setShadows(root){root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});}

function centeredAssetCopy(root){
 // The first child has the Blender waiting transform. Remove that transform so
 // the worn version uses the headphone's authored local X/Y/Z axes instead.
 const asset=root.children[0];if(!asset)throw new Error('Headphones GLB has no asset root');
 root.updateWorldMatrix(true,true);const inverseAsset=asset.matrixWorld.clone().invert(),copy=new Group(),bounds=new Box3();
 asset.traverse(object=>{if(!object.isMesh)return;const mesh=object.clone(false),localMatrix=inverseAsset.clone().multiply(object.matrixWorld);localMatrix.decompose(mesh.position,mesh.quaternion,mesh.scale);copy.add(mesh);bounds.union(new Box3().setFromObject(mesh));});
 const center=bounds.getCenter(new Vector3());copy.children.forEach(mesh=>mesh.position.sub(center));return copy;
}

// キーボードの演奏位置は Blender で置いた向き（human 側で回せる）から決める。
// 鍵盤ローカルでは長辺が X、白鍵の手前側が +Z（黒鍵・ツマミは -Z 側）。
// ぴよみは鍵盤の長さの中央、白鍵の手前から playGap 離れた床に座り、鍵盤の方を向く。
export const keyboardPlayGap=.30;
export function keyboardPlayPose(root){
 root.updateWorldMatrix(true,true);
 let body=null;root.traverse(o=>{if(!body&&o.isMesh)body=o.parent;});
 const yaw=new Euler().setFromQuaternion(body.getWorldQuaternion(new Quaternion()),'YXZ').y;
 // 鍵盤の向きにそろえた枠で測る（ワールドの軸には頼らない）。
 const frame=new Matrix4().makeRotationY(yaw),inverse=frame.clone().invert(),local=new Box3(),v=new Vector3();
 root.traverse(o=>{
  if(!o.isMesh)return;const pos=o.geometry.attributes.position,m=inverse.clone().multiply(o.matrixWorld);
  for(let i=0;i<pos.count;i++)local.expandByPoint(v.fromBufferAttribute(pos,i).applyMatrix4(m));
 });
 const toWorld=(x,y,z)=>new Vector3(x,y,z).applyMatrix4(frame).toArray();
 const cx=(local.min.x+local.max.x)/2,cz=(local.min.z+local.max.z)/2,world=new Box3().setFromObject(root),center=toWorld(cx,local.min.y,cz);
 return {
  position:[center[0],0,center[2]],footprint:[world.max.x-world.min.x,world.max.z-world.min.z],
  spot:toWorld(cx,0,local.max.z+keyboardPlayGap).map((n,i)=>i===1?0:n),
  face:Math.atan2(Math.sin(yaw-Math.PI),Math.cos(yaw-Math.PI)),keyboardYaw:yaw,
  keyboardCenter:center,keyboardFront:toWorld(cx,local.min.y,local.max.z),
 };
}

export const modelingHeadphonesFit={scale:.64,tilt:-.58,position:[0,-.024,-.02]};

// The source GLB stays in its human-authored waiting position. The worn copy
// keeps those meshes/materials but is recentered at the character head pivot.
export function installModelingHeadphones(character,source){
 const worn=centeredAssetCopy(source);worn.name='Worn_Modeling_Headphones';
 // Headphone local X is the ear-to-ear axis, Y is up, and Z faces forward.
 // ぴよきちの頭の実メッシュに当てて決めた装着位置：バンドはトサカの後ろで後頭部に沿い、
 // イヤーカップは頭の横（耳の位置）に触れる。机の待機姿勢の回転は引き継がない。
 const fit=modelingHeadphonesFit;
 worn.rotation.set(fit.tilt,0,0);worn.scale.setScalar(fit.scale);worn.position.set(...fit.position);worn.visible=false;
 character.head.add(worn);character.modelingHeadphones=worn;return worn;
}

// These GLBs retain their Blender world transforms, so adding them to the
// scene restores their approved waiting positions without moving room meshes.
export async function loadActionProps(scene,furniture,urls,loader=new GLTFLoader()){
 const names=propNames.filter(name=>urls[name]||!optionalProps.has(name));
 const entries=await Promise.all(names.map(async name=>[name,(await loader.loadAsync(urls[name])).scene]));
 const props=Object.fromEntries(entries);
 for(const [name,root] of Object.entries(props)){setShadows(root);applyOpaqueTransmissionTargets(root,name);}

 const vacuum=furniture.find(item=>item.id==='vacuum');
 props.vacuum.traverse(object=>{if(object.isMesh)object.userData.furnitureId='vacuum';});
 vacuum.group.add(props.vacuum);installVacuumMotion(vacuum,scene);

 scene.add(props.headphones);
 props.musicKeyboard=props['music-keyboard'];props.musicKeyboard.visible=false;
 const piano=furniture.find(item=>item.id==='piano');
 if(piano){
  props.musicKeyboard.traverse(object=>{if(object.isMesh)object.userData.furnitureId='piano';});piano.group.add(props.musicKeyboard);props.musicKeyboard.updateWorldMatrix(true,true);
  Object.assign(piano,keyboardPlayPose(props.musicKeyboard));
 }else scene.add(props.musicKeyboard);
 // burger.glb already contains its serving plate (14_Dessert_|_Circle001).
 // Keep the authored table placement and toggle the complete set as one prop.
 props.burger.visible=false;props.burger.name='Piyomi_Burger_Set';scene.add(props.burger);
 // ぴよみが翼を伸ばす先（バーガーとつまむポテトのワールド位置）をテーブルに持たせる。
 const table=furniture.find(item=>item.id==='table');
 // 食べかけ（bite01 / bite02）はお皿のセットの中へ移し、段階に合わせて差し替える。
 const plate=installBurgerMotion(props.burger,[props.burger_bite01,props.burger_bite02]);if(table)table.meal=plate;
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
