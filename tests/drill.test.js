// ピヨドリル（drill.html）の問題生成・判定・ポイント・保存のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYERS,makeQuestionSet,seededRandom,normalizeAnswer,checkAnswer,QUESTIONS_PER_SET,ZONES} from '../src/drill/questions.js';
import {createRun,answerRun,scoreAnswers,POINTS} from '../src/drill/scoring.js';
import {loadStore,saveStore,commitResult,emptyStore,sanitizeStore,setPuddingDisplayed,selectPlayer,dayInfo,sessionsLeft,todayKey,STORE_KEY,BROKEN_KEY,DAILY_REWARD_SESSIONS} from '../src/drill/storage.js';

// ---- 問題とは別に、表示された式から答えを計算しなおす（10倍整数で誤差なし） ----
const toT=s=>{const [w,f='']=String(s).split('.');assert.ok(f.length<=1,`小数第1位まで: ${s}`);return Number(w)*10+Number(f||0);};
const fromT=t=>t%10===0?String(t/10):`${Math.floor(t/10)}.${t%10}`;
function solve(q){
 const t=q.tokens;
 if(q.kind==='word'){
  const s=t[0];let m;
  if((m=s.match(/^1こ (\d+)円の プリンを (\d+)こ/)))return String(m[1]*m[2]);
  if((m=s.match(/^(\d+)まいの シールを (\d+)人で/))){assert.equal(m[1]%m[2],0,s);return String(m[1]/m[2]);}
  if((m=s.match(/たて (\d+)cm、よこ (\d+)cm/)))return String(m[1]*m[2]);
  if((m=s.match(/^1000円で (\d+)円の/)))return String(1000-m[1]);
  if((m=s.match(/1日に (\d+)ページずつ 読むと、(\d+)日で/)))return String(m[1]*m[2]);
  if((m=s.match(/^([\d.]+)mの リボンから ([\d.]+)m/)))return fromT(toT(m[1])-toT(m[2]));
  throw new Error('unknown word problem: '+s);
 }
 if(t.some(x=>x?.frac)){
  if(t.length===5){const [[a,d],op,[b,d2]]=[t[0].frac,t[1],t[2].frac];assert.equal(d,d2);assert.equal(t[4].frac[1],d);return String(op==='+'?a+b:a-b);}
  const [n,d]=t[0].frac,[bn,bd]=t[2].frac;
  if(bn==null){assert.equal((n*bd)%d,0);return String(n*bd/d);}
  assert.equal((d*bn)%n,0);return String(d*bn/n);
 }
 const [a,op,b]=t;assert.equal(t[3],'=');assert.ok(t[4].box);
 const A=toT(a),B=toT(b);
 if(op==='+')return fromT(A+B);
 if(op==='−')return fromT(A-B);
 if(op==='×'){assert.equal(B%10,0,'かける数は整数');return fromT(A*B/10);}
 if(op==='÷'){assert.equal(B%10,0,'わる数は整数');assert.equal(A%(B/10),0,`わりきれる: ${a}÷${b}`);return fromT(A/(B/10));}
 throw new Error('op '+op);
}

test('各学年：10問そろい、表示の式から計算した答えと正答が一致する（2000セット）',()=>{
 for(const player of Object.keys(PLAYERS))for(let seed=1;seed<=1000;seed++){
  const set=makeQuestionSet(player,seededRandom(seed));
  assert.equal(set.length,QUESTIONS_PER_SET);
  assert.equal(new Set(set.map(q=>q.text)).size,set.length,'同じ問題が重ならない');
  const kk=set.filter(q=>q.tokens[1]==='×'&&q.kind==='kuku').map(q=>[q.tokens[0],q.tokens[2]].sort().join());
  assert.equal(new Set(kk).size,kk.length,'7×3 と 3×7 は重ねない');
  for(const q of set){
   assert.equal(normalizeAnswer(solve(q)),normalizeAnswer(q.answer),`${player} seed${seed}: ${q.text} → ${q.answer}`);
   assert.match(q.answer,/^\d+(\.\d)?$/,'答えは0以上、小数は第1位まで');
   assert.ok(Number(q.answer)>0||q.kind==='sub','答えは正の数');
   assert.equal(checkAnswer(q,q.answer).ok,true);
  }
 }
});

