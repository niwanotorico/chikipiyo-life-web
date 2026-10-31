// ピヨドリル：まちがえたときの「考え方」ひとこと（DOM なし・テスト可能）。
//   算数：問題の数字から ひな形で作り、計算しなおして 答えと 合ったときだけ 返す（合わなければ null＝説明なし）。
//   3択：subjects/*-why.js の「ちきんが 読んで OK を出した（checked:true）」行だけ 返す。まだの行は null。
// questions.js・scoring.js には さわらない（毎日の問題・得点は そのまま）。
import piyomiG3Why from './subjects/piyomi-g3-why.js';
import piyomiG3NovWhy from './subjects/piyomi-g3-nov-why.js';

const PLACE=['一','十','百','千','万'];
const isInt=s=>/^\d+$/.test(s);
const tz=n=>{let z=0;while(n>0&&n%10===0){n/=10;z++;}return z;};   // うしろの 0 の数
const digits=n=>String(n).split('').reverse().map(Number);
// 小数を 0.1 の いくつ分（整数）に。"2.3" → 23、"4" → 40
const toTenths=s=>{const [w,f='']=String(s).split('.');return f.length>1?NaN:Number(w)*10+Number(f||0);};
const fromTenths=t=>t%10===0?String(t/10):`${Math.floor(t/10)}.${t%10}`;
const same=(value,answer)=>String(value)===String(answer);

// ---------- 3択 ----------
const CHOICE_WHY=new Map();
for(const table of [piyomiG3Why,piyomiG3NovWhy])for(const rows of Object.values(table))for(const [text,why,checked] of rows)if(checked===true&&why)CHOICE_WHY.set(text,why);
export function choiceWhyTable(){return CHOICE_WHY;}

