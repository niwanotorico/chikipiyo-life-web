// ピヨ探検（10月の報酬マップ）のルール・保存・問題モチーフのテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import {SEASON,MAP,REWARDS,emptyCubePlayer,recordSession,openGate,mergeCubePlayer,season,cubeBalance,playsOn,completion,nodeState,mapView,nodeById,openableNodes,effectsOf,sanitizeCubePlayer,pendingHouseVisits} from '../src/drill/cosmicube.js';
import {CubeStore,localCubeAdapter,memoryCubeAdapter,CUBE_KEY,CUBE_BROKEN_KEY} from '../src/drill/cosmicube-store.js';
import {makeQuestionSet,seededRandom,checkAnswer} from '../src/drill/questions.js';
import {commitResult,emptyStore,STORE_KEY} from '../src/drill/storage.js';

const D='2026-10-05';
const award=(points,{practice=false,cleared=true}={})=>({points,practice,cleared});
function fakeStorage(init={}){const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};}
function earn(p,n,{day=D,pt=20}={}){for(let i=0;i<n;i++)p=recordSession(p,{sessionId:`s-${day}-${i}-${Math.random()}`,dayKey:day,award:award(pt)}).player;return p;}
function richPlayer(pt){let p=emptyCubePlayer();const days=Math.ceil(pt/60);for(let d=0;d<days;d++)p=earn(p,3,{day:`2026-10-${String(3+d).padStart(2,'0')}`,pt:20});return p;}

test('scoring のポイントがそのままキューブpt に入る・同じ回は二度入らない', ()=>{
 let p=emptyCubePlayer();
 const r=recordSession(p,{sessionId:'a',dayKey:D,award:award(17)});
 assert.equal(r.cubePt,17);assert.equal(r.reason,'ok');
 assert.equal(cubeBalance(season(r.player)),17);
 const again=recordSession(r.player,{sessionId:'a',dayKey:D,award:award(17)});
 assert.equal(again.reason,'duplicate');assert.equal(cubeBalance(season(again.player)),17);
});

test('1日3回まで・4回目以降（れんしゅう）と期間外は入らない', ()=>{
 let p=emptyCubePlayer();
 for(let i=0;i<3;i++){const r=recordSession(p,{sessionId:`x${i}`,dayKey:D,award:award(10)});assert.equal(r.reason,'ok');p=r.player;}
 assert.equal(recordSession(p,{sessionId:'x3',dayKey:D,award:award(10)}).reason,'limit');
 assert.equal(recordSession(p,{sessionId:'x4',dayKey:D,award:award(0,{practice:true})}).reason,'practice');
 assert.equal(recordSession(p,{sessionId:'x5',dayKey:'2026-11-01',award:award(10)}).reason,'season');
 assert.equal(recordSession(p,{sessionId:'x6',dayKey:'2026-10-02',award:award(10)}).reason,'season');
 assert.equal(recordSession(p,{sessionId:'x7',dayKey:'2026-10-06',award:award(10)}).reason,'ok');   // 次の日はまた入る
 assert.equal(playsOn(season(p),D),3);
 assert.equal(cubeBalance(season(p)),30);
});

test('チキンコインミッション：その日の1回目クリアだけ達成。期間外やれんしゅうでも記録する', ()=>{
 let r=recordSession(emptyCubePlayer(),{sessionId:'a',dayKey:D,award:award(10)});
 assert.equal(r.coinNew,true);assert.equal(r.player.coin[D],'a');
 r=recordSession(r.player,{sessionId:'b',dayKey:D,award:award(10)});
 assert.equal(r.coinNew,false);assert.equal(r.player.coin[D],'a');
 r=recordSession(r.player,{sessionId:'c',dayKey:'2026-11-02',award:award(10)});
 assert.equal(r.coinNew,true);
});

test('ゲート：前がぜんぶ開いていて、pt が足りれば開く。pt は消費される', ()=>{
 let p=richPlayer(1000);
 const before=cubeBalance(season(p));
 assert.equal(openGate(p,'toramana',D).reason,'locked');      // カレーが先
 assert.equal(openGate(p,'deep',D).reason,'locked');
 assert.equal(openGate(p,'slot-a',D).reason,'empty');         // 空きスロットは開かない
 assert.equal(openGate(p,'slot-left',D).reason,'empty');
 assert.equal(openGate(p,'start',D).reason,'unknown');
 const r=openGate(p,'curry',D);
 assert.equal(r.ok,true);assert.equal(r.reward,'curry');
 assert.equal(cubeBalance(season(r.player)),before-nodeById('curry').cost);
 assert.equal(season(r.player).position,'curry');
 assert.deepEqual(season(r.player).rewards.curry,{on:D,house:false});
 assert.equal(openGate(r.player,'curry',D).reason,'open');
 assert.ok(effectsOf(r.player).has('curry'));
 assert.deepEqual(pendingHouseVisits(r.player),[]);
 const t=openGate(r.player,'toramana',D);
 assert.equal(t.ok,true);assert.deepEqual(pendingHouseVisits(t.player),['toramana']);
});