// ---- 難易度カーブ：1〜3秒殺／4〜7ふつう／8〜9ちょいムズ／10ボス（順番は固定、ゾーン内はランダム） ----
const nums=q=>[Number(q.tokens[0]),Number(q.tokens[2])];
const digits=n=>String(n).length;
const gcdT=(a,b)=>b?gcdT(b,a%b):a;
const carry=(a,b)=>a%10+b%10>=10, borrow=(a,b)=>a%10<b%10;

test('難易度カーブ：ゾーンの並びは毎回 秒殺3・ふつう4・ちょいムズ2・ボス1',()=>{
 for(const player of Object.keys(PLAYERS))for(let seed=1;seed<=500;seed++){
  const zones=makeQuestionSet(player,seededRandom(seed)).map(q=>q.zone);
  assert.deepEqual(zones,[...ZONES]);
 }
 assert.deepEqual(ZONES,['easy','easy','easy','normal','normal','normal','normal','hard','hard','boss']);
});

test('ぴよみ（3年）：ゾーンごとの型と数の大きさ',()=>{
 const seen={easy:new Set(),normal:new Set(),hard:new Set(),boss:new Set()};
 for(let seed=1;seed<=1000;seed++)for(const q of makeQuestionSet('piyomi',seededRandom(seed))){
  assert.ok(['add','sub','kuku','div'].includes(q.kind),q.kind);
  assert.equal(q.decimal,false);assert.match(q.answer,/^\d+$/);
  assert.ok(Number(q.answer)<1000,q.text);
  const [a,b]=nums(q),op=q.tokens[1];
  if(q.zone==='easy'){
   if(q.kind==='add'){seen.easy.add('add');assert.ok(digits(a)===2&&digits(b)===2&&!carry(a,b)&&a+b<100,q.text);}
   else if(q.kind==='sub'){seen.easy.add('sub');assert.ok(digits(a)===2&&digits(b)===2&&!borrow(a,b)&&a>b,q.text);}
   else {assert.equal(q.kind,'kuku',q.text);seen.easy.add('kuku');assert.ok(a>=2&&a<=5&&b>=2&&b<=9,q.text);}
  }
  if(q.zone==='normal'){
   if(q.kind==='kuku'){seen.normal.add('kuku');assert.ok(a>=6&&a<=9&&b>=2&&b<=9,q.text);}
   else if(q.kind==='add'){seen.normal.add('add');assert.ok(digits(a)===2&&digits(b)===2&&carry(a,b)&&a+b<100,q.text);}
   else if(q.kind==='sub'){seen.normal.add('sub');assert.ok(digits(a)===2&&digits(b)===2&&borrow(a,b)&&a>b,q.text);}
   else {assert.equal(q.kind,'div',q.text);seen.normal.add('div');assert.ok(b>=2&&b<=9&&a%b===0&&a/b<=9,q.text);}
  }
  if(q.zone==='hard'){
   assert.ok(['add','sub'].includes(q.kind),q.text);seen.hard.add(q.kind);
   assert.ok(digits(a)===3&&digits(b)===2,q.text);
   if(q.kind==='sub')assert.ok(a-b>=100,q.text);
  }
  if(q.zone==='boss'){
   assert.ok(['add','sub'].includes(q.kind),q.text);seen.boss.add(q.kind);
   assert.ok(digits(a)===3&&digits(b)===3&&a<900&&b<600,q.text);
   if(q.kind==='sub')assert.ok(a-b>=50,q.text);
  }
 }
 assert.deepEqual([...seen.easy].sort(),['add','kuku','sub']);
 assert.deepEqual([...seen.normal].sort(),['add','div','kuku','sub']);
 assert.deepEqual([...seen.hard].sort(),['add','sub']);
 assert.deepEqual([...seen.boss].sort(),['add','sub']);
});

