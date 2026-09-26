import {cleanSweep} from '../characters/clean-motion.js';
import {Box3,CatmullRomCurve3,CylinderGeometry,Group,Mesh,MeshStandardMaterial,TubeGeometry,Vector3} from 'three';

function centeredCopy(meshes){
 const copy=new Group(),bounds=new Box3();
 for(const source of meshes){const mesh=source.clone(false);source.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);copy.add(mesh);bounds.union(new Box3().setFromObject(source));}
 const center=bounds.getCenter(new Vector3());for(const mesh of copy.children)mesh.position.sub(center);
 return copy;
}
export function captureRoomAccessories(room,names=['VR_headset','VR_handL','VR_handR','08_Coffee_|_Vert001']){
 const roots=Array.isArray(room)?room:[room];
 const assets={};roots.forEach(root=>root.updateMatrixWorld(true));
 const candidatesByName={VR_headset:['VR_headset'],VR_handL:['VR_handL'],VR_handR:['VR_handR'],'08_Coffee_|_Vert001':['08_Coffee_|_Vert001','08 Coffee | Vert.001']};
 for(const name of names){const candidates=candidatesByName[name];
  const source=roots.flatMap(root=>candidates.map(candidate=>root.getObjectByName(candidate))).find(Boolean);if(!source)throw new Error(`Missing room accessory: ${name}`);
  const meshes=[];source.traverse(o=>{if(o.isMesh){o.userData.roomAccessory=name;meshes.push(o);}});
  assets[name]=centeredCopy(meshes);
 }
 return assets;
}
// position は head 内の vr グループ基準（+z が顔側）。
// ちきんは現状維持。ぴよきち・ぴよみだけ顔側へ寄せて少し下げ、少し小さくする。
// grip / gripForward / gripOut は翼の先でコントローラーを握る位置。
const vrFit={
 chiki:{scale:1.04,position:[0,-.025,.025],handScale:.58,grip:.34,gripForward:.025,gripOut:.08,gripTilt:-.25},
 piyo:{scale:1.02,position:[0,-.035,.14],handScale:.44,grip:.27,gripForward:.015,gripOut:.08,gripTilt:-.25},
 piyomi:{scale:1.05,position:[0,-.040,.15],handScale:.46,grip:.10,gripForward:.015,gripOut:.20,gripTilt:-.25},
};
export function installRoomAccessories(c,furniture){
 const fit=vrFit[c.id],assets=furniture.accessories;
 c.food.clear();c.food.add(assets['08_Coffee_|_Vert001'].clone(true));c.food.visualSource='room-glb';c.food.userData.handle=measureCupHandle(c.food);
 c.vr.clear();c.vr.position.set(0,0,0);c.vr.scale.setScalar(1);
 const headset=assets.VR_headset.clone(true);headset.name='Worn_Room_VR_headset';headset.scale.setScalar(fit.scale);headset.position.set(...fit.position);c.vr.add(headset);c.vr.visualSource='room-glb';
 c.vrControllers=['VR_handL','VR_handR'].map((name,i)=>{
  const controller=assets[name].clone(true);controller.name=`Held_${name}`;controller.scale.setScalar(fit.handScale);
  const side=i===0?-1:1;
  controller.position.set(side*fit.gripOut,-fit.grip,fit.gripForward);
  controller.rotation.set(fit.gripTilt,0,side*.12);
  c.arms[i].add(controller);controller.visible=false;return controller;
 });
 return true;
}

// マグの持ち手の位置（カップのローカル）。飲口の縁の円の中心を胴の軸とし、
// 軸から縁の半径より明らかに外へ出ている頂点の重心を「持ち手を握る所」とする。
export function measureCupHandle(cup){
 cup.updateWorldMatrix(true,true);
 const inverse=cup.matrixWorld.clone().invert(),points=[],v=new Vector3();
 cup.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position,m=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<pos.count;i++)points.push(v.fromBufferAttribute(pos,i).applyMatrix4(m).clone());});
 if(!points.length)return null;
 const top=Math.max(...points.map(p=>p.y)),bottom=Math.min(...points.map(p=>p.y)),rim=points.filter(p=>p.y>top-(top-bottom)*.04);
 const axis=rim.reduce((a,p)=>a.add(p),new Vector3()).divideScalar(rim.length).setY(0);
 const radius=Math.max(...rim.map(p=>Math.hypot(p.x-axis.x,p.z-axis.z)));
 const handle=points.filter(p=>Math.hypot(p.x-axis.x,p.z-axis.z)>radius*1.08);
 if(!handle.length)return null;
 const grip=handle.reduce((a,p)=>a.add(p),new Vector3()).divideScalar(handle.length);
 return {grip,axis};
}

