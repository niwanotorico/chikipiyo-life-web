import {noiseGLSL,causticGLSL} from './shaders.js';

const TERRAIN_COLOR=`{
 vec3 wp=vWP;float slope=1.-clamp(vWN.y,0.,1.);
 vec3 peb=texture2D(uPebble,wp.xz*.2).rgb;vec3 peb2=texture2D(uPebble,wp.xz*.061+vec2(.3,.7)).rgb;
 vec3 bed=mix(peb,peb2,.4);
 float n1=fbm3(wp.xz*.12),n2=vnoise(wp.xz*1.3);
 vec3 grass=mix(vec3(.045,.09,.02),vec3(.15,.21,.05),n1)*(.75+.5*n2);
 vec3 soil=vec3(.22,.18,.13)*(.8+.4*n2);
 vec3 rock=mix(vec3(.33,.32,.29),vec3(.52,.51,.47),fbm3(wp.xz*.6+wp.y*.3));
 float gw=smoothstep(.75,1.7,wp.y+(n1-.5)*1.6);
 vec3 col=mix(bed,mix(soil,grass,smoothstep(.25,.55,n1+.15)),gw);
 col=mix(col,rock,smoothstep(.5,.75,slope+(n2-.5)*.2)*smoothstep(1.,2.5,wp.y));
 col*=mix(.62,1.,smoothstep(-.02,.3,wp.y));
 col*=mix(vec3(.68,.72,.55),vec3(1.),smoothstep(-.6,-.05,wp.y)*.5+smoothstep(-.05,.05,wp.y)*.5);
 diffuseColor.rgb*=col;
}`;
const ROCK_COLOR=`{
 float mn=vnoise(vWP.xz*1.7+vWP.y*2.);
 float moss=smoothstep(.5,.85,vWN.y+(mn-.5)*.55)*smoothstep(.35,.9,vWP.y);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.21,.045)*(.7+.6*mn),moss*.92);
 diffuseColor.rgb*=mix(.55,1.,smoothstep(-.03,.28,vWP.y));
}`;
const UNDERWATER=`
if(vWP.y<0.){
 float d=-vWP.y;
 outgoingLight*=exp(-vec3(.42,.10,.085)*d*1.35);
 float c=caustic(vWP.xz*.33+vec2(uTime*.05,uTime*.16),uTime*.55);
 c+=.6*caustic(vWP.xz*.21-vec2(uTime*.07,-uTime*.05)+3.1,uTime*.43);
 c=min(c,1.3);
 outgoingLight+=diffuseColor.rgb*uSunCol*c*.75*smoothstep(.05,.35,d)*exp(-d*.3)*max(vWN.y,0.);
}
`;

// Adds world-space varyings, procedural colouring and underwater absorption + caustics.
export function patchSurface(mat,kind,shared){
 mat.customProgramCacheKey=()=>'river-surface-'+kind;
 mat.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,{uTime:shared.uTime,uSunCol:shared.uSunCol,uPebble:shared.uPebble});
  sh.vertexShader=sh.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;')
   .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
{vec4 q=vec4(transformed,1.);vec3 nn=objectNormal;
#ifdef USE_INSTANCING
q=instanceMatrix*q;nn=mat3(instanceMatrix)*nn;
#endif
q=modelMatrix*q;vWP=q.xyz;vWN=normalize(mat3(modelMatrix)*nn);}`);
  sh.fragmentShader=sh.fragmentShader
   .replace('#include <common>',`#include <common>
uniform float uTime;uniform vec3 uSunCol;uniform sampler2D uPebble;varying vec3 vWP;varying vec3 vWN;
${noiseGLSL}${causticGLSL}`)
   .replace('#include <color_fragment>','#include <color_fragment>\n'+(kind==='terrain'?TERRAIN_COLOR:kind==='rock'?ROCK_COLOR:''))
   .replace('#include <opaque_fragment>',UNDERWATER+'#include <opaque_fragment>');
 };
}

// Gentle wind sway for instanced foliage.
export function patchWind(mat,shared,{amp=1,base=1,key='wind'}={}){
 mat.customProgramCacheKey=()=>'river-'+key;
 mat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=shared.uTime;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
{float sw=max(transformed.y-${base.toFixed(2)},0.)*${amp.toFixed(3)};vec3 ip=vec3(0);
#ifdef USE_INSTANCING
ip=instanceMatrix[3].xyz;
#endif
float ph=ip.x*.37+ip.z*.23;
transformed.x+=(sin(uTime*1.3+ph)+.4*sin(uTime*3.1+ph*2.))*sw;
transformed.z+=cos(uTime*1.05+ph*1.3)*sw*.7;}`);
 };
}

// Instanced trees/bushes: the same gentle sway plus a soft world-space "leaf" mottling,
// so the low-poly clumps read as foliage instead of smooth blobs (no textures, no extra draws).
export function patchFoliage(mat,shared,{amp=.016,base=1.6}={}){
 mat.customProgramCacheKey=()=>'river-foliage';
 mat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=shared.uTime;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;varying vec3 vFW;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
{float sw=max(transformed.y-${base.toFixed(2)},0.)*${amp.toFixed(3)};vec3 ip=vec3(0);
#ifdef USE_INSTANCING
ip=instanceMatrix[3].xyz;
#endif
float ph=ip.x*.37+ip.z*.23;
transformed.x+=(sin(uTime*1.3+ph)+.4*sin(uTime*3.1+ph*2.))*sw;
transformed.z+=cos(uTime*1.05+ph*1.3)*sw*.7;}`)
   .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
{vec4 q=vec4(transformed,1.);
#ifdef USE_INSTANCING
q=instanceMatrix*q;
#endif
vFW=(modelMatrix*q).xyz;}`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vFW;
${noiseGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
{vec3 w=vFW*6.5;float a=vnoise(w.xz+w.y*.7),b=vnoise(w.zy*1.3+w.x*.5+4.1);
float leaf=smoothstep(.3,.7,a*.55+b*.45);             // small leaf clusters with darker gaps
float big=vnoise(vFW.xz*.9+vFW.y*.6);                  // broader light/dark patches
diffuseColor.rgb*=(.73+.42*leaf)*(.9+.2*big);}`);
 };
}