test('ぴよきち（5年）：ゾーンごとの型と数の大きさ',()=>{
 const seen={easy:new Set(),normal:new Set(),hard:new Set(),boss:new Set()};
 for(let seed=1;seed<=1000;seed++){
  const set=makeQuestionSet('piyokichi',seededRandom(seed));
  assert.equal(set.filter(q=>q.zone==='easy'&&(q.decimal||q.label==='分数'||q.kind==='word')).length,0,'秒殺に小数・分数・文章題は出さない');
  for(const q of set){
   assert.ok(Number(q.answer)<20000,q.text);
   if(q.decimal)assert.match(q.answer,/^\d+(\.\d)?$/);
   const op=q.tokens[1];
   if(q.zone==='easy'){
    seen.easy.add(q.kind);assert.ok(['mul','bigAdd','div'].includes(q.kind),q.text);
    const [a,b]=nums(q);
    if(q.kind==='mul')assert.ok(digits(a)>=2&&digits(a)<=3&&b>=2&&b<=6,q.text);
    if(q.kind==='bigAdd')assert.ok(a%100===0&&b%100===0&&a>=1000,q.text);
    if(q.kind==='div')assert.ok(b>=2&&b<=9&&a%b===0&&a/b<=12,q.text);
   }
   if(q.zone==='normal'){
    seen.normal.add(q.kind);assert.ok(['decAdd','decSub','fracAdd','fracSub','word'].includes(q.kind),q.text);
    if(q.kind==='word')assert.match(q.text,/プリンを|ページずつ|おつり/,'ふつうの文章題は1回の計算');
   }
   if(q.zone==='hard'){
    seen.hard.add(q.kind);assert.ok(['bigMul','decMul','decDiv'].includes(q.kind),q.text);
    if(q.kind==='bigMul'){const [a,b]=nums(q);assert.ok(digits(a)===2&&digits(b)===2,q.text);}
   }
   if(q.zone==='boss'){
    seen.boss.add(q.label);if(q.label==='分数'){ // 大きさの等しい分数：□を答えでうめて、もとの分数（約分した形）と大きいほうの分母を見る
     const ans=Number(q.answer),fill=f=>f.map(v=>v??ans),[x,y]=[fill(q.tokens[0].frac),fill(q.tokens[2].frac)];
     assert.equal(x[0]*y[1],y[0]*x[1],'大きさが等しい: '+q.text);
     const g=gcdT(x[0],x[1]),base=[x[0]/g,x[1]/g];
     assert.ok(base[0]>=2&&base[1]>=3,'1/2 や 1/3 のような分子1の分数は出さない: '+q.text);
     assert.ok(Math.max(x[1],y[1])>=8&&Math.max(x[1],y[1])<=24,'大きいほうの分母は8〜24: '+q.text);
    }
    if(q.label==='大きな数'){
     const [a,b]=nums(q),t=n=>Math.floor(n/10)%10,h=n=>Math.floor(n/100)%10;
     if(q.kind==='bigDiv')assert.ok(digits(a)===3&&a>=200&&b>=4&&b<=9&&a/b>=25&&a/b<=99&&(a/b)%10!==0,'ボスのわり算は商が2桁: '+q.text);
     if(q.kind==='bigAdd')assert.ok(digits(a)===4&&digits(b)===4&&a%10===0&&b%10===0&&(t(a)+t(b)>=10||h(a)+h(b)>=10)&&a+b<10000,'ボスのたし算は4桁＋4桁でくり上がり: '+q.text);
     if(q.kind==='bigSub')assert.ok(digits(a)===4&&digits(b)===4&&a%10===0&&b%10===0&&(t(a)<t(b)||h(a)<h(b))&&a-b>=1000,'ボスのひき算は4桁−4桁でくり下がり: '+q.text);
    }assert.ok(['分数','文章題','大きな数'].includes(q.label),q.text);
    if(q.kind==='word')assert.match(q.text,/シールを|面積|リボン/);
   }
  }
 }
 assert.deepEqual([...seen.easy].sort(),['bigAdd','div','mul']);
 assert.deepEqual([...seen.normal].sort(),['decAdd','decSub','fracAdd','fracSub','word']);
 assert.deepEqual([...seen.hard].sort(),['bigMul','decDiv','decMul']);
 assert.deepEqual([...seen.boss].sort(),['分数','大きな数','文章題']);
});

