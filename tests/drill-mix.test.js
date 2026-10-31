// ピヨドリル：4教科シャッフル（ぴよみ）のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeQuestionSet,seededRandom,checkAnswer,ZONES,MIX_PLANS,FIXED_ROUNDS,MIX_MATH_POOLS,QUESTIONS_PER_SET,hasSubjectMix} from '../src/drill/questions.js';
import {SUBJECT_BANKS,weekIndex} from '../src/drill/subjects/index.js';

const days=Array.from({length:29},(_,i)=>`2026-10-${String(i+3).padStart(2,'0')}`);
const novDays=Array.from({length:30},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
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
 if(t.length===7){assert.equal(t[5],'=');assert.ok(t[1]==='×'&&t[3]==='×');return String(n(t[0])*n(t[2])*n(t[4]));}   // 3つの数の かけ算
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
 for(const d of [...days,...novDays])for(const zone of ['easy','normal','hard','boss'])for(const k of MIX_MATH_POOLS.piyomi.pools(d)[zone])assert.ok(MIX_MATH_POOLS.piyomi.makers[k],k);
});

test('ピヨ探検のモチーフは 算数の問題だけを おきかえる（固定セットは モチーフも固定）',()=>{
 const motifs=new Set(['usako','curry','toramana']);
 for(const d of days.slice(0,10))for(let r=0;r<4;r++){
  const base=set(d,r,seededRandom(5)),s=set(d,r,seededRandom(5),motifs);
  const m=s.filter(q=>q.motif);
  assert.equal(m.length,2);
  for(const q of m){
   const i=s.indexOf(q);
   assert.equal(base[i].subject,'算数','元は算数');
   assert.equal(q.subject,'算数');assert.notEqual(q.zone,'boss');
  }
  s.forEach((q,i)=>{if(!q.motif)assert.equal(q.text,base[i].text);});
  if(r<3)assert.deepEqual(set(d,r,Math.random,motifs).map(q=>q.text),s.map(q=>q.text));
 }
});

// 1人分の 問題の山を ぜんぶ（今月の 週ごと＋先月）
const allBanks=bank=>[...bank.weeks.map(w=>w.banks),...(bank.review?[bank.review.banks]:[])];

test('問題プール：難しさの書き方・正解とまちがいが別。週ごとに 各教科 9問以上・どの難しさも 3問以上',()=>{
 for(const [player,bank] of Object.entries(SUBJECT_BANKS)){
  for(const subject of ['国語','理科','社会']){
   const all=allBanks(bank).flatMap(b=>b[subject]);
   assert.equal(new Set(all.map(r=>r[1])).size,all.length,`${player} ${subject}：先月・今月を 通して 問題文の重なりなし`);
   for(const [level,text,answer,...wrong] of all){
    assert.ok(['easy','normal','hard'].includes(level),text);
    assert.equal(wrong.length,2,text);
    assert.equal(new Set([answer,...wrong]).size,3,text);
   }
   bank.weeks.forEach((w,k)=>{
    const rows=w.banks[subject];
    assert.ok(rows.length>=9,`${player} ${k+1}週め ${subject} ${rows.length}`);
    for(const level of ['easy','normal','hard'])assert.ok(rows.filter(r=>r[0]===level).length>=3,`${k+1}週め ${subject} ${level}`);
   });
  }
 }
});

test('教材のキャラクター名を 問題に使わない',()=>{
 const names=/キッズ|ラッキー|コラショ|ブン兄/;
 for(const bank of Object.values(SUBJECT_BANKS))for(const banks of allBanks(bank))for(const rows of Object.values(banks))for(const r of rows)assert.ok(!names.test(r.join('')),r[1]);
});

// ---------- 11月：週ごとに すすむ ----------
const weekOfText=(()=>{const m=new Map();SUBJECT_BANKS.piyomi.weeks.forEach((w,k)=>{for(const rows of Object.values(w.banks))for(const r of rows)m.set(r[1],k);});return m;})();

test('週の きりかわり：11/1〜7 は 1週め、8日から 2週め、15日から 3週め、22日から 4週め。10月中は 1週め',()=>{
 const w=SUBJECT_BANKS.piyomi.weeks;
 assert.deepEqual(['2026-10-31','2026-11-01','2026-11-07','2026-11-08','2026-11-14','2026-11-15','2026-11-22','2026-11-30','2026-12-05'].map(d=>weekIndex(w,d)),[0,0,0,1,1,2,3,3,3]);
});

test('11月の 国語・理科・社会：まだ 来ていない 週の 問題は 出ない。いまの週の 問題が いちばん 多い',()=>{
 let curTotal=0,allTotal=0;
 for(const d of novDays){
  const now=weekIndex(SUBJECT_BANKS.piyomi.weeks,d),count=[0,0,0,0],old={n:0};
  for(const q of [0,1,2].flatMap(r=>set(d,r)).filter(q=>q.choices&&q.subject!=='算数')){
   const k=weekOfText.get(q.tokens[0]);
   if(k===undefined){old.n++;continue;}   // 10月の ふくしゅう
   assert.ok(k<=now,`${d}：${k+1}週めの 問題が もう 出ている ${q.tokens[0]}`);
   count[k]++;
  }
  // 1日 21問（国語・理科・社会）。重みは いまの週 6：前の週 3：10月 1 なので、ふつうは 12問くらい。日による ばらつきは ある
  assert.ok(count[now]>=6,`${d}：いまの週 ${count[now]}問`);
  assert.ok(count[now]>Math.max(old.n,...count.filter((_,k)=>k!==now)),`${d}：${count} / 10月 ${old.n}`);
  curTotal+=count[now];allTotal+=old.n+count.reduce((a,b)=>a+b,0);
 }
 assert.ok(curTotal/allTotal>.5,`1か月の 平均：いまの週 ${curTotal}/${allTotal}`);
});

