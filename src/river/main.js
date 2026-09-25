import './river.css';
import {mountSiteNav} from '../nav/site-nav.js';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {createTerrain,makePebbleTexture,heightAt,riverCenter,WATER_Y} from './terrain.js';
import {createRocks} from './rocks.js';
import {createVegetation} from './vegetation.js';
import {createWater} from './water.js';
import {createFish} from './fish.js';
import {createFishing,fishingSpot} from './fishing.js';
import {createRiverAudio} from './river-audio.js';
import {createRiverSfx} from './river-sfx.js';

mountSiteNav(document.body,'river',{position:'beforeend',variant:'floating'});
const params=new URLSearchParams(location.search);
// 画質：スマホ・Quest（ブラウザ内の Quest も含む）は軽量設定。?quality=high / low で上書きできる
const quest=/OculusBrowser|Quest|Pico/i.test(navigator.userAgent);
const touch=matchMedia('(pointer:coarse)').matches||innerWidth<760;
const quality=params.get('quality');
const mobile=quality==='high'?false:quality==='low'?true:(touch||quest);
const xrProfile={xrScale:+(params.get('xrscale')||(quest?.9:1)),xrSamples:params.has('msaa')?+params.get('msaa'):(quest?2:4)};
const app=document.getElementById('app');
const renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.78;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene=new T.Scene();
const sunDir=new T.Vector3(-.42,.78,-.46).normalize();
const sunCol=new T.Color(0xfff0d8);
const shared={uTime:{value:0},uSunCol:{value:sunCol.clone().multiplyScalar(2.3)},uPebble:{value:makePebbleTexture(mobile?512:1024)}};
shared.uPebble.value.anisotropy=renderer.capabilities.getMaxAnisotropy();

// sky + image based lighting
const sky=new Sky();sky.scale.setScalar(1400);
sky.material.uniforms.turbidity.value=2.2;sky.material.uniforms.rayleigh.value=1.7;
sky.material.uniforms.mieCoefficient.value=.004;sky.material.uniforms.mieDirectionalG.value=.82;sky.material.uniforms.sunPosition.value.copy(sunDir);
scene.add(sky);
{const envScene=new T.Scene(),s2=new Sky();s2.scale.setScalar(50);for(const k in sky.material.uniforms)s2.material.uniforms[k].value=sky.material.uniforms[k].value;envScene.add(s2);
 const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(envScene,0,.1,100).texture;scene.environmentIntensity=.55;pm.dispose();}
scene.fog=new T.FogExp2(0xaec8cc,.0048);

const focus=new T.Vector3(riverCenter(66),0,66);
const sun=new T.DirectionalLight(sunCol,3.1);sun.position.copy(focus).addScaledVector(sunDir,140);sun.target.position.copy(focus);
sun.castShadow=true;sun.shadow.mapSize.setScalar(mobile?2048:4096);
Object.assign(sun.shadow.camera,{left:-62,right:62,top:62,bottom:-62,near:10,far:320});sun.shadow.bias=-.0003;sun.shadow.normalBias=.06;
scene.add(sun,sun.target,new T.HemisphereLight(0xd6e8ff,0x3a4a26,.3));

// world
const spot=fishingSpot();
scene.add(createTerrain(shared,mobile?{segX:160,segZ:260}:{}));
const rocks=createRocks(shared,{mobile,clear:spot.clear});scene.add(rocks.group);
const vegetation=createVegetation(shared,{mobile,clear:spot.clear,focus:spot.camera.target,viewer:spot.camera.position});scene.add(vegetation);
const fish=createFish(shared,{count:mobile?10:16,extraHomes:spot.fishHomes});scene.add(fish.group);

// camera
const camera=new T.PerspectiveCamera(48,1,.2,1800);
camera.position.copy(spot.camera.position);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.copy(spot.camera.target);controls.enableDamping=true;controls.dampingFactor=.07;
controls.maxPolarAngle=Math.PI*.495;controls.minDistance=2.5;controls.maxDistance=70;controls.screenSpacePanning=false;controls.update();
// 川のせせらぎ（assets/audio/river-stream.* がある時だけ。最初の操作で鳴り始める）
const riverAudio=createRiverAudio({camera,scene,mobile});
// 釣りの効果音（着水・釣り上げ・リリース）。せせらぎと同じ耳（AudioListener）を使う
const sfx=createRiverSfx({camera,scene,mobile,listener:riverAudio?riverAudio.listener:null});