test('pt が足りないと開かない', ()=>{
 const p=earn(emptyCubePlayer(),1,{pt:10});
 assert.equal(openGate(p,'curry',D).reason,'short');
});

test('分岐は排他ではない：どの順番でも、ぜんぶ開けて 100%', ()=>{
 const total=openableNodes().reduce((a,n)=>a+n.cost,0);
 for(const order of [['bgm','curry','toramana','deep'],['curry','toramana','bgm','deep'],['curry','bgm','toramana','deep']]){
  let p=richPlayer(total);
  for(const id of order){const r=openGate(p,id,D);assert.equal(r.ok,true,`${order}: ${id} ${r.reason}`);p=r.player;}
  assert.deepEqual(completion(season(p)),{done:4,total:4,percent:100});
  assert.equal(cubeBalance(season(p)),richPlayer(total).seasons[SEASON.id].earned.reduce((a,e)=>a+e.pt,0)-total);
 }
});

test('メインのゲートのコスト合計は、毎日1回（約15pt）× 期間 で届く', ()=>{
 const total=openableNodes().reduce((a,n)=>a+n.cost,0);
 const days=(Date.parse(SEASON.end)-Date.parse(SEASON.start))/864e5+1;
 assert.ok(total<=15*days,`total ${total} / ${15*days}`);
 assert.ok(total>=10*days*.8,'かんたんすぎない');
});

test('見えかた：となりは ❓、遠くは霧。最奥は片方だけ開くと 🔒', ()=>{
 let p=richPlayer(1000);const s0=season(p);
 assert.equal(nodeState(s0,nodeById('slot-left')),'soon');   // 左40pt は ❓ の空きスロット
 assert.equal(nodeState(s0,nodeById('bgm')),'ready');
 assert.equal(nodeState(s0,nodeById('curry')),'ready');
 assert.equal(nodeState(s0,nodeById('deep')),'fog');
 p=openGate(p,'bgm',D).player;
 const s=season(p);
 assert.equal(nodeState(s,nodeById('deep')),'near');
 assert.equal(nodeState(s,nodeById('slot-a')),'fog');
 assert.equal(nodeState(s,nodeById('toramana')),'fog');
 // 親モードは霧なし
 assert.ok(mapView(s0,{parent:true}).every(v=>v.state!=='fog'));
});

test('最奥の中身は 子ども2人とも ❓。親モード（仮）だけで確認できる', async ()=>{
 const {rewardFace}=await import('../src/drill/cosmicube-ui.js');
 const {parentLabel,isParentMode}=await import('../src/drill/parent-mode.js');
 for(const player of ['piyomi','piyokichi']){
  const face=JSON.stringify(rewardFace('deep',player));
  assert.ok(!face.includes('メロガッパ'),player);assert.ok(face.includes('❓'),player);
 }
 const parent={label:parentLabel};
 assert.equal(rewardFace('deep','piyomi',parent).name,'メロガッパFC 3か月権');
 assert.equal(rewardFace('deep','piyokichi',parent).name,'（未定）');
 assert.equal(rewardFace('usako','piyomi',parent).name,'うさこ');
 // 親にだけ見せる中身は parent-mode.js にしかない
 for(const f of ['cosmicube.js','cosmicube-ui.js','cosmicube-store.js','main.js']){
  const {readFileSync}=await import('node:fs');
  assert.ok(!readFileSync(new URL(`../src/drill/${f}`,import.meta.url),'utf8').includes('メロガッパ'),f);
 }
 assert.equal(isParentMode({search:'?parent=1'}),true);
 assert.equal(isParentMode({search:''}),false);
 assert.equal(isParentMode({search:'?parent=0'}),false);
});