test('同じ型が1セットに偏らない：ゾーン内の型はまず1回ずつ出る',()=>{
 for(let seed=1;seed<=300;seed++){
  const pm=makeQuestionSet('piyomi',seededRandom(seed));
  assert.equal(new Set(pm.slice(3,7).map(q=>q.kind)).size,4,'ぴよみのふつう4問は九九・たし算・ひき算・わり算が1問ずつ');
  const pk=makeQuestionSet('piyokichi',seededRandom(seed));
  assert.equal(new Set(pk.slice(0,3).map(q=>q.kind)).size,3,'ぴよきちの秒殺3問は型がばらばら');
  assert.equal(new Set(pk.slice(7,9).map(q=>q.kind)).size,2,'ぴよきちのちょいムズ2問は型がちがう');
 }
});

test('毎回同じ問題にならない：シードがちがえば並びもちがう',()=>{
 for(const player of Object.keys(PLAYERS)){
  const texts=new Set();
  for(let seed=1;seed<=50;seed++)texts.add(makeQuestionSet(player,seededRandom(seed)).map(q=>q.text).join('|'));
  assert.equal(texts.size,50);
 }
});

test('判定：正解・不正解・入力のゆれ（全角、先頭の0、末尾の0）',()=>{
 const q={answer:'42',decimal:false},d={answer:'2.5',decimal:true};
 assert.equal(checkAnswer(q,'42').ok,true);
 assert.equal(checkAnswer(q,'042').ok,true);
 assert.equal(checkAnswer(q,'４２').ok,true);
 assert.equal(checkAnswer(q,'43').ok,false);
 assert.equal(checkAnswer(q,'43').close,true,'1ちがいは「おしい」');
 assert.equal(checkAnswer(q,'50').close,false);
 assert.equal(checkAnswer(q,'').valid,false,'空は判定しない');
 assert.equal(checkAnswer(q,'4a').valid,false);
 assert.equal(checkAnswer(d,'2.50').ok,true);
 assert.equal(checkAnswer(d,'2.5').ok,true);
 assert.equal(checkAnswer(d,'2.4').close,true);
 assert.equal(checkAnswer({answer:'0.5',decimal:true},'.5').ok,true);
 assert.equal(normalizeAnswer('3.'),'3');
 assert.equal(normalizeAnswer('0'),'0');
});

const tenQuestions=()=>Array.from({length:10},(_,i)=>({id:`q${i}`,answer:String(i+1),decimal:false,unit:''}));

test('10問で終わり、終わったあとの回答や空の回答は無視される',()=>{
 let run=createRun(tenQuestions());
 assert.equal(answerRun(run,'').feedback,null,'空入力では進まない');
 for(let i=0;i<10;i++){assert.equal(run.done,false);({run}=answerRun(run,String(i+1)));}
 assert.equal(run.done,true);assert.equal(run.answers.length,10);
 const after=answerRun(run,'1');
 assert.equal(after.feedback,null);assert.equal(after.run.answers.length,10);
});

test('コンボ：正解で増え、まちがえると0にもどる。3の倍数でボーナス',()=>{
 let run=createRun(tenQuestions()),f;
 const plan=[1,1,1,0,1,1,1,1,1,1]; // 3連続→ミス→6連続
 const combos=[],bonus=[];
 plan.forEach((ok,i)=>{({run,feedback:f}=answerRun(run,ok?String(i+1):'999'));combos.push(f.combo);bonus.push(f.comboBonus);});
 assert.deepEqual(combos,[1,2,3,0,1,2,3,4,5,6]);
 assert.deepEqual(bonus.map((b,i)=>b?i:-1).filter(i=>i>=0),[2,6,9]);
 assert.equal(run.maxCombo,6);assert.equal(run.correct,9);
 assert.equal(run.earned,9+3);
});

