import * as T from 'three';
import {noiseGLSL,causticGLSL} from './shaders.js';
import {seasonUniforms,seasonGLSL} from './seasons.js';

// 地面：河原の小石 → 土 → 草 → 崖の岩。色は季節の uniform（uS*）で決まる
const TERRAIN_COLOR=`{
 vec3 wp=vWP;float slope=1.-clamp(vWN.y,0.,1.);
 vec3 peb=texture2D(uPebble,wp.xz*.2).rgb;vec3 peb2=texture2D(uPebble,wp.xz*.061+vec2(.3,.7)).rgb;
 vec3 bed=mix(peb,peb2,.4)*uSBedTint;
 float n1=fbm3(wp.xz*.12),n2=vnoise(wp.xz*1.3);
 vec3 grass=mix(uSGrassDark,uSGrassLight,n1)*(.75+.5*n2);
 vec3 soil=vec3(.22,.18,.13)*(.8+.4*n2);
 vec3 rock=mix(vec3(.33,.32,.29),vec3(.52,.51,.47),fbm3(wp.xz*.6+wp.y*.3));
 float gw=smoothstep(.75,1.7,wp.y+(n1-.5)*1.6);
 vec3 col=mix(bed,mix(soil,grass,smoothstep(.25,.55,n1+.15)),gw);
 float cliff=smoothstep(.5,.75,slope+(n2-.5)*.2)*smoothstep(1.,2.5,wp.y);
 col=mix(col,rock,cliff);
 // 春：草地にぽつぽつ小さな花（桃・黄・薄紫。白は雪に見えるので使わない）
 if(uSFlowers>.001){                                   // 季節の飾りは uniform で分岐（使わない季節は計算しない＝Quest でも軽い）
 float fl=uSFlowers*gw*(1.-cliff)*(1.-smoothstep(.15,.3,slope))*(1.-smoothstep(4.,7.,wp.y))*smoothstep(.84,.95,vnoise(wp.xz*6.3))*smoothstep(.4,.7,fbm3(wp.xz*.23+4.));
 float fc=vnoise(wp.xz*1.7+9.);
 col=mix(col,fc<.45?vec3(.8,.42,.55):fc<.75?vec3(.78,.6,.07):vec3(.5,.36,.7),fl*.9);}
 // 秋：岸・草地に落ち葉の吹きだまり（赤・橙・黄が混ざる）
 if(uSLitter>.001){
 float lt=min(1.,uSLitter*4.)*(1.-cliff)*(1.-smoothstep(.2,.4,slope))*smoothstep(.02,.35,wp.y)*smoothstep(.5,.78,vnoise(wp.xz*1.6)*.55+vnoise(wp.xz*.33+2.)*.45-(1.-uSLitter)*.32);
 float lc=vnoise(wp.xz*5.+1.3);
 vec3 lcol=mix(mix(vec3(.36,.045,.02),vec3(.5,.17,.025),smoothstep(.25,.5,lc)),vec3(.52,.36,.05),smoothstep(.55,.8,lc));
 col=mix(col,lcol*(.65+.6*vnoise(wp.xz*14.)),lt*.9);}
 col*=mix(.62,1.,smoothstep(-.02,.3,wp.y));
 col*=mix(vec3(.68,.72,.55),vec3(1.),smoothstep(-.6,-.05,wp.y)*.5+smoothstep(-.05,.05,wp.y)*.5);
 // 冬：上を向いた所にだけ、まだらに積もる（崖・水ぎわ・水中には積もらない）
 if(uSSnow>.001){
 float sm=fbm3(wp.xz*.26+5.)*.75+vnoise(wp.xz*.9+2.)*.25;
 float sn=min(1.,uSSnow*5.)*smoothstep(.46,.62,sm+(vWN.y-.9)*1.2-(1.-uSSnow)*.4)*smoothstep(.7,.92,vWN.y+(n2-.5)*.1)*smoothstep(.3,1.1,wp.y+(n2-.5)*.4);
 col=mix(col,vec3(.64,.68,.74)*(.94+.06*n2),sn);}
 diffuseColor.rgb*=col;
}`;
// 岩：季節で地の色・苔の色を変え、秋は上面に落ち葉、冬は上面に雪
const ROCK_COLOR=`{
 diffuseColor.rgb*=uSRockTint;
 float mn=vnoise(vWP.xz*1.7+vWP.y*2.);
 float moss=smoothstep(.5,.85,vWN.y+(mn-.5)*.55)*smoothstep(.35,.9,vWP.y);
 diffuseColor.rgb=mix(diffuseColor.rgb,uSMoss*(.7+.6*mn),moss*.92);
 float lt=min(1.,uSLitter*4.)*smoothstep(.55,.85,vWN.y)*smoothstep(.55,.8,vnoise(vWP.xz*2.6+vWP.y)-(1.-uSLitter)*.3)*smoothstep(.02,.15,vWP.y);
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.4,.07,.02),vec3(.5,.3,.04),vnoise(vWP.xz*9.)),lt*.9);
 float sn=min(1.,uSSnow*5.)*smoothstep(.42,.75,vWN.y+(mn-.5)*.45-(1.-uSSnow)*.5)*smoothstep(.04,.22,vWP.y);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.74,.78,.84),sn);
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
  Object.assign(sh.uniforms,{uTime:shared.uTime,uSunCol:shared.uSunCol,uPebble:shared.uPebble},seasonUniforms(shared));
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
${seasonGLSL}${noiseGLSL}${causticGLSL}`)
   .replace('#include <color_fragment>','#include <color_fragment>\n'+(kind==='terrain'?TERRAIN_COLOR:kind==='rock'?ROCK_COLOR:''))
   .replace('#include <opaque_fragment>',UNDERWATER+'#include <opaque_fragment>');
 };
}

