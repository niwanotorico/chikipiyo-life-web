// ちきぴよクエスト v0.3：キャラクター演出。
// 完成済みの透過 PNG（assets/drill/characters）を一枚絵のまま <img> で切り替え、
// Web Animations API の移動・拡縮・回転と、薄い残像で動かす（絵の分割・描き足しはしない）。
//
//  - 固定サイズの「舞台」（.dq-stage）の中だけで動くので、絵ごとのサイズ差でレイアウトが動かない
//  - 絵は object-fit: contain（縦横比を崩さない）。読み込めない絵があっても、前の絵のまま進む
//  - 新しい演出を始めると、前の演出のアニメーションとタイマーはすべて止めて片づける
//  - 目玉焼き（ちきぴよオリジナルのインライン SVG）もここで出す
import {ALL_POSE_FILES,EGG_TIMES} from './hype.js';

// 絵の URL（Vite がビルド時に取りこめるよう、1枚ずつ固定の文字列で書く）
export const POSE_URLS={
 'dance01':new URL('../../assets/drill/characters/dance01.png',import.meta.url).href,
 'dance02':new URL('../../assets/drill/characters/dance02.png',import.meta.url).href,
 'spin':new URL('../../assets/drill/characters/spin.png',import.meta.url).href,
 'hands_up':new URL('../../assets/drill/characters/hands_up.png',import.meta.url).href,
 'headphones':new URL('../../assets/drill/characters/headphones.png',import.meta.url).href,
 'dj':new URL('../../assets/drill/characters/dj.png',import.meta.url).href,
 'piyokichi-wrong':new URL('../../assets/drill/characters/piyokichi-wrong.png',import.meta.url).href,
 'piyomi-wrong':new URL('../../assets/drill/characters/piyomi-wrong.png',import.meta.url).href,
 'music_duo':new URL('../../assets/drill/characters/music_duo.png',import.meta.url).href,
 'radio_duo':new URL('../../assets/drill/characters/radio_duo.png',import.meta.url).href,
};


export const EGG_SVG='<svg viewBox="0 0 120 70" aria-hidden="true"><g class="dq-egg-white"><path d="M8 42 C2 28 18 14 36 16 C44 6 66 4 76 14 C94 8 116 20 110 38 C118 52 100 64 82 60 C70 70 44 68 34 62 C18 66 4 56 8 42Z" fill="#fff" stroke="#e6ddcc" stroke-width="3"/></g><g class="dq-egg-yolk"><circle cx="60" cy="36" r="17" fill="#ffb21e" stroke="#e8900c" stroke-width="2.5"/><ellipse cx="53" cy="29" rx="6" ry="4" fill="#fff4c8" opacity=".85"/></g></svg>';

export class Actor{
 constructor(stage,{reduced=()=>false}={}){
  this.stage=stage;this.reduced=reduced;
  this.anims=new Set();this.timers=new Set();this.token=0;this.idleSrc='';this.current='';
  stage.innerHTML=`<div class="dq-actor-ghosts" aria-hidden="true"><img alt=""><img alt=""><img alt=""></div>
<div class="dq-actor-move"><div class="dq-actor-body"><img class="dq-actor-img" alt=""></div></div><div class="dq-actor-props"></div>`;
  this.move=stage.querySelector('.dq-actor-move');this.body=stage.querySelector('.dq-actor-body');
  this.img=stage.querySelector('.dq-actor-img');this.ghosts=[...stage.querySelectorAll('.dq-actor-ghosts img')];
  this.props=stage.querySelector('.dq-actor-props');
  // 読み込めない絵のときは、ひとつ前の絵にもどす（進行は止めない）
  this.img.addEventListener('error',()=>{if(this.lastGood&&this.img.src!==this.lastGood)this.img.src=this.lastGood;});
  this.img.addEventListener('load',()=>{this.lastGood=this.img.src;});
 }
 url(name){return POSE_URLS[name]||'';}
 preload(){for(const n of ALL_POSE_FILES){const i=new Image();i.decoding='async';i.src=this.url(n);}}
 setIdle(src){this.idleSrc=src;this.show(src,{kind:'idle'});}
 show(src,{kind='pose'}={}){
  this.current=src;this.img.src=src;this.stage.dataset.kind=kind;
  for(const g of this.ghosts)g.src=src;
 }
 pose(name,kind='pose'){this.show(this.url(name),{kind:kind==='duo'?'duo':kind});}

