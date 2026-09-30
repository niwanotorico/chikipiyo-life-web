// ピヨドリル：算数の問題づくり（DOM なし・テスト可能）。
// 答えはいつも「ひとつの数」。小数は 10 倍した整数で計算するので、浮動小数点の誤差が出ない。
//   token: 文字列 | {frac:[分子,分母]}（null の側が □） | {box:true}（□）

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

export function makeQuestionSet(player,rng=Math.random,count=QUESTIONS_PER_SET){
 if(!PLAYERS[player])throw new Error(`unknown player: ${player}`);
 const makers=player==='piyomi'?piyomiMakers:piyokichiMakers;
 const plan=zonePlan(rng,player==='piyomi'?piyomiPools:piyokichiPools,count);
 const seen=new Set(),list=[];
 for(const {zone,key} of plan){
  let item,tries=0;
  do item=makers[key](rng);while(seen.has(sameKey(item))&&++tries<30);
  seen.add(sameKey(item));
  list.push({...item,zone,id:`${player}-${list.length+1}`,text:questionText(item)});
 }
 return list;
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
 const given=normalizeAnswer(input);
 if(given===null)return {ok:false,close:false,given:null,valid:false};
 const ok=given===normalizeAnswer(question.answer);
 const diff=Math.abs(Number(given)-Number(question.answer));
 const close=!ok&&diff<=(question.decimal?.1001:1);
 return {ok,close,given,valid:true};
}