// 木・草のインスタンス位置からの 0〜1 の乱数（季節の色分け・間引きに使う。LOD の並べ替えでも変わらない）
const INSTANCE_HASH=`float instHash(){vec3 ip=vec3(0);
#ifdef USE_INSTANCING
ip=instanceMatrix[3].xyz;
#endif
return fract(sin(dot(floor(ip.xz*4.),vec2(12.9898,78.233)))*43758.5453);}`;
const SWAY=(amp,base)=>`{float sw=max(transformed.y-${base.toFixed(2)},0.)*${amp.toFixed(3)};vec3 ip=vec3(0);
#ifdef USE_INSTANCING
ip=instanceMatrix[3].xyz;
#endif
float ph=ip.x*.37+ip.z*.23;
transformed.x+=(sin(uTime*1.3+ph)+.4*sin(uTime*3.1+ph*2.))*sw;
transformed.z+=cos(uTime*1.05+ph*1.3)*sw*.7;}`;
// 1 つの葉房（aLeaf が同じ頂点）を 1 点に潰す＝その葉房は描かれない。影用の depth でも同じことをする
const LEAF_BARE=`if(aLeaf>0.&&uEvergreen<.5)transformed=mix(aCenter,transformed,1.-uSBare*.5);`;
const LEAF_DROP=`if(aLeaf>0.&&uEvergreen<.5&&fract(aLeaf*7.31+vInstH*3.17)>uSLeafKeep)transformed=vec3(0.,-60.,0.);`;
const GRASS_DROP=`if(vInstH>uSGrassKeep)transformed=vec3(0.,-60.,0.);`;

// 草むら：風で揺れる＋季節の色（春は若草、秋は穂が色づき、冬は枯れ草で数も減る）
export function patchWind(mat,shared,{amp=1,base=1,key='wind'}={}){
 mat.customProgramCacheKey=()=>'river-'+key;
 mat.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,{uTime:shared.uTime},seasonUniforms(shared));
  sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
