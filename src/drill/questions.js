// ピヨドリル：問題づくり（DOM なし・テスト可能）。算数はここで作り、国語・理科・社会は subjects/ の問題プールから選ぶ。
// 答えはいつも「ひとつの数」。小数は 10 倍した整数で計算するので、浮動小数点の誤差が出ない。
//   token: 文字列 | {frac:[分子,分母]}（null の側が □） | {box:true}（□）

import {SUBJECT_BANKS} from './subjects/index.js';

export const PLAYERS={
 piyokichi:{id:'piyokichi',name:'ぴよきち',grade:5,gradeLabel:'小学5年'},
 piyomi:{id:'piyomi',name:'ぴよみ',grade:3,gradeLabel:'小学3年'},
};
export const playerIds=Object.keys(PLAYERS);
export const QUESTIONS_PER_SET=10;

// 種の決まった乱数（テストで同じ問題を再現できる）
export function seededRandom(seed=1){
 let a=seed>>>0;
 return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}
const int=(rng,min,max)=>min+Math.floor(rng()*(max-min+1));
const pick=(rng,list)=>list[Math.floor(rng()*list.length)];
function shuffle(rng,list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const gcd=(a,b)=>b?gcd(b,a%b):a;
// 10 倍した整数 → 表示用の小数（23 → "2.3"、30 → "3"）
export function tenths(t){return t%10===0?String(t/10):`${Math.floor(t/10)}.${t%10}`;}
const notRound=(rng,min,max)=>{let v;do v=int(rng,min,max);while(v%10===0);return v;};

const q=(kind,label,tokens,answer,extra={})=>({kind,label,tokens,answer:String(answer),decimal:false,unit:'',...extra});
const eq=(a,op,b)=>[String(a),op,String(b),'=',{box:true}];

// ---------- 難易度カーブ ----------
// 「学年相当の総合テスト」ではなく、10問を気持ちよく解き進めてプリンフィーバーへ向かうための並び。
//   1〜3問：秒殺（easy）／ 4〜7問：ふつう（normal）／ 8〜9問：ちょいムズ（hard）／ 10問目：ボス（boss）
// ゾーンの順番は固定。各ゾーンの中で型と数字をランダムに選ぶ。
export const ZONES=['easy','easy','easy','normal','normal','normal','normal','hard','hard','boss'];
export const ZONE_LABELS={easy:'秒殺',normal:'ふつう',hard:'ちょいムズ',boss:'ボス'};

// ---------- ぴよみ（小学3年） ----------
const piyomiMakers={
 // 秒殺：2桁＋2桁（繰り上がりなし）
 addEasy(rng){const at=int(rng,1,7),bt=int(rng,1,8-at),ao=int(rng,0,8),bo=int(rng,0,9-ao);const a=at*10+ao,b=bt*10+bo;return q('add','たし算',eq(a,'+',b),a+b);},
 // 秒殺：2桁−2桁（繰り下がりなし）
 subEasy(rng){const at=int(rng,2,9),bt=int(rng,1,at-1),ao=int(rng,1,9),bo=int(rng,0,ao);const a=at*10+ao,b=bt*10+bo;return q('sub','ひき算',eq(a,'−',b),a-b);},
 // 秒殺：九九（2〜5の段）
 kukuEasy(rng){const a=int(rng,2,5),b=int(rng,2,9);return q('kuku','九九',eq(a,'×',b),a*b);},
 // ふつう：九九（6〜9の段）
 kukuHard(rng){const a=int(rng,6,9),b=int(rng,2,9);return q('kuku','九九',eq(a,'×',b),a*b);},
 // ふつう：2桁＋2桁（繰り上がりあり、答えは2桁）
 addCarry(rng){const at=int(rng,1,7),bt=int(rng,1,8-at),ao=int(rng,2,9),bo=int(rng,10-ao,9);const a=at*10+ao,b=bt*10+bo;return q('add','たし算',eq(a,'+',b),a+b);},
 // ふつう：2桁−2桁（繰り下がりあり）
 subBorrow(rng){const at=int(rng,3,9),bt=int(rng,1,at-2),ao=int(rng,0,8),bo=int(rng,ao+1,9);const a=at*10+ao,b=bt*10+bo;return q('sub','ひき算',eq(a,'−',b),a-b);},
 // ふつう：わり算（九九で解ける・必ずわり切れる）
 div(rng){const b=int(rng,2,9),c=int(rng,2,9);return q('div','わり算',eq(b*c,'÷',b),c);},
 // ちょいムズ：3桁＋2桁
 add3x2(rng){const a=int(rng,101,899),b=int(rng,12,99);return q('add','たし算',eq(a,'+',b),a+b);},
 // ちょいムズ：3桁−2桁（答えは3桁）
 sub3x2(rng){const a=int(rng,150,999),b=int(rng,12,Math.min(99,a-100));return q('sub','ひき算',eq(a,'−',b),a-b);},
 // ボス：3桁＋3桁（答えは999まで。数字はほどほど）
 add3x3(rng){const a=int(rng,110,599),b=int(rng,110,Math.min(499,999-a));return q('add','たし算',eq(a,'+',b),a+b);},
 // ボス：3桁−3桁（答えは50以上）
 sub3x3(rng){const a=int(rng,300,899),b=int(rng,110,Math.min(499,a-50));return q('sub','ひき算',eq(a,'−',b),a-b);},
};
const piyomiPools={
 easy:['addEasy','subEasy','kukuEasy'],
 normal:['kukuHard','addCarry','subBorrow','div'],
 hard:['add3x2','sub3x2'],
 boss:['add3x3','sub3x3'],
};

// ---------- ぴよきち（小学5年） ----------
const piyokichiMakers={
 // 秒殺：2〜3桁×1桁
 mulEasy(rng){
  if(rng()<.6){const a=int(rng,12,49),b=int(rng,2,6);return q('mul','かけ算',eq(a,'×',b),a*b);}
  const a=int(rng,101,299),b=int(rng,2,3);return q('mul','かけ算',eq(a,'×',b),a*b);
 },
 // 秒殺：大きな数の簡単なたし算（百のまとまり）
 bigAddEasy(rng){const a=int(rng,10,60)*100,b=int(rng,1,Math.min(30,98-a/100))*100;return q('bigAdd','大きな数',eq(a,'+',b),a+b);},
 // 秒殺：わり切れる簡単なわり算
 divEasy(rng){const d=int(rng,2,9),c=int(rng,2,12);return q('div','わり算',eq(d*c,'÷',d),c);},
 // ふつう：小数＋小数、小数−小数
 decAdd(rng){const a=notRound(rng,11,89),b=notRound(rng,11,89);return q('decAdd','小数',eq(tenths(a),'+',tenths(b)),tenths(a+b),{decimal:true});},
 decSub(rng){const a=notRound(rng,31,99),b=notRound(rng,11,a-5);return q('decSub','小数',eq(tenths(a),'−',tenths(b)),tenths(a-b),{decimal:true});},
 // ふつう：同分母の分数のたし算／ひき算
 fracAdd(rng){const d=int(rng,5,12),a=int(rng,1,d-2),b=int(rng,1,d-1-a);return q('fracAdd','分数',[{frac:[a,d]},'+',{frac:[b,d]},'=',{frac:[null,d]}],a+b);},
 fracSub(rng){const d=int(rng,5,12),a=int(rng,3,d-1),b=int(rng,1,a-1);return q('fracSub','分数',[{frac:[a,d]},'−',{frac:[b,d]},'=',{frac:[null,d]}],a-b);},
 // ふつう：簡単な文章題（1回かけ算・ひき算）
 wordSimple(rng){return pick(rng,[wordBuy,wordPages,wordChange])(rng);},
 // ちょいムズ：2桁×2桁
 mul2x2(rng){const a=int(rng,12,35),b=int(rng,11,19);return q('bigMul','大きな数',eq(a,'×',b),a*b);},
 // ちょいムズ：小数のかけ算／わり算
 decMul(rng){const a=notRound(rng,11,49),n=int(rng,2,9);return q('decMul','小数',eq(tenths(a),'×',n),tenths(a*n),{decimal:true});},
 decDiv(rng){const c=notRound(rng,11,49),d=int(rng,2,6);return q('decDiv','小数',eq(tenths(c*d),'÷',d),tenths(c),{decimal:true});},
 // ボス：分数（大きさの等しい分数）。1/2=□/4 のように一瞬で終わる形はさけ、
 // 分子が2以上の分数（2/3・3/4・2/5・3/5・4/5・5/6）と、大きいほうの分母が8以上になる倍率を使う
 // 例：3/4 = □/12、4/5 = 12/□、6/8 = 3/□
 bossFrac(rng){
  let n,d,k;do{d=int(rng,3,6);n=int(rng,2,d-1);k=int(rng,2,4);}while(gcd(n,d)!==1||d*k<8);
  const form=int(rng,0,2);
  if(form===0)return q('fracEq','分数',[{frac:[n,d]},'=',{frac:[null,d*k]}],n*k);   // 3/4 = □/12
  if(form===1)return q('fracEq','分数',[{frac:[n,d]},'=',{frac:[n*k,null]}],d*k);   // 4/5 = 12/□
  return q('fracEq','分数',[{frac:[n*k,d*k]},'=',{frac:[n,null]}],d);               // 6/8 = 3/□
 },
 // ボス：文章題（わり算・面積・小数）
 bossWord(rng){return pick(rng,[wordShare,wordArea,wordRibbon])(rng);},
 // ボス：少し大きい計算（4桁のたし算・ひき算、3桁÷1桁）
 // ボス：少し大きい計算。8〜9問目より軽くならないよう、くり上がり・くり下がりのある4桁（10のまとまり）か、
 // 商が2桁になる3桁÷1桁（324÷6、672÷8 くらい）。難しすぎないよう、4桁は一の位を0にそろえる
 bossBig(rng){
  const v=int(rng,0,2),tens=n=>Math.floor(n/10)%10,hund=n=>Math.floor(n/100)%10;
  if(v===0){ // 4桁＋4桁：百の位か十の位でくり上がる（3650＋2480 くらい）
   let a,b;do{a=int(rng,120,650)*10;b=int(rng,120,Math.min(650,990-a/10))*10;}while(!(tens(a)+tens(b)>=10||hund(a)+hund(b)>=10)||tens(a)===0||tens(b)===0);
   return q('bigAdd','大きな数',eq(a,'+',b),a+b);
  }
  if(v===1){ // 4桁−4桁：くり下がりあり（4800−1750 くらい）
   let a,b;do{a=int(rng,300,960)*10;b=int(rng,110,a/10-100)*10;}while(!(tens(a)<tens(b)||hund(a)<hund(b))||tens(b)===0);
   return q('bigSub','大きな数',eq(a,'−',b),a-b);
  }
  // 3桁÷1桁：わる数4〜9、商は2桁（一の位が0でない）
  let d,c;do{d=int(rng,4,9);c=int(rng,Math.max(25,Math.ceil(200/d)),Math.min(99,Math.floor(999/d)));}while(c%10===0);
  return q('bigDiv','大きな数',eq(d*c,'÷',d),c);
 },
};
function wordBuy(rng){const p=pick(rng,[60,80,120,150,180,240]),n=int(rng,3,8);return q('word','文章題',[`1こ ${p}円の プリンを ${n}こ 買います。代金は 何円？`],p*n,{unit:'円'});}
function wordShare(rng){const n=int(rng,3,8),c=int(rng,6,24);return q('word','文章題',[`${n*c}まいの シールを ${n}人で 同じ数ずつ 分けます。1人 何まい？`],c,{unit:'まい'});}
function wordArea(rng){const a=int(rng,6,15),b=int(rng,4,12);return q('word','文章題',[`たて ${a}cm、よこ ${b}cm の 長方形の 面積は 何cm²？`],a*b,{unit:'cm²'});}
function wordChange(rng){const p=int(rng,25,98)*10;return q('word','文章題',[`1000円で ${p}円の 本を 買うと、おつりは 何円？`],1000-p,{unit:'円'});}
function wordPages(rng){const p=int(rng,8,25),d=int(rng,4,9);return q('word','文章題',[`本を 1日に ${p}ページずつ 読むと、${d}日で 何ページ？`],p*d,{unit:'ページ'});}
function wordRibbon(rng){const a=int(rng,4,9)*10,b=notRound(rng,11,a-11);return q('word','文章題',[`${tenths(a)}mの リボンから ${tenths(b)}m 使いました。のこりは 何m？`],tenths(a-b),{unit:'m',decimal:true});}
const piyokichiPools={
 easy:['mulEasy','bigAddEasy','divEasy'],
 normal:['decAdd','decSub','fracAdd','fracSub','wordSimple'],
 hard:['mul2x2','decMul','decDiv'],
 boss:['bossFrac','bossWord','bossBig'],
};

// ---------- 4教科シャッフル ----------
// subjects/ に問題プールがあるプレイヤー（いまは ぴよみ）は、毎日「国語・算数・理科・社会」をまぜた10問。
//   1〜3回目：その日・その人で決まった A・B・C（30問の中で同じ問題は出ない）。ページを開きなおしても同じ
//   4回目以降：れんしゅう用に、問題プールから毎回つくりなおす
// 難易度カーブ（秒殺3・ふつう4・ちょいムズ2・ボス1）はそのまま。ボスは算数。同じ教科は3問つづけない。
export const MIX_PLANS=[
 {算数:3,国語:3,理科:2,社会:2},   // A
 {算数:3,国語:2,理科:3,社会:2},   // B
 {算数:3,国語:2,理科:2,社会:3},   // C
];
export const FIXED_ROUNDS=MIX_PLANS.length;
const ZONE_LEVEL={easy:'easy',normal:'normal',hard:'hard',boss:'hard'};
const LEVEL_ORDER={easy:['easy','normal','hard'],normal:['normal','easy','hard'],hard:['hard','normal','easy']};

// 10月教材の算数（ぴよみ：大きな数・かけ算の筆算）。4教科シャッフルのときだけ、いつもの算数にまぜる
const piyomiOctMakers={
 // 秒殺：何十×1けた、何百×1けた（30×4、300×4）
 mulTens(rng){const a=int(rng,2,9)*10,b=int(rng,2,9);return q('mul','かけ算',eq(a,'×',b),a*b);},
 mulHundreds(rng){const a=int(rng,2,9)*100,b=int(rng,2,9);return q('mul','かけ算',eq(a,'×',b),a*b);},
 // ふつう：1000を いくつ 集めた数／1万の まとまりの たし算／10倍・10で わる
 thousands(rng){const n=int(rng,12,99);return q('word','大きな数',[`1000を ${n}こ 集めた 数は？`],n*1000);},
 manAdd(rng){const a=int(rng,1,6),b=int(rng,1,9-a);return q('bigAdd','大きな数',eq(a*10000,'+',b*10000),(a+b)*10000);},
 tenTimes(rng){const a=int(rng,12,99)*10;return rng()<.5?q('word','大きな数',[`${a}を 10倍した 数は？`],a*10):q('word','大きな数',[`${a}を 10で わった 数は？`],a/10);},
 // ちょいムズ：2けた×1けた／何百万の ひき算（700万−200万）
 mul2x1(rng){const a=int(rng,12,49),b=int(rng,2,9);return q('mul','かけ算の筆算',eq(a,'×',b),a*b);},
 manSub(rng){const a=int(rng,3,9),b=int(rng,1,a-1);return q('bigSub','大きな数',[`${a*100}万`,'−',`${b*100}万`,'=',{box:true}],(a-b)*100,{unit:'万'});},
 // ボス：大きめの 2けた×1けた（58×6 くらい）
 mul2x1Big(rng){const a=int(rng,51,98),b=int(rng,3,9);return q('mul','かけ算の筆算',eq(a,'×',b),a*b);},
};
// 4教科シャッフルの算数の枠で使う型（ゾーンごと）。いつもの算数 ＋ 10月教材
export const MIX_MATH_POOLS={
 piyomi:{makers:{...piyomiMakers,...piyomiOctMakers},pools:{
  easy:[...piyomiPools.easy,'mulTens','mulHundreds'],
  normal:[...piyomiPools.normal,'thousands','manAdd','tenTimes'],
  hard:[...piyomiPools.hard,'mul2x1','manSub'],
  boss:[...piyomiPools.boss,'mul2x1Big'],
 }},
 piyokichi:{makers:piyokichiMakers,pools:piyokichiPools},
};

// 文字列から乱数の種（その日・その人で同じ問題にするため）
function hashSeed(text){let h=0x811c9dc5;for(const c of text){h^=c.codePointAt(0);h=Math.imul(h,0x01000193)>>>0;}return h;}
const hasTriple=list=>list.some((s,i)=>i>=2&&s===list[i-1]&&s===list[i-2]);
// 教科の並び：最後（ボス）は算数。同じ教科が3問つづかないように並べる
function subjectOrder(plan,rng){
 const rest=[];
 for(const [subject,n] of Object.entries(plan))for(let i=0;i<(subject==='算数'?n-1:n);i++)rest.push(subject);
 for(let t=0;t<500;t++){const order=[...shuffle(rng,rest),'算数'];if(!hasTriple(order))return order;}
 throw new Error('subject order not found');
}
// その日の「まだ使っていない問題」の山（教科ごとにシャッフル）と、算数の重なりチェック
function mixState(bank,rng){
 const queues={};
 for(const [subject,rows] of Object.entries(bank.banks))queues[subject]=shuffle(rng,rows.map((row,idx)=>({row,key:`${subject}-${idx}`})));
 return {queues,used:new Set(),seen:new Set()};
}
function mixMath(player,zone,rng,seen){
 const {makers,pools}=MIX_MATH_POOLS[player];
 let item,tries=0;
 do item=makers[pick(rng,pools[zone])](rng);while(seen.has(sameKey(item))&&++tries<30);
 seen.add(sameKey(item));
 return {...item,subject:'算数'};
}
function bankQuestion(subject,entry,rng){
 const [level,text,answer,...wrong]=entry.row;
 return {...q('choice',subject,[text],answer,{choices:shuffle(rng,[answer,...wrong])}),subject,level,bankKey:entry.key};
}
function buildMixSet(player,plan,rng,state){
 return subjectOrder(plan,rng).map((subject,i)=>{
  const zone=ZONES[i];
  let item;
  if(subject==='算数')item=mixMath(player,zone,rng,state.seen);
  else{
   const queue=state.queues[subject];
   let entry=null;
   for(const level of LEVEL_ORDER[ZONE_LEVEL[zone]]){entry=queue.find(e=>!state.used.has(e.key)&&e.row[0]===level);if(entry)break;}
   if(!entry)throw new Error(`${subject} の問題が たりない`);
   state.used.add(entry.key);
   item=bankQuestion(subject,entry,rng);
  }
  return {...item,zone,id:`${player}-${i+1}`,text:questionText(item)};
 });
}
export const hasSubjectMix=player=>!!SUBJECT_BANKS[player];
// 戻り値 {set, motifRng} | null（4教科の問題プールがないプレイヤー・日付なし）
function mixedSet(player,dayKey,round,rng){
 const bank=SUBJECT_BANKS[player];
 if(!bank||!dayKey)return null;
 if(round<FIXED_ROUNDS){
  const seed=hashSeed(`${player}|${dayKey}`),r=seededRandom(seed),state=mixState(bank,r);
  let set;for(let k=0;k<=round;k++)set=buildMixSet(player,MIX_PLANS[k],r,state);   // A → B → C の順に作ると、毎回同じ・重なりなし
  return {set,motifRng:seededRandom(seed+round+1)};
 }
 return {set:buildMixSet(player,MIX_PLANS[round%FIXED_ROUNDS],rng,mixState(bank,rng)),motifRng:rng};
}

// ---------- 日付で決まる 3択セット ----------
// その日だけ、ランダムの計算問題のかわりに出す10問。並びは ZONES と同じ（秒殺3・ふつう4・ちょいムズ2・ボス1）
// セットが複数ある日は、その日に何回目のプレイかで A → B → C …（全部終わったら A にもどる）
//   [科目, 問題文, 選択肢, 正解]
export const DAILY_SETS={
 '2026-10-02':{piyomi:[[
  ['国語','「夜」の読みは？',['よる','あさ','ひる'],'よる'],
  ['算数','40 × 5 は？',['20','200','400'],'200'],
  ['社会','野菜やくだものなどが作られた場所を何という？',['産地','日付','ねだん'],'産地'],
  ['国語','「赤い りんごを 食べる」。「赤い」がくわしくしている言葉は？',['りんご','食べる','赤い'],'りんご'],
  ['算数','450を10倍すると？',['45','4500','45000'],'4500'],
  ['社会','品物を買うとき、「いつまでおいしく食べられるか」を知る手がかりは？',['賞味期限','産地','値段'],'賞味期限'],
  ['国語','「うさこが ノートを 買う」。「ノートを」はどの言葉をくわしくしている？',['うさこ','ノート','買う'],'買う'],
  ['算数','600を10でわると？',['6','60','6000'],'60'],
  ['社会','買い物で、かんきょうのためによい行動はどれ？',['レジぶくろを毎回もらう','マイバッグを使う','必要ない物も買う'],'マイバッグを使う'],
  ['国語','「犬が しっぽを ふる」を、ようすがもっとわかる文にするならどれ？',['犬がしっぽをふる','犬がうれしそうにしっぽをふる','犬がしっぽ'],'犬がうれしそうにしっぽをふる'],
 ],[
  ['算数','30 × 4 は？',['12','120','1200'],'120'],
  ['国語','「朝」の読みは？',['あさ','よる','ひる'],'あさ'],
  ['社会','品物がどこで作られたかを表すのは？',['産地','値段','日付'],'産地'],
  ['算数','320を10倍すると？',['32','3200','32000'],'3200'],
  ['国語','「大きな 犬が 走る」。「大きな」がくわしくしている言葉は？',['犬','走る','大きな'],'犬'],
  ['社会','買い物で、食べものの新せんさを知る手がかりになるのは？',['日付','色えんぴつ','くつの大きさ'],'日付'],
  ['算数','700を10でわると？',['7','70','7000'],'70'],
  ['国語','「うさこが ゆっくり 歩く」。「ゆっくり」がくわしくしている言葉は？',['うさこ','ゆっくり','歩く'],'歩く'],
  ['社会','かんきょうのためにできることはどれ？',['マイバッグを使う','ごみをふやす','いらない物も買う'],'マイバッグを使う'],
  ['算数','300 × 6 は？',['180','1800','18000'],'1800'],
 ],[
  ['国語','「遠い」の読みは？',['とおい','ちかい','おおい'],'とおい'],
  ['算数','50 × 3 は？',['15','150','1500'],'150'],
  ['社会','買い物で、かんきょうのために持っていくとよいものは？',['マイバッグ','レジぶくろ','空きばこ'],'マイバッグ'],
  ['国語','「赤い 花が さく」。「赤い」がくわしくしている言葉は？',['花','さく','赤い'],'花'],
  ['算数','680を10倍すると？',['68','6800','68000'],'6800'],
  ['社会','食べものを買うとき、「いつまでおいしく食べられるか」を見るものは？',['賞味期限','産地','値段'],'賞味期限'],
  ['国語','「ぴよみが 公園で 遊ぶ」。「公園で」がくわしくしている言葉は？',['ぴよみ','公園','遊ぶ'],'遊ぶ'],
  ['算数','4500を10でわると？',['45','450','45000'],'450'],
  ['国語','「鳥が 飛ぶ」を、ようすがもっとわかる文にするならどれ？',['鳥が飛ぶ','鳥が高く飛ぶ','鳥が空'],'鳥が高く飛ぶ'],
  ['社会','買い物で、かんきょうのことを考えた行動はどれ？',['必要な分だけ買う','使わない物もたくさん買う','レジぶくろを毎回たくさんもらう'],'必要な分だけ買う'],
 ]]},
};
function dailySet(player,dayKey,round=0){
 const sets=DAILY_SETS[dayKey]?.[player];
 if(!sets)return null;
 const list=sets[round%sets.length];
 return list.map(([subject,text,choices,answer],i)=>({...q('choice',subject,[text],answer,{choices}),zone:ZONES[i],id:`${player}-${i+1}`,text}));
}

// ゾーンごとの型の並び：ゾーン内はシャッフル（型が足りなければ繰り返す）。ゾーンの順番は変えない
function zonePlan(rng,pools,count){
 const plan=[],used={};
 for(const zone of ZONES.slice(0,count)){
  if(!used[zone]||!used[zone].length)used[zone]=shuffle(rng,pools[zone]);
  plan.push({zone,key:used[zone].shift()});
 }
 return plan;
}

// 読み上げ・aria 用の文章
export function questionText(question){
 return question.tokens.map(t=>{
  if(typeof t==='string')return t;
  if(t.box)return '□';
  const [n,d]=t.frac;return `${d??'□'}ぶんの${n??'□'}`;
 }).join(' ');
}

// 重なり判定用：a+b と b+a、a×b と b×a は同じ問題とみなす
function sameKey(question){
 const t=question.tokens;
 if(t.length===5&&typeof t[0]==='string'&&(t[1]==='+'||t[1]==='×'))return [t[0],t[2]].sort().join(t[1]);
 return questionText(question);
}

// ---------- ピヨ探検のごほうび：文章題のモチーフ ----------
// motifs（Set か配列）：'usako' うさこが登場／'curry' カレーが登場／'toramana' トラマナちゃんが登場＋カレーが多め
// 「ふつう」ゾーンの1問（トラマナちゃんがいれば2問）を、モチーフ入りの文章題にする。motifs が空なら何も変えない（乱数も使わない）
export const MOTIFS=['usako','curry','toramana'];
function motifWord(rng,player,m){
 const who=[...(m.has('usako')?['うさこ']:[]),...(m.has('toramana')?['トラマナちゃん']:[])];
 const name=who.length?pick(rng,who):pick(rng,['ちきん','ぴよきち','ぴよみ']);
 const curry=m.has('curry')&&(rng()<(m.has('toramana')?.8:.5));
 if(curry&&m.has('toramana')&&rng()<.4){   // トラマナちゃんのカレー屋さん
  if(player==='piyomi'){const p=int(rng,2,9)*10,n=int(rng,2,5);return q('word','文章題',[`トラマナちゃんの カレー屋さんで、${p}円の カレーパンを ${n}こ 買いました。ぜんぶで 何円？`],p*n,{unit:'円'});}
  const p=pick(rng,[380,450,520,640]),n=int(rng,3,6);return q('word','文章題',[`トラマナちゃんの カレー屋さんで、1さら ${p}円の カレーを ${n}さら たのみました。代金は 何円？`],p*n,{unit:'円'});
 }
 const item=curry?pick(rng,['カレーパン','じゃがいも','にんじん']):pick(rng,['クッキー','おにぎり','いちご']);
 if(player==='piyomi'){
  const t=int(rng,0,2);
  if(t===0){const a=int(rng,25,60),b=int(rng,6,a-11);return q('word','文章題',[`${item}が ${a}こ あります。${name}が ${b}こ つかうと、のこりは 何こ？`],a-b,{unit:'こ'});}
  if(t===1){const n=int(rng,2,9),k=int(rng,2,9);return q('word','文章題',[`${name}は ${n}人に ${item}を ${k}こずつ くばります。ぜんぶで 何こ いる？`],n*k,{unit:'こ'});}
  const n=int(rng,2,9),c=int(rng,2,9);return q('word','文章題',[`${n*c}この ${item}を ${name}たち ${n}人で 同じ数ずつ 分けます。1人 何こ？`],c,{unit:'こ'});
 }
 const t=int(rng,0,2);
 if(t===0){const p=pick(rng,[60,80,120,150,180,240]),n=int(rng,3,8);return q('word','文章題',[`${name}は 1こ ${p}円の ${item}を ${n}こ 買いました。代金は 何円？`],p*n,{unit:'円'});}
 if(t===1){const n=int(rng,3,8),c=int(rng,6,24);return q('word','文章題',[`${n*c}この ${item}を ${name}たち ${n}人で 同じ数ずつ 分けます。1人 何こ？`],c,{unit:'こ'});}
 const a=notRound(rng,11,49),n=int(rng,2,9);return q('word','文章題',[`${name}は ${item}を 1日に ${tenths(a)}kg つかいます。${n}日では 何kg？`],tenths(a*n),{unit:'kg',decimal:true});
}
function applyMotifs(list,rng,player,motifs){
 const m=new Set([...(motifs??[])].filter(x=>MOTIFS.includes(x)));
 if(!m.size)return list;
 // 算数の問題（3択でない・ボス以外）だけをおきかえる。「ふつう」の枠を優先
 const math=list.map((x,i)=>i).filter(i=>!list[i].choices&&list[i].zone!=='boss');
 const want=m.has('toramana')?2:1;
 let slots=shuffle(rng,math.filter(i=>list[i].zone==='normal')).slice(0,want);
 if(slots.length<want)slots=[...slots,...shuffle(rng,math.filter(i=>list[i].zone!=='normal')).slice(0,want-slots.length)];
 const out=[...list];
 for(const i of slots){const item=motifWord(rng,player,m);out[i]={...item,...(out[i].subject?{subject:out[i].subject}:{}),zone:out[i].zone,id:out[i].id,text:questionText(item),motif:true};}
 return out;
}

// round：その日に何回目のプレイか（0 から）。日付で決まるセットを選ぶのに使う
// motifs：ピヨ探検でもらったモチーフ（上の applyMotifs）。日付で決まる3択セットの日は使わない
export function makeQuestionSet(player,rng=Math.random,count=QUESTIONS_PER_SET,{dayKey,round=0,motifs}={}){
 if(!PLAYERS[player])throw new Error(`unknown player: ${player}`);
 const daily=dailySet(player,dayKey,round);
 if(daily)return daily.slice(0,count);   // 1. 日付で決まる特別セット（10/2 など）が最優先
 const mix=mixedSet(player,dayKey,round,rng);
 if(mix)return applyMotifs(mix.set,mix.motifRng,player,motifs).slice(0,count);   // 2. 4教科シャッフル
 // 3. 4教科の問題プールがないプレイヤーは、いつもの算数
 const makers=player==='piyomi'?piyomiMakers:piyokichiMakers;
 const plan=zonePlan(rng,player==='piyomi'?piyomiPools:piyokichiPools,count);
 const seen=new Set(),list=[];
 for(const {zone,key} of plan){
  let item,tries=0;
  do item=makers[key](rng);while(seen.has(sameKey(item))&&++tries<30);
  seen.add(sameKey(item));
  list.push({...item,zone,id:`${player}-${list.length+1}`,text:questionText(item)});
 }
 return applyMotifs(list,rng,player,motifs);
}

// 入力のゆれをそろえる：全角数字、先頭の 0、小数点以下の余分な 0（"03" "2.50" ".5"）
export function normalizeAnswer(input){
 if(input==null)return null;
 let s=String(input).trim().replace(/[０-９．]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[,，\s]/g,'');
 if(!/^(\d+\.?\d*|\.\d+)$/.test(s))return null;
 if(s.startsWith('.'))s='0'+s;
 let [whole,frac='']=s.split('.');
 whole=whole.replace(/^0+(?=\d)/,'');frac=frac.replace(/0+$/,'');
 return frac?`${whole}.${frac}`:whole;
}

// 判定。close は「おしい」（差が 1 以内、または小数で 0.1 以内）
export function checkAnswer(question,input){
 // 3択：選んだ選択肢そのものを比べる
 if(question.choices){
  if(!question.choices.includes(input))return {ok:false,close:false,given:null,valid:false};
  return {ok:input===question.answer,close:false,given:input,valid:true};
 }
 const given=normalizeAnswer(input);
 if(given===null)return {ok:false,close:false,given:null,valid:false};
 const ok=given===normalizeAnswer(question.answer);
 const diff=Math.abs(Number(given)-Number(question.answer));
 const close=!ok&&diff<=(question.decimal?.1001:1);
 return {ok,close,given,valid:true};
}
