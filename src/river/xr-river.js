import * as T from 'three';
import {mountWorldXR} from '../xr/xr-world.js';
import {heightAt,WATER_Y} from './terrain.js';

// 渓流を VR で歩くための「つなぎ」。WebXR の共通部品（src/xr/xr-world.js）に、渓流の地形ルールを渡すだけ。
// このファイルは WebXR 対応ブラウザでだけ動的 import される（PC・スマホの通常表示には読み込まれない）。

export const WADE_DEPTH=.35;                    // 浅瀬はくるぶし〜すねまで入れる。深い淵ではこの深さに“浮く”
export const BOUNDS={x:78,z:138};
export const riverFloor=(x,z)=>Math.max(heightAt(x,z),WATER_Y-WADE_DEPTH);
const grade=(x,z)=>Math.hypot(heightAt(x+.5,z)-heightAt(x-.5,z),heightAt(x,z+.5)-heightAt(x,z-.5));
export const canStand=(x,z)=>Math.abs(x)<BOUNDS.x&&Math.abs(z)<BOUNDS.z&&grade(x,z)<.95;
// 一歩ぶんの移動を許すか：崖は登れない（下りは少し許す）
export const walkable=(ax,az,bx,bz)=>canStand(bx,bz)&&riverFloor(bx,bz)-riverFloor(ax,az)<.25;

// VR に入った直後の立ち位置：3人を 4〜5m 先に見る、浅瀬か岸。近すぎる所・深い所は避ける
export function xrStartPose(spot){
 const mid=spot.anglers[1].pos,cam=spot.camera.position,base=Math.atan2(cam.x-mid.x,cam.z-mid.z);
 const ok=(x,z)=>heightAt(x,z)>WATER_Y-.28&&canStand(x,z)&&spot.anglers.every(a=>Math.hypot(a.pos.x-x,a.pos.z-z)>2.2);
 let x=cam.x,z=cam.z;
 search:for(const d of [5,4.5,4,3.5,3])for(const o of [0,.3,-.3,.6,-.6,.9,-.9]){
  const a=base+o,px=mid.x+Math.sin(a)*d,pz=mid.z+Math.cos(a)*d;if(ok(px,pz)){x=px;z=pz;break search;}}
 return {x,z,y:riverFloor(x,z),yaw:Math.atan2(-(mid.x-x),-(mid.z-z))};
}

export function mountRiverXR({renderer,scene,camera,controls,rt,water,sun,sunDir,fishing,spot,profile={},onExit}){
 const sunHome={pos:sun.position.clone(),target:sun.target.position.clone()};
 const saved={};const head=new T.Vector3();
 const xr=mountWorldXR({renderer,scene,camera,controls,profile,onExit,near:.06,
  world:{ground:riverFloor,walkable,canStand,startPose:()=>xrStartPose(spot)},
  onStart(){
   // 水の屈折は near を使って深度を戻すので、カメラと揃える。VR では MSAA を軽くする
   water.material.uniforms.uNear.value=camera.near;
   saved.samples=rt.samples;
   if(profile.xrSamples!=null&&rt.samples!==profile.xrSamples){rt.samples=profile.xrSamples;rt.dispose();}
  },
  onEnd(){
   water.material.uniforms.uNear.value=camera.near;
   if(rt.samples!==saved.samples){rt.samples=saved.samples;rt.dispose();}
   sun.position.copy(sunHome.pos);sun.target.position.copy(sunHome.target);
  },
  onUpdate({locomotion}){
   // 太陽の影は自分のまわり（±62m）に付いてくる。8m 単位で動かしてチラつきを抑える
   head.copy(locomotion.headWorld());
   const tx=Math.round(head.x/8)*8,tz=Math.round(head.z/8)*8;
   if(sun.target.position.x!==tx||sun.target.position.z!==tz){sun.target.position.set(tx,0,tz);sun.position.copy(sun.target.position).addScaledVector(sunDir,140);}
  },
 });
 // トリガー：ウキを指して「合わせ」。当たればブルッと振動
 const raycaster=new T.Raycaster();
 xr.input.on('selectstart',hand=>{raycaster.setFromXRController(hand.ray);if(fishing.trySetHook(raycaster))hand.pulse(.9,140);});
 return xr;
}
