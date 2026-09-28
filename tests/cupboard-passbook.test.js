import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Raycaster,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installCupboard,cupboardDoorNames} from '../src/world/cupboard.js';
import {pointBalances,subscribePointBalances,validPointRecord} from '../src/points/ledger.js';

async function loadRoom(){
 const bytes=readFileSync(new URL('../assets/room/human-room.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 gltf.scene.updateMatrixWorld(true);return gltf.scene;
}
const settle=(c,seconds=1)=>{for(let t=0;t<seconds;t+=1/60)c.update(1/60);c.doors[0].mesh.parent.updateMatrixWorld(true);};
const ray=(from,to)=>{const o=new Vector3(...from),d=new Vector3(...to).sub(o).normalize();return new Raycaster(o,d,0,50);};

test('cupboard uses the existing lower doors of the room, not a new cabinet',async()=>{
 const room=await loadRoom();
 const before=new Set();room.traverse(o=>before.add(o));
 const c=installCupboard(room,{createCanvas:()=>null});
 assert(c);
 assert.equal(c.doors[0].mesh.name,cupboardDoorNames.left);
 assert.equal(c.doors[1].mesh.name,cupboardDoorNames.right);
 // 追加するのは通帳の入口だけ。
 const added=[];room.traverse(o=>{if(!before.has(o))added.push(o);});
 assert(added.every(o=>{for(let p=o;p;p=p.parent)if(p===c.entry)return true;return false;}));
 assert.equal(installCupboard({getObjectByName:()=>null}),null);
});

test('doors swing open toward the room on their hinges and the passbook only shows while open',async()=>{
 const room=await loadRoom();const c=installCupboard(room,{createCanvas:()=>null});
 const closed=c.doors.map(d=>new Box3().setFromObject(d.mesh)),hinges=c.doors.map(d=>d.mesh.getWorldPosition(new Vector3()));
 assert(hinges[0].x<closed[0].min.x+.06&&hinges[1].x>closed[1].max.x-.06);
 assert.equal(c.open,false);assert.equal(c.entryVisible,false);
 const events=[];c.onChange(v=>events.push(v));
 c.toggle();c.update(.1);
 assert.equal(c.entryVisible,false,'not visible while the doors are still mostly closed');
 settle(c);
 assert.equal(c.open,true);assert.equal(c.progress,1);assert.equal(c.entryVisible,true);
 c.doors.forEach((d,i)=>{
  const open=new Box3().setFromObject(d.mesh);
  assert(open.max.z>closed[i].max.z+.4,`${d.mesh.name} opens toward the room`);
  // 扉の原点＝蝶番（外側の縁）。原点は動かず、取っ手側だけが手前へ回る。
  assert(d.mesh.getWorldPosition(new Vector3()).distanceTo(hinges[i])<1e-9);
  assert(i===0?open.max.x<closed[i].max.x-.3:open.min.x>closed[i].min.x+.3);
 });
 // 入口は閉じた扉の奥（戸棚の中）にある。
 const p=c.entry.getWorldPosition(new Vector3());
 assert(p.z<Math.min(...closed.map(b=>b.min.z)));
 assert(p.x>closed[0].min.x&&p.x<closed[1].max.x);
 assert(p.y>=closed[0].min.y-.01&&p.y<.3);
 c.setOpen(false);
 assert.equal(c.entryVisible,false,'hidden as soon as closing starts');
 settle(c);
 assert.equal(c.progress,0);
 c.doors.forEach(d=>assert.equal(d.mesh.rotation.y,d.restY));
 assert.deepEqual(events,[true,false]);
});

test('click hits: closed door toggles, passbook is hit only when visible',async()=>{
 const room=await loadRoom();const c=installCupboard(room,{createCanvas:()=>null});
 const doorCenter=new Box3().setFromObject(c.doors[1].mesh).getCenter(new Vector3());
 const cam=[doorCenter.x,doorCenter.y+2,doorCenter.z+6];
 assert.equal(c.hit(ray(cam,doorCenter.toArray()))?.kind,'door');
 const book=c.entry.getWorldPosition(new Vector3());
 assert.equal(c.hit(ray([book.x,book.y+3,book.z+3],book.toArray()))?.kind,'door',"closed doors cover the book");
 c.toggle();settle(c);
 assert.equal(c.hit(ray([book.x,book.y+3,book.z+3],[book.x,book.y+.01,book.z]))?.kind,'passbook');
 assert.equal(c.hit(ray([0,10,8],[0,10,20])),null);
});

test('ledger balances match the points app rules',()=>{
 const records=[
  {child:'ぴよきち',type:'earn',points:120,reason:'おてつだい'},
  {child:'ぴよきち',type:'spend',points:20,reason:'おやつ'},
  {child:'ぴよみ',type:'earn',points:5,reason:'はみがき'},
  {child:'ぴよみ',type:'spend',points:30,reason:'ほん'},
  {child:'ちきん',type:'earn',points:999,reason:'対象外'},
  {child:'ぴよみ',type:'earn',points:1.5,reason:'不正'},
  {child:'ぴよみ',type:'earn',points:10,reason:'   '},
 ];
 assert.deepEqual(pointBalances(records),{'ぴよきち':100,'ぴよみ':-25});
 assert.equal(validPointRecord(null),false);
});

test('Firestore is read-only: only the records collection is subscribed and unsubscribed on close',async()=>{
 const calls=[];let unsubscribed=0,snapshotHandler;
 const sdk={
  'firebase-app.js':{getApps:()=>[],initializeApp:(config,name)=>{calls.push(['init',config.projectId,name]);return {name};}},
  'firebase-firestore.js':{getFirestore:app=>({app}),collection:(db,path)=>{calls.push(['collection',path]);return {path};},
   onSnapshot:(ref,opts,next)=>{calls.push(['onSnapshot',ref.path,opts.includeMetadataChanges]);snapshotHandler=next;return ()=>unsubscribed++;}},
 };
 const importModule=async url=>{calls.push(['import',url]);const key=url.split('/').pop();assert(sdk[key],url);return sdk[key];};
 const seen=[];
 const stop=subscribePointBalances(v=>seen.push(v),e=>assert.fail(e),{importModule});
 await new Promise(r=>setTimeout(r,0));
 snapshotHandler({metadata:{fromCache:true},docs:[]});
 snapshotHandler({metadata:{fromCache:false},docs:[{data:()=>({child:'ぴよきち',type:'earn',points:7,reason:'x'})}]});
 assert.deepEqual(seen,[{ready:false,balances:{'ぴよきち':0,'ぴよみ':0}},{ready:true,balances:{'ぴよきち':7,'ぴよみ':0}}]);
 stop();assert.equal(unsubscribed,1);
 assert(calls.some(c=>c[0]==='init'&&c[1]==='creative-chicken-points'));
 assert(calls.filter(c=>c[0]==='import').every(c=>c[1].startsWith('https://www.gstatic.com/firebasejs/12.0.0/')));
 assert.deepEqual(calls.filter(c=>c[0]==='collection'),[['collection','records']]);
});

test('passbook code never writes to Firestore or browser storage',()=>{
 for(const file of ['../src/points/ledger.js','../src/points/passbook.js','../src/world/cupboard.js']){
  const src=readFileSync(new URL(file,import.meta.url),'utf8');
  for(const banned of ['localStorage','sessionStorage','indexedDB','setDoc','addDoc','updateDoc','deleteDoc','writeBatch','runTransaction','firebase-auth'])assert(!src.includes(banned),`${file} uses ${banned}`);
 }
});