// two pass render: opaque world -> target, then (blit + refractive water) to screen
const depthTexture=new T.DepthTexture(1,1);
const rt=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:mobile?0:4,depthTexture});
const water=createWater({rt,camera,sunDir,sunCol:shared.uSunCol.value,foam:rocks.foam,mobile});
const screenScene=new T.Scene();screenScene.fog=scene.fog;
const blit=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
 uniforms:{tMap:{value:rt.texture},uScreen:water.material.uniforms.uScreen},depthTest:false,depthWrite:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 // gl_FragCoord で読む：VR（左右の目が並んだ 1 枚のターゲット）でも通常画面でも同じ位置を取れる
 fragmentShader:'uniform sampler2D tMap;uniform vec2 uScreen;varying vec2 vUv;void main(){gl_FragColor=texture2D(tMap,gl_FragCoord.xy/uScreen);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));
blit.frustumCulled=false;blit.renderOrder=-1;screenScene.add(blit,water);

// ちきんとぴよこたちの釣り
const counts=document.querySelectorAll('[data-count]');
const fishing=createFishing({scene,fish,camera,dom:renderer.domElement,shared,onEvent:(type,a,pos)=>sfx.play(type,pos),onScore:(id,n)=>{for(const el of counts)if(el.dataset.count===id){el.textContent=n;el.parentElement.classList.remove('pop');void el.offsetWidth;el.parentElement.classList.add('pop');}}});

function resize(){
 if(renderer.xr.isPresenting)return; // VR 中のサイズは WebXR が決める
 const w=app.clientWidth||innerWidth,h=app.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 const v=renderer.getDrawingBufferSize(new T.Vector2());rt.setSize(v.x,v.y);water.material.uniforms.uScreen.value.copy(v);
}
addEventListener('resize',resize);resize();

function constrain(){
 const t=controls.target;t.x=T.MathUtils.clamp(t.x,-60,60);t.z=T.MathUtils.clamp(t.z,-110,125);t.y=T.MathUtils.clamp(t.y,heightAt(t.x,t.z)+.1,heightAt(t.x,t.z)+4);
 const p=camera.position,g=Math.max(heightAt(p.x,p.z),WATER_Y)+.45;if(p.y<g)p.y=g;
}

// WebXR：対応ブラウザ（Meta Quest など）でだけ VR 用コードを読み込み「VRで入る」ボタンを出す。?xr で強制表示
let xr=null;
if(navigator.xr&&navigator.xr.isSessionSupported)navigator.xr.isSessionSupported('immersive-vr').catch(()=>false).then(ok=>{
 if(!ok&&!params.has('xr'))return;
 return import('./xr-river.js').then(m=>{xr=m.mountRiverXR({renderer,scene,camera,controls,rt,water,sun,sunDir,fishing,spot,profile:xrProfile,onExit:resize});window.__river.xr=xr;});
}).catch(e=>console.warn('[river-xr]',e));

const clock=new T.Clock(),eye=new T.Vector3();
function frame(dt){
 shared.uTime.value+=dt;water.material.uniforms.uTime.value=shared.uTime.value;
 fish.update(dt,shared.uTime.value);fishing.update(dt,shared.uTime.value);
 if(renderer.xr.isPresenting&&xr)xr.update(dt);else{controls.update();constrain();}
 vegetation.userData.update(camera.getWorldPosition(eye));
 if(riverAudio)riverAudio.update(dt);
 // 描画先：通常は画面（null）、VR 中は WebXR のフレームバッファ。中間ターゲットの大きさをそれに合わせる
 const out=renderer.getRenderTarget();
 if(out&&(rt.width!==out.width||rt.height!==out.height)){rt.setSize(out.width,out.height);water.material.uniforms.uScreen.value.set(out.width,out.height);}
 renderer.setRenderTarget(rt);renderer.render(scene,camera);
 renderer.setRenderTarget(out);renderer.render(screenScene,camera);
 document.body.classList.add('ready');
}
window.__river={scene,camera,controls,fish,fishing,renderer,frame,water,vegetation,xr,riverAudio,sfx};
if(!params.has('still'))renderer.setAnimationLoop(()=>frame(Math.min(clock.getDelta(),.05)));