// ---------- たし算・ひき算（位ごと） ----------
function addColumns(a,b){
 const da=digits(a),db=digits(b),n=Math.max(da.length,db.length),parts=[];let carry=0,out=0;
 for(let i=0;i<n;i++){
  const x=da[i]??null,y=db[i]??null,s=(x??0)+(y??0)+carry;
  const terms=[x,y].filter(v=>v!==null).map(String);if(carry)terms.push('1');
  const name=`${PLACE[i]??''}の位`;
  if(terms.length===1)parts.push(`${name} ${terms[0]}`);
  else parts.push(`${name} ${terms.join('＋')}＝${s}${s>=10&&i<n-1?'（1 くり上がり）':''}`);
  out+=(i<n-1?s%10:s)*10**i;carry=s>=10&&i<n-1?1:0;
 }
 return {text:parts.join('、'),value:out};
}
function subColumns(a,b){
 const da=digits(a),db=digits(b),parts=[];let borrow=0,out=0;
 for(let i=0;i<da.length;i++){
  const x=da[i]-borrow,y=db[i]??0,name=`${PLACE[i]??''}の位`;
  if(x<0)return null;   // 0 から かりる（くり下がりが つづく）形は 位ごとの説明を やめる
  const lent=borrow?'（1 かしたので '+x+'）':'';
  if(x<y){parts.push(`${name}${lent} ${x}−${y} は ひけないので、となりから 10 かりて ${x+10}−${y}＝${x+10-y}`);out+=(x+10-y)*10**i;borrow=1;}
  else{if(db[i]===undefined&&!borrow){parts.push(`${name} ${x}`);}else parts.push(`${name}${lent} ${x}−${y}＝${x-y}`);out+=(x-y)*10**i;borrow=0;}
 }
 return borrow?null:{text:parts.join('、'),value:out};
}
function addWhy(a,b,ans){
 const z=Math.min(tz(a),tz(b));
 if(z>=2&&a>=100&&b>=100){const p=10**z,s=a/p+b/p;return same(s*p,ans)?`0を ${z}こ とって ${a/p}＋${b/p}＝${s}、0を ${z}こ つけて ${ans}`:null;}
 const c=addColumns(a,b);return same(c.value,ans)?`${c.text} → ${ans}`:null;
}
function subWhy(a,b,ans){
 const z=Math.min(tz(a),tz(b));
 if(z>=2&&a>=100&&b>=100){const p=10**z,s=a/p-b/p;return same(s*p,ans)?`0を ${z}こ とって ${a/p}−${b/p}＝${s}、0を ${z}こ つけて ${ans}`:null;}
 const c=subColumns(a,b);
 if(c&&same(c.value,ans))return `${c.text} → ${ans}`;
 return same(b+Number(ans),a)?`たし算で たしかめよう：${b}＋${ans}＝${a}`:null;
}
// ---------- かけ算 ----------
function mulWhy(a,b,ans){
 if(a<10&&b<10){   // 九九
  if(b===1||a===1)return null;
  const p=a*(b-1);return same(p+a,ans)?`${a}の だん：${a}×${b-1}＝${p} に ${a} を たすと ${ans}`:null;
 }
 if(b>=10){const bt=b-b%10,bo=b%10,x=a*bt,y=a*bo;   // 2けた×2けた
  if(!bo)return null;
  return same(x+y,ans)?`${a}×${bt}＝${x} と ${a}×${bo}＝${y}、あわせて ${ans}`:null;}
 const z=tz(a),core=a/10**z;
 if(z>0&&core<10)return same(core*b*10**z,ans)?`${core}×${b}＝${core*b} に 0を ${z}こ つけて ${ans}`:null;
 const parts=digits(a).map((d,i)=>d*10**i).filter(Boolean).reverse(),prods=parts.map(p=>p*b);
 if(parts.length<2)return null;
 return same(prods.reduce((s,v)=>s+v,0),ans)?`${parts.map((p,i)=>`${p}×${b}＝${prods[i]}`).join('、')}、あわせて ${ans}`:null;
}
// ---------- わり算 ----------
function divWhy(a,b,ans){
 const c=Number(ans);if(b*c!==a)return null;
 if(c<10)return `${b}×□＝${a} の □ を 九九で さがすと、${b}×${c}＝${a}`;
 const ct=c-c%10,co=c%10;
 if(!co)return `${b}×${c}＝${a}`;
 return `${b}×${ct}＝${b*ct}、のこりの ${a-b*ct} は ${b}×${co}。あわせて ${ct}＋${co}＝${c}`;
}
// ---------- 小数（0.1 の いくつ分） ----------
function decWhy(a,op,b,ans){
 const ta=toTenths(a);
 if(op==='+'||op==='−'){const tb=toTenths(b),r=op==='+'?ta+tb:ta-tb;return same(fromTenths(r),ans)?`0.1が いくつ分か で 考えよう：${ta}${op==='+'?'＋':'−'}${tb}＝${r} → 0.1が ${r}こで ${ans}`:null;}
 const n=Number(b);if(!isInt(String(b)))return null;
 if(op==='×'){const r=ta*n;return same(fromTenths(r),ans)?`${a} は 0.1が ${ta}こ。${ta}×${n}＝${r} → 0.1が ${r}こで ${ans}`:null;}
 if(op==='÷'){if(ta%n)return null;const r=ta/n;return same(fromTenths(r),ans)?`${a} は 0.1が ${ta}こ。${ta}÷${n}＝${r} → 0.1が ${r}こで ${ans}`:null;}
 return null;
}
// ---------- 分数 ----------
function fracWhy(t,ans){
 const f=x=>x&&typeof x==='object'&&Array.isArray(x.frac)?x.frac:null;
 if(t.length===5&&(t[1]==='+'||t[1]==='−')){
  const [a,d]=f(t[0])||[],[b,d2]=f(t[2])||[],[,d3]=f(t[4])||[];
  if(d==null||d!==d2||d!==d3)return null;
  const r=t[1]==='+'?a+b:a-b;
  return same(r,ans)?`分母は ${d} の まま。分子だけ ${t[1]==='+'?'たして':'ひいて'} ${a}${t[1]==='+'?'＋':'−'}${b}＝${r}`:null;
 }
 if(t.length===3&&t[1]==='='){
  const [n,d]=f(t[0])||[],[N,D]=f(t[2])||[];if(n==null)return null;
  if(N==null&&D!=null){const k=D/d;return Number.isInteger(k)&&same(n*k,ans)?`分母が ${d}→${D} で ${k}倍。分子も ${k}倍して ${n}×${k}＝${n*k}`:null;}
  if(D==null&&N!=null){
   if(N>n){const k=N/n;return Number.isInteger(k)&&same(d*k,ans)?`分子が ${n}→${N} で ${k}倍。分母も ${k}倍して ${d}×${k}＝${d*k}`:null;}
   const k=n/N;return Number.isInteger(k)&&Number.isInteger(d/k)&&same(d/k,ans)?`分子が ${n}→${N} で ${k}で わった。分母も ${k}で わって ${d}÷${k}＝${d/k}`:null;
  }
 }
 return null;
}
// ---------- 文章題（ピヨドリルの 文のかたち だけ。わからない文は null） ----------
const WORD=[
 [/1こ (\d+)円の .+を (\d+)こ 買/,(p,n)=>[Number(p)*Number(n),`1こ ${p}円が ${n}こ分 なので かけ算：${p}×${n}`]],
 [/(\d+)円の カレーパンを (\d+)こ 買/,(p,n)=>[Number(p)*Number(n),`${p}円が ${n}こ分 なので かけ算：${p}×${n}`]],
 [/1さら (\d+)円の カレーを (\d+)さら/,(p,n)=>[Number(p)*Number(n),`1さら ${p}円が ${n}さら分 なので かけ算：${p}×${n}`]],
 [/1000円で (\d+)円の/,p=>[1000-Number(p),`おつりは ひき算：1000−${p}`]],
 [/1日に (\d+)ページずつ 読むと、(\d+)日/,(p,d)=>[Number(p)*Number(d),`${p}ページが ${d}日分 なので かけ算：${p}×${d}`]],
 [/(\d+)まいの シールを (\d+)人で/,(a,n)=>[Number(a)/Number(n),`同じ数ずつ 分けるので わり算：${a}÷${n}`]],
 [/(\d+)この .+ (\d+)人で 同じ数ずつ/,(a,n)=>[Number(a)/Number(n),`同じ数ずつ 分けるので わり算：${a}÷${n}`]],
 [/たて (\d+)cm、よこ (\d+)cm/,(a,b)=>[Number(a)*Number(b),`長方形の 面積は たて×よこ：${a}×${b}`]],
 [/が (\d+)こ あります。.+が (\d+)こ (?:つかう|食べる|たべる)と/,(a,b)=>[Number(a)-Number(b),`のこりは ひき算：${a}−${b}`]],
 [/(\d+)人に .+を (\d+)こずつ/,(n,k)=>[Number(n)*Number(k),`${k}こずつ ${n}人分 なので かけ算：${k}×${n}`]],
 [/1000を (\d+)こ 集めた/,n=>[Number(n)*1000,`1000が ${n}こ。${n} に 0を 3こ つけるよ`]],
 [/(\d+)を 10倍した/,a=>[Number(a)*10,`10倍すると、うしろに 0が 1こ ふえるよ`]],
 [/(\d+)を 10で わった/,a=>[Number(a)/10,`10で わると、うしろの 0が 1こ へるよ`]],
 [/([\d.]+)mの リボンから ([\d.]+)m 使い/,(a,b)=>[fromTenths(toTenths(a)-toTenths(b)),`のこりは ひき算：${a}−${b}`]],
 [/1日に ([\d.]+)kg (?:つかいます|たべます)。(\d+)日では/,(a,n)=>[fromTenths(toTenths(a)*Number(n)),`${n}日分 なので かけ算：${a}×${n}`]],
 // 11月：円と球
 [/^半径 (\d+)cmの 円の 直径/,r=>[Number(r)*2,`直径は 半径の 2つ分：${r}×2`]],
 [/^直径 (\d+)cmの 円の 半径/,d=>[Number(d)/2,`半径は 直径の 半分：${d}÷2`]],
 [/^直径 (\d+)cmの 円を コンパスで/,d=>[Number(d)/2,`コンパスは 半径の 長さに 開くよ。半径は 直径の 半分：${d}÷2`]],
 [/切り口の 円の 直径が (\d+)cm/,d=>[Number(d)/2,`半分に 切った 切り口の 直径＝球の 直径。半径は その 半分：${d}÷2`]],
 // 11月：小数
 [/^0\.1Lを (\d+)こ 集めた/,n=>[fromTenths(Number(n)),`0.1が ${n}こで ${fromTenths(Number(n))}`]],
 [/^(\d+)L (\d)dLは 何L/,(a,b)=>[fromTenths(Number(a)*10+Number(b)),`1dL＝0.1L。${b}dL＝0.${b}L なので ${a}Lと あわせて`]],
 [/^([\d.]+)Lは 0\.1Lの 何こ分/,a=>[toTenths(a),`${a} を 0.1 の いくつ分か 考えよう`]],
 [/^(\d+)mmは 何cm/,n=>[fromTenths(Number(n)),`1mm＝0.1cm。${n}mmは 0.1cmが ${n}こ`]],
 [/^1m (\d)0cmは 何m/,n=>[fromTenths(10+Number(n)),`10cm＝0.1m。${n}0cmは 0.${n}m なので 1mと あわせて`]],
 [/^(\d)0cmは 何m/,n=>[fromTenths(Number(n)),`10cm＝0.1m。${n}0cmは 0.1mが ${n}こ`]],
];
function wordWhy(text,ans){
 for(const [re,fn] of WORD){
  const m=re.exec(text);if(!m)continue;
  const [value,why]=fn(...m.slice(1));
  return same(value,ans)?`${why} → ${ans}`:null;
 }
 return null;
}

