// ちきぴよクエスト v0.2：ドパ演出の上昇曲線と、音のしくみ（偽の Web Audio で Node 上で確かめる）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stageFor,comboMilestone,nextDelay,WRONG_DELAY,FEVER,FEVER_MS,FEVER_SKIP_AFTER,tempo,keyShift,LAYERS,layersFor,visuals} from '../src/drill/hype.js';
import {QuestAudio,SOUND_KEY} from '../src/drill/audio.js';

test('段階：コンボ 2→すこし楽しい、3→もりあがる、5→かなり、8→おまつり。まちがいで下がる',()=>{
 assert.deepEqual([0,1,2,3,4,5,6,7,8,9].map(combo=>stageFor({combo,index:1})),[0,0,1,2,2,3,3,3,4,4]);
 assert.equal(stageFor({combo:0,index:3}),0,'前半のまちがいは ふつう にもどる');
 assert.equal(stageFor({combo:0,index:7}),1,'後半は ふつう まで落とさない');
 assert.equal(FEVER,5);
});

test('コンボの節目：2・3・5・8以上でカットイン、だんだん大きく',()=>{
 assert.equal(comboMilestone(1),null);
 assert.equal(comboMilestone(4),null);
 const sizes=[2,3,5,8,9].map(c=>comboMilestone(c).size);
 assert.deepEqual(sizes,[1,2,3,4,4]);
 assert.match(comboMilestone(9).text,/9/);
});

test('テンポ：正解から次の問題まで 0.6〜1.0 秒、盛り上がるほど少し余韻。まちがい・フィーバーの長さ',()=>{
 for(let s=0;s<=4;s++){const d=nextDelay(s);assert.ok(d>=600&&d<=1000,`${s}: ${d}`);if(s)assert.ok(d>nextDelay(s-1));}
 assert.ok(WRONG_DELAY>=1500&&WRONG_DELAY<=3000);
 assert.ok(FEVER_MS>=3000&&FEVER_MS<=5000,'クライマックスは長すぎない');
 assert.ok(FEVER_SKIP_AFTER<FEVER_MS);
});

test('上昇曲線：テンポ・楽器の層・演出量は段階ごとに増える（最初から最大にしない）',()=>{
 for(let s=1;s<=FEVER;s++){
  assert.ok(tempo(s)>tempo(s-1),`tempo ${s}`);
  const prev=layersFor(s-1),cur=layersFor(s);
  assert.ok(cur.size>prev.size,`layers ${s}`);
  const a=visuals(s-1),b=visuals(s);
  assert.ok(b.particles>a.particles,`particles ${s}`);
  assert.ok(b.shake>=a.shake&&b.flash>=a.flash);
 }
 assert.equal(visuals(0).shake,0,'ふつうの時は揺らさない');
 assert.equal(keyShift(4),0);assert.equal(keyShift(FEVER),2,'フィーバーで転調');
 assert.equal(LAYERS.length,FEVER+1);
});

test('prefers-reduced-motion：揺れ・フラッシュ・大きな動きをおさえる',()=>{
 for(let s=0;s<=FEVER;s++){
  const v=visuals(s,{reduced:true});
  assert.equal(v.shake,0);assert.equal(v.flash,0);assert.equal(v.ghosts,false);assert.equal(v.hop,'nod');
  assert.ok(v.particles<=visuals(s).particles/3);
 }
});

// ---- 偽の Web Audio：作られた音（発振器・ノイズ）を数える ----
class Param{constructor(v=0){this.value=v;}setValueAtTime(v){this.value=v;return this;}linearRampToValueAtTime(v){this.value=v;return this;}exponentialRampToValueAtTime(v){this.value=v;return this;}setTargetAtTime(v){this.value=v;return this;}cancelScheduledValues(){return this;}}
class Node{constructor(ctx){this.ctx=ctx;}connect(n){return n;}disconnect(){}}
function fakeAudio(){
 const made={osc:0,noise:0};
 class Ctx{
  constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=new Node(this);}
  resume(){this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
  createGain(){const n=new Node(this);n.gain=new Param(1);return n;}
  createDynamicsCompressor(){const n=new Node(this);for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param();return n;}
  createBiquadFilter(){const n=new Node(this);n.frequency=new Param(350);n.Q=new Param(1);return n;}
  createStereoPanner(){const n=new Node(this);n.pan=new Param();return n;}
  createConvolver(){return new Node(this);}
  createBuffer(ch,len){return {getChannelData:()=>new Float32Array(len)};}
  createOscillator(){made.osc++;const n=new Node(this);n.frequency=new Param(440);n.detune=new Param();n.start=()=>{};n.stop=()=>{};return n;}
  createBufferSource(){made.noise++;const n=new Node(this);n.start=()=>{};n.stop=()=>{};return n;}
 }
 return {Ctx,made};
}
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};}

