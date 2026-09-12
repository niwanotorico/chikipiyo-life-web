import {Box3,CylinderGeometry,Group,Mesh,Vector3} from 'three';

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Height/depth are now authored in the human-adjusted Blend; do not offset them twice.
const railLift=0,railForward=0;

// Rig the existing exported parts without changing their resting geometry.
export function installPrinterMotion(furniture){
 const meshes=[];furniture.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const head=new Group();head.name='PrinterMotion_Head';
 const rail=new Group();rail.name='PrinterMotion_CrossRail';
 const supports=new Group();supports.name='PrinterMotion_Supports';
 furniture.group.add(head,rail,supports);furniture.group.updateMatrixWorld(true);
 const cables=[];
 for(const mesh of meshes){
  if(mesh.userData.roomPart==='Hotend'){
   const box=new Box3().setFromObject(mesh);
   if(box.max.x-box.min.x>2){
    mesh.geometry=mesh.geometry.clone();
    const position=mesh.geometry.attributes.position;
    const rest=new Float32Array(position.array),weights=[];
    const point=new Vector3();
    for(let i=0;i<position.count;i++){
     point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
     weights.push(smooth((point.x-box.min.x)/(box.max.x-box.min.x)));
    }
    cables.push({mesh,rest,weights});
   }else head.attach(mesh);
  }
  // Multi-material children retain their names after world-preserving attachment.
  if(/^Mesh_54(?:_\d+)?$/.test(mesh.name))rail.attach(mesh);
  if(/^Mesh_5600[23](?:_\d+)?$/.test(mesh.name))supports.attach(mesh);
 }
 const headBounds=new Box3().setFromObject(head);
 const tip=new Vector3((headBounds.min.x+headBounds.max.x)/2,headBounds.min.y,(headBounds.min.z+headBounds.max.z)/2);
 // The nozzle cone is narrower than the fan housing: use its exact center.
 const nozzle=head.children.find(o=>o.name==='Mesh_60');
 if(nozzle){const b=new Box3().setFromObject(nozzle);tip.set((b.min.x+b.max.x)/2,b.min.y,(b.min.z+b.max.z)/2);}
 const printed=meshes.filter(o=>o.userData.roomPart==='edp_house');
 const printBounds=new Box3();for(const mesh of printed)printBounds.union(new Box3().setFromObject(mesh));
 const center=printBounds.getCenter(new Vector3()),size=printBounds.getSize(new Vector3());
 const upper=head.children.filter(o=>['Mesh_60_1','Mesh_60_3','Mesh_60_4'].includes(o.name)).map(mesh=>({mesh,rest:mesh.position.clone()}));
 const heater=head.children.find(o=>o.name==='Mesh_60_2');
 const housing=head.children.find(o=>o.name==='Mesh_60_3');
 const heaterTop=new Box3().setFromObject(heater).max.y;
 const housingBottom=new Box3().setFromObject(housing).min.y;
 const shaft=new Mesh(new CylinderGeometry(.065,.065,1,16),rail.children[0].material.clone());shaft.name='PrinterMotion_TelescopicShaft';
 const sleeve=new Mesh(new CylinderGeometry(.105,.105,1,16),housing.material.clone());sleeve.name='PrinterMotion_ShaftSleeve';
 for(const mesh of [shaft,sleeve]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.furnitureId='printer';furniture.group.add(mesh);}
 furniture.printerMotion={head,rail,supports,cables,tip,center,size,upper,shaft,sleeve,heaterTop,housingBottom,railLift,railForward,offset:new Vector3(),wasPrinting:false,returnStarted:null,returnFrom:new Vector3()};
 updatePrinterMotion(furniture,null,0);
}

export function updatePrinterMotion(furniture,actor,time){
 const rig=furniture.printerMotion;if(!rig)return;
 const {head,rail,supports,cables,tip,center,size,offset}=rig;
 if(actor){
  const t=Math.max(0,actor.elapsed),progress=Math.min(1,t/14);
  const height=furniture.printBottom+(furniture.printTop-furniture.printBottom)*progress;
  // Smooth serpentine pass inside the model footprint, above the current layer.
  const target=new Vector3(center.x+size.x*.38*Math.sin(t*4),height+.045,center.z+size.z*.36*Math.sin(t*1.7)).sub(tip);
  offset.copy(target).multiplyScalar(smooth(t/.65));
  // The last two seconds of the existing 16-second action park the head.
  if(t>=14)offset.multiplyScalar(1-smooth((t-14)/1.6));
  rig.wasPrinting=true;rig.returnStarted=null;
 }else if(rig.wasPrinting){
  if(rig.returnStarted===null){rig.returnStarted=time;rig.returnFrom.copy(offset);}
  const progress=smooth((time-rig.returnStarted)/.8);
  offset.copy(rig.returnFrom).multiplyScalar(1-progress);
  if(progress===1){rig.wasPrinting=false;rig.returnStarted=null;}
 }
 head.position.copy(offset);
 // Only the nozzle/heater moves vertically; the housing rides on the high cross rail.
 for(const {mesh,rest} of rig.upper)mesh.position.copy(rest).add(new Vector3(0,-offset.y,0));
 rail.position.set(0,railLift,railForward+offset.z);
 supports.position.set(0,0,railForward+offset.z);
 const bottom=rig.heaterTop+offset.y-.02,top=rig.housingBottom+.04;
 const length=Math.max(.02,top-bottom);
 rig.shaft.position.set(tip.x+offset.x,(top+bottom)/2,tip.z+offset.z);rig.shaft.scale.y=length;
 const sleeveLength=Math.min(.22,length);
 rig.sleeve.position.set(tip.x+offset.x,top-sleeveLength/2,tip.z+offset.z);rig.sleeve.scale.y=sleeveLength;
 for(const {mesh,rest,weights} of cables){
  const position=mesh.geometry.attributes.position;
  // Convert world translation to the original cable's local coordinates.
  const local=mesh.worldToLocal(mesh.getWorldPosition(new Vector3()).add(new Vector3(offset.x,0,offset.z)));
  for(let i=0;i<position.count;i++)position.setXYZ(i,rest[i*3]+local.x*weights[i],rest[i*3+1]+local.y*weights[i],rest[i*3+2]+local.z*weights[i]);
  position.needsUpdate=true;mesh.geometry.computeBoundingSphere();
 }
}
