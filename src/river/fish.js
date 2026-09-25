import * as T from 'three';
import {rng} from './noise.js';
import {heightAt,riverCenter,riverHalfWidth,WATER_Y,flowAt} from './terrain.js';
import {patchSurface} from './materials.js';

function fishGeometry(){
 const g=new T.SphereGeometry(1,18,12);g.deleteAttribute('uv');
 const p=g.attributes.position,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const t=(z+1)/2;                          // 0 head(-z) .. 1 tail(+z)
  const taper=1-Math.pow(Math.max(0,t-.35)/.65,1.4)*.8;
  x*=.055*taper;y*=.075*taper;z*=.24;y+=(t-.5)*-.01;
  p.setXYZ(i,x,y,z);
  const top=THREE_clamp((y/.075+1)/2),spot=(Math.sin(z*90)*Math.sin(y*120)>.6&&top>.5)?.6:1;
  const back=[.13,.15,.09],belly=[.72,.69,.6];
  for(let k=0;k<3;k++)c[i*3+k]=(belly[k]+(back[k]-belly[k])*Math.pow(top,.8))*spot;
 }
 g.setAttribute('color',new T.BufferAttribute(c,3));g.computeVertexNormals();return g;
}
function THREE_clamp(v){return Math.min(1,Math.max(0,v));}
function tailGeometry(){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([0,0,0, 0,.07,.12, 0,-.07,.12, 0,0,.05],3));
 g.setAttribute('color',new T.Float32BufferAttribute([.2,.22,.15, .25,.26,.2, .25,.26,.2, .2,.22,.15],3));
 g.setIndex([0,1,3,0,3,2]);g.computeVertexNormals();return g;
}

export function createFish(shared,{count=14,zRange=[25,110],extraHomes=[]}={}){
 const group=new T.Group();group.name='RiverFish';const R=rng(7);
 const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.45,metalness:.1,side:T.DoubleSide});patchSurface(mat,'fish',shared);
 const body=fishGeometry(),tail=tailGeometry(),fish=[];
 const spawn=(x,z)=>{
  const depth=WATER_Y-heightAt(x,z);
  const root=new T.Group(),b=new T.Mesh(body,mat),t=new T.Mesh(tail,mat);t.position.z=.2;b.add(t);root.add(b);
  root.scale.setScalar(.8+R()*.6);b.castShadow=true;root.position.set(x,-depth*.5,z);group.add(root);
  fish.push({root,body:b,tail:t,home:new T.Vector2(x,z),target:new T.Vector2(x,z),vel:new T.Vector2(),yaw:Math.PI,phase:R()*10,wait:R()*3,dart:0,lured:null,hooked:false});
 };
 let guard=0;
 while(fish.length<count&&guard++<5000){
  const z=zRange[0]+R()*(zRange[1]-zRange[0]),x=riverCenter(z)+(R()*2-1)*riverHalfWidth(z)*.7;
  if(WATER_Y-heightAt(x,z)>=.7)spawn(x,z);
 }
 for(const [x,z] of extraHomes)spawn(x,z);
 const tmp=new T.Vector2();
 function pickTarget(f){
  for(let i=0;i<20;i++){const a=R()*6.28,d=R()*2.8;const x=f.home.x+Math.cos(a)*d,z=f.home.y+Math.sin(a)*d*1.4;if(WATER_Y-heightAt(x,z)>.55){f.target.set(x,z);return;}}
  f.target.copy(f.home);
 }
 function update(dt,time){
  for(const f of fish){
   const p=f.root.position;
   if(f.hooked)continue;
   f.wait-=dt;
   if(f.lured){f.target.set(f.lured.x+Math.sin(time*.9+f.phase)*.12,f.lured.z+.25);f.wait=1;}
   else if(f.wait<=0){pickTarget(f);f.wait=2+R()*5;if(R()<.15)f.dart=.6;}
   f.dart=Math.max(0,f.dart-dt);
   tmp.set(f.target.x-p.x,f.target.y-p.z);const dist=tmp.length();
   const maxV=f.dart>0?1.8:f.lured?.7:.35;
   const want=dist>.08?tmp.multiplyScalar(Math.min(maxV,dist*.8)/dist):tmp.set(0,0);
   f.vel.lerp(want,Math.min(1,dt*(f.dart>0?6:1.6)));
   // hold against the current: slight drift downstream compensated by swimming
   const fl=flowAt(p.x,p.z);
   p.x+=f.vel.x*dt;p.z+=f.vel.y*dt;
   const depth=WATER_Y-heightAt(p.x,p.z);
   const wantY=f.lured?Math.max(f.lured.y,-depth+.15):-Math.max(.18,Math.min(depth*.55,depth-.2));
   p.y+=(wantY-p.y)*Math.min(1,dt*2)+Math.sin(time*1.3+f.phase)*.0015;
   // face into the current when idle, else along the swim direction
   const sp=f.vel.length();
   const dirX=sp>.12?f.vel.x:-fl[0],dirZ=sp>.12?f.vel.y:-fl[1];
   const yaw=Math.atan2(-dirX,-dirZ);let dy=yaw-f.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));f.yaw+=dy*Math.min(1,dt*3);
   f.root.rotation.y=f.yaw;
   const freq=5+sp*18,wig=.35+sp*.5;
   f.tail.rotation.y=Math.sin(time*freq+f.phase)*wig;f.body.rotation.y=Math.sin(time*freq+f.phase-1.2)*.06;
  }
 }
 // --- fishing hooks: lure the nearest free fish to a point, hook it, let it go again
 function lure(pos,maxDist=14){
  let best=null,bd=maxDist;
  for(const f of fish){if(f.lured||f.hooked)continue;const d=Math.hypot(f.root.position.x-pos.x,f.root.position.z-pos.z);if(d<bd){bd=d;best=f;}}
  if(best)best.lured=pos;return best;
 }
 function release(f,{dart=false}={}){
  f.lured=null;f.hooked=false;f.root.visible=true;f.root.rotation.order='XYZ';f.root.rotation.set(0,f.yaw,0);f.body.rotation.set(0,0,0);
  const p=f.root.position;if(p.y>-.1)p.y=-.25;f.home.set(p.x,p.z);f.vel.set(0,0);f.wait=dart?.1:1+R()*2;if(dart){f.dart=.8;pickTarget(f);}
 }
 return {group,fish,update,lure,release,geometry:{body,tail},material:mat};
}
