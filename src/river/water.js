import * as T from 'three';
import {noiseGLSL} from './shaders.js';
import {heightAt,flowAt,riverCenter,riverHalfWidth,WATER_Y,TERRAIN} from './terrain.js';

const MAX_ROCKS=40;

const vert=`
attribute float aDepth;attribute vec2 aFlow;
varying vec3 vW;varying float vDepth;varying vec2 vFlow;varying float vViewZ;
#include <fog_pars_vertex>
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vDepth=aDepth;vFlow=aFlow;
 vec4 mvPosition=viewMatrix*w;vViewZ=-mvPosition.z;gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
const frag=`
#include <packing>
#include <fog_pars_fragment>
uniform sampler2D uScene;uniform sampler2D uDepth;uniform vec2 uScreen;uniform float uNear,uFar,uTime;
uniform vec3 uSunDir,uSunCol,uSkyTop,uSkyHorizon,uCanyon,uDeep,uShallow;
uniform vec3 uRocks[${MAX_ROCKS}];uniform int uRockCount;
varying vec3 vW;varying float vDepth;varying vec2 vFlow;varying float vViewZ;
${noiseGLSL}
float sceneZ(vec2 uv){return -perspectiveDepthToViewZ(texture2D(uDepth,uv).x,uNear,uFar);}
float waves(vec2 p,vec2 flow,float t){
 float s=vnoise(p*1.1-flow*t*1.1)*.55+vnoise(p*2.3+vec2(3.1,1.7)-flow*t*1.6)*.3+vnoise(p*5.1+vec2(7.,2.)-flow*t*2.2)*.15;
 return s;
}
float wavesFlow(vec2 p,vec2 flow){
 // two-phase flow-map sampling keeps the ripples moving downstream without stretching
 float t=uTime*.5,ph0=fract(t),ph1=fract(t+.5),wgt=abs(ph0*2.-1.);
 return mix(waves(p,flow,ph0*2.+floor(t)*0.),waves(p+vec2(.37,.61),flow,ph1*2.),wgt);
}
void main(){
 vec2 suv=gl_FragCoord.xy/uScreen;
 float sz=sceneZ(suv);
 if(sz<vViewZ-.02)discard;                 // manual depth test against the opaque pass
 vec2 flow=vFlow;float speed=length(flow);
 float shallow=1.-smoothstep(.05,1.2,vDepth);
 vec2 p=vW.xz;
 float e=.06;
 float h0=wavesFlow(p,flow),hx=wavesFlow(p+vec2(e,0),flow),hz=wavesFlow(p+vec2(0,e),flow);
 float amp=mix(.07,.42,clamp(shallow*speed*.9,0.,1.));
 // fine glitter ripples
 float g0=vnoise(p*9.-flow*uTime*1.8),gx=vnoise((p+vec2(e*.3,0))*9.-flow*uTime*1.8),gz=vnoise((p+vec2(0,e*.3))*9.-flow*uTime*1.8);
 vec3 N=normalize(vec3(-(hx-h0)/e*amp-(gx-g0)/(e*.3)*.012,1.,-(hz-h0)/e*amp-(gz-g0)/(e*.3)*.012));
 vec3 V=normalize(cameraPosition-vW);
 float NoV=max(dot(N,V),0.);
 float fres=.02+.98*pow(1.-NoV,5.);
 // refraction with bleed-guard
 float thick0=max(sz-vViewZ,0.);
 vec2 off=N.xz*.035*clamp(thick0*.6,0.,1.)*(1./(1.+vViewZ*.03));
 vec2 ruv=suv+off;
 float rz=sceneZ(ruv);if(rz<vViewZ)ruv=suv,rz=sz;
 vec3 refr=texture2D(uScene,ruv).rgb;
 float thick=max(rz-vViewZ,0.);
 refr*=mix(vec3(1.),uShallow,.8*(1.-exp(-thick*.9)));
 refr=mix(refr,uDeep,(1.-exp(-thick*.13))*.8);
 // reflection: sky above, dark forested canyon near the horizon
 vec3 R=reflect(-V,N);
 vec3 sky=mix(uSkyHorizon,uSkyTop,pow(clamp(R.y,0.,1.),.6));
 vec3 refl=mix(uCanyon,sky,smoothstep(.1,.5,R.y+ (vnoise(vW.xz*.05)-.5)*.2));
 float sd=max(dot(R,uSunDir),0.);
 vec3 spec=uSunCol*(pow(sd,900.)*14.+pow(sd,90.)*.35);
 vec3 col=mix(refr,refl,fres)+spec*(.35+.65*NoV);
 // foam: rocks, shallow riffles, shoreline
 float rockF=0.;
 for(int i=0;i<${MAX_ROCKS};i++){if(i>=uRockCount)break;vec3 r=uRocks[i];
  vec2 dv=vW.xz-r.xy;float d=length(dv)-r.z;
  float down=.6+.4*clamp(dot(normalize(dv),normalize(flow+1e-4)),-1.,1.);
  rockF=max(rockF,(1.-smoothstep(0.,.55+.5*down,d))*down);}
 float fn=fbm3(p*2.2-flow*uTime*1.3),fn2=vnoise(p*6.-flow*uTime*2.);
 float zone=smoothstep(.68,.85,vnoise(vec2(vW.z*.05,3.7)));
 float riffle=zone*smoothstep(.15,.35,vDepth)*(1.-smoothstep(.55,.9,vDepth))*.75;
 float shore=1.-smoothstep(-.02,.035,vDepth);
 float foamMask=max(max(rockF,riffle),shore*.35);
 float foam=smoothstep(.45,.75,fn*.7+fn2*.3+foamMask*.55-.25)*foamMask;
 col=mix(col,vec3(.85,.9,.9)*(.6+.4*uSunCol.r*.4),clamp(foam,0.,.85));
 gl_FragColor=vec4(col,1.);
 #include <fog_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function createWater({rt,camera,sunDir,sunCol,foam,mobile=false}){
 const rows=mobile?360:520,cols=mobile?36:56,zMin=-TERRAIN.length/2,zMax=TERRAIN.length/2;
 const pos=[],dep=[],flw=[],idx=[];
 for(let r=0;r<=rows;r++){const z=zMin+(zMax-zMin)*r/rows,c=riverCenter(z),hw=riverHalfWidth(z)+3.5;
  for(let k=0;k<=cols;k++){const x=c+(k/cols*2-1)*hw;pos.push(x,WATER_Y,z);dep.push(WATER_Y-heightAt(x,z));const f=flowAt(x,z);flw.push(f[0],f[1]);}}
 for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){const a=r*(cols+1)+k,b=a+1,c=a+cols+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('aDepth',new T.Float32BufferAttribute(dep,1));g.setAttribute('aFlow',new T.Float32BufferAttribute(flw,2));g.setIndex(idx);g.computeBoundingSphere();
 const rocks=Array.from({length:MAX_ROCKS},(_,i)=>foam[i]?new T.Vector3(...foam[i]):new T.Vector3());
 const mat=new T.ShaderMaterial({
  vertexShader:vert,fragmentShader:frag,fog:true,
  uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{
   uScene:{value:null},uDepth:{value:null},uScreen:{value:new T.Vector2(1,1)},uNear:{value:camera.near},uFar:{value:camera.far},uTime:{value:0},
   uSunDir:{value:sunDir.clone()},uSunCol:{value:sunCol.clone()},
   uSkyTop:{value:new T.Color(0x5d8fc9)},uSkyHorizon:{value:new T.Color(0xcfe0e6)},uCanyon:{value:new T.Color(0x1d2a14)},uDeep:{value:new T.Color(0x13807a)},uShallow:{value:new T.Color(0x9ee8dc)},
   uRocks:{value:rocks},uRockCount:{value:Math.min(foam.length,MAX_ROCKS)}}])
 });
 mat.uniforms.uScene.value=rt.texture;mat.uniforms.uDepth.value=rt.depthTexture;
 const mesh=new T.Mesh(g,mat);mesh.name='RiverWater';mesh.frustumCulled=false;
 return mesh;
}
