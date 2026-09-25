import './style.css';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadLatestRoom,animateRoom} from './world/latest-room.js';
import roomUrl from '../assets/room/human-room.glb?url';

import {characterDefinitions} from './characters/config.js';
import {createCharacter} from './characters/model.js';
import {characterAssetPaths,loadCharacterVisual} from './characters/gltf.js';
import {installRoomAccessories} from './world/room-accessories.js';
import {installModelingHeadphones,loadActionProps} from './world/action-props.js';
import {prewarmModelingScene} from './world/modeling-screen.js';
import {animatePudding,beginPuddingDrag,loadPudding,movePudding,ownsPudding,releasePudding} from './world/pudding.js';
import puddingUrl from '../assets/props/pudding.glb?url';
import vacuumUrl from '../assets/props/vacuum.glb?url';
import headphonesUrl from '../assets/props/headphones.glb?url';
import musicKeyboardUrl from '../assets/props/music-keyboard.glb?url';
import burgerUrl from '../assets/props/burger.glb?url';
import burgerBite01Url from '../assets/props/burger_bite01.glb?url';
import burgerBite02Url from '../assets/props/burger_bite02.glb?url';
import potatoSingleUrl from '../assets/props/potato-single.glb?url';
import vrGearUrl from '../assets/props/vr-gear.glb?url';
const characterAssets=import.meta.glob('../assets/characters/{chicken,piyokichi,piyomi}.glb',{eager:true,query:'?url',import:'default'});

import {animateCharacter} from './characters/animation.js';
import {LifeSimulation} from './simulation/life.js';
import {createUI} from './ui.js';
import {mountSiteNav} from './nav/site-nav.js';
const scene=new T.Scene();scene.background=new T.Color(0xeaf0e9);scene.fog=new T.Fog(0xeaf0e9,24,60);
const camera=new T.PerspectiveCamera(36,1,.1,100);let controls;function resetCamera(){camera.position.set(13,12,17);controls?.target.set(0,.5,0);controls?.update();}resetCamera();
scene.add(new T.HemisphereLight(0xfffaf1,0x8dafa4,2.5));const sun=new T.DirectionalLight(0xffe7c6,3.2);sun.position.set(-3,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:35});sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xeaf0e9,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.48;ground.receiveShadow=true;scene.add(ground);
const furniture=await loadLatestRoom(scene,roomUrl);
const actionProps=await loadActionProps(scene,furniture,{vacuum:vacuumUrl,headphones:headphonesUrl,'music-keyboard':musicKeyboardUrl,burger:burgerUrl,burger_bite01:burgerBite01Url,burger_bite02:burgerBite02Url,'potato-single':potatoSingleUrl,'vr-gear':vrGearUrl});
const characters=characterDefinitions.map(createCharacter);characters.forEach(c=>{scene.add(c.root);c.visualReady=loadCharacterVisual(c,characterAssets[characterAssetPaths[c.variant]]);c.vrVisualReady=c.visualReady.then(()=>{installRoomAccessories(c,furniture);if(c.id==='piyo')installModelingHeadphones(c,actionProps.headphones);});});
const pudding=await loadPudding(scene,puddingUrl,furniture.find(f=>f.id==='table'));
let ui;const simulation=new LifeSimulation(characters,furniture,message=>ui?.event(message));ui=createUI(characters,furniture,simulation,resetCamera);mountSiteNav(document.querySelector('header .brand'),'house');
const host=document.querySelector('#canvas-host');let renderer;
try{renderer=new T.WebGLRenderer({antialias:true});}catch(error){host.innerHTML='<p class="webgl-error">3D表示を開始できませんでした。ブラウザのハードウェアアクセラレーションを有効にして再読み込みしてください。</p>';throw error;}
renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.appendChild(renderer.domElement);
// モデリング用の画面・ホログラムのシェーダーを先にコンパイルしておく（初回表示のカクつき防止）。
prewarmModelingScene(renderer,scene,camera,furniture.find(f=>f.id==='desk'));
controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.5,0);controls.minDistance=9;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.15;controls.update();
const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
const raycaster=new T.Raycaster(),pointer=new T.Vector2(),floorPlane=new T.Plane(new T.Vector3(0,1,0),0),floorPoint=new T.Vector3();
const ownerOf=object=>characters.find(c=>{for(let n=object;n;n=n.parent)if(n===c.root)return true;return false;});
let down=null,drag=null,puddingPointer=null;
const aimPointer=e=>{
 const rect=host.getBoundingClientRect();
 pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
 raycaster.setFromCamera(pointer,camera);
};
const visibleHit=hits=>hits.find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
renderer.domElement.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;down=[e.clientX,e.clientY];aimPointer(e);
 const puddingHit=pudding&&visibleHit(raycaster.intersectObject(pudding.root,true));
 if(puddingHit&&ownsPudding(pudding,puddingHit.object)&&beginPuddingDrag(pudding,raycaster.ray,camera)){
  puddingPointer=e.pointerId;controls.enabled=false;renderer.domElement.style.cursor='grabbing';
  renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();return;
 }
 const person=visibleHit(raycaster.intersectObjects(characters.map(c=>c.root),true));
 if(!person)return;
 const c=ownerOf(person.object);ui.selectCharacter(c.id);
 drag={c,id:e.pointerId,active:false};controls.enabled=false;
 renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();
},{capture:true});
renderer.domElement.addEventListener('pointermove',e=>{
 if(puddingPointer===e.pointerId){aimPointer(e);movePudding(pudding,raycaster.ray);return;}
 if(!drag||e.pointerId!==drag.id)return;
 if(!drag.active&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>6){simulation.beginDrag(drag.c);drag.active=true;}
 if(!drag.active)return;
 aimPointer(e);
 if(raycaster.ray.intersectPlane(floorPlane,floorPoint)){
  const valid=simulation.dragTo(drag.c,floorPoint.toArray());renderer.domElement.style.cursor=valid?'grabbing':'not-allowed';
 }
});
const releasePuddingPointer=e=>{
 if(puddingPointer!==e.pointerId)return false;
 releasePudding(pudding);const id=puddingPointer;puddingPointer=null;down=null;controls.enabled=true;renderer.domElement.style.cursor='';
 if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);
 return true;
};
const releaseDrag=(e,cancel=false)=>{
 if(!drag||e.pointerId!==drag.id)return false;
 if(drag.active)simulation.endDrag(drag.c,cancel);
 const id=drag.id;drag=null;down=null;controls.enabled=true;renderer.domElement.style.cursor='';
 if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);
 return true;
};
renderer.domElement.addEventListener('pointercancel',e=>{releasePuddingPointer(e);releaseDrag(e,true);});
renderer.domElement.addEventListener('lostpointercapture',e=>{releasePuddingPointer(e);releaseDrag(e,true);});
renderer.domElement.addEventListener('pointerup',e=>{
 if(releasePuddingPointer(e))return;
 if(releaseDrag(e))return;
 if(e.button!==0||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6){down=null;return;}
 down=null;aimPointer(e);
 const hit=visibleHit(raycaster.intersectObjects(furniture.map(f=>f.group),true));
 if(hit)ui.selectFurniture(hit.object.userData.furnitureId);
});
const clock=new T.Clock();let uiElapsed=0;renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);simulation.update(dt);characters.forEach(c=>animateCharacter(c,simulation.time));animateRoom(furniture,characters,simulation.time);animatePudding(pudding,dt);controls.update();renderer.render(scene,camera);uiElapsed+=dt;if(uiElapsed>.2){ui.update();uiElapsed=0;}});
