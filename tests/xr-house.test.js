import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createFloorPlan,facePose} from '../src/xr/xr-floorplan.js';
import {houseFloor,houseStartPose,HOUSE_FLOOR_Y,HOUSE_BOUNDS,HOUSE_OUTSIDE_Y} from '../src/world/xr-house.js';
import {roomObstacles,roomFurniture} from '../src/world/room-layout.js';
import {whenXRSupported,xrProfile,isStandaloneHeadset} from '../src/xr/xr-session.js';

test('floor plan: flat floor, bounds and box obstacles',()=>{
 const plan=createFloorPlan({floorY:0,outsideY:-.5,bounds:{minX:-2,maxX:2,minZ:-2,maxZ:2},floorRect:{minX:-3,maxX:3,minZ:-3,maxZ:3},obstacles:[{position:[1,0,0],footprint:[1,1]}],radius:.2});
 assert.equal(plan.ground(0,0),0);assert.equal(plan.ground(2.5,0),0);assert.equal(plan.ground(5,0),-.5);
 assert.equal(plan.canStand(0,0),true);assert.equal(plan.canStand(2.5,0),false);
 assert.equal(plan.canStand(1,0),false);assert.equal(plan.canStand(.35,0),false);assert.equal(plan.canStand(.25,0),true);
 assert.equal(plan.walkable(0,0,.1,0),true);assert.equal(plan.walkable(.2,0,.4,0),false);
 // 実際に歩いて家具に入ってしまった時は抜け出せる
 assert.equal(plan.walkable(1,0,1.1,0),true);
});

test('facePose: yaw points -Z toward the target',()=>{
 const p=facePose(0,0,{x:3,z:-3});
 const fwd=new T.Vector3(0,0,-1).applyEuler(new T.Euler(0,p.yaw,0));
 assert.ok(fwd.dot(new T.Vector3(3,0,-3).normalize())>.999);
});

test('house VR start: standing on the real floor, clear of furniture, looking into the room',()=>{
 const p=houseStartPose();
 assert.equal(p.y,HOUSE_FLOOR_Y);assert.equal(houseFloor.ground(p.x,p.z),HOUSE_FLOOR_Y);
 assert.ok(houseFloor.canStand(p.x,p.z));
 for(const o of roomObstacles)assert.ok(Math.abs(p.x-o.position[0])>o.footprint[0]/2+.3||Math.abs(p.z-o.position[2])>o.footprint[1]/2+.3,'too close to '+(o.id||o.position));
 // 家具の大半が視野（前方 ±60°）に入る
 const fwd=new T.Vector3(0,0,-1).applyEuler(new T.Euler(0,p.yaw,0));
 const seen=roomFurniture.filter(f=>{const d=new T.Vector3(f.position[0]-p.x,0,f.position[2]-p.z).normalize();return d.dot(fwd)>Math.cos(Math.PI/3);});
 assert.ok(seen.length>=roomFurniture.length/2,'seen '+seen.map(f=>f.id));
});

test('house VR: cannot stand inside furniture or outside the house, floor outside is the garden',()=>{
 // 掃除機は動き回るので障害物にしない（キャラクターの経路探索と同じ）
 for(const f of roomFurniture.filter(f=>f.id!=='vacuum'))assert.equal(houseFloor.canStand(f.position[0],f.position[2]),false,f.id);
 assert.equal(houseFloor.canStand(HOUSE_BOUNDS.maxX+.3,0),false);
 assert.equal(houseFloor.ground(9,9),HOUSE_OUTSIDE_Y);
 // 家の中には歩いて回れる通路がある（歩ける格子点が十分ある）
 let open=0,all=0;for(let x=HOUSE_BOUNDS.minX;x<=HOUSE_BOUNDS.maxX;x+=.25)for(let z=HOUSE_BOUNDS.minZ;z<=HOUSE_BOUNDS.maxZ;z+=.25){all++;if(houseFloor.canStand(x,z))open++;}
 assert.ok(open/all>.3,'open ratio '+open/all);
});

test('shared XR helpers: support check and headset profile',async()=>{
 const none=new URLSearchParams('');
 assert.equal(await whenXRSupported(none,{}),false);
 assert.equal(await whenXRSupported(new URLSearchParams('xr'),{}),true);
 assert.equal(await whenXRSupported(none,{xr:{isSessionSupported:async m=>m==='immersive-vr'}}),true);
 assert.equal(await whenXRSupported(none,{xr:{isSessionSupported:async()=>{throw new Error('x');}}}),false);
 assert.equal(xrProfile(none,'Mozilla/5.0 (X11; Linux x86_64; Quest 3) OculusBrowser/35').xrScale,.9);
 assert.equal(xrProfile(new URLSearchParams('xrscale=1.2'),'OculusBrowser').xrScale,1.2);
 assert.equal(xrProfile(none,'Mozilla/5.0 (Windows NT 10.0)').xrScale,1);
});

test('house VR button: Quest / Pico browsers show the entry even when isSessionSupported is false or never answers',async()=>{
 const none=new URLSearchParams('');
 const QUEST='Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0 SamsungBrowser/4.0 Chrome/126.0 VR Safari/537.36';
 const PICO='Mozilla/5.0 (Linux; Android 12; Pico 4) AppleWebKit/537.36 (KHTML, like Gecko) PicoBrowser/3.3 Chrome/105.0 VR Safari/537.36';
 const PC='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
 const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
 const no={isSessionSupported:async()=>false},hang={isSessionSupported:()=>new Promise(()=>{})};
 const opt={trustHeadset:true};
 assert.ok(isStandaloneHeadset(QUEST)&&isStandaloneHeadset(PICO)&&!isStandaloneHeadset(PC)&&!isStandaloneHeadset(IPHONE));
 assert.equal(await whenXRSupported(none,{userAgent:QUEST,xr:no},opt),true);
 assert.equal(await whenXRSupported(none,{userAgent:QUEST,xr:hang},opt),true);
 assert.equal(await whenXRSupported(none,{userAgent:PICO},opt),true);
 // PC・スマホは今まで通り事前判定だけ
 assert.equal(await whenXRSupported(none,{userAgent:PC,xr:no},opt),false);
 assert.equal(await whenXRSupported(none,{userAgent:IPHONE},opt),false);
 assert.equal(await whenXRSupported(none,{userAgent:PC,xr:{isSessionSupported:async()=>true}},opt),true);
 // trustHeadset を付けないページ（渓流など）は従来どおり
 assert.equal(await whenXRSupported(none,{userAgent:QUEST,xr:no}),false);
});