test('11月の 算数：週ごとの 単元が 出る（円と球・小数は 2週めから）',()=>{
 const texts=d=>[0,1,2].flatMap(r=>set(d,r)).filter(q=>q.subject==='算数');
 const wk=(from,to)=>novDays.slice(from,to).flatMap(texts);
 assert.ok(!wk(0,7).some(q=>q.label==='円と球'||q.label==='小数'),'1週めに 円と球・小数は 出ない');
 assert.ok(wk(0,7).some(q=>/^\d{3} × \d = □$/.test(q.text)),'3けた×1けた');
 assert.ok(wk(0,7).some(q=>/^\d+ × \d+ × \d+ = □$/.test(q.text)),'3つの数の かけ算');
 assert.ok(wk(0,7).some(q=>/^\d0 ÷ \d = □$/.test(q.text)),'何十÷1けた');
 assert.ok(wk(7,14).some(q=>q.label==='円と球'),'2週め：円');
 assert.ok(!wk(7,14).some(q=>q.label==='小数'),'2週めに 小数は 出ない');
 assert.ok(wk(14,21).some(q=>q.label==='小数'),'3週め：小数');
 assert.ok(wk(14,30).some(q=>q.figure&&/花びら/.test(q.text)),'3週めから：花びらの もよう');
 assert.ok(wk(21,30).some(q=>q.figure&&/正方形/.test(q.text)),'4週め：正方形の もよう');
});

test('図の 問題：SVG つきの 3択（テンキーは 出さない）。ア・イ・ウ は 図の 中に 答えが ある／長さは 小さい じゅん',()=>{
 let n=0;
 for(const d of novDays)for(let r=0;r<6;r++)for(const q of set(d,r,seededRandom(r+3)).filter(q=>q.figure)){
  n++;
  assert.match(q.figure,/^<svg class="dq-fig" viewBox="[-\d. ]+" role="img" aria-label="[^"]+">.*<\/svg>$/s);
  assert.ok(!/undefined|NaN/.test(q.figure),q.text);
  assert.equal(q.choices?.length,3,q.text);assert.ok(q.why,q.text);
  if(q.choices[0]==='ア'){assert.deepEqual(q.choices,['ア','イ','ウ']);assert.ok(q.figure.includes(`>${q.answer}</text>`));}
  else{assert.ok(q.why.endsWith(`＝${q.answer}`),`${q.text} → ${q.why}`);const v=q.choices.map(c=>{assert.match(c,/^\d+cm$/);return parseInt(c);});assert.deepEqual(v,[...v].sort((a,b)=>a-b));}
 }
 assert.ok(n>50,`図の 問題 ${n}`);
});

test('ホーム画面：開始ボタンは「10もんチャレンジを はじめる」。特定の教科名を出さない',async ()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.match(html,/data-start[^>]*>10もんチャレンジを はじめる</);
 assert.ok(!/算数|国語|理科|社会/.test(html));
});

test('モチーフの文章題：たべ物は「たべる」。いちご・クッキーなどを「つかう」と書かない', ()=>{
 const motifs=new Set(['usako','curry','toramana']);let seen=0;
 for(let r=0;r<400;r++)for(const p of ['piyomi','piyokichi'])for(const q of makeQuestionSet(p,seededRandom(r*7+3),QUESTIONS_PER_SET,{motifs})){
  const t=q.text.join?q.text.join(''):String(q.text);
  for(const f of ['いちご','クッキー','おにぎり','カレーパン'])if(t.includes(f)&&/つか[うい]/.test(t))assert.fail(t);
  if(/たべ/.test(t))seen++;
 }
 assert.ok(seen>0,'たべる 問題が 出ている');
});

test('kg の文章題：ふだんは カレー屋さんの しいれ。だいぐい（たべます）は たまにだけ', ()=>{
 const motifs=new Set(['usako','curry','toramana']);let kg=0,oogui=0;
 for(let r=0;r<3000;r++)for(const q of makeQuestionSet('piyokichi',seededRandom(r*11+1),QUESTIONS_PER_SET,{motifs})){
  const t=q.text.join?q.text.join(''):String(q.text);
  if(!/1日に [\d.]+kg/.test(t))continue;kg++;
  if(/たべます/.test(t)){oogui++;assert.ok(t.startsWith('なんと！'),t);}
  else assert.ok(/カレー屋さんでは、(じゃがいも|にんじん|たまねぎ)を/.test(t),t);
 }
 assert.ok(kg>50,`kg ${kg}`);assert.ok(oogui>0,'レアも 出る');assert.ok(oogui/kg<.2,`${oogui}/${kg}`);
});
