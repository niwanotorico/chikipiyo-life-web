import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm3,noise,rng,smooth} from './noise.js';
import {heightAt,bankDistance,riverCenter} from './terrain.js';
import {patchWind} from './materials.js';

const colorize=(g,fn)=>{const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const [r,gg,b]=fn(p.getX(i),p.getY(i),p.getZ(i),n.getY(i));c[i*3]=r;c[i*3+1]=gg;c[i*3+2]=b;}
 g.setAttribute('color',new T.BufferAttribute(c,3));return g;};
function blob(r,x,y,z,seed,col){
 let g=new T.IcosahedronGeometry(r,1);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);
 const p=g.attributes.position,v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const k=1+.28*fbm3(v.x*1.3+seed,v.y*1.3,v.z*1.3,2);p.setXYZ(i,v.x*k+x,v.y*k*.85+y,v.z*k+z);}
 g.computeVertexNormals();
 return colorize(g,(px,py,pz,ny)=>{const ao=.5+.5*(ny*.5+.5);const t=.85+.3*fbm3(px*2,py*2,pz*2,1);return [col[0]*ao*t,col[1]*ao*t,col[2]*ao*t];});
}
function trunk(h,r){const g=new T.CylinderGeometry(r*.6,r,h,6,1);g.translate(0,h/2,0);g.deleteAttribute('uv');return colorize(g,()=>[.16,.11,.07]);}
function broadleaf(seed){
 const R=rng(seed),parts=[trunk(3.2,.18)],green=[.11+R()*.05,.24+R()*.06,.05];
 for(let i=0;i<6;i++){const a=R()*Math.PI*2,d=i?.9+R()*.7:0;parts.push(blob(1.2+R()*.6,Math.cos(a)*d,3.6+R()*2.2,Math.sin(a)*d,seed*7+i,green));}
 return mergeGeometries(parts);
}
function cedar(seed){
 const R=rng(seed),parts=[trunk(2.5,.16)];
 for(let i=0;i<5;i++){const t=i/5,r=1.7*(1-t)+.3,h=2.4-t*.8;let g=new T.ConeGeometry(r,h,9,1);g.translate(0,2+i*1.35+h/2,0);g.deleteAttribute('uv');
  const p=g.attributes.position;for(let k=0;k<p.count;k++){if(p.getY(k)<2+i*1.35+.1){p.setX(k,p.getX(k)*(1+(R()-.5)*.35));p.setZ(k,p.getZ(k)*(1+(R()-.5)*.35));}}
  g=mergeVertices(g);g.computeVertexNormals();parts.push(colorize(g,(x,y,z,ny)=>{const ao=.55+.45*(ny*.5+.5);return [.05*ao,.14*ao,.06*ao];}));}
 return mergeGeometries(parts);
}
function grassTuft(){
 const R=rng(5),pos=[],col=[],nor=[],idx=[];
 for(let b=0;b<6;b++){
  const a=R()*Math.PI,h=.28+R()*.4,w=.035+R()*.02,lean=(R()-.5)*.5,ox=(R()-.5)*.18,oz=(R()-.5)*.18,ca=Math.cos(a),sa=Math.sin(a);
  const base=pos.length/3;
  for(let s=0;s<=3;s++){const t=s/3,ww=w*(1-t),y=h*t,bend=lean*t*t*h;
   for(const side of [-1,1]){pos.push(ox+ca*ww*side+sa*bend,y,oz+sa*ww*side-ca*bend);nor.push(0,1,0);col.push(.07+.3*t,.13+.33*t,.03+.1*t);}}
  for(let s=0;s<3;s++){const i=base+s*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);
 return g;
}

export function createVegetation(shared,{mobile=false,clear=[]}={}){
 const blocked=(x,z,pad=0)=>clear.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+pad);
 const group=new T.Group();group.name='RiverVegetation';const R=rng(99);
 const leafMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0});patchWind(leafMat,shared,{amp:.018,base:2.5,key:'tree'});
 const grassMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0,side:T.DoubleSide});patchWind(grassMat,shared,{amp:.12,base:.05,key:'grass'});
 const types=[{geo:broadleaf(1),n:mobile?420:760},{geo:broadleaf(2),n:mobile?420:760},{geo:cedar(3),n:mobile?300:560}];
 const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),s=new T.Vector3(),p=new T.Vector3(),c=new T.Color();
 const slope=(x,z)=>Math.abs(heightAt(x+1,z)-heightAt(x-1,z))/2+Math.abs(heightAt(x,z+1)-heightAt(x,z-1))/2;
 types.forEach((t,ti)=>{
  const im=new T.InstancedMesh(t.geo,leafMat,t.n);let k=0,guard=0;
  while(k<t.n&&guard++<60000){
   const x=(R()*2-1)*88,z=(R()*2-1)*148,d=bankDistance(x,z);if(d<2.2||blocked(x,z,2.5))continue;
   const h=heightAt(x,z);if(slope(x,z)>1.3)continue;
   const dens=smooth((d-2.2)/3)*(.5+.5*noise(x*.05+ti,z*.05))*(ti===2?smooth((h-3)/6):1);if(R()>dens)continue;
   const toRiver=Math.sign(riverCenter(z)-x),lean=smooth(1-(d-2.2)/6)*.22;
   const sc=(ti===2?1.1:.85)+R()*.7;p.set(x,h-.3,z);e.set(0,R()*6.28,toRiver*-lean);q.setFromEuler(e);s.set(sc,sc*(.9+R()*.3),sc);
   m.compose(p,q,s);im.setMatrixAt(k,m);c.setHSL(.24+R()*.07,.55+R()*.2,.35+R()*.25);im.setColorAt(k,c);k++;
  }
  im.count=k;im.castShadow=true;im.receiveShadow=true;im.computeBoundingSphere();group.add(im);
 });
 // bushes near the banks
 const bushGeo=mergeGeometries([blob(.7,0,.45,0,11,[.1,.22,.05]),blob(.55,.6,.35,.2,12,[.13,.26,.05]),blob(.5,-.5,.3,-.3,13,[.09,.2,.05])]);
 const bn=mobile?260:520,bush=new T.InstancedMesh(bushGeo,leafMat,bn);let k=0;
 while(k<bn){const x=(R()*2-1)*88,z=(R()*2-1)*148,d=bankDistance(x,z);if(d<.6||d>9||blocked(x,z,.8))continue;const sc=.5+R()*.9;
  p.set(x,heightAt(x,z)-.1,z);e.set(0,R()*6.28,0);q.setFromEuler(e);s.set(sc,sc,sc);m.compose(p,q,s);bush.setMatrixAt(k,m);c.setHSL(.22+R()*.08,.5,.4+R()*.2);bush.setColorAt(k,c);k++;}
 bush.castShadow=true;bush.receiveShadow=true;bush.computeBoundingSphere();group.add(bush);
 // grass tufts concentrated around the viewing area
 const gn=mobile?6000:14000,grass=new T.InstancedMesh(grassTuft(),grassMat,gn);k=0;let guard=0;
 while(k<gn&&guard++<200000){const z=5+R()*125,x=riverCenter(z)+(R()*2-1)*34,d=bankDistance(x,z);if(d<.5||blocked(x,z,-1))continue;const h=heightAt(x,z);if(h<.3||slope(x,z)>1.2)continue;
  const sc=.7+R()*.9;p.set(x,h-.02,z);e.set(0,R()*6.28,0);q.setFromEuler(e);s.set(sc,sc*(.7+R()*.6),sc);m.compose(p,q,s);grass.setMatrixAt(k,m);c.setHSL(.2+R()*.08,.5,.45+R()*.25);grass.setColorAt(k,c);k++;}
 grass.count=k;grass.receiveShadow=true;grass.computeBoundingSphere();group.add(grass);
 return group;
}
