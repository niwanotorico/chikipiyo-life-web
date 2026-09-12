import {Group,Plane,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {roomFurniture,roomObstacles} from './room-layout.js';
import {installPrinterMotion,updatePrinterMotion} from './printer-motion.js';
import {captureRoomAccessories,installVacuumMotion,updateVacuumMotion} from './room-accessories.js';

export async function loadLatestRoom(scene,url,loader=new GLTFLoader()){
 const {scene:room}=await loader.loadAsync(url);
 const furniture=roomFurniture.map(d=>{
  const group=new Group();group.name=`Interaction_${d.id}`;scene.add(group);
  return {...d,group,visualSource:'latest-blend'};
 });
 scene.add(room);room.updateMatrixWorld(true);
 furniture.accessories=captureRoomAccessories(room);
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
 furniture.obstacles=roomObstacles;
 installPrinterMotion(furniture.find(f=>f.id==='printer'));
 installVacuumMotion(furniture.find(f=>f.id==='vacuum'),scene);
 return furniture;
}

export function animateRoom(furniture,characters,time){
 for(const f of furniture){
  const actor=characters.find(c=>c.target?.id===f.id&&c.phase==='acting');
  if(f.id==='printer')updatePrinterMotion(f,actor,time);
  f.group.traverse(o=>{
   if(!o.isMesh)return;
   if(o.userData.vrDockHeadset||o.userData.roomAccessory){
    const drinking=characters.some(c=>c.variant==='chicken'&&c.action==='eat'&&c.phase==='acting'&&c.target?.id==='table');
    o.visible=o.userData.roomAccessory==='08_Coffee_|_Vert001'?!drinking:!actor;
   }
   const part=o.userData.roomPart;
   if(part==='Blanket_idle')o.visible=!actor;
   // 小さい二人は布団を少しだけ下げる。下げすぎるとおなかと翼が布団の上に出る。
   if(part==='Blanket_in_use'){o.visible=!!actor;o.position.y=o.userData.blanketRestY-(actor?(actor.variant==='chicken'?(f.blanketDropChicken??0):(f.blanketDrop??.2)):0);}
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