// The vacuum's dark material combines wheels, hose and floor head. Separate only
// disconnected hose/head components; preserve all original geometry while docked.
function vacuumParts(mesh){
 const geometry=mesh.geometry,pos=geometry.attributes.position,idx=geometry.index.array;
 const parent=Array.from({length:pos.count},(_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
 const join=(a,b)=>{parent[find(a)]=find(b);},weld=new Map();
 for(let i=0;i<pos.count;i++){
  const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(n=>n.toFixed(4)).join(',');
  if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);
 }
 for(let i=0;i<idx.length;i+=3){join(idx[i],idx[i+1]);join(idx[i],idx[i+2]);}
 const boxes=new Map(),point=new Vector3();
 for(let i=0;i<pos.count;i++){const id=find(i);if(!boxes.has(id))boxes.set(id,new Box3());boxes.get(id).expandByPoint(point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));}
 const moving=new Set([...boxes].filter(([,b])=>b.max.x<4.5).map(([id])=>id));
 const floor=new Set([...boxes].filter(([id,b])=>moving.has(id)&&b.max.y<.15).map(([id])=>id));
 const bodyIndices=[],floorIndices=[];
 for(let i=0;i<idx.length;i+=3){const id=find(idx[i]);if(!moving.has(id))bodyIndices.push(idx[i],idx[i+1],idx[i+2]);if(floor.has(id))floorIndices.push(idx[i],idx[i+1],idx[i+2]);}
 if(!floorIndices.length)throw new Error('Vacuum floor head not found');
 const body=geometry.clone();body.setIndex(bodyIndices);
 const nozzleGeometry=geometry.clone();nozzleGeometry.setIndex(floorIndices);
 // Compact geometry so bounds reflect the selected component, not unused vertices.
 const compact=nozzleGeometry.toNonIndexed();compact.computeBoundingBox();nozzleGeometry.dispose();
 const nozzle=mesh.clone(false);nozzle.geometry=compact;nozzle.updateMatrixWorld(true);
 mesh.matrixWorld.decompose(nozzle.position,nozzle.quaternion,nozzle.scale);nozzle.updateMatrixWorld(true);
 return {body,original:geometry,nozzle:centeredCopy([nozzle])};
}
// ホースの付け根（本体の差込口）。待機中の部品もこの近くに畳んでおき、
// 部屋のバウンディングボックスを広げない。
const vacuumDock=new Vector3(4.7047,.2814,3.3543);
export function installVacuumMotion(furniture,scene){
 const source=furniture.group.getObjectByName('13_Vacuum_|_Cube001');if(!source)throw new Error('Vacuum source missing');
 source.updateWorldMatrix(true,false);const parts=vacuumParts(source);
 // 本体（キャニスター一式）だけをまとめて運べるようにする。ホース／ノズルは別のリグ。
 // carrier を本体の中心に置き、その中で座標を打ち消すことで「中心まわりの回転＋移動」になる。
 const carrier=new Group();carrier.name='Vacuum_Carrier';
 const chassis=new Group();chassis.name='Vacuum_Chassis';
 for(const child of [...furniture.group.children])chassis.add(child);
 carrier.add(chassis);furniture.group.add(carrier);furniture.group.updateMatrixWorld(true);
 const home=new Box3().setFromObject(chassis).getCenter(new Vector3());
 chassis.position.copy(home).negate();carrier.position.copy(home);
 // ホース差込口は本体中心から見てどちらを向いているか。ここをキャラ側へ向ける。
 const dockAngle=Math.atan2(vacuumDock.x-home.x,vacuumDock.z-home.z);
 const rig=new Group();rig.name='Vacuum_HoseAndNozzle';furniture.group.add(rig);
 const material=new MeshStandardMaterial({color:0xf5f2e9,roughness:.7});
 const rest=[vacuumDock.clone(),vacuumDock.clone().add(new Vector3(-.12,.08,.03)),vacuumDock.clone().add(new Vector3(-.20,.16,.06)),vacuumDock.clone().add(new Vector3(-.26,.22,.08))];
 const hose=new Mesh(new TubeGeometry(new CatmullRomCurve3(rest),24,.035,6,false),material);
 // ワンドは待機中の掃除機のワンド・ノズルと同じ素材（Cube.001 の濃い緑）で作り、持った時だけ別物に見えないようにする。
 const wandMaterial=[].concat(source.material)[0];
 // ワンドは固定長の一本の棒。長さはジオメトリで決め、アニメーションでは位置と向きだけを動かす（scale は触らない）。
 const wand=new Mesh(new CylinderGeometry(.025,.025,vacuumWandLength,12),wandMaterial??new MeshStandardMaterial({color:0x8c9b97,metalness:.55,roughness:.35}));
 wand.position.copy(vacuumDock).setY(vacuumWandLength/2);
 parts.nozzle.position.copy(vacuumDock).setY(.065);
 rig.add(hose,wand,parts.nozzle);rig.visible=false;
 rig.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData.furnitureId=furniture.id;}});
 const dockPipe=furniture.group.getObjectByName('13_Vacuum_|_Cube002');
 // Cube002 is the authored pipe. Cube052* are the canister, wheels and socket:
 // keep those visible while replacing only the original pipe and floor head.
 const authoredMovingParts=[dockPipe].filter(Boolean);
 furniture.vacuumMotion={rig,carrier,chassis,home,dockAngle,source,...parts,hose,wand,dockPipe,authoredMovingParts};
}
export const vacuumWandLength=.60;
// 本体はキャラの斜め後ろ、およそ1キャラ分（.85m前後）のところへ置く。
const chassisBack=.45,chassisSide=.72;
export function updateVacuumMotion(furniture,candidate){
 const motion=furniture.vacuumMotion;if(!motion)return;
 // 掃除機は踊らせない。グループ自体は原点のまま、中の本体だけを持ち運ぶ。
 furniture.group.position.set(0,0,0);
 const actor=candidate?.root?candidate:null;
 motion.rig.visible=!!actor;motion.source.geometry=actor?motion.body:motion.original;
 motion.authoredMovingParts?.forEach(o=>{o.visible=!actor;});
 if(!actor){motion.carrier.position.copy(motion.home);motion.carrier.rotation.y=0;motion.carrier.updateWorldMatrix(true,true);return;}
 actor.root.updateMatrixWorld(true);
 const yaw=actor.root.rotation.y;
 const forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw));
 const right=new Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 // 掃除する場所までは本体も一緒に連れて行く。ホースが部屋を横断しないための前提。
 const parked=actor.root.position.clone().addScaledVector(forward,-chassisBack).addScaledVector(right,chassisSide);
 parked.y=motion.home.y;
 // 差込口をキャラ側へ向ける。
 const toActor=actor.root.position.clone().sub(parked);
 motion.carrier.position.copy(parked);
 motion.carrier.rotation.y=Math.atan2(toActor.x,toActor.z)-motion.dockAngle;
 motion.carrier.updateWorldMatrix(true,true);
 const dock=motion.carrier.localToWorld(vacuumDock.clone().sub(motion.home));
 const grip=actor.arms[1].localToWorld(new Vector3(.10,actor.variant==='chicken'?-.22:-.16,.035));
 // ノズルは体の前で左右の弧を描きながら前後にも押し引きする（clean-motion.js と同じリズム）。
 // ワンドは手元とノズルを結ぶ一本の棒、ホースは本体からワンドの付け根（手元）までの柔らかい管。
 const {sweep}=cleanSweep(actor.elapsed??0),sweepYaw=yaw+sweep;
 const sweepDir=new Vector3(Math.sin(sweepYaw),0,Math.cos(sweepYaw));
 // ワンドの長さは一定。手元の高さから、床に届く水平距離が決まる（手が前後すればノズルも前後する）。
 // 前後の押し引き（stroke）は体と腕の動き（animation.js）で手元が動くことで出す。
 const drop=Math.min(vacuumWandLength*.98,Math.max(.05,grip.y-.065));
 const reach=Math.sqrt(vacuumWandLength**2-drop**2);
 const floor=grip.clone().addScaledVector(sweepDir,reach);floor.y=grip.y-drop;
 motion.nozzle.position.copy(floor);motion.nozzle.rotation.y=sweepYaw+Math.PI/2;
 const delta=grip.clone().sub(floor);motion.wand.position.copy(grip).add(floor).multiplyScalar(.5);motion.wand.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());
 // ホース：差込口から上へ出て、床へたるんでからキャラの外側を回って手元へ上がる。
 // 途中の点は体の外側（clearance）に置くので、手元へ向かう線が胴体を横切らない。
 const localGrip=actor.root.worldToLocal(grip.clone());
 const clearance=actor.variant==='chicken'?.48:.38;
 const escape=(z,y)=>actor.root.localToWorld(new Vector3(Math.max(clearance,localGrip.x+.09),y,z));
 const sag=dock.clone().lerp(escape(-.27,0),.55).setY(.05);
 const curve=new CatmullRomCurve3([dock,dock.clone().add(new Vector3(0,.075,0)),sag,
  escape(-.27,Math.max(.14,grip.y*.45)),escape(localGrip.z-.08,grip.y-.055),
  grip.clone().addScaledVector(right,.085),grip],false,'centripetal');
 motion.hose.geometry.dispose();motion.hose.geometry=new TubeGeometry(curve,40,.035,6,false);
}