 // ---------- 片づけ ----------
 later(ms,fn){const tk=this.token;const id=setTimeout(()=>{this.timers.delete(id);if(tk===this.token)fn();},ms);this.timers.add(id);return id;}
 anim(el,frames,opts){const a=el.animate(frames,opts);this.anims.add(a);a.finished.then(()=>this.anims.delete(a),()=>this.anims.delete(a));return a;}
 stop(){
  this.token++;
  for(const id of this.timers)clearTimeout(id);this.timers.clear();
  for(const a of this.anims)a.cancel();this.anims.clear();
  this.props.replaceChildren();this.stage.classList.remove('ghosts','egg');
 }
 get busy(){return this.timers.size>0||[...this.anims].some(a=>a.playState==='running');}
 // 次の問題：いつもの絵にもどす
 rest(){this.stop();if(this.idleSrc)this.show(this.idleSrc,{kind:'idle'});}
 reset(){this.stop();this.show(this.idleSrc||'',{kind:'idle'});}

 // 拍に合わせて小さく上下（演出中はしない）
 beat(strong=false){
  if(this.anims.size||this.reduced())return;
  const a=this.body.animate([{transform:`translateY(${strong?-5:-3}px) scale(1.03,.97)`},{transform:'none'}],{duration:220,easing:'ease-out'});
  void a;
 }

 // ---------- 演出 ----------
 // plan は hype.js の actorPlan()。正解音・粒子・「+1 pt」と同じ瞬間に呼ぶ
 play(plan){
  this.stop();
  const reduced=this.reduced(),tk=this.token;
  this.pose(plan.from,plan.duo?'duo':plan.move==='wrong'?'wrong':'pose');
  if(reduced)return this.playReduced(plan);
  const M=this.move,B=this.body;
  const land=(at,k=1)=>this.later(at,()=>this.anim(B,[{transform:`scale(${1+.16*k},${1-.2*k})`},{transform:`scale(${1-.06*k},${1+.08*k})`},{transform:'none'}],{duration:260,easing:'ease-out'}));
  const apex=(at)=>{if(plan.apex)this.later(at,()=>this.pose(plan.apex));};
  const ghosts=(on,dur)=>{if(!plan.ghosts)return;this.stage.classList.add('ghosts');this.ghosts.forEach((g,i)=>{g.hidden=i>=plan.ghosts;});this.later(dur,()=>this.stage.classList.remove('ghosts'));};
  switch(plan.move){
   case 'small':{ // 小さなジャンプ：しゃがむ→跳ぶ→着地でつぶれる
    this.anim(B,[{transform:'scale(1.12,.86)'},{transform:'none'}],{duration:90});
    this.anim(M,[{transform:'none'},{transform:'translateY(-18px)',offset:.45},{transform:'none'}],{duration:420,delay:70,easing:'cubic-bezier(.3,.7,.4,1)'});
    land(490,.8);break;}
   case 'big':{ // 大きめジャンプ＋左右の傾き。頂点で強い絵へ
    this.anim(B,[{transform:'scale(1.16,.82)'},{transform:'none'}],{duration:90});
    this.anim(M,[{transform:'none'},{transform:'translateY(-34px) rotate(-12deg)',offset:.3},{transform:'translateY(-40px) rotate(10deg)',offset:.55},{transform:'translateY(-8px) rotate(-4deg)',offset:.85},{transform:'none'}],{duration:560,delay:70,easing:'ease-out'});
    apex(240);land(630,1);break;}
   case 'turn':{ // 回転して少し行き過ぎて戻る。頂点で絵を切り替え
    this.anim(M,[{transform:'none'},{transform:'translateY(-36px) rotate(200deg) scale(1.08)',offset:.45},{transform:'translateY(-6px) rotate(385deg)',offset:.8},{transform:'rotate(360deg)'}],{duration:620,easing:'cubic-bezier(.3,.7,.4,1)'});
    apex(260);land(560,1);break;}
   case 'duo':{ // 2人が画面外から飛び込む（選んでいない兄弟も応援に）
    ghosts(true,700);
    const from=-(this.stage.getBoundingClientRect().left+this.stage.offsetWidth+20);
    const frames=[{transform:`translateX(${from}px) translateY(-40px) rotate(-18deg)`},{transform:'translateX(8px) translateY(-18px) rotate(6deg)',offset:.7},{transform:'none'}];
    this.anim(M,frames,{duration:520,easing:'cubic-bezier(.2,.8,.3,1)'});
    this.ghostTrail(frames,520);
    land(520,1.1);break;}
   case 'wild':{ // 大回転＋残像。頂点で絵を切り替え
    ghosts(true,900);
    const frames=[{transform:'none'},{transform:'translateY(-48px) rotate(-360deg) scale(1.2)',offset:.45},{transform:'translateY(-10px) rotate(-735deg) scale(1.05)',offset:.82},{transform:'rotate(-720deg)'}];
    this.anim(M,frames,{duration:760,easing:'cubic-bezier(.3,.7,.4,1)'});
    this.ghostTrail(frames,760);
    apex(330);land(700,1.2);break;}
   case 'wrong':{ // びくっ（0.2秒）→ 少し沈む。やさしく
    this.anim(M,[{transform:'none'},{transform:'translate(-3px,-6px) scale(1.08)',offset:.35},{transform:'translate(3px,-4px) scale(1.06)',offset:.7},{transform:'none'}],{duration:200,easing:'ease-out'});
    this.later(200,()=>this.anim(M,[{transform:'none'},{transform:'translateY(6px) scale(.96)'}],{duration:300,easing:'ease-out',fill:'forwards'}));
    break;}
  }
  void tk;
 }
 // 残像：同じ絵を少し遅れて同じ動きでなぞる
 ghostTrail(frames,duration){
  this.ghosts.forEach((g,i)=>{if(!g.hidden)this.anim(g,frames,{duration,delay:45*(i+1),easing:'cubic-bezier(.3,.7,.4,1)',fill:'backwards'});});
 }
 // 動きを減らす設定：回転・残像・大きな移動なし。ふわっと出して、少し大きくするだけ
 playReduced(plan){
  this.anim(this.body,[{opacity:.4,transform:'scale(.96)'},{opacity:1,transform:'none'}],{duration:180});
  if(plan.apex)this.later(260,()=>this.pose(plan.apex));
 }

