// ピヨ探検：ハードモード（さいおくの さらに おく。10/21〜）のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAP,HARD,REWARDS,emptyCubePlayer,recordSession,openGate,mergeCubePlayer,season,cubeBalance,nodeById,mapView,nodeState,sanitizeCubePlayer,hardOpen,starsEarned,starBalance,mangaOf,stickersOf,foundCount,completion,openableNodes,SPARE_STICKERS} from '../src/drill/cosmicube.js';
import {CubeStore,memoryCubeAdapter} from '../src/drill/cosmicube-store.js';
import {episodeById} from '../src/manga/catalog.js';
import {MANGA_PAGES} from '../src/manga/pages.js';
import {parentLabel} from '../src/drill/parent-mode.js';

const D='2026-10-21',D20='2026-10-20';
let seq=0;
const award=(points,perfect=false)=>({points,cleared:true,practice:false,perfect});
function earn(p,n,{day=D,pt=19,perfect=false}={}){for(let i=0;i<n;i++)p=recordSession(p,{sessionId:`s${++seq}`,dayKey:day,award:award(pt,perfect)}).player;return p;}
// メインの マップを ぜんぶ ひらいた子（ぴよみ：のこり 1pt）
function deepPlayer(){
 let p=emptyCubePlayer();
 for(let d=3;d<=20;d++)p=earn(p,3,{day:`2026-10-${String(d).padStart(2,'0')}`,pt:19});
 for(const n of MAP.nodes)if(n.id!==MAP.start){const r=openGate(p,n.id,D20);if(r.ok)p=r.player;}
 for(const n of MAP.nodes)if(n.id!==MAP.start){const r=openGate(p,n.id,D20);if(r.ok)p=r.player;}
 assert.ok(season(p).gates.deep,'さいおくまで ひらいた');
 // 残高を 1pt に そろえる（ぴよみと おなじ）
 const s=season(p);s.earned=[{id:'base',day:'2026-10-03',pt:Object.values(s.gates).reduce((a,g)=>a+g.cost,0)+1}];
 return sanitizeCubePlayer(p);
}
// 前から じゅんばんに ひらけるだけ ひらく
function openAll(p,day=D){let moved=true;while(moved){moved=false;for(const n of HARD.nodes){const r=openGate(p,n.id,day);if(r.ok){p=r.player;moved=true;}}}return p;}

test('マップ定義：17マス（マンガ14・シール2・ゴール1）、ID・requires・位置が正しい、⭐は4マス', ()=>{
 const ids=HARD.nodes.map(n=>n.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ids)assert.ok(!MAP.nodes.some(n=>n.id===id),`${id} は メインと かぶらない`);
 for(const n of HARD.nodes){for(const r of n.requires)assert.ok(ids.includes(r),`${n.id} → ${r}`);assert.ok(n.x>=5&&n.x<=95&&n.y>=5&&n.y<=95,n.id);}
 const gates=HARD.nodes.filter(n=>n.id!==HARD.start);
 assert.equal(gates.length,17);
 assert.equal(gates.filter(n=>REWARDS[n.reward]?.manga).length,14);
 assert.equal(gates.filter(n=>REWARDS[n.reward]?.sticker).length,2);
 assert.deepEqual(gates.filter(n=>n.star).map(n=>n.id),['hard-04','hard-08','hard-13','hard-goal']);
 assert.equal(gates.reduce((a,n)=>a+n.cost,0),290);
 assert.equal(nodeById('hard-16').reward,'manga-28');assert.deepEqual(REWARDS['manga-28'].manga,['daily-19']);
 assert.ok(REWARDS['hard-goal'].secret);
 // メインの マップは そのまま（合計 430pt・ノード数）
 assert.equal(openableNodes().reduce((a,n)=>a+n.cost,0),430);
 assert.equal(completion(season(emptyCubePlayer())).total,20);
});

