// 「さっきの もんだいに もういちど！」と まちがえたときの「かんがえかた」：
// 得点・保存・ピヨ探検に さわっていないこと、説明が 答えと 合っていること、3問の えらび方、記録のしかた
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeQuestionSet,seededRandom,checkAnswer} from '../src/drill/questions.js';
import {explain} from '../src/drill/explain.js';
import {pickReview,reviewQuestion,REVIEW_MAX,REVIEW_KEY,loadReviewLog,offerReview,setReviewStatus,recordReviewAnswer} from '../src/drill/review.js';
import bank from '../src/drill/subjects/piyomi-g3.js';
import why from '../src/drill/subjects/piyomi-g3-why.js';

const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};
const sets=()=>{const out=[];for(const p of ['piyokichi','piyomi'])for(let r=0;r<300;r++)out.push(makeQuestionSet(p,seededRandom(r*13+5),undefined,{dayKey:r%2?`2026-10-${String(11+r%15).padStart(2,'0')}`:undefined,round:r%5,motifs:r%3?['usako','curry','toramana']:[]}));return out;};

// 制作元（piyodrill/web）でだけ 確かめる。公開先には バックアップが ないので とばす
const BACKUP=new URL('../../backups/web-before-retry-20261010/src/drill/scoring.js',import.meta.url);
test('得点・保存・ピヨ探検・問題づくりの ファイルは ふくしゅう追加の前と 同じ',{skip:!existsSync(BACKUP)&&'バックアップが ない（公開先）'},()=>{
 const sha=p=>createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex');
 for(const f of ['scoring.js','storage.js','cosmicube.js','cosmicube-store.js','cosmicube-ui.js','questions.js','subjects/piyomi-g3.js','subjects/index.js','festival.js','hype.js'])
  assert.equal(sha(`../src/drill/${f}`),sha(`../../backups/web-before-retry-20261010/src/drill/${f}`),f);
});

test('ふくしゅうの 処理は ポイント計算・保存・ピヨ探検pt を 呼ばない',()=>{
 const src=readFileSync(new URL('../src/drill/main.js',import.meta.url),'utf8');
 const from=src.indexOf('// ---------- さっきの もんだいに もういちど！'),to=src.indexOf('// ---------- 入力 ----------');
 assert.ok(from>0&&to>from);
 const part=src.slice(from,to).replace(/\/\/.*$/gm,'');   // コメントは のぞく
 for(const name of ['answerRun','commitResult','recordSession','persist(','saveStore','cube.','finish(','fever('])assert.ok(!part.includes(name),name);
 const rv=readFileSync(new URL('../src/drill/review.js',import.meta.url),'utf8');
 assert.ok(!/import/.test(rv),'review.js は ほかの ファイルに たよらない');
});

test('算数の かんがえかた：どの問題にも 出て、計算しなおした 答えと 合う',()=>{
 let n=0;
 for(const set of sets())for(const q of set){
  if(q.choices)continue;n++;
  const w=explain(q);
  assert.ok(w,`説明なし ${q.kind} ${q.text}`);
  assert.ok(w.includes(String(q.answer))||/たしかめよう/.test(w)&&w.includes(String(q.answer)),`答えが 入っていない ${q.text} → ${w}`);
 }
 assert.ok(n>3000);
});

test('説明が 合わない 問題には 説明を 出さない（まちがった 説明を 作らない）',()=>{
 assert.equal(explain({kind:'add',tokens:['12','+','30','=',{box:true}],answer:'43',unit:''}),null);
 assert.equal(explain({kind:'word',tokens:['1こ 60円の プリンを 5こ 買います。代金は 何円？'],answer:'301',unit:'円'}),null);
 assert.equal(explain({kind:'word',tokens:['しらない 文の 問題'],answer:'3',unit:''}),null);
 assert.equal(explain({kind:'fracEq',tokens:[{frac:[3,4]},'=',{frac:[null,12]}],answer:'8'}),null);
});

test('3択の 理由：問題文と 1対1。チェックずみ（true）の 行だけ 出る',()=>{
 for(const [subject,rows] of Object.entries(bank.banks)){
  const texts=rows.map(r=>r[1]),w=why[subject].map(r=>r[0]);
  assert.deepEqual([...w].sort(),[...texts].sort(),subject);
  for(const r of why[subject]){assert.equal(typeof r[1],'string');assert.ok(r[1].length>4&&r[1].length<70,r[1]);assert.equal(typeof r[2],'boolean');}
 }
 const q={kind:'choice',tokens:['「回る」の 読みは？'],choices:['まわる','かえる','はしる'],answer:'まわる'};
 const checked=why.国語.find(r=>r[0]===q.tokens[0])[2];
 assert.equal(explain(q)!==null,checked);
});

