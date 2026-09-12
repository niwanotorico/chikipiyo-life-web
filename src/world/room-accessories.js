import {Box3,CatmullRomCurve3,CylinderGeometry,Group,Mesh,MeshStandardMaterial,TubeGeometry,Vector3} from 'three';

function centeredCopy(meshes){
 const copy=new Group(),bounds=new Box3();
 for(const source of meshes){const mesh=source.clone(false);source.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);copy.add(mesh);bounds.union(new Box3().setFromObject(source));}
 const center=bounds.getCenter(new Vector3());for(const mesh of copy.children)mesh.position.sub(center);
 return copy;
}
export function captureRoomAccessories(room){
 const assets={};room.updateMatrixWorld(true);
 for(const name of ['VR_headset','VR_handL','VR_handR','08_Coffee_|_Vert001']){
  const source=room.getObjectByName(name);if(!source)throw new Error(`Missing room accessory: ${name}`);
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
 c.food.clear();c.food.add(assets['08_Coffee_|_Vert001'].clone(true));c.food.visualSource='room-glb';
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
const vacuumDock=new Vector3(4.27,.25,3.49);
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
 const material=new MeshStandardMaterial({color:0x3c4544,roughness:.7});
 const rest=[vacuumDock.clone(),vacuumDock.clone().add(new Vector3(-.12,.08,.03)),vacuumDock.clone().add(new Vector3(-.20,.16,.06)),vacuumDock.clone().add(new Vector3(-.26,.22,.08))];
 const hose=new Mesh(new TubeGeometry(new CatmullRomCurve3(rest),24,.035,6,false),material);
 const wand=new Mesh(new CylinderGeometry(.025,.025,1,12),new MeshStandardMaterial({color:0x8c9b97,metalness:.55,roughness:.35}));
 wand.position.copy(vacuumDock).setY(.30);wand.scale.y=.30;
 parts.nozzle.position.copy(vacuumDock).setY(.065);
 rig.add(hose,wand,parts.nozzle);rig.visible=false;
 rig.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData.furnitureId=furniture.id;}});
 const dockPipe=furniture.group.getObjectByName('13_Vacuum_|_Cube002');
 furniture.vacuumMotion={rig,carrier,chassis,home,dockAngle,source,...parts,hose,wand,dockPipe};
}
// 本体はキャラの斜め後ろ、およそ1キャラ分（.85m前後）のところへ置く。
const chassisBack=.45,chassisSide=.72;
export function updateVacuumMotion(furniture,candidate){
 const motion=furniture.vacuumMotion;if(!motion)return;
 // 掃除機は踊らせない。グループ自体は原点のまま、中の本体だけを持ち運ぶ。
 furniture.group.position.set(0,0,0);
 const actor=candidate?.root?candidate:null;
 motion.rig.visible=!!actor;motion.source.geometry=actor?motion.body:motion.original;
 if(motion.dockPipe)motion.dockPipe.visible=!actor;
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
 const grip=actor.arms[1].localToWorld(new Vector3(.035,actor.variant==='chicken'?-.22:-.16,.035));
 // ノズルは手元から前後へストロークさせる。ワンドは短く、ホースは本体からすぐ届く長さ。
 const swing=.14*Math.sin(actor.elapsed*2.4);
 const wandLength=.60,drop=Math.max(.05,grip.y-.065);
 const reach=Math.sqrt(Math.max(.01,wandLength**2-drop**2))+swing;
 const floor=grip.clone().addScaledVector(forward,reach);floor.y=.065;
 motion.nozzle.position.copy(floor);motion.nozzle.rotation.y=yaw;
 const delta=grip.clone().sub(floor);motion.wand.position.copy(grip).add(floor).multiplyScalar(.5);motion.wand.scale.y=delta.length();motion.wand.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());
 // 本体からキャラの手元まで、肩を越えず、胴体の外側をまわして軽くたるませる。
 const bulge=right.clone().multiplyScalar(.18);
 const curve=new CatmullRomCurve3([dock,
  dock.clone().lerp(grip,.35).add(bulge).add(new Vector3(0,-.07,0)),
  dock.clone().lerp(grip,.72).addScaledVector(bulge,.5).add(new Vector3(0,-.03,0)),grip]);
 motion.hose.geometry.dispose();motion.hose.geometry=new TubeGeometry(curve,24,.035,6,false);
}
