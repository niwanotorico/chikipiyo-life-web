// ピヨドリル：4教科シャッフル（ぴよみ）のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeQuestionSet,seededRandom,checkAnswer,ZONES,MIX_PLANS,FIXED_ROUNDS,MIX_MATH_POOLS,QUESTIONS_PER_SET,hasSubjectMix} from '../src/drill/questions.js';
import {SUBJECT_BANKS} from '../src/drill/subjects/index.js';

const days=Array.from({length:29},(_,i)=>`2026-10-${String(i+3).padStart(2,'0')}`);
const set=(dayKey,round,rng=Math.random,motifs)=>makeQuestionSet('piyomi',rng,QUESTIONS_PER_SET,{dayKey,round,motifs});
const count=list=>list.reduce((a,q)=>(a[q.subject]=(a[q.subject]||0)+1,a),{});
const hasTriple=list=>list.some((s,i)=>i>=2&&s===list[i-1]&&s===list[i-2]);
// 算数の答えを式から計算しなおす
function solveMath(q){
 const t=q.tokens;
 if(q.kind==='word'){
  const s=t[0];let m;
  if((m=s.match(/^1000を (\d+)こ 集めた/)))return String(m[1]*1000);
  if((m=s.match(/^(\d+)を 10倍した/)))return String(m[1]*10);
  if((m=s.match(/^(\d+)を 10で わった/))){assert.equal(m[1]%10,0);return String(m[1]/10);}
  return null;   // ピヨ探検のモチーフ文章題など
 }
 const n=x=>Number(String(x).replace('万',''));
 const [a,op,b]=t;assert.equal(t[3],'=');
 return String({'+':n(a)+n(b),'−':n(a)-n(b),'×':n(a)*n(b),'÷':n(a)/n(b)}[op]);
}

test('ぴよみ だけ 4教科シャッフル。ぴよきちは 5年教材が入るまで算数だけ',()=>{
 assert.equal(hasSubjectMix('piyomi'),true);
 assert.equal(hasSubjectMix('piyokichi'),false);
 for(const d of days.slice(0,5))for(let r=0;r<5;r++)
  for(const q of makeQuestionSet('piyokichi',seededRandom(r+1),10,{dayKey:d,round:r}))assert.equal(q.choices,undefined);
});

test('1〜3回目：A・B・C の教科配分。合計 算数9・国語7・理科7・社会7',()=>{
 for(const d of days){
  const total={};
  MIX_PLANS.forEach((plan,r)=>{
   const c=count(set(d,r));
   assert.deepEqual(c,plan,`${d} ${'ABC'[r]}`);
   for(const [k,v] of Object.entries(c))total[k]=(total[k]||0)+v;
  });
  assert.deepEqual(total,{算数:9,国語:7,理科:7,社会:7});
 }
});

test('1〜3回目：その日・その人で固定（何回つくっても同じ）。日がかわると ちがう',()=>{
 for(const d of days)for(let r=0;r<FIXED_ROUNDS;r++){
  const a=set(d,r,Math.random),b=set(d,r,seededRandom(99));
  assert.deepEqual(a.map(q=>[q.text,q.choices]),b.map(q=>[q.text,q.choices]));
 }
 assert.notDeepEqual(set(days[0],0).map(q=>q.text),set(days[1],0).map(q=>q.text));
});

test('1〜3回目：30問の中で同じ問題は出ない',()=>{
 for(const d of days){
  const all=[0,1,2].flatMap(r=>set(d,r));
  assert.equal(all.length,30);
  assert.equal(new Set(all.map(q=>q.text)).size,30,d);
  const keys=all.filter(q=>q.bankKey).map(q=>q.bankKey);
  assert.equal(new Set(keys).size,keys.length);
 }
});

test('難易度カーブ（秒殺3・ふつう4・ちょいムズ2・ボス1）。ボスは算数。同じ教科は3問つづかない',()=>{
 for(const d of days)for(let r=0;r<6;r++){
  const s=set(d,r,seededRandom(r+7));
  assert.deepEqual(s.map(q=>q.zone),ZONES);
  assert.equal(s[9].subject,'算数');
  assert.ok(!hasTriple(s.map(q=>q.subject)),`${d} ${r}: ${s.map(q=>q.subject)}`);
 }
 // 3択の難しさは、ふだんは枠（秒殺＝easy・ふつう＝normal・ちょいムズ＝hard）と一致する
 let match=0,all=0;
 for(const d of days)for(let r=0;r<3;r++)for(const q of set(d,r).filter(q=>q.choices)){all++;if(q.level===q.zone)match++;}
 assert.ok(match/all>.95,`${match}/${all}`);
});