const run=(qs,oks)=>({questions:qs,answers:oks.map((ok,i)=>({id:qs[i].id,ok,given:ok?qs[i].answer:'0'}))});
const mk=(subjects)=>subjects.map((s,i)=>({id:`p-${i+1}`,text:`q${i+1}`,answer:'1',subject:s==='算数'?'算数':s,...(s!=='算数'?{choices:['1','2','3']}:{})}));

test('3問の えらび方：0問→なし／1問→1／4問以上→出題順で 教科が かぶらないように 最大3',()=>{
 const qs=mk(['算数','国語','算数','理科','国語','社会','算数','理科','算数','算数']);
 assert.deepEqual(pickReview(run(qs,Array(10).fill(true))),[]);
 assert.deepEqual(pickReview(run(qs,qs.map((_,i)=>i!==4))).map(p=>p.index),[4]);
 // まちがい：0算数 2算数 4国語 6算数 8算数 → 算数(0)・国語(4)・のこりは 出題順で 2
 const r=pickReview(run(qs,qs.map((_,i)=>![0,2,4,6,8].includes(i))));
 assert.deepEqual(r.map(p=>p.index),[0,2,4]);
 // 教科が 3つ以上 あれば ぜんぶ ちがう教科
 const r2=pickReview(run(qs,qs.map((_,i)=>![0,1,2,3,5].includes(i))));
 assert.equal(r2.length,REVIEW_MAX);assert.deepEqual(r2.map(p=>p.index),[0,1,3]);
 assert.equal(r2[0].given,'0');
 // 算数だけ（ぴよきち）
 const m=mk(Array(10).fill('算数'));
 assert.deepEqual(pickReview(run(m,m.map((_,i)=>i<5))).map(p=>p.index),[5,6,7]);
});

test('ふくしゅうの 問題：中身は 同じ、3択は 並びを 入れかえる',()=>{
 const q={id:'piyomi-3',kind:'choice',tokens:['t'],text:'t',answer:'a',choices:['a','b','c'],subject:'国語'};
 for(let s=1;s<20;s++){const r=reviewQuestion(q,seededRandom(s));
  assert.equal(r.id,'piyomi-3-r');assert.notDeepEqual(r.choices,q.choices);assert.deepEqual([...r.choices].sort(),['a','b','c']);
  assert.equal(checkAnswer(r,'a').ok,true);}
 assert.deepEqual(q.choices,['a','b','c'],'もとの 問題は かえない');
 const m={id:'x',kind:'add',tokens:['1','+','2','=',{box:true}],answer:'3'};
 assert.deepEqual(reviewQuestion(m).tokens,m.tokens);
});

test('記録：専用キーだけ／スキップも のこる／1問 1回だけ／はじめは まちがい・ふくしゅうで できた が わかる',()=>{
 const st=mem();st.setItem('chikipiyo-quest:v1','POINTS');st.setItem('chikipiyo-cosmicube:v1','CUBE');
 const qs=mk(['算数','国語','理科']);const picks=pickReview(run(qs,[false,false,true]));
 offerReview(st,{sessionId:'s1',player:'piyomi',dayKey:'2026-10-10',practice:false,picks});
 offerReview(st,{sessionId:'s1',player:'piyomi',dayKey:'2026-10-10',practice:false,picks});   // 2回目は かわらない
 let log=loadReviewLog(st);assert.equal(log.entries.length,1);assert.equal(log.entries[0].status,'offered');
 assert.deepEqual(log.entries[0].items.map(i=>[i.first,i.retry]),[['0',null],['0',null]]);
 setReviewStatus(st,'s1','started');
 recordReviewAnswer(st,'s1',0,{ok:true,given:'1'});
 recordReviewAnswer(st,'s1',0,{ok:false,given:'9'});   // 2回目は むし
 log=loadReviewLog(st);assert.equal(log.entries[0].items[0].retry,true);assert.equal(log.entries[0].status,'started');
 recordReviewAnswer(st,'s1',1,{ok:false,given:'2'});
 log=loadReviewLog(st);assert.equal(log.entries[0].status,'done');assert.deepEqual(log.entries[0].items.map(i=>i.retry),[true,false]);
 offerReview(st,{sessionId:'s2',player:'piyomi',dayKey:'2026-10-10',practice:true,picks});setReviewStatus(st,'s2','skipped');
 assert.equal(loadReviewLog(st).entries[1].status,'skipped');
 assert.equal(st.getItem('chikipiyo-quest:v1'),'POINTS');assert.equal(st.getItem('chikipiyo-cosmicube:v1'),'CUBE');
 assert.deepEqual([...st.m.keys()].sort(),[REVIEW_KEY,'chikipiyo-cosmicube:v1','chikipiyo-quest:v1'].sort());
 st.setItem(REVIEW_KEY,'{こわれた');assert.deepEqual(loadReviewLog(st).entries,[]);
 assert.deepEqual(loadReviewLog(null).entries,[]);
});
