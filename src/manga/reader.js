import './reader.css';
import {SERIES,MANGA_PLAYERS,seriesById,readableEpisodes} from './catalog.js';
import {withPages,clampPosition,stepPosition,pageAt,createPageWindow} from './reading.js';
import {readUnlocks,readShelf,writeShelf,defaultPlayer,CUBE_KEY,QUEST_KEY} from './unlocks.js';

// 3DPハウスの本だなの「大きなマンガリーダー」。本だなの本を はじめて タップしたときに読み込む（main.js から import()）。
// 画像は「いま見ているページ」と「つぎの1枚」だけ読む。ぜんぶの話を まとめて読んだり、自前でためこんだりはしない。
// ピヨドリルの保存データは読むだけ。本だなが おぼえるのは「えらんだ人」と「さいごに よんだ ところ」だけ（unlocks.js）。

// ---------- 画面 ----------
// host：3D 表示のエリア（.world）。storage：localStorage（読めない環境では null）
export function createMangaReader(host,{storage=null,onClose=()=>{}}={}){
 const panel=document.createElement('section');
 panel.className='manga-reader';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','manga-title');
 panel.innerHTML=`<div class="manga-sheet">
<header class="manga-head">
 <div class="manga-books" role="tablist" aria-label="本">${SERIES.map(s=>`<button type="button" role="tab" data-series="${s.id}" style="--book:${s.color};--ink:${s.ink};--paper:${s.paper}"><span class="manga-book-mark" aria-hidden="true"></span>${s.title}</button>`).join('')}</div>
 <h2 id="manga-title" class="manga-sr">マンガ</h2>
 <div class="manga-who" role="group" aria-label="よむ人">${MANGA_PLAYERS.map(p=>`<button type="button" data-player="${p.id}" aria-pressed="false">${p.name}</button>`).join('')}</div>
 <button type="button" class="manga-close" aria-label="マンガを とじる">×</button>
</header>
<nav class="manga-episodes" aria-label="おはなし"></nav>
<div class="manga-stage">
 <img class="manga-page" alt="" decoding="async">
 <div class="manga-message" role="status"></div>
</div>
<footer class="manga-pager"><button type="button" data-step="-1">◀ まえ</button><button type="button" data-step="1">つぎ ▶</button></footer>
</div>`;
 host.append(panel);
 const $=sel=>panel.querySelector(sel);
 const img=$('.manga-page'),message=$('.manga-message'),stage=$('.manga-stage');
 let state={player:null,series:SERIES[0].id,pos:null},eps=[],shelf=readShelf(storage);
 const pages=createPageWindow(img,{onState:setImageState});

 function setImageState(kind){
  stage.dataset.state=kind;
  if(kind==='error'){
   message.innerHTML='<p>え が よみこめませんでした。</p><button type="button" data-retry>もういちど</button>';
  }else if(kind==='loading')message.textContent='よみこみちゅう…';
  else if(kind==='ready')message.textContent='';
 }
 function setMessage(html){pages.show(null);stage.dataset.state='empty';message.innerHTML=html;}

 function render(){
  for(const b of panel.querySelectorAll('[data-series]')){const on=b.dataset.series===state.series;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
  for(const b of panel.querySelectorAll('[data-player]'))b.setAttribute('aria-pressed',String(b.dataset.player===state.player));
  const series=seriesById(state.series);
  panel.style.setProperty('--book',series.color);panel.style.setProperty('--ink',series.ink);panel.style.setProperty('--paper',series.paper);
  const nav=$('.manga-episodes');
  if(!state.player){
   eps=[];nav.replaceChildren();
   setMessage('<p>だれが よむ？ 上で えらんでね。</p>');updatePager();return;
  }
  const unlocked=readUnlocks(storage)[state.player];
  const readable=readableEpisodes(state.series,unlocked);
  eps=withPages(readable);
  nav.replaceChildren(...readable.map(e=>{
   const b=document.createElement('button');b.type='button';b.dataset.episode=e.id;b.textContent=e.title;
   const ready=eps.some(x=>x.id===e.id);b.disabled=!ready;if(!ready)b.title='じゅんびちゅう';
   return b;
  }));
  if(!readable.length){setMessage(`<p>まだ よめる おはなしが ないよ。</p><p>${series.hint??'ピヨドリルの ピヨ探検で 📚 を みつけると、この本が ふえるよ。'}</p>`);updatePager();return;}
  if(!eps.length){setMessage('<p>おはなしの え を じゅんびちゅう。もうすこし まってね。</p>');updatePager();return;}
  state.pos=clampPosition(eps,state.pos??shelf.last[state.player]?.[state.series]);
  showPage();
 }
 function showPage(){
  for(const b of panel.querySelectorAll('[data-episode]'))b.setAttribute('aria-current',String(b.dataset.episode===state.pos.episode));
  const ep=eps.find(e=>e.id===state.pos.episode);
  img.alt=`${seriesById(state.series).title}「${ep.title}」`;
  pages.show(pageAt(eps,state.pos));
  pages.prefetch(pageAt(eps,stepPosition(eps,state.pos,1)));
  (shelf.last[state.player]??={})[state.series]={...state.pos};
  shelf.player=state.player;writeShelf(storage,shelf);
  updatePager();
 }
 function updatePager(){
  const prev=$('[data-step="-1"]'),next=$('[data-step="1"]');
  const ok=state.pos&&eps.length;
  prev.disabled=!ok||!stepPosition(eps,state.pos,-1);
  const n=ok&&stepPosition(eps,state.pos,1);
  next.disabled=!n;next.textContent=ok&&!n?'おしまい':'つぎ ▶';
 }
 function step(dir){
  if(!state.pos)return;
  const to=stepPosition(eps,state.pos,dir);if(!to)return;
  state.pos=to;showPage();
  $('.manga-stage').scrollTo?.(0,0);
 }
 function pick({series=state.series,player=state.player}={}){
  if(series!==state.series||player!==state.player)state.pos=null;
  if(player&&player!==state.player){shelf.player=player;writeShelf(storage,shelf);}
  state.series=series;state.player=player;render();
 }

 const onStorage=e=>{if(!panel.hidden&&(e.key==null||e.key===CUBE_KEY||e.key===QUEST_KEY))render();};
 let swipe=null;
 const api={
  panel,
  get isOpen(){return !panel.hidden;},
  get state(){return {...state,pos:state.pos&&{...state.pos}};},
  get preloading(){return pages.preloading;},
  open(seriesId){
   shelf=readShelf(storage);
   state={player:defaultPlayer(storage,shelf),series:seriesById(seriesId)?.id??state.series,pos:null};
   panel.hidden=false;
   addEventListener('storage',onStorage);
   render();
   $('.manga-close').focus({preventScroll:true});
  },
  close(){
   if(panel.hidden)return;
   panel.hidden=true;pages.clear();
   removeEventListener('storage',onStorage);
   onClose();
  },
  step,pick,
 };
 panel.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.matches('.manga-close'))api.close();
  else if(t.dataset.series)pick({series:t.dataset.series});
  else if(t.dataset.player)pick({player:t.dataset.player});
  else if(t.dataset.episode){state.pos={episode:t.dataset.episode,page:0};showPage();}
  else if(t.dataset.step)step(Number(t.dataset.step));
  else if(t.hasAttribute('data-retry'))pages.retry();
 });
 // 背景（シートの外）をタップしても閉じる
 panel.addEventListener('pointerdown',e=>{if(e.target===panel)api.close();});
 panel.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();api.close();}
  else if(e.key==='ArrowRight'){e.preventDefault();step(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
 });
 // 左右に スワイプ：左へ はらうと つぎ
 stage.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY};});
 stage.addEventListener('pointerup',e=>{
  if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);
 });
 stage.addEventListener('pointercancel',()=>{swipe=null;});
 return api;
}
