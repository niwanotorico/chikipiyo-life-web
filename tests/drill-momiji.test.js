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

test('11〜12月も ピヨ探検pt が たまる（12/31 まで）。1/1 からは 期間外', ()=>{
 assert.equal(SEASON.end,'2026-12-31');
 let r=recordSession(emptyCubePlayer(),{sessionId:'n1',dayKey:N1,award:award(12)});
 assert.equal(r.reason,'ok');assert.equal(cubeBalance(season(r.player)),12);
 assert.equal(recordSession(r.player,{sessionId:'n2',dayKey:'2026-12-31',award:award(12)}).reason,'ok');
 assert.equal(recordSession(r.player,{sessionId:'n3',dayKey:'2027-01-01',award:award(12)}).reason,'season');
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

test('もみじの もり：小ネタ（マンガ5話）・小ゴール（もりと さくま・うさこ・ひみつ）。大ゴールは じゅんびちゅう', ()=>{
 let p=rich(1000);
 p=openPath(p,['momiji-01','momiji-02','momiji-morisaku','momiji-usako','momiji-03','momiji-04','momiji-05']);
 assert.ok(effectsOf(p).has('usako'));assert.ok(effectsOf(p).has('morisaku'));
 const m=mangaOf(p,N1);
 for(const ep of ['daily-21','daily-22','daily-23','daily-24','daily-25']){assert.ok(m.has(ep),ep);assert.ok(episodeById(ep),ep);}
 p=openPath(p,['momiji-34']);
 const g=openGate(p,'momiji-secret',N1);
 assert.equal(g.ok,true);assert.equal(g.reward,'momiji-secret');
 assert.equal(REWARDS['momiji-secret'].secret,true);
 for(const who of ['piyomi','piyokichi'])assert.match(parentLabel('momiji-secret',who).name,/マクドナルド/);
 p=g.player;
 assert.equal(nodeById('momiji-goal').reward,null);   // 大ゴールは 未定
 assert.equal(nodeById('momiji-song').reward,'momiji-song');   // 曲は えんも
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

test('もみじの もり：26〜33話も ひらける。曲を ひらかなくても 大ゴールの 手前まで 行ける', ()=>{
 let p=rich(2000);
 p=openPath(p,['momiji-01','momiji-02','momiji-morisaku','momiji-usako','momiji-03','momiji-04','momiji-05',
  'momiji-34','momiji-secret','momiji-36','momiji-st1','momiji-40','momiji-35','momiji-37','momiji-st2','momiji-41']);
 const m=mangaOf(p,N1);
 for(let n=21;n<=33;n++){const ep=`daily-${n}`;assert.ok(m.has(ep),ep);assert.ok(episodeById(ep),ep);}
 assert.equal(nodeState(season(p),nodeById('momiji-song'),N1),'ready');
 assert.equal(nodeState(season(p),nodeById('momiji-oku-01'),N1),'ready');   // 足した道の 1マス目
 assert.equal(nodeState(season(p),nodeById('momiji-goal'),N1),'fog');
 // 中身の ある マス 合計 540pt（曲 30pt、足した道の マンガ 3マス 150pt を ふくむ）
 const total=MOMIJI.nodes.filter(n=>n.reward).reduce((a,n)=>a+n.cost,0);
 assert.equal(total,540);
});

const BEFORE_OKU=['momiji-01','momiji-02','momiji-morisaku','momiji-usako','momiji-04','momiji-05','momiji-34','momiji-secret','momiji-36','momiji-st1','momiji-40','momiji-35','momiji-37','momiji-st2','momiji-41'];

test('足した道：50pt の 1本道 14マス。40・41 の 両方を ひらくと 入れて、34〜36話が よめる', ()=>{
 const oku=MOMIJI.nodes.filter(n=>n.id.startsWith('momiji-oku-'));
 assert.equal(oku.length,14);
 assert.ok(oku.every(n=>n.cost===50&&n.small));
 oku.slice(1).forEach((n,i)=>assert.deepEqual(n.requires,[oku[i].id]));
 let p=rich(2000);
 p=openPath(p,BEFORE_OKU.filter(id=>id!=='momiji-41'));
 assert.equal(openGate(p,'momiji-oku-01',N1).reason,'locked');
 p=openPath(p,['momiji-41']);
 const bal=cubeBalance(season(p));
 p=openPath(p,['momiji-oku-01','momiji-oku-02','momiji-oku-03']);
 assert.equal(cubeBalance(season(p)),bal-150);
 const m=mangaOf(p,N1);
 for(const ep of ['daily-34','daily-35','daily-36']){assert.ok(m.has(ep),ep);assert.ok(episodeById(ep),ep);}
});

test('足した道：中身の ない マスは じゅんびちゅうで 止まる。pt は へらない', ()=>{
 let p=openPath(rich(2000),[...BEFORE_OKU,'momiji-oku-01','momiji-oku-02','momiji-oku-03']);
 const s=season(p),bal=cubeBalance(s);
 assert.equal(nodeState(s,nodeById('momiji-oku-04'),N1),'soon');
 assert.equal(nodeState(s,nodeById('momiji-oku-05'),N1),'fog');
 const r=openGate(p,'momiji-oku-04',N1);
 assert.equal(r.ok,false);assert.equal(r.reason,'empty');
 assert.equal(cubeBalance(season(r.player)),bal);
});

test('大ゴール：いちばん おくで 100pt。全体は 1190pt', ()=>{
 const goal=nodeById('momiji-goal');
 assert.equal(goal.cost,100);assert.equal(goal.reward,null);
 assert.deepEqual(goal.requires,['momiji-oku-14']);
 assert.equal(MOMIJI.nodes.reduce((a,n)=>a+n.cost,0),1190);
});

test('前に ひらいた もみじの マスは 記録も pt も そのまま', ()=>{
 let p=openPath(rich(1000),['momiji-01','momiji-02','momiji-usako']);
 const before=cubeBalance(season(p));
 const q=sanitizeCubePlayer(JSON.parse(JSON.stringify(p)));
 assert.equal(cubeBalance(season(q)),before);
 for(const id of ['momiji-01','momiji-02','momiji-usako'])assert.equal(nodeState(season(q),nodeById(id),N1),'open');
 assert.equal(season(q).gates['momiji-usako'].cost,30);
});

test('12/31 まで 毎日3回＋おうえんでも、記録が 切りすてられず pt が へらない', ()=>{
 const days=[];for(let t=Date.parse('2026-10-03');t<=Date.parse('2026-12-31');t+=864e5)days.push(new Date(t).toISOString().slice(0,10));
 assert.equal(days.length,90);
 let mi=emptyCubePlayer();
 for(const d of days)for(let n=0;n<3;n++)season(mi).earned.push({id:`s${d}-${n}`,day:d,pt:10});
 mi=sanitizeCubePlayer(mi);
 assert.equal(cubeBalance(season(mi)),2700);
 let ki=emptyCubePlayer();
 for(const d of days)for(let n=0;n<3;n++)season(ki).earned.push({id:`k${d}-${n}`,day:d,pt:10});
 ki=applyCheer(sanitizeCubePlayer(ki),mi);
 assert.equal(season(ki).earned.length,480);
 assert.equal(cubeBalance(season(ki)),2700+210*3);
});
