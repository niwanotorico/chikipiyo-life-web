import {mountWorldXR} from '../xr/xr-world.js';
import {createFloorPlan,facePose} from '../xr/xr-floorplan.js';
import {roomObstacles} from './room-layout.js';

// 3DPハウスを VR で歩くための「つなぎ」。WebXR の共通部品（src/xr）に、ハウスの床ルールを渡すだけ。
// 家・家具・キャラクター・生活シミュレーションは通常表示とまったく同じものを使う（VR 専用のコピーは作らない）。
// このファイルは WebXR 対応ブラウザでだけ動的 import される（PC・スマホの通常表示には読み込まれない）。
//
// ハウスは Blender の実寸（メートル）のまま：床の天面 y≈0、マットレス天面 .79m、椅子の座面 .61m。
// なのでスケール変換はせず 1:1 で入る。目の高さは Quest の local-floor（実際の身長）に任せる。

// 床の天面（human-room.glb の Mesh_10：x ±5.10 / z ±4.05、天面 y=.01）
export const HOUSE_FLOOR_Y=0;
export const HOUSE_FLOOR_RECT={minX:-5.1,maxX:5.1,minZ:-4.05,maxZ:4.05};
// 立ってよい範囲：奥の壁（z=-3.91〜）と床の端から少し内側
export const HOUSE_BOUNDS={minX:-4.9,maxX:4.9,minZ:-3.7,maxZ:3.85};
// 床の外（庭の地面 y=-.48）
export const HOUSE_OUTSIDE_Y=-.48;

// 家具の足元はキャラクターの経路探索と同じデータ（room-layout の roomObstacles）で塞ぐ。家具を動かせば VR にも反映される
export const houseFloor=createFloorPlan({floorY:HOUSE_FLOOR_Y,outsideY:HOUSE_OUTSIDE_Y,bounds:HOUSE_BOUNDS,floorRect:HOUSE_FLOOR_RECT,obstacles:roomObstacles,radius:.18});

// VR に入った直後：開いている手前側（ベッドと VR 台のあいだ）に立って、部屋の中央〜奥（ソファ・テーブル・PC）を向く
export const HOUSE_START={x:-.9,z:3.25,lookAt:{x:.3,z:-1}};
export const houseStartPose=()=>facePose(HOUSE_START.x,HOUSE_START.z,HOUSE_START.lookAt,HOUSE_FLOOR_Y);

export function mountHouseXR({renderer,scene,camera,controls,profile={},onExit}){
 return mountWorldXR({renderer,scene,camera,controls,profile,onExit,near:.05,
  world:{ground:houseFloor.ground,walkable:houseFloor.walkable,canStand:houseFloor.canStand,startPose:houseStartPose},
 });
}