function mathWhy(q){
 const t=q.tokens||[],ans=String(q.answer);
 const part=/^(\d+)cmの$/.exec(typeof t[0]==='string'?t[0]:'');
 if(part&&t[1]?.frac?.[0]===1){   // 80cmの 1/4 の 長さ：もとの 長さを 等分する わり算
  const L=Number(part[1]),n=t[1].frac[1];
  return same(L/n,ans)?`1/${n}は ${n}等分した 1こ分。わり算で：${L}÷${n}＝${ans}`:null;
 }
 if(q.kind==='word'||(t.length===1&&typeof t[0]==='string'))return wordWhy(String(t[0]??q.text??''),ans);
 if(t.some(x=>x&&typeof x==='object'&&x.frac))return fracWhy(t,ans);
 if(t.length===7&&t[1]==='×'&&t[3]==='×'&&[t[0],t[2],t[4]].every(isInt)){   // 3つの数の かけ算：うしろを 先に まとめる
  const [a,b,c]=[t[0],t[2],t[4]].map(Number);
  return same(a*b*c,ans)?`うしろの ${b}×${c}＝${b*c} を 先に 計算すると かんたん：${a}×${b*c}＝${ans}`:null;
 }
 if(t.length!==5||typeof t[0]!=='string'||typeof t[2]!=='string'||!t[4]?.box)return null;
 const [a,op,b]=t;
 const man=/^(\d+)万$/;
 if(man.test(a)&&man.test(b)){   // 700万 − 200万 ＝ □万
  const x=Number(man.exec(a)[1]),y=Number(man.exec(b)[1]),z=tz(Math.min(x,y)),p=10**z;
  const r=op==='+'?x+y:x-y;if(!same(r,ans))return null;
  return `${p>1?p:''}万の まとまりで 考えよう：${x/p}${op==='+'?'＋':'−'}${y/p}＝${r/p} → ${r}万`;
 }
 if(a.includes('.')||b.includes('.')||q.decimal)return decWhy(a,op,b,ans);
 if(!isInt(a)||!isInt(b))return null;
 const x=Number(a),y=Number(b);
 if(op==='+')return addWhy(x,y,ans);
 if(op==='−')return subWhy(x,y,ans);
 if(op==='×')return mulWhy(x,y,ans);
 if(op==='÷')return divWhy(x,y,ans);
 return null;
}

// 戻り値：ひとことの文字列、または null（説明を 出さない）
export function explain(q){
 if(!q)return null;
 try{
  // 算数の 図・ことばの 3択は、問題を 作るときに ひとこと（q.why）を いっしょに もつ
  if(q.choices)return CHOICE_WHY.get(String(q.tokens?.[0]??q.text??''))??(q.subject==='算数'&&q.why?q.why:null);
  return mathWhy(q)??null;
 }catch{return null;}
}