test('マンガ15話：catalog にあり、配信用 WebP があり、どれか1マスだけ', ()=>{
 const eps=HARD.nodes.flatMap(n=>REWARDS[n.reward]?.manga??[]);
 assert.deepEqual(eps.sort(),['daily-10','daily-11','daily-12','daily-13','daily-14','daily-15','daily-16','daily-17','daily-18','daily-19','daily-20','mc-09','mc-10','mc-11','mc-12']);
 for(const e of eps){assert.ok(episodeById(e),e);assert.equal(MANGA_PAGES[e]?.length,1,e);}
 const stickers=HARD.nodes.map(n=>REWARDS[n.reward]?.sticker).filter(Boolean);
 assert.equal(new Set(stickers).size,2);
 for(const st of stickers)assert.ok(!SPARE_STICKERS.some(x=>x.sticker===st),`${st} は もう 予備ではない`);
});

test('入口：さいおくを ひらいた子だけ・10/21 から。ひらく前は 霧で、ひらけない', ()=>{
 const none=earn(emptyCubePlayer(),3);
 assert.equal(hardOpen(season(none),D),false);
 assert.equal(openGate(none,'hard-01',D).reason,'locked');
 assert.ok(mapView(season(none),{dayKey:D,map:'hard'}).every(v=>v.state==='fog'));
 const p=deepPlayer();
 assert.equal(hardOpen(season(p),D20),false,'10/20 は まだ');
 assert.equal(openGate(earn(p,1,{day:D20}),'hard-01',D20).reason,'locked');
 assert.equal(hardOpen(season(p),D),true);
 const v=Object.fromEntries(mapView(season(p),{dayKey:D,map:'hard'}).map(x=>[x.node.id,x.state]));
 assert.equal(v['hard-start'],'open');assert.equal(v['hard-01'],'ready');assert.equal(v['hard-02'],'ready');assert.equal(v['hard-03'],'fog');
 assert.equal(openGate(p,'hard-start',D).reason,'unknown','入口は ひらく マスではない');
});

test('ぴよみ（のこり 1pt）：きょう 3回 あそべば 2マス ひらける。メインの記録は そのまま', ()=>{
 let p=deepPlayer();const before=JSON.parse(JSON.stringify(season(p)));
 assert.equal(cubeBalance(season(p)),1);
 assert.equal(openGate(p,'hard-01',D).reason,'short');
 p=earn(p,2,{pt:15});
 let r=openGate(p,'hard-01',D);assert.equal(r.ok,true);assert.equal(r.reward,'manga-15');p=r.player;
 r=openGate(p,'hard-02',D);assert.equal(r.ok,true);p=r.player;
 const s=season(p);
 assert.equal(cubeBalance(s),1);
 for(const [id,g] of Object.entries(before.gates))assert.deepEqual(s.gates[id],g);
 assert.ok(mangaOf(p,D).has('mc-09'));
 assert.ok(stickersOf(p).some(x=>x.sticker==='banzai'));
 assert.equal(foundCount(s),Object.keys(before.gates).length+2);
});

test('⭐の マス：パーフェクトの ほしが ないと ひらかない。ほしは 1こ つかう', ()=>{
 let p=earn(deepPlayer(),3,{pt:15});
 p=openGate(p,'hard-02',D).player;
 assert.equal(starBalance(season(p)),0);
 assert.equal(openGate(p,'hard-04',D).reason,'star');
 p=earn(p,1,{day:'2026-10-22',pt:19,perfect:true});
 assert.equal(starsEarned(season(p)),1);assert.equal(starBalance(season(p)),1);
 const r=openGate(p,'hard-04','2026-10-22');assert.equal(r.ok,true);
 assert.equal(starBalance(season(r.player)),0);
});

test('ほしは ピヨ探検pt が もらえる回だけ（れんしゅう・4回目・二重は なし）', ()=>{
 let p=emptyCubePlayer();
 let r=recordSession(p,{sessionId:'a',dayKey:D,award:award(19,true)});assert.equal(r.star,true);p=r.player;
 r=recordSession(p,{sessionId:'a',dayKey:D,award:award(19,true)});assert.equal(r.star,false);assert.equal(r.reason,'duplicate');
 r=recordSession(p,{sessionId:'b',dayKey:D,award:{points:0,cleared:true,practice:true,perfect:true}});assert.equal(r.star,false);
 r=recordSession(p,{sessionId:'c',dayKey:D,award:award(13,false)});assert.equal(r.star,false);p=r.player;
 p=earn(p,1,{perfect:true});
 r=recordSession(p,{sessionId:'d',dayKey:D,award:award(19,true)});assert.equal(r.reason,'limit');assert.equal(r.star,false);
 assert.equal(starsEarned(season(r.player)),2);
});