// 1周（4小節＝64ステップ）で作られる音の数
function barNotes(stage,{muted=false}={}){
 const {Ctx,made}=fakeAudio();
 const a=new QuestAudio({storage:memoryStorage(),AudioCtx:Ctx});
 a.unlock();if(muted)a.setMuted(true);a.setStage(stage);
 const before=made.osc+made.noise;
 for(let s=0;s<64;s++)a.scheduleStep(s,s*.1);
 return made.osc+made.noise-before;
}

test('BGM：段階が上がるほど 1周あたりの音の数（厚み）が増える',()=>{
 const counts=[0,1,2,3,4,5].map(s=>barNotes(s));
 for(let s=1;s<counts.length;s++)assert.ok(counts[s]>counts[s-1],`stage ${s}: ${counts.join(',')}`);
 assert.ok(counts[5]>counts[0]*2.5,'フィーバーは ふつう の何倍も にぎやか');
});

test('効果音：正解音は段階で厚くなる。コンボで音程が上がる',()=>{
 const n=[];
 for(let s=0;s<=4;s++){const {Ctx,made}=fakeAudio();const a=new QuestAudio({storage:memoryStorage(),AudioCtx:Ctx});a.unlock();const b=made.osc+made.noise;a.correct(s,1);n.push(made.osc+made.noise-b);}
 for(let s=1;s<n.length;s++)assert.ok(n[s]>=n[s-1],n.join(','));
 assert.ok(n[4]>n[0]);
 const {Ctx}=fakeAudio();const a=new QuestAudio({storage:memoryStorage(),AudioCtx:Ctx});a.unlock();
 const pitches=[0,1,2,3,4,5].map(c=>a.tone(c));
 for(let i=1;i<pitches.length;i++)assert.ok(pitches[i]>pitches[i-1],'コンボで音が上がっていく');
});

test('ミュート：保存され、次に開いたときも ミュート。ミュート中は BGM の音を作らない',()=>{
 const st=memoryStorage();
 const {Ctx}=fakeAudio();
 const a=new QuestAudio({storage:st,AudioCtx:Ctx});
 assert.equal(a.muted,false);
 a.unlock();a.setMuted(true);
 assert.equal(st.getItem(SOUND_KEY),'off');
 assert.equal(new QuestAudio({storage:st,AudioCtx:Ctx}).muted,true);
 assert.equal(barNotes(4,{muted:true}),0);
 a.setMuted(false);assert.equal(st.getItem(SOUND_KEY),'on');
});

test('音が使えない環境（AudioContext なし）でも、すべての操作が落ちない',()=>{
 const a=new QuestAudio({storage:null,AudioCtx:undefined});
 assert.equal(a.available,false);assert.equal(a.unlock(),null);
 for(const f of ['tap','erase','point','wrong','reachOn','feverIn','fanfare','jiggle','finishSoft','suspend','resume'])a[f]();
 a.key(3);a.correct(4,8);a.comboUp(4);a.startMusic(2);a.setStage(3);a.stopMusic(1);a.setMuted(true);
});

test('自動再生制限：最初の unlock まで AudioContext を作らない。リーチ→フィーバーで転調',()=>{
 const {Ctx}=fakeAudio();let created=0;
 class Counting extends Ctx{constructor(){super();created++;}}
 const a=new QuestAudio({storage:memoryStorage(),AudioCtx:Counting});
 a.correct(2,3);
 assert.equal(created,0);
 a.unlock();a.unlock();assert.equal(created,1);
 a.setStage(4);a.reachOn();assert.equal(a.reach,true);
 a.feverIn();assert.equal(a.reach,false);assert.equal(a.stage,FEVER);assert.equal(a.trans,2);
 a.stopMusic();
});

