// 「平らな床＋四角い障害物」でできた場所の、VR で歩ける範囲（3DPハウス・今後の室内ワールド用）。
// 障害物は room-layout と同じ形 {position:[x,y,z], footprint:[幅x, 奥行z]}。
//   bounds   … 立ってよい範囲（壁や床の端から少し内側）
//   floorRect… 床がある範囲（外は outsideY の高さ。テレポートの放物線が床の外に落ちても破綻しないように）
//   radius   … プレイヤーの体の半径。家具の足元にめり込まない余白

export function createFloorPlan({floorY=0,outsideY=floorY,bounds,floorRect=bounds,obstacles=[],radius=.18}){
 const inRect=(r,x,z,pad=0)=>x>=r.minX+pad&&x<=r.maxX-pad&&z>=r.minZ+pad&&z<=r.maxZ-pad;
 const blocked=(x,z)=>obstacles.some(o=>Math.abs(x-o.position[0])<o.footprint[0]/2+radius&&Math.abs(z-o.position[2])<o.footprint[1]/2+radius);
 const ground=(x,z)=>inRect(floorRect,x,z)?floorY:outsideY;
 const canStand=(x,z)=>inRect(bounds,x,z)&&!blocked(x,z);
 // 家具の中に実際に歩いて入ってしまった時は、スティックで抜け出せるようにする
 const walkable=(ax,az,bx,bz)=>canStand(bx,bz)||(!canStand(ax,az)&&inRect(floorRect,bx,bz));
 return {ground,canStand,walkable,blocked,floorY};
}

// (x,z) に立って target の方を向く開始位置。yaw は three の rotation.y（0 で -Z を向く）
export function facePose(x,z,target,y=0){
 return {x,y,z,yaw:Math.atan2(-(target.x-x),-(target.z-z))};
}
