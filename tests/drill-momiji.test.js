import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SEASON,MOMIJI,momijiOpen,emptyCubePlayer,recordSession,openGate,season,cubeBalance,nodeById,nodeState,effectsOf,mangaOf,applyCheer,sanitizeCubePlayer,REWARDS} from '../src/drill/cosmicube.js';
import {parentLabel} from '../src/drill/parent-mode.js';
import {episodeById} from '../src/manga/catalog.js';
import {makeQuestionSet,seededRandom} from '../src/drill/questions.js';

const N1='2026-11-01';
const award=(points,extra={})=>({cleared:true,points,...extra});
function rich(pt,day=N1){let p=emptyCubePlayer();for(let i=0;i<Math.ceil(pt/100);i++){const s=season(p);s.earned.push({id:`r${i}`,day:'2026-10-10',pt:100});}return sanitizeCubePlayer(p);}
function openPath(p,ids,day=N1){for(const id of ids){const r=openGate(p,id,day);assert.equal(r.ok,true,`${id} ${r.reason}`);p=r.player;}return p;}

test('11月も ピヨ探検pt が たまる（11/30 まで）。12/1 からは 期間外', ()=>{
 assert.equal(SEASON.end,'2026-11-30');
 let r=recordSession(emptyCubePlayer(),{sessionId:'n1',dayKey:N1,award:award(12)});
 assert.equal(r.reason,'ok');assert.equal(cubeBalance(season(r.player)),12);
 assert.equal(recordSession(r.player,{sessionId:'n2',dayKey:'2026-11-30',award:award(12)}).reason,'ok');
 assert.equal(recordSession(r.player,{sessionId:'n3',dayKey:'2026-12-01',award:award(12)}).reason,'season');
});

test('10月の pt・ゲートは そのまま 11月に 持ちこし（同じ シーズン）', ()=>{
 let p=rich(200);
 p=openPath(p,['curry'],'2026-10-20');
 const bal=cubeBalance(season(p));
 p=recordSession(p,{sessionId:'n1',dayKey:N1,award:award(10)}).player;
 assert.equal(cubeBalance(season(p)),bal+10);
 assert.ok(season(p).gates.curry);
});

test('もみじの もり：11/1 から。それまでは ひらけない', ()=>{
 const p=rich(1000);
 assert.equal(momijiOpen('2026-10-31'),false);assert.equal(momijiOpen(N1),true);
 assert.equal(openGate(p,'momiji-01','2026-10-31').reason,'empty');
 assert.equal(openGate(p,'momiji-01',N1).ok,true);
 assert.equal(openGate(p,'momiji-03',N1).reason,'locked');
});

test('もみじの もり：小ネタ（マンガ5話）・小ゴール（もりと さくま・うさこ・ひみつ）。曲・シール・大ゴールは じゅんびちゅう', ()=>{
 let p=rich(1000);
 p=openPath(p,['momiji-01','momiji-02','momiji-morisaku','momiji-usako','momiji-03','momiji-04','momiji-05']);
 assert.ok(effectsOf(p).has('usako'));assert.ok(effectsOf(p).has('morisaku'));
 const m=mangaOf(p,N1);
 for(const ep of ['daily-21','daily-22','daily-23','daily-24','daily-25']){assert.ok(m.has(ep),ep);assert.ok(episodeById(ep),ep);}
 const g=openGate(p,'momiji-secret',N1);
 assert.equal(g.ok,true);assert.equal(g.reward,'momiji-secret');
 assert.equal(REWARDS['momiji-secret'].secret,true);
 for(const who of ['piyomi','piyokichi'])assert.match(parentLabel('momiji-secret',who).name,/マクドナルド/);
 p=g.player;
 for(const id of ['momiji-song','momiji-st1']){assert.equal(nodeState(season(p),nodeById(id),N1),'soon',id);assert.equal(openGate(p,id,N1).reason,'empty');}
 assert.equal(nodeById('momiji-goal').reward,null);   // 大ゴールは 未定
 assert.ok(!nodeById('momiji-secret').small&&!nodeById('momiji-morisaku').small&&!nodeById('momiji-song').small);
 for(const n of MOMIJI.nodes)assert.equal(n.from,N1);
});

test('もりと さくま：ごほうびが あると 文章題に 出てくる', ()=>{
 let seen=0;
 for(let i=0;i<40;i++){
  const set=makeQuestionSet('piyomi',seededRandom(i),10,{motifs:['morisaku']});
  if(set.some(q=>q.motif&&/もり|さくま/.test(q.text)))seen++;
 }
 assert.ok(seen>=30,`${seen}`);
});

test('おうえんも 11月に つづく', ()=>{
 const mi=recordSession(emptyCubePlayer(),{sessionId:'m1',dayKey:'2026-11-05',award:award(20)}).player;
 const ki=applyCheer(emptyCubePlayer(),mi);
 assert.equal(cubeBalance(season(ki)),6);
});

test('2か月ぶんの 記録でも 古い pt が 切りすてられない', ()=>{
 let p=emptyCubePlayer();const s=season(p);
 for(let i=0;i<360;i++)s.earned.push({id:`e${i}`,day:'2026-10-10',pt:5});
 p=sanitizeCubePlayer(p);
 assert.equal(cubeBalance(season(p)),1800);
});

test('drill.html に もみじの もりの タブ', ()=>{
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.ok(html.includes('data-map-tab="momiji"'));
});