test('2台の記録を合わせても、pt・ゲートは二重にならない（将来の同期用）', ()=>{
 let a=richPlayer(200),b=emptyCubePlayer();
 b=earn(b,2,{day:'2026-10-20',pt:15});
 a=openGate(a,'bgm',D).player;
 const both=openGate(a,'curry','2026-10-06').player;
 const b2=openGate(richPlayer(200),'curry','2026-10-07').player;
 const m=mergeCubePlayer(both,b);
 assert.equal(season(m).earned.length,season(both).earned.length+2);
 assert.equal(cubeBalance(season(m)),cubeBalance(season(both))+30);
 assert.deepEqual(mergeCubePlayer(m,m),sanitizeCubePlayer(m));   // 何度合わせても同じ
 const m2=mergeCubePlayer(both,b2);
 assert.equal(season(m2).gates.curry.on,'2026-10-06');            // 同じゲートは1回ぶん
});

test('保存：壊れたデータは退避して作りなおす・既存ドリルの保存キーには触らない', ()=>{
 const st=fakeStorage({[CUBE_KEY]:'{broken',[STORE_KEY]:'{"keep":1}'});
 const cube=new CubeStore({adapter:localCubeAdapter(st)});
 assert.equal(cube.status,'recovered');
 assert.equal(st.getItem(CUBE_BROKEN_KEY),'{broken');
 assert.equal(st.getItem(STORE_KEY),'{"keep":1}');
 cube.recordSession('piyomi',{sessionId:'s1',dayKey:D,award:award(12)});
 const again=new CubeStore({adapter:localCubeAdapter(st)});
 assert.equal(again.snapshot('piyomi',D).cubePt,12);
 assert.equal(again.snapshot('piyomi',D).coinToday,true);
 assert.equal(again.snapshot('piyokichi',D).cubePt,0);
 assert.equal(st.getItem(STORE_KEY),'{"keep":1}');
});

test('保存先が使えなくても落ちない（メモリ）・スナップショットに必要な項目がそろう', ()=>{
 const cube=new CubeStore({adapter:memoryCubeAdapter()});
 cube.recordSession('piyokichi',{sessionId:'s1',dayKey:D,award:award(50)});
 const r=cube.openGate('piyokichi','curry',D);assert.equal(r.ok,true);
 const snap=cube.snapshot('piyokichi',D);
 for(const k of ['cubePt','gates','rewards','position','playsToday','coinToday','completion'])assert.ok(k in snap,k);
 assert.equal(snap.cubePt,0);assert.deepEqual(snap.gates,['curry']);assert.equal(snap.completion.percent,25);
 assert.deepEqual(Object.keys(cube.snapshotAll(D)).sort(),['piyokichi','piyomi']);
});

test('ドリルの記録（commitResult）からキューブpt へ：同じ award の points が入る', ()=>{
 const oks=Array(10).fill(true);
 const {award:a}=commitResult(emptyStore(),{sessionId:'s',player:'piyomi',dayKey:D,oks});
 const r=recordSession(emptyCubePlayer(),{sessionId:'s',dayKey:D,award:a});
 assert.equal(r.cubePt,a.points);assert.ok(a.points>0);
});

test('モチーフ：ごほうびがなければ問題は今までと同じ。あれば文章題にうさこ・カレー・トラマナ', ()=>{
 for(const player of ['piyomi','piyokichi'])for(let seed=1;seed<=30;seed++){
  assert.deepEqual(makeQuestionSet(player,seededRandom(seed),10,{motifs:new Set()}),makeQuestionSet(player,seededRandom(seed)));
 }
 const seen={usako:0,curry:0,toramana:0};
 for(const player of ['piyomi','piyokichi'])for(let seed=1;seed<=200;seed++){
  const set=makeQuestionSet(player,seededRandom(seed),10,{motifs:new Set(['usako','curry','toramana'])});
  assert.equal(set.length,10);
  const m=set.filter(q=>q.motif);
  assert.equal(m.length,2);
  for(const q of m){
   assert.equal(q.zone,'normal');assert.equal(q.kind,'word');
   assert.ok(Number(q.answer)>0,q.text);
   assert.ok(checkAnswer(q,q.answer).ok);
   if(q.text.includes('うさこ'))seen.usako++;
   if(/カレー|じゃがいも|にんじん/.test(q.text))seen.curry++;
   if(q.text.includes('トラマナちゃん'))seen.toramana++;
   assert.ok(!/トラマナ(?!ちゃん)/.test(q.text),q.text);
  }
 }
 assert.ok(seen.usako>0&&seen.curry>0&&seen.toramana>0,JSON.stringify(seen));
 // 3択セットの日はモチーフを入れない
 const daily=makeQuestionSet('piyomi',seededRandom(1),10,{dayKey:'2026-10-02',motifs:['usako']});
 assert.ok(daily.every(q=>!q.motif));
});

