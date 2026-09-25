import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm3,rng,smooth} from './noise.js';
import {heightAt,riverCenter,riverHalfWidth,WATER_Y} from './terrain.js';
import {patchSurface} from './materials.js';

export function rockGeometry(seed,detail){
 let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);
 const p=g.attributes.position,col=new Float32Array(p.count*3),v=new T.Vector3();
 const tint=[.47+seed%3*.02,.44+seed%2*.015,.38];
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).normalize();
  const big=fbm3(v.x*1.1+seed*3.1,v.y*1.1,v.z*1.1-seed,4),fine=fbm3(v.x*4+seed,v.y*4,v.z*4,3);
  let r=1+big*.5+fine*.07;
  const y=v.y<-.15?v.y*.55:v.y;
  p.setXYZ(i,v.x*r,y*r,v.z*r);
  const sp=.85+.3*fbm3(v.x*9,v.y*9+seed,v.z*9,2),cav=.72+.28*smooth((big+.25)/.5);
  col[i*3]=tint[0]*sp*cav;col[i*3+1]=tint[1]*sp*cav;col[i*3+2]=tint[2]*sp*cav;
 }
 g.setAttribute('color',new T.BufferAttribute(col,3));g.computeVertexNormals();
 return g;
}

// Returns {group, foam:[x,z,r]} — foam entries mark rocks that break the water surface.
export function createRocks(shared,{mobile=false,clear=[]}={}){
 const group=new T.Group();group.name='RiverRocks';
 const r=rng(42);const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,envMapIntensity:.45});
 patchSurface(m,'rock',shared);
 const variants=[0,1,2,3,4,5].map(s=>rockGeometry(s+1,mobile?3:4));
 const pebbleGeo=rockGeometry(9,2);
 const lists=variants.map(()=>[]),pebbles=[],foam=[];
 const mat4=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),sc=new T.Vector3(),pos=new T.Vector3();
 const add=(x,z,s,flat=.62,list)=>{
  if(clear.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+s))return;
  const sy=s*flat*(.8+r()*.4),h=heightAt(x,z);
  pos.set(x,h-sy*.3,z);e.set((r()-.5)*.3,r()*Math.PI*2,(r()-.5)*.3);q.setFromEuler(e);sc.set(s*(.8+r()*.5),sy,s*(.8+r()*.5));
  mat4.compose(pos,q,sc);(list??lists[(r()*lists.length)|0]).push(mat4.clone());
  const top=pos.y+sy*.9,bot=pos.y-sy;
  if(!list&&top>WATER_Y-.15&&bot<WATER_Y)foam.push([x,z,Math.max(sc.x,sc.z)*.85]);
 };
 for(let i=0;i<34;i++){const z=-120+r()*245,c=riverCenter(z),hw=riverHalfWidth(z);add(c+(r()*2-1)*hw*.85,z,.5+Math.pow(r(),1.6)*2.1);}
 for(let i=0;i<70;i++){const z=-140+r()*280,c=riverCenter(z),hw=riverHalfWidth(z),side=r()<.5?-1:1;add(c+side*(hw-1.5+r()*6),z,.4+Math.pow(r(),1.4)*2.6);}
 for(let i=0;i<26;i++){const z=-140+r()*280,c=riverCenter(z),hw=riverHalfWidth(z),side=r()<.5?-1:1;add(c+side*(hw+5+r()*16),z,1.4+r()*3,.7);}
 const pebbleCount=mobile?260:520;
 for(let i=0;i<pebbleCount;i++){const z=-60+r()*190,c=riverCenter(z),hw=riverHalfWidth(z),side=r()<.5?-1:1;add(c+side*(hw-2+Math.pow(r(),.7)*5),z,.1+Math.pow(r(),2)*.3,.55,pebbles);}
 const inst=(geo,list)=>{const im=new T.InstancedMesh(geo,m,list.length);list.forEach((mm,i)=>im.setMatrixAt(i,mm));im.castShadow=true;im.receiveShadow=true;im.computeBoundingSphere();group.add(im);};
 variants.forEach((g,i)=>lists[i].length&&inst(g,lists[i]));inst(pebbleGeo,pebbles);
 return {group,foam};
}
