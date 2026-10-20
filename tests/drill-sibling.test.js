// ピヨ探検：きょうだい（10/23〜）— 2台の同期・おかえりボーナス・おうえん のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyCubePlayer,recordSession,season,cubeBalance,playsOn,cubeSessionsLeft,starsEarned,boostFor,applyCheer,cheerReceived,cheerGiven,sanitizeCubePlayer,mergeCubePlayer,CHEER} from '../src/drill/cosmicube.js';
import {CubeStore,memoryCubeAdapter,sameCube} from '../src/drill/cosmicube-store.js';
import {createCubeSync} from '../src/drill/cube-sync.js';
import {familyLines,syncLabel} from '../src/drill/cosmicube-ui.js';

const D='2026-10-23';
const award=(points,perfect=false)=>({points,cleared:true,practice:false,perfect});
// にせものの Firestore（2台で 共有）
function fakeCloud(){
 const docs=new Map();let writes=0,down=false;
 return {docs,get writes(){return writes;},set down(v){down=v;},
  open:async()=>{if(down)throw new Error('offline');return {
   async read(id){if(down)throw new Error('offline');return docs.has(id)?JSON.parse(docs.get(id)):null;},
   async write(id,p){if(down)throw new Error('offline');writes++;docs.set(id,JSON.stringify(p));},
  };}};
}
function ipad(cloud,clock){
 let t=clock??1000;const cube=new CubeStore({adapter:memoryCubeAdapter(),now:()=>++t});
 const sync=createCubeSync({cube,openRemote:cloud.open,now:()=>t});
 return {cube,sync};
}

test('おかえりボーナス：ぴよきちだけ 10/23〜10/31 に 1.5倍（四捨五入）。ぴよみ・10/22・11/1 は そのまま', ()=>{
 assert.equal(boostFor('piyokichi','2026-10-22'),null);
 assert.equal(boostFor('piyokichi',D).rate,1.5);
 assert.equal(boostFor('piyokichi','2026-10-31').rate,1.5);
 assert.equal(boostFor('piyokichi','2026-11-01'),null);
 assert.equal(boostFor('piyomi',D),null);
 const cube=new CubeStore({adapter:memoryCubeAdapter()});
 const r=cube.recordSession('piyokichi',{sessionId:'a',dayKey:D,award:award(13)});
 assert.equal(r.cubePt,20);assert.equal(r.basePt,13);assert.equal(r.boost.label,'おかえりボーナス');
 const m=cube.recordSession('piyomi',{sessionId:'b',dayKey:D,award:award(13)});
 assert.equal(m.cubePt,13);assert.equal(m.boost,null);
 const old=cube.recordSession('piyokichi',{sessionId:'c',dayKey:'2026-10-22',award:award(13)});
 assert.equal(old.cubePt,13);
});

test('おうえん：ぴよみの 10/23 からの pt の 3わりが ぴよきちに。ぴよみの pt は へらない・何回 足しても ふえない', ()=>{
 let mi=emptyCubePlayer();
 mi=recordSession(mi,{sessionId:'old',dayKey:'2026-10-22',award:award(19)}).player;
 mi=recordSession(mi,{sessionId:'m1',dayKey:D,award:award(19,true)}).player;
 mi=recordSession(mi,{sessionId:'m2',dayKey:D,award:award(15)}).player;
 let ki=emptyCubePlayer();
 ki=applyCheer(ki,mi);
 assert.equal(cheerReceived(season(ki)),6+5);
 assert.equal(cheerGiven(season(mi)),11);
 assert.equal(cubeBalance(season(mi)),53,'ぴよみは へらない');
 assert.equal(cubeBalance(season(ki)),11);
 assert.equal(applyCheer(ki,mi),ki,'2回目は かわらない');
 // おうえんは あそんだ回にも ほしにも 数えない
 assert.equal(playsOn(season(ki),D),0);assert.equal(cubeSessionsLeft(season(ki),D),3);assert.equal(starsEarned(season(ki)),0);
 // 保存して 読みなおしても cheer は のこる・2台で あわせても 二重にならない
 const back=sanitizeCubePlayer(JSON.parse(JSON.stringify(ki)));
 assert.equal(cheerReceived(season(back)),11);
 assert.equal(cheerReceived(season(mergeCubePlayer(ki,applyCheer(emptyCubePlayer(),mi)))),11);
});