test('ポイント計算：1問1pt・3連続+1・クリア+3・全問正解+3',()=>{
 const all=scoreAnswers(Array(10).fill(true));
 assert.equal(all.points,10+3+POINTS.clear+POINTS.perfect);assert.equal(all.points,19);
 assert.equal(all.perfect,true);assert.equal(all.maxCombo,10);
 const none=scoreAnswers(Array(10).fill(false));
 assert.equal(none.points,3,'ぜんぶまちがえてもクリアボーナスはもらえる');
 const mix=scoreAnswers([true,true,false,true,true,true,false,true,true,true]);
 assert.deepEqual([mix.correct,mix.comboPoints,mix.clearBonus,mix.perfectBonus,mix.points],[8,2,3,0,13]);
 assert.equal(scoreAnswers([true,true,true]).clearBonus,0,'10問そろわないとクリアではない');
 assert.equal(scoreAnswers(Array(10).fill(true),{clearBonus:false,perfectBonus:false}).points,13);
});

const allOk=Array(10).fill(true);
const commit=(store,id,player='piyomi',dayKey='2026-09-29',oks=allOk)=>commitResult(store,{sessionId:id,player,dayKey,oks});

test('同じ日の二重取得防止：同じ回は1回だけ、クリア・全問正解ボーナスは1日1回、プリンは最初の1回',()=>{
 let s=emptyStore(),r;
 r=commit(s,'a');s=r.store;
 assert.equal(r.award.points,19);assert.equal(r.award.puddingNew,true);
 assert.equal(s.players.piyomi.points,19);
 // 更新・戻る・連打で同じ回をもう一度保存しても増えない
 r=commit(s,'a');assert.equal(r.duplicate,true);assert.equal(r.store.players.piyomi.points,19);
 // 同じ日の再挑戦：問題ポイントは入るが、ボーナスとプリンは入らない
 r=commit(s,'b');s=r.store;
 assert.equal(r.award.points,13);assert.equal(r.award.clearBonusAlready,true);assert.equal(r.award.perfectBonusAlready,true);assert.equal(r.award.puddingNew,false);
 r=commit(s,'c');s=r.store;assert.equal(r.award.points,13);
 assert.equal(sessionsLeft(s,'piyomi','2026-09-29'),0);
 // 4回目以降は「れんしゅう」：記録は残るがポイント0
 for(const id of ['d','e','f']){r=commit(s,id);s=r.store;assert.equal(r.award.practice,true);assert.equal(r.award.points,0);}
 assert.equal(s.players.piyomi.points,19+13+13);
 const d=dayInfo(s,'piyomi','2026-09-29');
 assert.deepEqual([d.sessions,d.rewarded,d.cleared,d.clearBonus,d.perfectBonus,d.points],[6,DAILY_REWARD_SESSIONS,true,true,true,45]);
 // 次の日はまたボーナスがもらえる（プリンはもうもっている）
 r=commit(s,'g','piyomi','2026-09-30');
 assert.equal(r.award.points,19);assert.equal(r.award.puddingNew,false);
});

test('ぴよきち／ぴよみの記録は分かれている',()=>{
 let s=emptyStore();
 s=commit(s,'x','piyokichi').store;
 assert.equal(s.players.piyokichi.points,19);assert.equal(s.players.piyomi.points,0);
 assert.equal(s.players.piyokichi.pudding.earned,true);assert.equal(s.players.piyomi.pudding.earned,false);
 assert.equal(dayInfo(s,'piyomi','2026-09-29').cleared,false);
 const r=commit(s,'y','piyomi');
 assert.equal(r.award.points,19,'ぴよきちのボーナス済みはぴよみに影響しない');assert.equal(r.award.puddingNew,true);
 assert.equal(selectPlayer(s,'piyomi').selected,'piyomi');
 assert.equal(selectPlayer(s,'chiki').selected,null);
});

