import * as T from 'three';
import {createXRSession,mountXRButton} from './xr-session.js';
import {createXRInput} from './xr-input.js';
import {createLocomotion} from './xr-locomotion.js';

// 既存のワールド（渓流・3DPハウス・今後の赤羽…）を、そのまま VR で歩けるようにする共通部品。
// シーン・キャラクター・アニメーションには手を入れず、カメラをリグ（プレイヤーの足元）に載せ替えるだけ。
// ワールド側が渡すもの：
//   world.ground(x,z)            … その地点の床の高さ（テレポートの着地・足元合わせ）
//   world.walkable(ax,az,bx,bz)  … スティックで一歩動いてよいか
//   world.canStand(x,z)          … テレポートで立てるか
//   world.startPose()            … VR に入った直後の {x,y,z,yaw}
//   onStart / onEnd / onUpdate   … ワールド固有の切り替え（渓流なら水の near や影の追従）
// 通常時はリグが原点・無回転なので、PC・スマホの見た目や OrbitControls はこれまでと同じ。

export const XR_EYE_HEIGHT=1.6; // トラッキング前（エミュレーター等）の仮の目の高さ。実機は local-floor の実身長になる

export function mountWorldXR({renderer,scene,camera,controls,world,profile={},near=.06,onStart,onEnd,onUpdate,onExit,buttonParent=document.body,buttonOptions={}}){
 renderer.xr.enabled=true;
 const rig=new T.Group();rig.name='XRRig';scene.add(rig);rig.add(camera);
 const input=createXRInput(renderer,rig);
 const loco=createLocomotion({rig,camera,input,ground:world.ground,walkable:world.walkable,canStand:world.canStand,parent:scene});
 const saved={};
 const ctx={rig,input,locomotion:loco,camera,scene,renderer};

 const session=createXRSession(renderer,{
  framebufferScale:profile.xrScale||1,
  foveation:profile.foveation??1,
  onStart(mode,s){
   saved.pos=camera.position.clone();saved.quat=camera.quaternion.clone();saved.near=camera.near;saved.fov=camera.fov;saved.zoom=camera.zoom;
   saved.target=controls?controls.target.clone():null;
   if(controls)controls.enabled=false;
   camera.near=near;camera.updateProjectionMatrix();
   const p=world.startPose();rig.position.set(p.x,p.y??world.ground(p.x,p.z),p.z);rig.rotation.set(0,p.yaw||0,0);
   camera.position.set(0,XR_EYE_HEIGHT,0);camera.quaternion.identity();
   loco.reset();
   onStart&&onStart(ctx,mode,s);
   document.body.classList.add('xr-active');button.active();
  },
  onEnd(mode){
   rig.position.set(0,0,0);rig.rotation.set(0,0,0);rig.updateMatrixWorld(true);
   // VR 中は three.js がカメラの fov を目の視野（約100°）で上書きするので、元の画角に戻す（戻さないと家が豆粒に見える）
   camera.position.copy(saved.pos);camera.quaternion.copy(saved.quat);camera.near=saved.near;camera.fov=saved.fov;camera.zoom=saved.zoom;camera.updateProjectionMatrix();
   onEnd&&onEnd(ctx,mode);
   if(controls){if(saved.target)controls.target.copy(saved.target);controls.enabled=true;controls.update();}
   loco.reset();document.body.classList.remove('xr-active');button.idle();onExit&&onExit();
  },
 });
 const button=mountXRButton(buttonParent,{...buttonOptions,onEnter:()=>session.enter('vr'),onExit:()=>session.exit()});

 function update(dt){
  input.update();loco.update(dt);
  onUpdate&&onUpdate(ctx,dt);
 }
 return {rig,input,locomotion:loco,session,button,update,get active(){return session.active;}};
}