test('CubeStore：ぴよみが あそぶと その場で ぴよきちに おうえんが 足される', ()=>{
 const cube=new CubeStore({adapter:memoryCubeAdapter()});
 cube.recordSession('piyomi',{sessionId:'x',dayKey:D,award:award(19)});
 assert.equal(cheerReceived(season(cube.player('piyokichi'))),6);
 cube.recordSession('piyokichi',{sessionId:'y',dayKey:D,award:award(19)});
 assert.equal(cubeBalance(season(cube.player('piyokichi'))),6+29);
 assert.equal(cheerReceived(season(cube.player('piyomi'))),0,'ぴよきち → ぴよみ は ない');
});

test('2台の同期：ぴよみの iPad と ぴよきちの iPad の 記録が あわさる。何回 同期しても ふえない', async ()=>{
 const cloud=fakeCloud();
 const A=ipad(cloud,1000),B=ipad(cloud,5000);   // A=ぴよみの iPad、B=ぴよきちの iPad
 A.cube.recordSession('piyomi',{sessionId:'m1',dayKey:D,award:award(19,true)});
 B.cube.recordSession('piyokichi',{sessionId:'k1',dayKey:D,award:award(10)});
 await A.sync.sync();await B.sync.sync();await A.sync.sync();
 for(const dev of [A,B]){
  assert.equal(cubeBalance(season(dev.cube.player('piyomi'))),19);
  assert.equal(cubeBalance(season(dev.cube.player('piyokichi'))),15+6,'1.5倍 ＋ おうえん');
 }
 assert.ok(sameCube(A.cube.player('piyokichi'),B.cube.player('piyokichi')));
 const w=cloud.writes;
 await A.sync.sync();await B.sync.sync();
 assert.equal(cloud.writes,w,'かわらなければ 書かない');
 assert.equal(A.sync.state().status,'ok');
});

test('同期：だれも あそんでいない 子の からっぽの 記録は 書かない', async ()=>{
 const cloud=fakeCloud();const A=ipad(cloud);
 await A.sync.sync();
 assert.equal(cloud.docs.size,0);
});

test('同期：ネットが ないときは エラーに なるだけ。記録は 消えないし、つながったら あわさる', async ()=>{
 const cloud=fakeCloud();cloud.down=true;
 const A=ipad(cloud);
 A.cube.recordSession('piyomi',{sessionId:'m1',dayKey:D,award:award(19)});
 await A.sync.sync();
 assert.equal(A.sync.state().status,'error');
 assert.equal(cubeBalance(season(A.cube.player('piyomi'))),19);
 cloud.down=false;
 await A.sync.sync();
 assert.equal(A.sync.state().status,'ok');
 assert.ok(cloud.docs.has('piyomi'));assert.ok(cloud.docs.has('piyokichi'),'おうえんの ぶん ぴよきちも 書く');
});

test('同期：同時に よばれても 1つに まとまる', async ()=>{
 const cloud=fakeCloud();const A=ipad(cloud);
 A.cube.recordSession('piyomi',{sessionId:'m1',dayKey:D,award:award(19)});
 await Promise.all([A.sync.sync(),A.sync.sync(),A.sync.sync()]);
 assert.equal(A.sync.state().status,'ok');
 assert.equal(cubeBalance(season(A.cube.player('piyomi'))),19);
});

test('画面の文：おかえりボーナス・おうえん・つながりかた', ()=>{
 const cube=new CubeStore({adapter:memoryCubeAdapter()});
 cube.recordSession('piyomi',{sessionId:'x',dayKey:D,award:award(19)});
 const k=familyLines('piyokichi',cube.player('piyokichi'),D),m=familyLines('piyomi',cube.player('piyomi'),D);
 assert.ok(k.boost.includes('1.5'));assert.ok(k.cheer.includes('+6'));
 assert.equal(m.boost,'');assert.ok(m.cheer.includes('6 pt'));
 const before=familyLines('piyokichi',cube.player('piyokichi'),'2026-10-22');
 assert.equal(before.boost,'');assert.equal(before.cheer,'');
 assert.equal(syncLabel({status:'idle'}),'');
 assert.ok(syncLabel({status:'ok',lastOk:0}).includes('つながった'));
 assert.ok(syncLabel({status:'error'}).includes('だいじょうぶ'));
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 for(const sel of ['data-map-family','data-map-boost','data-map-cheer','data-map-sync'])assert.ok(html.includes(sel),sel);
});

test('同期は 通帳（records）に さわらない・匿名ログインだけ', ()=>{
 const src=readFileSync(new URL('../src/drill/cube-sync.js',import.meta.url),'utf8');
 assert.ok(src.includes("SYNC_COLLECTION='piyoTanken'"));
 assert.ok(!/collection\([^)]*'records'/.test(src));
 assert.ok(src.includes('signInAnonymously'));
 assert.ok(!/signInWith(Popup|Redirect)/.test(src));
});
