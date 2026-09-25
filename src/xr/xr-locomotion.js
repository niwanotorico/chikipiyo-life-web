import * as T from 'three';

// VR の移動：左スティック＝歩く、右スティック左右＝スナップターン、右スティック前倒し＝テレポート照準（離すと移動）。
// 「どこに立てるか」はページ側が ground / walkable / canStand で決める（渓流なら浅瀬まで入れる、崖は登れない…）。

export const deadzone=(v,dz=.18)=>{const a=Math.abs(v);return a<dz?0:Math.sign(v)*(a-dz)/(1-dz);};

// pivot（頭の位置）を中心に、リグの位置 pos を Y 軸まわりに angle 回す（three の rotation.y と同じ向き）
export function rotateAroundY(pos,pivot,angle){
 const dx=pos.x-pivot.x,dz=pos.z-pivot.z,c=Math.cos(angle),s=Math.sin(angle);
 return {x:pivot.x+dx*c+dz*s,z:pivot.z-dx*s+dz*c};
}

// 放物線を地面に当たるまでたどる（テレポート照準）
export function traceArc(origin,dir,groundAt,{speed=7.5,gravity=9.8,step=.035,maxSteps=90}={},points=[]){
 points.length=0;let x=origin.x,y=origin.y,z=origin.z,vx=dir.x*speed,vy=dir.y*speed,vz=dir.z*speed;
 points.push({x,y,z});
 for(let i=0;i<maxSteps;i++){
  const nx=x+vx*step,ny=y+vy*step,nz=z+vz*step;vy-=gravity*step;
  const g=groundAt(nx,nz);
  if(ny<=g){const g0=groundAt(x,z),t=Math.min(1,Math.max(0,(y-g0)/Math.max(1e-6,(y-g0)-(ny-g))));
   const hx=x+(nx-x)*t,hz=z+(nz-z)*t,hit={x:hx,y:groundAt(hx,hz),z:hz};points.push(hit);return {hit,points};}
  x=nx;y=ny;z=nz;points.push({x,y,z});
 }
 return {hit:null,points};
}

export function createLocomotion({rig,camera,input,ground,walkable=()=>true,canStand=()=>true,parent,speed=1.8,snapAngle=Math.PI/6,teleport=true}){
 const head=new T.Vector3(),q=new T.Quaternion(),fwd=new T.Vector3(),right=new T.Vector3(),o=new T.Vector3(),d=new T.Vector3();
 let snapLatch=false,aiming=false,target=null;
 const pts=[];
 // テレポートの軌跡とマーカー
 const N=92,arcGeo=new T.BufferGeometry();arcGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));
 const arc=new T.Line(arcGeo,new T.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.8,depthWrite:false}));arc.frustumCulled=false;arc.visible=false;arc.renderOrder=10;
 const marker=new T.Mesh(new T.RingGeometry(.22,.3,32).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xfff6d8,transparent:true,opacity:.9,depthWrite:false}));marker.visible=false;marker.renderOrder=10;
 const dot=new T.Mesh(new T.CircleGeometry(.08,20).rotateX(-Math.PI/2),marker.material);marker.add(dot);
 (parent||rig.parent).add(arc,marker);

 function headWorld(){rig.updateMatrixWorld();return head.copy(camera.position).applyMatrix4(rig.matrixWorld);}
 function settle(snap=false){const h=headWorld(),g=ground(h.x,h.z);rig.position.y=snap?g:rig.position.y;return g;}

 function update(dt){
  const L=input.hands.left,R=input.hands.right;
  headWorld();
  // 歩く（頭の向き基準）
  if(L){const s=L.stick(),x=deadzone(s.x),y=deadzone(s.y);
   if(x||y){
    rig.getWorldQuaternion(q).multiply(camera.quaternion);
    fwd.set(0,0,-1).applyQuaternion(q).setY(0).normalize();right.set(1,0,0).applyQuaternion(q).setY(0).normalize();
    const mx=(fwd.x*-y+right.x*x)*speed*dt,mz=(fwd.z*-y+right.z*x)*speed*dt;
    if(walkable(head.x,head.z,head.x+mx,head.z+mz)){rig.position.x+=mx;rig.position.z+=mz;}
    else if(walkable(head.x,head.z,head.x+mx,head.z)){rig.position.x+=mx;}
    else if(walkable(head.x,head.z,head.x,head.z+mz)){rig.position.z+=mz;}
   }
  }
  // 右スティック：左右＝スナップターン、前＝テレポート照準
  if(R){const s=R.stick();
   if(!aiming){
    if(!snapLatch&&Math.abs(s.x)>.7){snapLatch=true;headWorld();const p=rotateAroundY(rig.position,head,-Math.sign(s.x)*snapAngle);
     rig.position.x=p.x;rig.position.z=p.z;rig.rotation.y-=Math.sign(s.x)*snapAngle;}
    else if(Math.abs(s.x)<.3)snapLatch=false;
   }
   if(teleport){
    if(s.y<-.65&&Math.abs(s.x)<.6)aiming=true;
    if(aiming){
     R.rayWorld(o,d);const r=traceArc(o,d,ground,{},pts);
     target=r.hit&&canStand(r.hit.x,r.hit.z)?r.hit:null;
     const a=arcGeo.attributes.position;for(let i=0;i<N;i++){const p=pts[Math.min(i,pts.length-1)];a.setXYZ(i,p.x,p.y,p.z);}a.needsUpdate=true;
     arc.material.color.set(target?0xffffff:0xff8a7a);arc.visible=true;
     marker.visible=!!target;if(target)marker.position.set(target.x,target.y+.03,target.z);
     if(s.y>-.25){ // 離したら移動
      aiming=false;arc.visible=false;marker.visible=false;
      if(target){headWorld();rig.position.x+=target.x-head.x;rig.position.z+=target.z-head.z;rig.position.y=target.y;R.pulse(.3,40);}
      target=null;
     }
    }
   }
  }
  // 足元を地面に合わせる（部屋の中を実際に歩いたときも）
  headWorld();const g=ground(head.x,head.z),dy=g-rig.position.y;
  rig.position.y=Math.abs(dy)>1.2?g:rig.position.y+dy*Math.min(1,dt*8);
 }
 function reset(){aiming=false;target=null;snapLatch=false;arc.visible=false;marker.visible=false;}
 function dispose(){arc.removeFromParent();marker.removeFromParent();}
 return {update,reset,dispose,settle,headWorld};
}
