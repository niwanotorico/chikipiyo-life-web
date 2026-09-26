import {Box3,Group,Plane,Raycaster,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {roomFurniture,roomObstacles} from './room-layout.js';
import {installPrinterMotion,updatePrinterMotion} from './printer-motion.js';
import {captureRoomAccessories,updateVacuumMotion} from './room-accessories.js';
import {updateBurgerMotion,updatePotatoMotion} from './burger-motion.js';
import {installModelingHologram,installModelingScreen,updateModelingHologram,updateModelingScreen} from './modeling-screen.js';
import {hopOffDuration,modelingBeats} from '../characters/modeling-timeline.js';
import {applyOpaqueTransmissionTargets} from './transmission.js';
import {applySoftNormals} from './soft-normals.js';

export async function loadLatestRoom(scene,url,loader=new GLTFLoader(),{createCanvas}={}){
 const {scene:room}=await loader.loadAsync(url);
 applyOpaqueTransmissionTargets(room,'room');
 const furniture=roomFurniture.map(d=>{
  const group=new Group();group.name=`Interaction_${d.id}`;scene.add(group);
  return {...d,group,visualSource:'latest-blend'};
 });
 scene.add(room);room.updateMatrixWorld(true);
 const desk=furniture.find(f=>f.id==='desk'),laptop=desk&&room.getObjectByName(desk.modelLaptopName);
 const seat=desk&&measureModelingDesk(desk,room);
 if(seat){
  installModelingScreen(desk,laptop,seat,{createCanvas});
  installModelingHologram(desk,laptop,seat);
 }
 furniture.coffeeAccessories=captureRoomAccessories(room,['08_Coffee_|_Vert001']);
 const meshes=[];
 room.traverse(o=>{if(o.isMesh){
  for(let p=o.parent;p&&p!==room;p=p.parent){
   for(const key of ['furnitureId','vrDockHeadset','roomPart'])if(p.userData[key]!==undefined&&o.userData[key]===undefined)o.userData[key]=p.userData[key];
  }
  meshes.push(o);
 }});
 for(const mesh of meshes){
  mesh.castShadow=true;mesh.receiveShadow=true;
  furniture.find(f=>f.id===mesh.userData.furnitureId)?.group.attach(mesh);
  if(mesh.userData.roomPart==='Blanket_in_use'){mesh.visible=false;mesh.userData.blanketRestY=mesh.position.y;}
 }
 // ソファは近くで見ても陰がギザつかないよう、法線だけ作り直す（形は変えない）。
 applySoftNormals(meshes);
 // 使用中の掛け布団は、下の縁をマットレス脇に残したまま上だけ伸ばす（持ち上げると縁が浮く）。
 const inUse=meshes.filter(m=>m.userData.roomPart==='Blanket_in_use');
 if(inUse.length){
  let low=Infinity,high=-Infinity;
  for(const m of inUse){m.geometry.computeBoundingBox();low=Math.min(low,m.geometry.boundingBox.min.y);high=Math.max(high,m.geometry.boundingBox.max.y);}
  for(const m of inUse)m.userData.blanketRest={y:m.position.y,scaleY:m.scale.y,low,high};
 }
 furniture.obstacles=roomObstacles;
 furniture.roomRoot=room;
 installPrinterMotion(furniture.find(f=>f.id==='printer'));
 return furniture;
}

// ぴよきちのモデリング：椅子の座面・立ち位置・キーボード面を部屋の実メッシュから測って desk に書き込む。
// アプリ（loadLatestRoom）と動くAR の書き出し（build-ar-anim-usdz.mjs）で共通。座面の点 [x,y,z] を返す。
export function measureModelingDesk(desk,room){
 const chair=room.getObjectByName(desk.modelChairName),laptop=room.getObjectByName(desk.modelLaptopName);
 if(!chair||!laptop)return null;
 room.updateMatrixWorld(true);
 const chairBounds=new Box3().setFromObject(chair),chairCenter=chairBounds.getCenter(new Vector3());
 const seatHit=new Raycaster(new Vector3(chairCenter.x,10,chairCenter.z),new Vector3(0,-1,0),0,20).intersectObject(chair,true)[0];
 if(!seatHit)throw new Error('Modeling chair seat surface missing');
 const laptopCenter=new Box3().setFromObject(laptop).getCenter(new Vector3()),face=Math.atan2(laptopCenter.x-seatHit.point.x,laptopCenter.z-seatHit.point.z);
 // 椅子の背もたれ越しではなく、椅子の横（本人の右＝通路側）から座面へ跳び乗る。
 desk.spot=[chairBounds.min.x-.38,0,seatHit.point.z];desk.face=face;
 desk.standAnchor=[seatHit.point.x+Math.sin(face)*.08,seatHit.point.y,seatHit.point.z+Math.cos(face)*.08];
 // 翼の先を置く面：立ち位置から PC へ向かって下向きRaycastし、最初に当たるノートPC本体の天面。
 const fwd=new Vector3(Math.sin(face),0,Math.cos(face)),down=new Raycaster(new Vector3(),new Vector3(0,-1,0),0,20);
 for(let d=.05;d<1;d+=.005){
  down.ray.origin.set(desk.standAnchor[0]+fwd.x*d,5,desk.standAnchor[2]+fwd.z*d);
  const hit=down.intersectObject(laptop,true)[0];
  if(hit){desk.typing={front:d,surfaceY:hit.point.y};break;}
 }
 return [seatHit.point.x,seatHit.point.y,seatHit.point.z];
}

export function animateRoom(furniture,characters,time){
 const piyomiEating=characters.find(c=>c.id==='piyomi'&&c.phase==='acting'&&c.action==='eat'&&c.target?.id==='table');
 if(furniture.actionProps?.burger)updateBurgerMotion(furniture.actionProps.burger,piyomiEating);
 if(furniture.actionProps?.potatoSingle)updatePotatoMotion(furniture.actionProps.potatoSingle,piyomiEating);
 if(furniture.actionProps?.headphones)furniture.actionProps.headphones.visible=!characters.some(c=>c.id==='piyo'&&c.phase==='acting'&&c.action==='model'&&c.elapsed>=1.0&&!(c.remaining<hopOffDuration));
 if(furniture.actionProps?.musicKeyboard)furniture.actionProps.musicKeyboard.visible=characters.some(c=>c.id==='piyomi'&&c.action==='piano');
 for(const f of furniture){
  const actor=characters.find(c=>c.target?.id===f.id&&c.phase==='acting');
  if(f.id==='printer')updatePrinterMotion(f,actor,time);
  // PCは跳び乗って着地したところで点く
  if(f.id==='desk'){
   const worker=actor?.action==='model'&&actor.elapsed>=modelingBeats.hopOn[1]*.9?actor:null;
   updateModelingScreen(f.modelingScreen,worker,time);
   updateModelingHologram(f.modelingHologram,worker,time,Math.max(0,time-(f.lastRoomTime??time)));f.lastRoomTime=time;
  }
  if(f.id==='vr'&&f.dockGear)f.dockGear.traverse(o=>{if(o.isMesh)o.visible=!actor;});
  f.group.traverse(o=>{
   if(!o.isMesh)return;
   if(o.userData.vrDockHeadset||o.userData.roomAccessory){
    const drinking=characters.some(c=>c.variant==='chicken'&&c.action==='eat'&&c.phase==='acting'&&c.target?.id==='table');
    o.visible=o.userData.roomAccessory==='08_Coffee_|_Vert001'?!drinking:!actor;
   }
   const part=o.userData.roomPart;
   if(part==='Blanket_idle')o.visible=!actor;
   // 小さい二人は布団を少しだけ下げる。下げすぎるとおなかと翼が布団の上に出る。
   if(part==='Blanket_in_use'){o.visible=!!actor;fitBlanket(o,(f.blanketLift??0)-(actor?(actor.variant==='chicken'?(f.blanketDropChicken??0):(f.blanketDrop??.2)):0));}
   // Reveal the Blender print from its build plate upward; leave the gantry and cable intact.
   if(part==='edp_house'){
    if(!o.userData.printMaterials){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.userData.printMaterials=true;}
    const height=f.printBottom+(f.printTop-f.printBottom)*Math.min(1,(actor?.elapsed??16)/14);
    const clip=o.userData.printClip??(o.userData.printClip=new Plane(new Vector3(0,-1,0),height));clip.constant=height;
    for(const m of [].concat(o.material)){
     m.emissive?.setHex(actor?0x9b6600:0);m.emissiveIntensity=actor ? .25+.15*Math.sin(time*4) : 0;
     m.clippingPlanes=actor?[clip]:null;
     m.clipShadows=true;
    }
   }
  });
  if(f.id==='vacuum')updateVacuumMotion(f,actor);
 }
}

// 掛け布団の天面だけを raise 分上げ下げし、下の縁（マットレス脇に垂れる所）は元の高さに残す。
// 以前は布団ごと平行移動していたので、ちきん（+.12）のときに縁が浮いてマットレスが見えていた。
export function fitBlanket(mesh,raise){
 const rest=mesh.userData.blanketRest;
 if(!rest){mesh.position.y=(mesh.userData.blanketRestY??mesh.position.y)+raise;return;}
 const bottom=rest.y+rest.scaleY*rest.low,height=rest.scaleY*(rest.high-rest.low);
 const scaleY=rest.scaleY*Math.max(.5,(height+raise)/height);
 mesh.scale.y=scaleY;mesh.position.y=bottom-scaleY*rest.low;
}
