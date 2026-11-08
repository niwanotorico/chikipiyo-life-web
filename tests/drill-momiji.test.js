import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SEASON,MOMIJI,momijiOpen,emptyCubePlayer,recordSession,openGate,season,cubeBalance,cubeEarnedTotal,nodeById,nodeState,effectsOf,mangaOf,applyCheer,sanitizeCubePlayer,mergeCubePlayer,coopReached,REWARDS} from '../src/drill/cosmicube.js';
import {CubeStore,localCubeAdapter,sameCube,CUBE_KEY,COOP_SEEN_KEY} from '../src/drill/cosmicube-store.js';
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
 assert.equal(nodeById('momiji-goal').reward,'switch2');   // 大ゴールは 2人の 協力ゴール
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
 // 11/8 から ぜんぶの マスに 中身が ある（全体 1190pt）
 assert.deepEqual(MOMIJI.nodes.filter(n=>!n.reward).map(n=>n.id),['momiji-start']);
 const total=MOMIJI.nodes.filter(n=>n.reward).reduce((a,n)=>a+n.cost,0);
 assert.equal(total,1190);
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

const OKU_CHICKEN=[4,5,6,7,8,9,10,11,12,13,14].map(n=>`momiji-oku-${String(n).padStart(2,'0')}`);
const toOku=()=>openPath(rich(2000),[...BEFORE_OKU,'momiji-oku-01','momiji-oku-02','momiji-oku-03']);

test('チキンポイント：マスごとの 金額は きまっている（合計 95pt）', ()=>{
 const want={'04':5,'06':5,'08':5,'10':5,'12':5,'05':10,'09':10,'11':10,'14':10,'07':15,'13':15};
 let sum=0;
 for(const id of OKU_CHICKEN){const r=REWARDS[nodeById(id).reward];assert.equal(r.chickenPoints,want[id.slice(-2)],id);sum+=r.chickenPoints;}
 assert.equal(sum,95);
 assert.equal(new Set(OKU_CHICKEN.map(id=>nodeById(id).reward)).size,11,'記録が 上書きされないよう ごほうびIDは マスごと');
});

test('チキンポイント：開けると 金額と 開けた日が のこる。50pt へる', ()=>{
 let p=toOku();
 const s=season(p),bal=cubeBalance(s);
 assert.equal(nodeState(s,nodeById('momiji-oku-04'),N1),'ready');
 assert.equal(nodeState(s,nodeById('momiji-oku-05'),N1),'fog');
 const r=openGate(p,'momiji-oku-04','2026-11-08');
 assert.equal(r.ok,true);assert.equal(r.reward,'chicken-momiji-oku-04');
 assert.equal(cubeBalance(season(r.player)),bal-50);
 assert.deepEqual(season(r.player).rewards['chicken-momiji-oku-04'],{on:'2026-11-08',house:false,chickenPoints:5});
 p=openPath(r.player,['momiji-oku-05','momiji-oku-06'],'2026-11-09');
 const q=sanitizeCubePlayer(JSON.parse(JSON.stringify(p)));
 assert.equal(season(q).rewards['chicken-momiji-oku-04'].chickenPoints,5);
 assert.equal(season(q).rewards['chicken-momiji-oku-05'].chickenPoints,10);
 assert.equal(season(q).rewards['chicken-momiji-oku-06'].on,'2026-11-09');
});

test('チキンポイント：2台を 合わせても 金額と 日付が のこる', ()=>{
 const p=openGate(toOku(),'momiji-oku-04','2026-11-08').player;
 const same=mergeCubePlayer(p,JSON.parse(JSON.stringify(p)));
 assert.deepEqual(season(same).rewards['chicken-momiji-oku-04'],{on:'2026-11-08',house:false,chickenPoints:5});
 assert.equal(cubeBalance(season(same)),cubeBalance(season(p)));
});

test('チキンポイント：古いページが 記録を 消しても ゲートから 取りもどす', ()=>{
 const p=openGate(toOku(),'momiji-oku-07','2026-11-08');
 assert.equal(p.reason,'locked');
 let q=openPath(toOku(),['momiji-oku-04','momiji-oku-05','momiji-oku-06','momiji-oku-07'],'2026-11-08');
 const stale=JSON.parse(JSON.stringify(q));
 for(const k of Object.keys(season(stale).rewards))if(k.startsWith('chicken-'))delete season(stale).rewards[k];
 const m=mergeCubePlayer(stale,stale);
 assert.deepEqual(season(m).rewards['chicken-momiji-oku-07'],{on:'2026-11-08',house:false,chickenPoints:15});
 assert.equal(sameCube(stale,m),false,'サーバーに 書きもどされる');
});

test('チキンポイントでは ptの 残高・おうえんは かわらない（通帳の ぶんは ドリルの pt に 入らない）', ()=>{
 const p=toOku(),q=openGate(p,'momiji-oku-04',N1).player;
 assert.equal(cubeEarnedTotal(season(q)),cubeEarnedTotal(season(p)));
 assert.equal(season(q).earned.length,season(p).earned.length);
});

test('大ゴール：Switch 2 は 2人の 協力ゴール。子どもには 名前を 出さない', ()=>{
 assert.equal(nodeById('momiji-goal').reward,'switch2');
 assert.equal(REWARDS.switch2.secret,true);
 assert.ok(!JSON.stringify(REWARDS.switch2).includes('Switch'));
 for(const who of ['piyomi','piyokichi'])assert.equal(parentLabel('switch2',who).name,'Switch 2 かいほう券（2人そろったら）');
 const lone=openPath(toOku(),OKU_CHICKEN);
 assert.equal(coopReached(lone,lone),false);
 const done=openGate(lone,'momiji-goal',N1).player;
 assert.equal(season(done).rewards.switch2.on,N1);
 assert.equal(coopReached(done,lone),false);
 assert.equal(coopReached(lone,done),false);
 assert.equal(coopReached(done,done),true);
});

test('協力ゴール：この端末で 見たかは 記録の データと べつに のこる', ()=>{
 const m=new Map(),storage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)};
 const a=new CubeStore({adapter:localCubeAdapter(storage)});
 assert.equal(a.coopSeen(),false);
 const before=m.get(CUBE_KEY);
 a.markCoopSeen();
 assert.equal(m.get(COOP_SEEN_KEY),'1');assert.equal(m.get(CUBE_KEY),before);
 assert.equal(new CubeStore({adapter:localCubeAdapter(storage)}).coopSeen(),true);
});

test('大ゴール：いちばん おくで 100pt。全体は 1190pt', ()=>{
 const goal=nodeById('momiji-goal');
 assert.equal(goal.cost,100);assert.equal(goal.reward,'switch2');
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
