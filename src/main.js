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
import {whenXRSupported,xrProfile} from './xr/xr-session.js';
import {mountARButton,dockXRButton} from './ar/ar-dollhouse.js';
import {installCupboard} from './world/cupboard.js';
import {createPassbook} from './points/passbook.js';
import {installBookshelf} from './world/bookshelf.js';
import {createShelfEntry} from './manga/shelf-entry.js';
import {installToramanaVisit} from './world/toramana-visit.js';
const scene=new T.Scene();scene.background=new T.Color(0xeaf0e9);scene.fog=new T.Fog(0xeaf0e9,24,60);
const camera=new T.PerspectiveCamera(36,1,.1,100);let controls;function resetCamera(){camera.position.set(13,12,17);controls?.target.set(0,.5,0);controls?.update();}resetCamera();
scene.add(new T.HemisphereLight(0xfffaf1,0x8dafa4,2.5));const sun=new T.DirectionalLight(0xffe7c6,3.2);sun.position.set(-3,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:35});sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xeaf0e9,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.48;ground.receiveShadow=true;scene.add(ground);
const furniture=await loadLatestRoom(scene,roomUrl);
const actionProps=await loadActionProps(scene,furniture,{vacuum:vacuumUrl,headphones:headphonesUrl,'music-keyboard':musicKeyboardUrl,burger:burgerUrl,burger_bite01:burgerBite01Url,burger_bite02:burgerBite02Url,'potato-single':potatoSingleUrl,'vr-gear':vrGearUrl});
const characters=characterDefinitions.map(createCharacter);characters.forEach(c=>{scene.add(c.root);c.visualReady=loadCharacterVisual(c,characterAssets[characterAssetPaths[c.variant]]);c.vrVisualReady=c.visualReady.then(()=>{installRoomAccessories(c,furniture);if(c.id==='piyo')installModelingHeadphones(c,actionProps.headphones);});});
const pudding=await loadPudding(scene,puddingUrl,furniture.find(f=>f.id==='table'));
// 戸棚の下の扉（hirakiL / hirakiR）。開いている間だけ、中にチキンポイント通帳の入口が出る。
const cupboard=installCupboard(furniture.roomRoot);
let ui;const simulation=new LifeSimulation(characters,furniture,message=>ui?.event(message));ui=createUI(characters,furniture,simulation,resetCamera);mountSiteNav(document.querySelector('header .brand'),'house');mountARButton(document.querySelector('.scene-bottom'));
const host=document.querySelector('#canvas-host');let renderer;
const passbook=cupboard&&createPassbook(document.querySelector('.world'),host);
// 戸棚を閉じたら通帳パネルも閉じる。
cupboard?.onChange(open=>{if(!open)passbook.close();});
// 戸棚の上の段に マンガの本（シリーズごとに1冊）。タップで大きなリーダー。ピヨドリルの記録は読むだけ。
const bookshelf=installBookshelf(furniture.roomRoot);
const shelf=bookshelf&&createShelfEntry(document.querySelector('.world'),host);
// トラマナちゃん：ピヨ探検で ひらいた子が いるときだけ 読みこんで 部屋に 出す。タップで ひとこと
const toramana=installToramanaVisit(scene,{onSay:message=>ui.event(message)});
try{renderer=new T.WebGLRenderer({antialias:true});}catch(error){host.innerHTML='<p class="webgl-error">3D表示を開始できませんでした。ブラウザのハードウェアアクセラレーションを有効にして再読み込みしてください。</p>';throw error;}
renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.appendChild(renderer.domElement);
// モデリング用の画面・ホログラムのシェーダーを先にコンパイルしておく（初回表示のカクつき防止）。
prewarmModelingScene(renderer,scene,camera,furniture.find(f=>f.id==='desk'));
controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.5,0);controls.minDistance=9;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.15;controls.update();
const resize=()=>{if(renderer.xr.isPresenting)return;/* VR 中のサイズは WebXR が決める */const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
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
// 本だな：PC で カーソルを合わせている あいだだけ ラベルを出し、本を すこし明るくする。
// ボタンを おしたまま（カメラを回すドラッグなど）のときは 出さない。手前に 家具やキャラが あるときも 出さない。
const shelfRay=new T.Raycaster(),shelfPointer=new T.Vector2();let shelfMove=null;
function hoverShelf(){
 const e=shelfMove;shelfMove=null;if(!e||!shelf)return;
 const rect=host.getBoundingClientRect();
 shelfPointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);shelfRay.setFromCamera(shelfPointer,camera);
 let on=bookshelf.hit(shelfRay);
 if(on){const front=visibleHit(shelfRay.intersectObjects([...furniture.map(f=>f.group),...characters.map(c=>c.root)],true));if(front&&front.distance<on.distance)on=null;}
 shelf.setHover(!!on);bookshelf.highlight(on?.series??null);
 renderer.domElement.style.cursor=on?.series?'pointer':'';
}
renderer.domElement.addEventListener('pointermove',e=>{
 if(shelf&&e.pointerType==='mouse'&&!drag&&puddingPointer==null){
  if(e.buttons===0){if(!shelfMove)requestAnimationFrame(hoverShelf);shelfMove=e;}
  else{shelf.setHover(false);bookshelf.highlight(null);}
 }
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
renderer.domElement.addEventListener('pointerleave',e=>{if(shelf&&e.pointerType==='mouse'){shelfMove=null;shelf.setHover(false);bookshelf.highlight(null);}});
renderer.domElement.addEventListener('pointercancel',e=>{releasePuddingPointer(e);releaseDrag(e,true);});
renderer.domElement.addEventListener('lostpointercapture',e=>{releasePuddingPointer(e);releaseDrag(e,true);});
renderer.domElement.addEventListener('pointerup',e=>{
 if(releasePuddingPointer(e))return;
 if(releaseDrag(e))return;
 if(e.button!==0||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6){down=null;return;}
 down=null;aimPointer(e);
 const hit=visibleHit(raycaster.intersectObjects(furniture.map(f=>f.group),true));
 const tora=toramana.hit(raycaster);
 if(tora&&(!hit||tora.distance<=hit.distance)){toramana.tap();return;}
 // 戸棚の扉・通帳が家具より手前で当たったときだけ戸棚を優先する（上の棚のカメラ等はそのまま家具として選べる）。
 const cup=cupboard?.hit(raycaster);
 // 本だなも同じ：家具や戸棚より手前で当たったときだけ。本なら その本を ひらく。本のない ところなら 本だなを えらぶ（ラベルを出す）。
 // ほかの場所を タップしたら 本だなを えらぶのを やめる（ラベルを かくす）。
 const book=shelf&&bookshelf.hit(raycaster);
 const onShelf=!!book&&(!hit||book.distance<=hit.distance)&&(!cup||book.distance<=cup.distance);
 if(onShelf&&book.series){shelf.open(book.series).catch(e=>console.warn('[manga]',e));return;}
 shelf?.setSelected(onShelf);
 if(onShelf)return;
 if(cup&&(!hit||cup.distance<=hit.distance)){if(cup.kind==='passbook')passbook.open();else cupboard.toggle();return;}
 if(hit)ui.selectFurniture(hit.object.userData.furnitureId);
});
// WebXR：対応ブラウザ（Meta Quest など）でだけ VR 用コードを読み込み「VRで入る」ボタンを出す。?xr で強制表示。
// 家・家具・キャラクター・シミュレーションは通常表示と共通。VR 中はカメラをリグに載せ替えて歩けるようにするだけ。
let xr=null;
whenXRSupported(undefined,undefined,{trustHeadset:true}).then(ok=>ok&&import('./world/xr-house.js')).then(m=>{if(m){xr=m.mountHouseXR({renderer,scene,camera,controls,profile:xrProfile(),onExit:resize});dockXRButton(xr.button.el);}}).catch(e=>console.warn('[house-xr]',e));
// 通帳の入口ラベルを、戸棚の中の通帳の上に重ねる。戸棚の裏側から見ているときと VR 中は出さない。
const entryPoint=new T.Vector3(),entryScreen={x:0,y:0};
function placePassbookEntry(){
 if(!passbook)return;
 if(!cupboard.entryVisible||renderer.xr.isPresenting||camera.position.z<cupboard.front){passbook.placeEntry(null);return;}
 entryPoint.copy(cupboard.entryAnchor()).project(camera);
 if(entryPoint.z>1||Math.abs(entryPoint.x)>1||Math.abs(entryPoint.y)>1){passbook.placeEntry(null);return;}
 const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;
 entryScreen.x=(entryPoint.x+1)/2*w;entryScreen.y=(1-entryPoint.y)/2*h;passbook.placeEntry(entryScreen);
}
// 本だなの入口ラベル：本の上に重ねる。戸棚の裏側から見ているとき・VR 中・画面の外は出さない。
const shelfPoint=new T.Vector3(),shelfScreen={x:0,y:0};
function placeShelfEntry(){
 if(!shelf)return;
 if(renderer.xr.isPresenting||camera.position.z<bookshelf.front){shelf.placeEntry(null);return;}
 shelfPoint.copy(bookshelf.entryAnchor()).project(camera);
 if(shelfPoint.z>1||Math.abs(shelfPoint.x)>.95||Math.abs(shelfPoint.y)>.95){shelf.placeEntry(null);return;}
 shelfScreen.x=(shelfPoint.x+1)/2*renderer.domElement.clientWidth;shelfScreen.y=(1-shelfPoint.y)/2*renderer.domElement.clientHeight;shelf.placeEntry(shelfScreen);
}
const clock=new T.Clock();let uiElapsed=0;renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);simulation.update(dt);characters.forEach(c=>animateCharacter(c,simulation.time));animateRoom(furniture,characters,simulation.time);animatePudding(pudding,dt);toramana.update(dt);cupboard?.update(dt);placePassbookEntry();placeShelfEntry();if(xr?.active)xr.update(dt);else controls.update();renderer.render(scene,camera);uiElapsed+=dt;if(uiElapsed>.2){ui.update();uiElapsed=0;}});
window.__house={scene,camera,controls,renderer,characters,furniture,simulation,cupboard,passbook,bookshelf,shelf,toramana,get xr(){return xr;}};