test('4回目以降：れんしゅう用に毎回つくりなおす（配分は A→B→C の型）',()=>{
 const d=days[0];
 const p1=set(d,3,seededRandom(1)),p2=set(d,3,seededRandom(2));
 assert.notDeepEqual(p1.map(q=>q.text),p2.map(q=>q.text));
 assert.deepEqual(count(p1),MIX_PLANS[0]);
 assert.deepEqual(count(set(d,4,seededRandom(3))),MIX_PLANS[1]);
 assert.deepEqual(count(set(d,5,seededRandom(4))),MIX_PLANS[2]);
 assert.equal(new Set(p1.map(q=>q.text)).size,10);
});

test('3択：選択肢3つ・正解が1つ。算数：答えが式と合う',()=>{
 for(const d of days)for(let r=0;r<4;r++)for(const q of set(d,r,seededRandom(r))){
  if(q.choices){
   assert.equal(q.choices.length,3);assert.equal(new Set(q.choices).size,3);
   assert.ok(q.choices.includes(q.answer));
   assert.equal(checkAnswer(q,q.answer).ok,true);
   for(const c of q.choices.filter(c=>c!==q.answer))assert.equal(checkAnswer(q,c).ok,false);
  }else{
   const a=solveMath(q);
   if(a!==null)assert.equal(q.answer,a,q.text);
   assert.ok(Number(q.answer)>0,q.text);
  }
 }
});

test('10月教材の算数（大きな数・かけ算の筆算）も出る',()=>{
 const texts=days.flatMap(d=>[0,1,2].flatMap(r=>set(d,r))).filter(q=>q.subject==='算数').map(q=>q.text);
 assert.ok(texts.some(t=>/^1000を \d+こ/.test(t)),'1000を いくつ');
 assert.ok(texts.some(t=>/10倍|10で わった/.test(t)),'10倍・10でわる');
 assert.ok(texts.some(t=>/0000 \+ \d0000/.test(t)),'1万の まとまり');
 assert.ok(texts.some(t=>/\d00万 − \d00万/.test(t)),'何百万の ひき算');
 assert.ok(texts.some(t=>/^\d{2} × \d = □$/.test(t)),'2けた×1けた');
 assert.ok(texts.some(t=>/^\d00 × \d = □$/.test(t)),'何百×1けた');
 for(const zone of ['easy','normal','hard','boss'])for(const k of MIX_MATH_POOLS.piyomi.pools[zone])assert.ok(MIX_MATH_POOLS.piyomi.makers[k],k);
});

test('ピヨ探検のモチーフは 算数の問題だけを おきかえる（固定セットは モチーフも固定）',()=>{
 const motifs=new Set(['usako','curry','toramana']);
 for(const d of days.slice(0,10))for(let r=0;r<4;r++){
  const base=set(d,r,seededRandom(5)),s=set(d,r,seededRandom(5),motifs);
  const m=s.filter(q=>q.motif);
  assert.equal(m.length,2);
  for(const q of m){
   const i=s.indexOf(q);
   assert.equal(base[i].choices,undefined,'元は算数');
   assert.equal(q.subject,'算数');assert.notEqual(q.zone,'boss');
  }
  s.forEach((q,i)=>{if(!q.motif)assert.equal(q.text,base[i].text);});
  if(r<3)assert.deepEqual(set(d,r,Math.random,motifs).map(q=>q.text),s.map(q=>q.text));
 }
});

test('問題プール：各教科25問以上・難しさの書き方・正解とまちがいが別',()=>{
 for(const [player,bank] of Object.entries(SUBJECT_BANKS)){
  for(const subject of ['国語','理科','社会']){
   const rows=bank.banks[subject];
   assert.ok(rows.length>=25,`${player} ${subject} ${rows.length}`);
   assert.equal(new Set(rows.map(r=>r[1])).size,rows.length,'問題文の重なりなし');
   for(const [level,text,answer,...wrong] of rows){
    assert.ok(['easy','normal','hard'].includes(level),text);
    assert.equal(wrong.length,2,text);
    assert.equal(new Set([answer,...wrong]).size,3,text);
   }
   for(const level of ['easy','normal','hard'])assert.ok(rows.filter(r=>r[0]===level).length>=5,`${subject} ${level}`);
  }
 }
});

test('教材のキャラクター名を 問題に使わない',()=>{
 const names=/キッズ|ラッキー|コラショ|ブン兄/;
 for(const bank of Object.values(SUBJECT_BANKS))for(const rows of Object.values(bank.banks))for(const r of rows)assert.ok(!names.test(r.join('')),r[1]);
});

test('ホーム画面：開始ボタンは「10もんチャレンジを はじめる」。特定の教科名を出さない',async ()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.match(html,/data-start[^>]*>10もんチャレンジを はじめる</);
 assert.ok(!/算数|国語|理科|社会/.test(html));
});
