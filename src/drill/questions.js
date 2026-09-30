// ちきぴよクエスト：算数の問題づくり（DOM なし・テスト可能）。
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

// ---------- ぴよみ（小学3年） ----------
const piyomiMakers={
 add(rng){
  const v=int(rng,0,2);let a,b;
  if(v===0){a=int(rng,12,89);b=int(rng,11,89);}
  else if(v===1){a=int(rng,101,899);b=int(rng,12,99);}
  else{a=int(rng,101,599);b=int(rng,101,999-a);}
  return q('add','たし算',eq(a,'+',b),a+b);
 },
 sub(rng){
  const v=int(rng,0,2);let a,b;
  if(v===0){a=int(rng,30,99);b=int(rng,11,a-1);}
  else if(v===1){a=int(rng,120,999);b=int(rng,12,99);}
  else{a=int(rng,300,999);b=int(rng,101,a-1);}
  return q('sub','ひき算',eq(a,'−',b),a-b);
 },
 mul(rng){const a=int(rng,2,9),b=int(rng,2,9);return q('kuku','九九',eq(a,'×',b),a*b);},
 div(rng){const b=int(rng,2,9),c=int(rng,2,9);return q('div','わり算',eq(b*c,'÷',b),c);},
};
const piyomiPlan=['add','add','add','sub','sub','mul','mul','mul','div','div'];

// ---------- ぴよきち（小学5年） ----------
const piyokichiMakers={
 bigAdd(rng){const a=int(rng,1200,8999),b=int(rng,150,999);return q('bigAdd','大きな数',eq(a,'+',b),a+b);},
 bigSub(rng){const a=int(rng,3000,9999),b=int(rng,1000,a-500);return q('bigSub','大きな数',eq(a,'−',b),a-b);},
 bigMul(rng){
  const v=int(rng,0,2);let a,b;
  if(v===0){a=int(rng,12,98);b=int(rng,3,9);}
  else if(v===1){a=pick(rng,[25,50,75,125,150,250]);b=pick(rng,[2,3,4,6,8]);}
  else{a=int(rng,12,35);b=int(rng,11,15);}
  return q('bigMul','大きな数',eq(a,'×',b),a*b);
 },
 bigDiv(rng){
  if(rng()<.6){const d=int(rng,2,9),c=int(rng,12,99);return q('bigDiv','大きな数',eq(d*c,'÷',d),c);}
  const d=pick(rng,[12,15,20,25]),c=int(rng,2,9);return q('bigDiv','大きな数',eq(d*c,'÷',d),c);
 },
 decAdd(rng){const a=notRound(rng,11,89),b=notRound(rng,11,89);return q('decAdd','小数',eq(tenths(a),'+',tenths(b)),tenths(a+b),{decimal:true});},
 decSub(rng){const a=notRound(rng,31,99),b=notRound(rng,11,a-5);return q('decSub','小数',eq(tenths(a),'−',tenths(b)),tenths(a-b),{decimal:true});},
 decMul(rng){const a=notRound(rng,11,49),n=int(rng,2,9);return q('decMul','小数',eq(tenths(a),'×',n),tenths(a*n),{decimal:true});},
 decDiv(rng){const c=notRound(rng,11,49),d=int(rng,2,6);return q('decDiv','小数',eq(tenths(c*d),'÷',d),tenths(c),{decimal:true});},
 fracAdd(rng){const d=int(rng,5,12),a=int(rng,1,d-2),b=int(rng,1,d-1-a);return q('fracAdd','分数',[{frac:[a,d]},'+',{frac:[b,d]},'=',{frac:[null,d]}],a+b);},
 fracSub(rng){const d=int(rng,5,12),a=int(rng,3,d-1),b=int(rng,1,a-1);return q('fracSub','分数',[{frac:[a,d]},'−',{frac:[b,d]},'=',{frac:[null,d]}],a-b);},
 fracEq(rng){
  let n,d;do{d=int(rng,2,6);n=int(rng,1,d-1);}while(gcd(n,d)!==1);
  const k=int(rng,2,4);
  return rng()<.5
   ?q('fracEq','分数',[{frac:[n,d]},'=',{frac:[null,d*k]}],n*k)
   :q('fracEq','分数',[{frac:[n*k,d*k]},'=',{frac:[n,null]}],d);
 },
 wordBuy(rng){const p=pick(rng,[60,80,120,150,180,240]),n=int(rng,3,8);return q('word','文章題',[`1こ ${p}円の プリンを ${n}こ 買います。代金は 何円？`],p*n,{unit:'円'});},
 wordShare(rng){const n=int(rng,3,8),c=int(rng,6,24);return q('word','文章題',[`${n*c}まいの シールを ${n}人で 同じ数ずつ 分けます。1人 何まい？`],c,{unit:'まい'});},
 wordArea(rng){const a=int(rng,6,15),b=int(rng,4,12);return q('word','文章題',[`たて ${a}cm、よこ ${b}cm の 長方形の 面積は 何cm²？`],a*b,{unit:'cm²'});},
 wordChange(rng){const p=int(rng,25,98)*10;return q('word','文章題',[`1000円で ${p}円の 本を 買うと、おつりは 何円？`],1000-p,{unit:'円'});},
 wordPages(rng){const p=int(rng,8,25),d=int(rng,4,9);return q('word','文章題',[`本を 1日に ${p}ページずつ 読むと、${d}日で 何ページ？`],p*d,{unit:'ページ'});},
 wordRibbon(rng){const a=int(rng,4,9)*10,b=notRound(rng,11,a-11);return q('word','文章題',[`${tenths(a)}mの リボンから ${tenths(b)}m 使いました。のこりは 何m？`],tenths(a-b),{unit:'m',decimal:true});},
};

function piyokichiPlan(rng){
 const dec=shuffle(rng,['decAdd','decSub','decMul','decDiv']).slice(0,2);
 const frac=shuffle(rng,['fracAdd','fracSub','fracEq']).slice(0,2);
 const word=shuffle(rng,['wordBuy','wordShare','wordArea','wordChange','wordPages','wordRibbon']).slice(0,2);
 return ['bigAdd','bigSub','bigMul','bigDiv',...dec,...frac,...word];
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
 const plan=shuffle(rng,player==='piyomi'?piyomiPlan:piyokichiPlan(rng)).slice(0,count);
 const seen=new Set(),list=[];
 for(const key of plan){
  let item,tries=0;
  do item=makers[key](rng);while(seen.has(sameKey(item))&&++tries<30);
  seen.add(sameKey(item));
  list.push({...item,id:`${player}-${list.length+1}`,text:questionText(item)});
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