uniform float uTime;varying float vInstH;${seasonGLSL}${INSTANCE_HASH}`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
vInstH=instHash();
${SWAY(amp,base)}
${GRASS_DROP}`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
varying float vInstH;${seasonGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
{vec3 c=diffuseColor.rgb*uSGrassMul;float l=dot(c,vec3(.2126,.7152,.0722));
vec3 straw=mix(vec3(.5,.36,.15),vec3(.62,.52,.3),vInstH)*l*2.3;
diffuseColor.rgb=mix(c,straw,uSGrassDry*(.7+.3*fract(vInstH*5.1)));}`);
 };
}

// 木・低木の葉：揺れ＋葉の模様（テクスチャなし）＋季節。
//  aLeaf … 0＝幹・枝、>0＝葉房ごとの乱数。evergreen … 杉・モミ（冬も葉が残る）
export function patchFoliage(mat,shared,{amp=.016,base=1.6,evergreen=false}={}){
 mat.customProgramCacheKey=()=>'river-foliage';
 mat.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,{uTime:shared.uTime,uEvergreen:{value:evergreen?1:0}},seasonUniforms(shared));
  sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
uniform float uTime;uniform float uEvergreen;attribute float aLeaf;attribute vec3 aCenter;varying vec3 vFW;varying vec3 vFN;varying float vLeaf;varying float vInstH;${seasonGLSL}${INSTANCE_HASH}`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
vInstH=instHash();vLeaf=aLeaf;
${LEAF_BARE}
${SWAY(amp,base)}
${LEAF_DROP}`)
   .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
{vec4 q=vec4(transformed,1.);vec3 nn=objectNormal;
#ifdef USE_INSTANCING
q=instanceMatrix*q;nn=mat3(instanceMatrix)*nn;
#endif
vFW=(modelMatrix*q).xyz;vFN=normalize(mat3(modelMatrix)*nn);}`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform float uEvergreen;varying vec3 vFW;varying vec3 vFN;varying float vLeaf;varying float vInstH;
${seasonGLSL}${noiseGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
{vec3 w=vFW*6.5;float a=vnoise(w.xz+w.y*.7),b=vnoise(w.zy*1.3+w.x*.5+4.1);
float leaf=smoothstep(.3,.7,a*.55+b*.45);             // small leaf clusters with darker gaps
float big=vnoise(vFW.xz*.9+vFW.y*.6);                  // broader light/dark patches
vec3 c=diffuseColor.rgb;
if(vLeaf>0.){
 float l=dot(c,vec3(.2126,.7152,.0722)),k=clamp(l/.085,.2,1.9); // 元の陰影（葉房の日向・日陰）を残して色だけ替える
 float cl=fract(vLeaf*5.37);                                      // 葉房ごとの乱数
 if(uEvergreen>.5)c*=uSNeedleTint;
 else{
  c*=uSLeafShift;
  // 春：ところどころ桜（木ごと）。花の間に若葉が少し混ざる
  vec3 pink=mix(vec3(.66,.24,.34),vec3(.8,.44,.52),cl)*k;
  // 注意：step() で判定すると、ハッシュがちょうど 0 になる木（約 1/256）が夏・秋でも桜色になっていた。厳密な < で判定する
  c=mix(c,pink,float(vInstH<uSBlossom)*step(.22,cl));
  // 秋：木ごとに赤・橙・黄・まだ緑を振り分け、葉房ごとに隣の色へ少しずらす
  float h=fract(vInstH*13.7+cl*.35);
  vec3 au=h<.26?vec3(.34,.03,.018):h<.52?vec3(.46,.12,.02):h<.8?vec3(.5,.32,.035):vec3(.2,.2,.04);
  // 色づきは木ごとに順番がある：黄色の木が先、橙、赤は最後。同じ木でも葉房ごとに少しずれる（9 月はちらほら → 11 月に満開）
  // 色づく順番：黄緑（まだ緑の木）が最初 → 黄色 → 橙 → 赤は最後。同じ色の木どうしでも時期をばらす
  // 9 月末（uSAutumn≈.2）は黄緑が少しと黄色がごく少数、10 月末（≈.6）は黄・橙、11 月（1）で赤まで
  float r=fract(vInstH*7.9);
  float d=h<.26?.5+r*.1:h<.52?.34+r*.2:h<.8?.08+r*.38:r*.12;
  d+=cl*.05;
  c=mix(c,au*k,smoothstep(d,d+.34,uSAutumn));
  // 冬：葉の落ちた小枝のかたまり（灰色がかった茶）。すき間から向こうが透けて見える
  c=mix(c,mix(vec3(.12,.1,.085),vec3(.16,.125,.095),cl)*k,uSDry);
 }
}
if(vLeaf>0.&&uEvergreen<.5&&uSBare>.01&&vnoise(vFW.xz*4.3+vFW.y*3.1+vLeaf*9.)<uSBare*.58)discard;
diffuseColor.rgb=c*(.73+.42*leaf)*(.9+.2*big);
// 冬：葉房・枝の上面に雪
float sn=min(1.,uSSnow*5.)*smoothstep(.35,.75,vFN.y+(a-.5)*.5-(1.-uSSnow)*.5)*(vLeaf>0.?1.:.6);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.74,.78,.84),sn);}`);
 };
}

// 木の影：葉を散らした分だけ影も減らす（通常の影は葉の間引きを知らないため）
export function foliageDepthMaterial(shared,{amp=.016,base=1.6,evergreen=false}={}){
 const m=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
 m.customProgramCacheKey=()=>'river-foliage-depth';
 m.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,{uTime:shared.uTime,uEvergreen:{value:evergreen?1:0}},seasonUniforms(shared));
  sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
uniform float uTime;uniform float uEvergreen;attribute float aLeaf;attribute vec3 aCenter;float vInstH;${seasonGLSL}${INSTANCE_HASH}`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
vInstH=instHash();
${LEAF_BARE}
${SWAY(amp,base)}
${LEAF_DROP}`);
 };
 return m;
}