 // ---------- 目玉焼き ----------
 // 落ちる → 着地で白身が横につぶれる → 黄身がぷるん → 目玉焼きが小さく跳ねる。キャラは「びくっ」→ 喜ぶ
 egg(lightPose){
  this.stop();
  const reduced=this.reduced(),T=EGG_TIMES;
  const el=document.createElement('div');el.className='dq-egg';el.innerHTML=EGG_SVG;
  this.props.append(el);this.stage.classList.add('egg');
  const top=this.stage.getBoundingClientRect().top;
  if(reduced)this.anim(el,[{opacity:0},{opacity:1}],{duration:200,fill:'both'});
  else this.anim(el,[{transform:`translateY(${-(top+80)}px) rotate(-25deg)`},{transform:'none'}],{duration:T.land,easing:'cubic-bezier(.55,0,1,1)',fill:'both'});
  const white=el.querySelector('.dq-egg-white'),yolk=el.querySelector('.dq-egg-yolk');
  this.later(T.land,()=>{
   // ぽすっ：白身が横につぶれ、キャラがびくっ
   if(!reduced){this.anim(white,[{transform:'scale(1.35,.6)'},{transform:'scale(.92,1.08)'},{transform:'none'}],{duration:320,easing:'ease-out'});
    this.anim(this.move,[{transform:'none'},{transform:'translateY(-8px) scale(1.1)'},{transform:'none'}],{duration:200});}
  });
  this.later(T.jiggle,()=>{if(!reduced)this.anim(yolk,[{transform:'scale(1.25,.75)'},{transform:'scale(.85,1.18)'},{transform:'scale(1.1,.92)'},{transform:'scale(.96,1.04)'},{transform:'none'}],{duration:420,easing:'ease-out'});});
  this.later(T.happy,()=>{this.pose(lightPose);if(!reduced)this.anim(this.move,[{transform:'none'},{transform:'translateY(-16px)',offset:.45},{transform:'none'}],{duration:380,easing:'ease-out'});});
  this.later(T.hop,()=>{if(!reduced)this.anim(el,[{transform:'none'},{transform:'translateY(-22px) rotate(8deg)',offset:.45},{transform:'none'}],{duration:320,easing:'ease-out'});});
  this.later(T.leave,()=>this.anim(el,[{opacity:1},{opacity:0,transform:reduced?'none':'translateY(-10px) scale(.8)'}],{duration:T.end-T.leave,fill:'forwards'}));
  this.later(T.end,()=>{el.remove();this.stage.classList.remove('egg');});
 }
}