test('ぜんぶ ひらける：ほし4こ ＋ 345pt で ゴールまで。ゴールの中身は 子どもには ❓、親モードで 見える', ()=>{
 let p=deepPlayer();
 for(let d=21;d<=31;d++)p=earn(p,3,{day:`2026-10-${d}`,pt:19,perfect:d%3===0});
 p=openAll(p,'2026-10-31');
 const s=season(p);
 for(const n of HARD.nodes)if(n.id!==HARD.start)assert.ok(s.gates[n.id],n.id);
 assert.equal(s.position,'hard-goal');
 assert.equal(parentLabel('hard-goal','piyomi').name.includes('ハードモード'),true);
 assert.ok(parentLabel('hard-goal','piyomi').name.includes('メロガッパFC 3か月'));
 const ui=readFileSync(new URL('../src/drill/cosmicube-ui.js',import.meta.url),'utf8');
 assert.ok(ui.includes('rewardFace'),'secret は rewardFace で ❓');
});

test('保存：perfect と ハードモードの ゲートは 読みなおしても 消えない・2台を合わせても 二重にならない', ()=>{
 let p=earn(deepPlayer(),3,{pt:19,perfect:true});
 p=openAll(p);
 const s1=season(sanitizeCubePlayer(JSON.parse(JSON.stringify(p))));
 assert.deepEqual(s1,season(p));
 assert.ok(s1.earned.some(e=>e.perfect===true));
 assert.ok(s1.earned.every(e=>e.perfect===undefined||e.perfect===true));
 const m=mergeCubePlayer(p,p);
 assert.equal(starBalance(season(m)),starBalance(season(p)));assert.equal(cubeBalance(season(m)),cubeBalance(season(p)));
 // 入口は 保存しない
 const raw=JSON.parse(JSON.stringify(p));season(raw).gates['hard-start']={on:D,cost:0};
 assert.equal(season(sanitizeCubePlayer(raw)).gates['hard-start'],undefined);
});

test('CubeStore：結果画面の ほし・マップの きりかえ・⭐の 表示が 画面に ある', ()=>{
 const cube=new CubeStore({adapter:memoryCubeAdapter()});
 const r=cube.recordSession('piyomi',{sessionId:'x',dayKey:D,award:award(19,true)});
 assert.equal(r.star,true);
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 for(const sel of ['data-map-tabs','data-map-tab="hard"','data-map-star','data-cube-star'])assert.ok(html.includes(sel),sel);
 const main=readFileSync(new URL('../src/drill/main.js',import.meta.url),'utf8');
 assert.ok(main.includes('パーフェクトの ほし ゲット'));
});

test('ドリルの記録（commitResult）から：10もん ぜんぶ せいかいで ほし、1つでも まちがえると なし', async ()=>{
 const {commitResult,emptyStore}=await import('../src/drill/storage.js');
 let store=emptyStore(),p=emptyCubePlayer();
 const run=(id,oks)=>{const r=commitResult(store,{sessionId:id,player:'piyomi',dayKey:D,oks});store=r.store;const c=recordSession(p,{sessionId:id,dayKey:D,award:r.award});p=c.player;return c;};
 assert.equal(run('p1',Array(10).fill(true)).star,true);
 assert.equal(run('p2',[...Array(9).fill(true),false]).star,false);
 const third=run('p3',Array(10).fill(true));   // その日 2回目の パーフェクト（パーフェクトボーナスは なし）でも ほしは もらえる
 assert.equal(third.star,true);
 assert.equal(starsEarned(season(p)),2);
});