test('マップ定義：ノードIDは重複なし・requires は存在するノード', ()=>{
 const ids=MAP.nodes.map(n=>n.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const n of MAP.nodes)for(const r of n.requires)assert.ok(nodeById(r),`${n.id} → ${r}`);
 for(const n of openableNodes())assert.ok(REWARDS[n.reward]);
});

test('BGM プール：ごほうびがなければ いつもの曲だけ。あれば usako.mp3 も抽選に入る', async ()=>{
 const {pickTrack,BGM_TRACKS}=await import('../src/drill/bgm-pool.js');
 assert.equal(pickTrack(new Set()),null);
 assert.ok(BGM_TRACKS.some(t=>t.url.endsWith('/bgm/usako.mp3')));
 const rng=seededRandom(3),got=new Set();
 for(let i=0;i<50;i++)got.add(pickTrack(new Set(['bgm']),rng)?.id??'synth');
 assert.deepEqual([...got].sort(),['synth','usako']);
 const {existsSync}=await import('node:fs');
 assert.ok(existsSync(new URL('../bgm/usako.mp3',import.meta.url)));
});

test('見える名前：ピヨ探検・トラマナちゃん（コズミキューブ・トラマナ単独の表記は出さない）', async ()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.match(html,/ピヨ探検/);assert.ok(!html.includes('コズミキューブ'));
 for(const f of ['cosmicube.js','cosmicube-ui.js','main.js','questions.js']){
  const src=readFileSync(new URL(`../src/drill/${f}`,import.meta.url),'utf8');
  assert.ok(!src.includes('コズミキューブ'),f);assert.ok(!/トラマナ(?!ちゃん)/.test(src),f);
 }
 assert.equal(REWARDS.toramana.name,'トラマナちゃん');
 assert.equal(REWARDS.usako.house,undefined);
 assert.equal(REWARDS.usako.note,'もんだいに うさこが でてくる');
});

test('マップの現在地キャラ：ぴよきち・ぴよみ それぞれの ドット絵素材がある', async ()=>{
 const {MAP_CHAR}=await import('../src/drill/cosmicube-ui.js');
 const {existsSync}=await import('node:fs');
 assert.ok(MAP_CHAR.piyokichi.endsWith('/assets/drill/characters/piyokichi_ipad.png'));
 assert.ok(MAP_CHAR.piyomi.endsWith('/assets/drill/characters/piyomi_ipad.png'));
 for(const f of ['piyokichi_ipad.png','piyomi_ipad.png'])assert.ok(existsSync(new URL(`../assets/drill/characters/${f}`,import.meta.url)),f);
});

test('トラマナちゃんの絵：toramana_jump.png を使う（開放後のマスと開放演出）', async ()=>{
 const {REWARD_ART}=await import('../src/drill/cosmicube-ui.js');
 const {existsSync,readFileSync}=await import('node:fs');
 assert.ok(REWARD_ART.toramana.endsWith('/assets/drill/characters/toramana_jump.png'));
 assert.ok(existsSync(new URL('../assets/drill/characters/toramana_jump.png',import.meta.url)));
 const ui=readFileSync(new URL('../src/drill/cosmicube-ui.js',import.meta.url),'utf8');
 assert.match(ui,/state==='open'&&REWARD_ART\[node\.reward\]/,'未開放は ❓ のまま');
 assert.ok(!ui.includes('toramana_joy'));
});

test('左40pt は ❓ の空きスロット：うさこを置かない（うさこは10月後半に別のごほうびで追加予定）', async ()=>{
 const left=nodeById('slot-left');
 assert.equal(left.cost,40);assert.equal(left.x,24);assert.equal(left.reward,null);
 assert.ok(MAP.nodes.every(n=>n.reward!=='usako'));
 // 空きスロットがあっても、ほかのゲートと最奥には行ける
 for(const n of openableNodes())assert.ok(n.requires.every(id=>id===MAP.start||openableNodes().some(o=>o.id===id)),n.id);
 // 子ども画面では ❓（じゅんびちゅう）、親モードでも中身は出ない
 const s=season(emptyCubePlayer());
 assert.equal(nodeState(s,left),'soon');
 assert.equal(mapView(s,{parent:true}).find(v=>v.node.id==='slot-left').state,'soon');
});
