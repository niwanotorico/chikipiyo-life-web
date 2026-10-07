// ピヨドリル「おまつり」モード：ラボ（演出ラボ 派手さ100%）の演出を、ふつうの演出に“足す”だけ。
// ここは見た目と音の味つけだけ。問題・得点・ピヨ探検pt・報酬・保存データ（storage.js / cosmicube*.js / scoring.js）には一切触れない。
// 「ふつう」のときは、このファイルの関数は 1つも呼ばれない（main.js 側で play.fx==='festival' のときだけ呼ぶ）。
import {POSE_URLS} from './actor.js';

// ---------- 選んだモードの保存（専用キー1つだけ。記録データとは別） ----------
export const FXMODE_KEY='chikipiyo-quest:fxmode';
export const FX_NORMAL='normal',FX_FESTIVAL='festival';
// 初回（キーなし）と、こわれた値は「ふつう」
export function loadFxMode(storage){try{return storage?.getItem(FXMODE_KEY)===FX_FESTIVAL?FX_FESTIVAL:FX_NORMAL;}catch{return FX_NORMAL;}}
export function saveFxMode(storage,mode){try{storage?.setItem(FXMODE_KEY,mode===FX_FESTIVAL?FX_FESTIVAL:FX_NORMAL);return true;}catch{return false;}}

// ---------- 演出量の表（純粋関数。q は 1〜10 の問題番号） ----------
export const FEST_FEVER_MS=5200;   // おまつりのプリンフィーバーの長さ（ふつうは hype.js の FEVER_MS=3900）。比較して調整する
export function festivalPower(q,combo){return (.35+q*.14)*(1+Math.min(combo,10)*.03);}
// ふつうの visuals() の結果に、ラボ100%の量を上乗せする（下回らない）。動きを減らす設定のときは何も足さない
export function festivalVisuals(v,{q,combo,reduced=false}){
 if(reduced)return v;
 const p=festivalPower(q,combo);
 return {...v,
  particles:Math.max(v.particles,Math.round(4+14*p)),
  bigEggs:q>=4?Math.max(v.bigEggs,2):v.bigEggs,
  hopEggs:q>=4?Math.max(v.hopEggs,6):v.hopEggs,
  rain:q>=7?Math.max(v.rain,6+(q-6)*4):v.rain,
  shake:q>=4?Math.max(v.shake,Math.min(12,p*4)):v.shake,
  flash:q>=7?Math.max(v.flash,.5):v.flash,
 };
}
// 飛び上がるキャラの数：4〜6問目は1体、7〜9問目は 2〜4体（ラボと同じ）。最後の問題はフィーバー側で出す
export function festivalDancerCount(q){return q>=7&&q<=9?2+(q-7):q>=4&&q<=6?1:0;}
// コンボ表示：2コンボ以上は毎回（位置はふつうと同じ、カード上のカットイン）
export function festivalCombo(combo){
 if(combo<2)return null;
 return {size:combo>=8?4:combo>=5?3:combo>=3?2:1,text:`${combo}れんぞく！`};
}
// つぎの問題が 4／7／10 問目になるとき、画面上部に出す大きな文字
export function festivalStageText(nextQ){return nextQ===4?'ノってきた!!':nextQ===7?'アツアツ!!':nextQ===10?'ラスト1もん!!':null;}

// ---------- ここから DOM（ブラウザだけ） ----------
const SETS=[['dance01','dance02'],['spin'],['hands_up'],['headphones'],['music_duo'],['radio_duo']];
const MAX_DANCERS=14;
let layer=null,dancerCount=0;
const rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];

function ensureLayer(){
 if(layer&&layer.isConnected)return layer;
 layer=document.createElement('div');layer.className='dq-fest-layer';layer.setAttribute('aria-hidden','true');
 document.body.append(layer);return layer;
}
// front=true のときだけ、画面の手前（フィーバーの全画面演出の上）に出す。ふだんは問題・ボタンの後ろ
export function setLayerFront(front){ensureLayer().classList.toggle('is-front',!!front);}
export function clear(){
 if(layer){layer.replaceChildren();layer.classList.remove('is-front');}
 dancerCount=0;
 for(const el of document.querySelectorAll('.dq-fest-wave,.dq-fest-stage'))el.remove();
}