test('drill.html：音のボタン・演出用の canvas・プリンフィーバーがある。音源ファイルを読み込まない',()=>{
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.equal((html.match(/data-sound[ >]/g)||[]).length,2,'ホームと問題中の2か所');assert.match(html,/data-stage/);
 assert.match(html,/data-fx/);assert.match(html,/data-fever/);assert.match(html,/プリン/);
 for(const f of ['audio.js','fx.js','hype.js','main.js']){
  const src=readFileSync(new URL(`../src/drill/${f}`,import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
  assert.ok(!/\.(mp3|ogg|wav|m4a)\b|new Audio\(|firebase|firestore/i.test(src),`${f}`);
 }
});

// ---------- v0.3 キャラクター演出（一枚絵の切り替え）・目玉焼き ----------
import {existsSync} from 'node:fs';
import {actorPlan,POSES,DUO,DUO_COMBOS,ALL_POSE_FILES,EGG_CHANCE,eggRoll,EGG_TIMES,EGG_NEXT_DELAY} from '../src/drill/hype.js';
import {seededRandom} from '../src/drill/questions.js';
import {createRun,answerRun} from '../src/drill/scoring.js';

test('素材：10枚すべて assets/drill/characters にあり、日本語名は半角に変えてある',()=>{
 assert.equal(ALL_POSE_FILES.length,10);
 for(const n of ALL_POSE_FILES){assert.match(n,/^[a-z0-9_-]+$/);assert.ok(existsSync(new URL(`../assets/drill/characters/${n}.png`,import.meta.url)),n);}
 for(const n of ['piyokichi-wrong','piyomi-wrong'])assert.ok(ALL_POSE_FILES.includes(n));
});

test('キャラ：ぴよきち／ぴよみで正しい絵に切り替わる',()=>{
 const k=c=>actorPlan({player:'piyokichi',combo:c}),m=c=>actorPlan({player:'piyomi',combo:c});
 assert.equal(k(1).from,'dance01');assert.equal(m(1).from,'dance02');
 assert.equal(k(3).apex,'spin');assert.equal(m(3).apex,'hands_up');
 assert.equal(m(6).apex,'headphones');assert.equal(m(9).apex,'dj');
 assert.equal(actorPlan({player:'piyokichi',ok:false}).from,'piyokichi-wrong');
 assert.equal(actorPlan({player:'piyomi',ok:false}).from,'piyomi-wrong');
 // ぴよきちの絵にぴよみ専用の絵を使わない（逆も）
 for(let c=1;c<=10;c++){
  const a=k(c),b=m(c);
  if(!a.duo)for(const n of [a.from,a.apex].filter(Boolean))assert.ok(['dance01','spin'].includes(n),`kichi ${c}: ${n}`);
  if(!b.duo)for(const n of [b.from,b.apex].filter(Boolean))assert.ok(['dance02','hands_up','headphones','dj'].includes(n),`mi ${c}: ${n}`);
 }
});

test('キャラ：1・3・5・8コンボで段階的に派手になる（1〜2 小ジャンプ／3〜4 大ジャンプ／5〜7 回転か2人／8〜 大回転・残像・フラッシュ・2人）',()=>{
 const rank={small:0,big:1,turn:2,duo:2,wild:3};
 const at=c=>actorPlan({player:'piyomi',combo:c});
 assert.equal(at(1).move,'small');assert.equal(at(2).move,'small');
 assert.equal(at(3).move,'big');assert.equal(at(4).move,'big');
 assert.ok(['turn','duo'].includes(at(5).move)&&['turn','duo'].includes(at(7).move));
 assert.ok(at(8).ghosts>=2&&at(8).flash&&at(8).duo);
 assert.ok(at(9).ghosts>=2&&at(9).flash);
 const lv=[1,3,5,8].map(c=>rank[at(c).move]+(at(c).ghosts?1:0)+(at(c).flash?1:0));
 for(let i=1;i<lv.length;i++)assert.ok(lv[i]>lv[i-1],lv.join(','));
});

test('2人演出は節目（5・8コンボ）だけ',()=>{
 for(let c=0;c<=12;c++){const p=actorPlan({player:'piyokichi',combo:c});assert.equal(p.duo,DUO_COMBOS.includes(c),`${c}`);}
 assert.equal(actorPlan({combo:5}).from,DUO.mid);assert.equal(actorPlan({combo:8}).from,DUO.high);
 assert.equal(actorPlan({ok:false,combo:5}).duo,false,'まちがいで2人は出ない');
});

test('まちがい：専用の絵で「びくっ」→ 沈むだけ（回転・残像・フラッシュ・揺れなし）',()=>{
 const p=actorPlan({player:'piyomi',ok:false});
 assert.equal(p.move,'wrong');assert.equal(p.ghosts,0);assert.equal(p.flash,false);
 const src=readFileSync(new URL('../src/drill/actor.js',import.meta.url),'utf8');
 const w=src.slice(src.indexOf("case 'wrong'"),src.indexOf('break;',src.indexOf("case 'wrong'")));
 assert.ok(!/rotate|ghost|flash/.test(w));
 assert.match(w,/duration:200/,'びくっ は 0.2 秒');
});

test('目玉焼き：約8%・1プレイ最大1回・10問目と2人の節目では出ない・?egg=1 で必ず',()=>{
 const rng=seededRandom(7);let n=0;for(let i=0;i<100000;i++)if(eggRoll({rng,combo:1}))n++;
 assert.equal(EGG_CHANCE,.08);assert.ok(Math.abs(n/100000-.08)<.004,`${n/100000}`);
 for(let seed=1;seed<=2000;seed++){const r=seededRandom(seed);let used=false,count=0;for(let i=0;i<10;i++){if(eggRoll({rng:r,used,isLast:i===9,combo:i+1})){used=true;count++;}}assert.ok(count<=1);}
 assert.equal(eggRoll({rng:()=>0,isLast:true}),false,'フィーバーと重ならない');
 for(const c of DUO_COMBOS)assert.equal(eggRoll({rng:()=>0,combo:c}),false,'2人演出と重ならない');
 assert.equal(eggRoll({rng:()=>.99,force:true,combo:1}),true);
 assert.equal(eggRoll({rng:()=>.99,force:true,used:true}),false);
});

test('目玉焼き：1.3〜1.8秒で通常進行へ。ぽすっ→ぷるん→ぴょん の順。保存しない・ポイントは変わらない',()=>{
 const T=EGG_TIMES;
 assert.ok(T.fall<T.land&&T.land<T.jiggle&&T.jiggle<T.hop&&T.hop<T.end);
 assert.ok(EGG_NEXT_DELAY>=1300&&EGG_NEXT_DELAY<=1800&&T.end<=1800);
 const main=readFileSync(new URL('../src/drill/main.js',import.meta.url),'utf8');
 assert.match(main,/actor\.egg\(.*?\);audio\.egg\(EGG_TIMES\)/,'絵と音は同じタイムライン');
 const storage=readFileSync(new URL('../src/drill/storage.js',import.meta.url),'utf8');
 assert.ok(!/egg/i.test(storage),'localStorage に保存しない');
 const qs=Array.from({length:10},(_,i)=>({id:`q${i}`,answer:String(i+1),decimal:false,unit:''}));
 let run=createRun(qs);for(let i=0;i<10;i++)({run}=answerRun(run,String(i+1)));
 assert.equal(run.earned,13,'演出はポイント計算の外');
});

test('動きを減らす設定：回転・残像・大きな移動をしない',()=>{
 const src=readFileSync(new URL('../src/drill/actor.js',import.meta.url),'utf8');
 const r=src.slice(src.indexOf(' playReduced(plan){'),src.indexOf('\n }',src.indexOf(' playReduced(plan){')));
 assert.ok(r.length>20&&!/rotate|translate|ghost/.test(r));
 assert.match(src,/if\(reduced\)return this\.playReduced\(plan\)/);
});

test('片づけ：演出の後にタイマー・アニメーション・小道具を残さない',()=>{
 const src=readFileSync(new URL('../src/drill/actor.js',import.meta.url),'utf8');
 const stop=src.slice(src.indexOf(' stop(){'),src.indexOf('\n }',src.indexOf(' stop(){')));
 for(const k of ['clearTimeout','cancel()','props.replaceChildren'])assert.ok(stop.includes(k),k);
 assert.match(src,/el\.remove\(\)/);
 const main=readFileSync(new URL('../src/drill/main.js',import.meta.url),'utf8');
 assert.match(main,/function leavePlay\(\)\{clearTimers\(\);actor\.reset\(\);/);
 assert.match(main,/actor\.rest\(\);\n renderQuestion\(\);/);
});