test('プリン：獲得済みのときだけ「かざる」を保存できる',()=>{
 let s=emptyStore();
 assert.equal(setPuddingDisplayed(s,'piyomi').players.piyomi.pudding.displayed,false);
 s=commit(s,'a').store;
 s=setPuddingDisplayed(s,'piyomi');
 assert.deepEqual(s.players.piyomi.pudding,{earned:true,earnedOn:'2026-09-29',displayed:true});
});

function memoryStorage(init={}){const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),map:m};}

test('保存と読み込み：往復で同じ内容',()=>{
 const st=memoryStorage();
 assert.equal(loadStore(st).status,'new');
 const s=commit(emptyStore(),'a').store;
 assert.equal(saveStore(s,st),true);
 const back=loadStore(st);
 assert.equal(back.status,'ok');assert.deepEqual(back.store,s);
});

test('保存データが壊れていても落ちずに復帰し、壊れたデータは退避する',()=>{
 for(const bad of ['{oops','null','[]','"text"','{"version":2}','42']){
  const st=memoryStorage({[STORE_KEY]:bad});
  const r=loadStore(st);
  assert.equal(r.status,'recovered',bad);
  assert.deepEqual(r.store,emptyStore());
  assert.equal(st.map.get(BROKEN_KEY),bad);
 }
 // 形の一部だけおかしい → 使える所は残し、おかしい所だけ直す
 const odd={version:1,selected:'chiki',players:{piyomi:{points:-5,pudding:{earned:'yes',displayed:true},days:{'2026-09-29':{sessions:'2',rewarded:1,cleared:true,points:1e99},'bad-day':{}},history:[{id:'a',day:'2026-09-29',correct:99},{nope:1}]},piyokichi:'??'},committed:['a',3]};
 const s=sanitizeStore(odd);
 assert.equal(s.selected,null);
 assert.equal(s.players.piyomi.points,0);
 assert.deepEqual(s.players.piyomi.pudding,{earned:false,earnedOn:null,displayed:false});
 assert.deepEqual(Object.keys(s.players.piyomi.days),['2026-09-29']);
 assert.equal(s.players.piyomi.days['2026-09-29'].sessions,0);
 assert.equal(s.players.piyomi.days['2026-09-29'].points,0);
 assert.equal(s.players.piyomi.history.length,1);assert.equal(s.players.piyomi.history[0].correct,10);
 assert.deepEqual(s.players.piyokichi,emptyStore().players.piyokichi);
 assert.deepEqual(s.committed,['a']);
 // localStorage が使えない／例外を投げる環境
 assert.equal(loadStore(null).status,'unavailable');
 const throwing={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 assert.equal(loadStore(throwing).status,'unavailable');
 assert.equal(saveStore(emptyStore(),throwing),false);
});

test('日付キーは端末のローカル日付',()=>{
 assert.equal(todayKey(new Date(2026,8,29,23,59)),'2026-09-29');
 assert.equal(todayKey(new Date(2026,0,5,0,0)),'2026-01-05');
});

test('drill.html：共通ナビに ピヨドリル、スマホ用 viewport、Firestore を使わない',()=>{
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.match(html,/name="viewport"[^>]*width=device-width/);
 assert.match(html,/src="\/src\/drill\/main\.js"/);
 for(const f of ['main.js','questions.js','scoring.js','storage.js']){
  const src=readFileSync(new URL(`../src/drill/${f}`,import.meta.url),'utf8');
  assert.ok(!/firebase|firestore|gstatic/i.test(src.replace(/\/\/.*$/gm,'')),`${f} は Firestore を呼ばない`);
 }
 const places=readFileSync(new URL('../src/nav/places.js',import.meta.url),'utf8');
 assert.match(places,/id:'drill',page:'drill\.html'/,'共通ナビ（とビルド対象）に ピヨドリル がある');
 assert.match(html,/<script type="module" src="\/src\/drill\/main\.js"/);
});