// 下から飛び上がって、ひと回りして落ちるキャラ（ラボの dancer と同じ動き）。タッチは邪魔しない（pointer-events:none）
export function dancers(n=1,{reduced=false}={}){
 if(reduced)return;
 const L=ensureLayer(),W=innerWidth,H=innerHeight;
 for(let i=0;i<n&&dancerCount<MAX_DANCERS;i++){
  const set=pick(SETS),left=Math.random()<.5,s=100+Math.random()*50*(innerWidth<500?.8:1);
  const duo=set[0].includes('duo'),size=s*(duo?1.5:1);
  const x0=W*(left?.1+Math.random()*.3:.6+Math.random()*.3),vx=(left?1:-1)*(40+Math.random()*120);
  const vy=-(H*.9+Math.random()*H*.5),g=H*1.1,life=2.6,spin=set[0]==='spin'?(left?9:-9):0,ph=Math.random()*6;
  const img=document.createElement('img');img.className='dq-fest-dancer';img.alt='';img.decoding='async';
  img.style.width=`${size}px`;img.src=POSE_URLS[set[0]];
  L.append(img);dancerCount++;
  const kf=[];const N=26;
  for(let k=0;k<=N;k++){
   const t=k/N*life,x=x0+vx*t,y=H+s+vy*t+.5*g*t*t,rot=spin?spin*t:Math.sin(t*10+ph)*.18;
   kf.push({transform:`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) rotate(${rot.toFixed(3)}rad)`,opacity:k===N?0:1});
  }
  let iv=0;
  if(set.length>1){let f=0;iv=setInterval(()=>{f=(f+1)%set.length;img.src=POSE_URLS[set[f]];},140);}
  const done=()=>{clearInterval(iv);img.remove();dancerCount=Math.max(0,dancerCount-1);};
  const a=img.animate(kf,{duration:life*1000,easing:'linear',fill:'forwards'});
  a.onfinish=done;a.oncancel=done;
 }
}

// 正解の波紋：黄色の輪と、赤い点線の輪が広がる（細い線だけ。答えは隠さない）
export function wave(x,y,r,{reduced=false}={}){
 if(reduced)return;
 const el=document.createElement('div');el.className='dq-fest-wave';el.setAttribute('aria-hidden','true');
 el.style.cssText=`left:${x}px;top:${y}px;width:${r*2}px;height:${r*2}px`;
 document.body.append(el);
 const a=el.animate([
  {transform:'translate(-50%,-50%) scale(.4)',opacity:.85},
  {transform:'translate(-50%,-50%) scale(2)',opacity:0},
 ],{duration:900,easing:'ease-out',fill:'forwards'});
 a.onfinish=()=>el.remove();
}

// 段階アップの大きな文字（画面の上のほう。問題・答え・ボタンには重ねない）
export function stageText(text,{reduced=false}={}){
 for(const old of document.querySelectorAll('.dq-fest-stage'))old.remove();
 const el=document.createElement('div');el.className='dq-fest-stage';el.textContent=text;el.setAttribute('aria-hidden','true');
 document.body.append(el);
 const a=el.animate(reduced?[{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.8},{opacity:0}]:[
  {transform:'translate(-50%,-50%) scale(0) rotate(-14deg)',opacity:1},
  {transform:'translate(-50%,-50%) scale(1.35) rotate(4deg)',opacity:1,offset:.18},
  {transform:'translate(-50%,-50%) scale(1) rotate(-2deg)',opacity:1,offset:.32},
  {transform:'translate(-50%,-50%) scale(1) rotate(0)',opacity:1,offset:.75},
  {transform:'translate(-50%,-80%) scale(1)',opacity:0},
 ],{duration:1400,easing:'cubic-bezier(.2,1.6,.4,1)',fill:'forwards'});
 a.onfinish=()=>el.remove();
}

// プリンフィーバーの“おまつり”：拍ごとの卵跳ね＋降る粒、飛び回るキャラ（ラボと同じ：拍は約0.47秒＝BPM128相当）
// later は main.js の later（その回が終わったら自動で止まる）。particles は fx.js の Particles
export function feverShow({later,particles,reduced=false}){
 if(reduced)return;
 setLayerFront(true);
 for(let k=0;k<10;k++){
  later(300+k*470,()=>{
   particles.hopEggs(6,{life:.7});
   if(k%2===0)particles.rain({count:8,kinds:['pudding','fried','omu','feather','heart'],life:1.6});
  });
 }
 for(let k=0;k<8;k++)later(300+k*420,()=>dancers(1));
}
