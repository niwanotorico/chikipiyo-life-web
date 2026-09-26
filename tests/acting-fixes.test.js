import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,SphereGeometry,Vector3} from 'three';
import {smoothSoftNormals} from '../src/world/soft-normals.js';
import {fitBlanket} from '../src/world/latest-room.js';
import {keyboardPlayPose,keyboardPlayGap} from '../src/world/action-props.js';
import {measureCupHandle} from '../src/world/room-accessories.js';
import {cleanSweep} from '../src/characters/clean-motion.js';

test('ソファの法線：形は変えず、同じ位置の頂点の法線の割れを閉じる',()=>{
 const sphere=new SphereGeometry(1,24,16),smooth=smoothSoftNormals(sphere);
 const flat=sphere.toNonIndexed();
 assert.equal(smooth.attributes.position.count,flat.attributes.position.count);
 const p=smooth.attributes.position,n=smooth.attributes.normal,byPos=new Map(),v=new Vector3(),m=new Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);m.fromBufferAttribute(n,i);
  assert(Math.abs(m.length()-1)<1e-4);
  const k=v.toArray().map(x=>x.toFixed(4)).join();(byPos.get(k)??byPos.set(k,[]).get(k)).push(m.clone());
 }
 // 球の側面（極以外）は同じ位置なら同じ法線
 for(const [k,list] of byPos){const y=Number(k.split(',')[1]);if(Math.abs(y)>.99)continue;for(const x of list)assert(x.angleTo(list[0])<1e-3,k);}
 // 箱の角（90°）は混ぜない
 const box=smoothSoftNormals(new BoxGeometry(1,1,1)),bn=box.attributes.normal;
 for(let i=0;i<bn.count;i++){const x=new Vector3().fromBufferAttribute(bn,i);assert(Math.max(Math.abs(x.x),Math.abs(x.y),Math.abs(x.z))>.999);}
});

test('掛け布団：天面だけを上げ下げし、下の縁は元の高さに残す',()=>{
 const mesh=new Mesh(new BoxGeometry(2,1,1).translate(0,.5,0));mesh.position.y=.40;mesh.scale.setScalar(.5);
 mesh.geometry.computeBoundingBox();
 mesh.userData.blanketRest={y:mesh.position.y,scaleY:mesh.scale.y,low:mesh.geometry.boundingBox.min.y,high:mesh.geometry.boundingBox.max.y};
 const before=new Box3().setFromObject(mesh);
 for(const raise of [.12,-.02,0]){
  fitBlanket(mesh,raise);mesh.updateMatrixWorld(true);const b=new Box3().setFromObject(mesh);
  assert(Math.abs(b.min.y-before.min.y)<1e-9,`縁の高さ raise=${raise}`);assert(Math.abs(b.max.y-(before.max.y+raise))<1e-9,`天面 raise=${raise}`);
 }
});

test('キーボード：置いた向きから演奏位置と向きを決める',()=>{
 for(const yaw of [Math.PI,2.491,-.4]){
  const root=new Group(),body=new Group();body.rotation.y=yaw;body.position.set(3,0,2);root.add(body);
  // 長辺 X、手前（白鍵側）が +Z の板
  body.add(new Mesh(new BoxGeometry(1.2,.1,.4).translate(0,.05,0),new MeshBasicMaterial()));
  const pose=keyboardPlayPose(root);
  const out=new Vector3(Math.sin(yaw),0,Math.cos(yaw));
  assert(new Vector3(...pose.spot).sub(new Vector3(3,0,2)).distanceTo(out.clone().multiplyScalar(.2+keyboardPlayGap))<1e-6,`spot yaw=${yaw}`);
  const facing=new Vector3(Math.sin(pose.face),0,Math.cos(pose.face));
  assert(facing.dot(out)<-.999,`鍵盤の方を向く yaw=${yaw}`);
 }
});

test('マグの持ち手：縁の円の外へ出ている所を持ち手として見つける',()=>{
 const cup=new Group();
 cup.add(new Mesh(new CylinderGeometry(.1,.08,.2,24,1,true)));
 const handle=new Mesh(new BoxGeometry(.03,.08,.03));handle.position.set(-.13,0,0);cup.add(handle);
 const found=measureCupHandle(cup);
 assert(found.grip.x<-.11&&Math.abs(found.grip.z)<.02,JSON.stringify(found.grip));
});

test('掃除機：ノズルは左右の弧と前後の押し引きを両方する',()=>{
 const samples=Array.from({length:40},(_,i)=>cleanSweep(i*.2));
 assert(Math.max(...samples.map(s=>s.sweep))-Math.min(...samples.map(s=>s.sweep))>.6);
 assert(Math.max(...samples.map(s=>s.stroke))-Math.min(...samples.map(s=>s.stroke))>.2);
 assert(samples.every(s=>Math.abs(s.arm)<=Math.abs(s.sweep)+1e-9&&s.lean>=0&&s.lean<=.05+1e-9));
});
