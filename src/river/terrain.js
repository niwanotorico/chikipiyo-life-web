import * as T from 'three';
import {fbm,noise,smooth} from './noise.js';
import {patchSurface} from './materials.js';

export const WATER_Y=0;
export const TERRAIN={width:180,length:300};

// The stream flows toward +z (toward the default camera). Upstream is -z.
export const riverCenter=z=>7*Math.sin(z*.03)+3.5*Math.sin(z*.083+1.3);
export const riverHalfWidth=z=>7.5+2.2*Math.sin(z*.047+2)+1.4*noise(z*.08,3.1);

export function heightAt(x,z){
 const c=riverCenter(z),hw=riverHalfWidth(z),s=Math.abs(x-c)-hw;
 if(s<0){
  const d=Math.min(1,-s/Math.max(hw*.55,1));
  const pool=1+.9*Math.max(0,Math.sin(z*.061+.5))+.4*noise(z*.05,x*.05);
  return .22-1.25*pool*smooth(d)+.12*fbm(x*.7,z*.7,3);
 }
 const side=x>c?1.25:.85;
 const cliff=17*side*smooth((s-2.5)/24)+5*fbm(x*.035,z*.035,4)*smooth(s/12);
 return .22+s*.22+cliff+.35*fbm(x*.25,z*.25,3)*smooth(s/2);
}

// Distance from the channel edge: negative inside the stream.
export function bankDistance(x,z){return Math.abs(x-riverCenter(z))-riverHalfWidth(z);}

export function flowAt(x,z){
 const e=.5,dx=riverCenter(z+e)-riverCenter(z-e),len=Math.hypot(dx,2*e);
 const depth=Math.max(0,WATER_Y-heightAt(x,z)),hw=riverHalfWidth(z);
 const speed=(.45+.9*(1-smooth(depth/1.6)))*(.25+.75*smooth(depth/.45))*(8.5/hw);
 return [dx/len*speed,2*e/len*speed];
}

export function makePebbleTexture(size=512){
 const cv=document.createElement('canvas');cv.width=cv.height=size;const g=cv.getContext('2d');
 g.fillStyle='#6f6c60';g.fillRect(0,0,size,size);
 const pal=['#b4ac98','#968f7e','#c7bfaa','#7c7c70','#a3977c','#8a8f80','#d2cab6','#6c6f64','#ab9f84','#8f8672','#5f625a'];
 const r=(()=>{let s=11;return()=>(s=(s*16807)%2147483647)/2147483647;})();
 const stones=[];
 for(let k=0;k<1500;k++)stones.push({rad:size*(.006+Math.pow(r(),2.4)*.04),x:r()*size,y:r()*size,a:r()*Math.PI,e:.5+r()*.5,col:pal[(r()*pal.length)|0]});
 stones.sort((a,b)=>b.rad-a.rad);
 for(const st of stones){
  for(const ox of [-size,0,size])for(const oy of [-size,0,size]){
   const cx=st.x+ox,cy=st.y+oy,R=st.rad;if(cx<-R*2||cx>size+R*2||cy<-R*2||cy>size+R*2)continue;
   g.save();g.translate(cx,cy);g.rotate(st.a);g.scale(1,st.e);
   g.fillStyle='rgba(35,33,26,.4)';g.beginPath();g.arc(R*.1,R*.22,R*1.06,0,7);g.fill();
   g.fillStyle=st.col;g.beginPath();g.arc(0,0,R,0,7);g.fill();
   const gr=g.createRadialGradient(-R*.35,-R*.45,R*.05,0,0,R);gr.addColorStop(0,'rgba(255,253,245,.45)');gr.addColorStop(.6,'rgba(255,253,245,0)');gr.addColorStop(1,'rgba(20,18,12,.25)');
   g.fillStyle=gr;g.beginPath();g.arc(0,0,R,0,7);g.fill();g.restore();
  }
 }
 const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;
 return tex;
}

export function createTerrain(shared,{segX=220,segZ=360}={}){
 const g=new T.PlaneGeometry(TERRAIN.width,TERRAIN.length,segX,segZ);g.rotateX(-Math.PI/2);g.deleteAttribute('uv');
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));
 g.computeVertexNormals();
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.94,metalness:0});
 patchSurface(m,'terrain',shared);
 const mesh=new T.Mesh(g,m);mesh.name='RiverTerrain';mesh.receiveShadow=true;mesh.castShadow=true;
 return mesh;
}
