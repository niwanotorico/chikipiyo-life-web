import './reader.css';
import {SERIES,MANGA_PLAYERS,seriesById,readableEpisodes,allEpisodes} from './catalog.js';
import {withPages,clampPosition,stepPosition,pageAt,createPageWindow,seedRead,isNewEpisode,markRead} from './reading.js';
import {readUnlocks,readShelf,writeShelf,defaultPlayer,CUBE_KEY,QUEST_KEY} from './unlocks.js';

// 3DPハウスの本だなの「大きなマンガリーダー」。本だなの本を はじめて タップしたときに読み込む（main.js から import()）。
// 画面は2つ：
//   もくじ（toc）：よめる話を カードで ならべる。よんでいない話には NEW。カードを タップすると その話を よむ
//   よむ（read）　：1ページずつ。「つぎ」で 話の おわりまで いくと、つぎの話へ すすむ（話が かわったら タイトルを 大きく出す）
// 画像は「いま見ているページ」と「つぎの1枚」だけ読む。もくじの 小さな絵は 見えたものから 読む（loading=lazy）。
// ピヨドリルの保存データは読むだけ。本だなが おぼえるのは「えらんだ人」「さいごに よんだ ところ」「よんだ話」だけ（unlocks.js）。

const epLabel=e=>`第${e.no}話`;

// ---------- 画面 ----------
// host：3D 表示のエリア（.world）。storage：localStorage（読めない環境では null）
export function createMangaReader(host,{storage=null,onClose=()=>{}}={}){
 const panel=document.createElement('section');
 panel.className='manga-reader';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','manga-title');
 panel.innerHTML=`<div class="manga-sheet">
<header class="manga-head">
 <div class="manga-books" role="tablist" aria-label="本">${SERIES.map(s=>`<button type="button" role="tab" data-series="${s.id}" style="--book:${s.color};--ink:${s.ink};--paper:${s.paper}"><span class="manga-book-mark" aria-hidden="true"></span>${s.title}<span class="manga-new-dot" aria-label="NEW" hidden></span></button>`).join('')}</div>
 <h2 id="manga-title" class="manga-sr">マンガ</h2>
 <div class="manga-who" role="group" aria-label="よむ人">${MANGA_PLAYERS.map(p=>`<button type="button" data-player="${p.id}" aria-pressed="false">${p.name}</button>`).join('')}</div>
 <button type="button" class="manga-close" aria-label="マンガを とじる">×</button>
</header>
<div class="manga-bar">
 <button type="button" class="manga-toc-button" data-toc>📖 もくじ</button>
 <p class="manga-now" aria-live="polite"></p>
</div>
<div class="manga-stage">
 <div class="manga-toc" role="list" aria-label="もくじ"></div>
 <img class="manga-page" alt="" decoding="async">
 <div class="manga-banner" aria-hidden="true"></div>
 <div class="manga-message" role="status"></div>
</div>
<footer class="manga-pager"><button type="button" data-step="-1">◀ まえ</button><button type="button" data-step="1">つぎ ▶</button></footer>
</div>`;
 host.append(panel);
 const $=sel=>panel.querySelector(sel);
 const img=$('.manga-page'),message=$('.manga-message'),stage=$('.manga-stage'),toc=$('.manga-toc'),banner=$('.manga-banner'),now=$('.manga-now');
 let state={player:null,series:SERIES[0].id,pos:null,view:'toc'},eps=[],readable=[],unlocked=null,shelf=readShelf(storage);
 const pages=createPageWindow(img,{onState:setImageState});
 let bannerTimer=0;

 function setImageState(kind){
  if(state.view!=='read')return;
  stage.dataset.state=kind;
  if(kind==='error'){
   message.innerHTML='<p>え が よみこめませんでした。</p><button type="button" data-retry>もういちど</button>';
  }else if(kind==='loading')message.textContent='よみこみちゅう…';
  else if(kind==='ready')message.textContent='';
 }
 function setMessage(html){pages.show(null);stage.dataset.state='empty';message.innerHTML=html;}
 const save=()=>writeShelf(storage,shelf);
 const isNew=id=>!!state.player&&isNewEpisode(shelf,state.player,id);

 // 本ごとの NEW の点（えらんでいない本にも 出す）
 function renderBookDots(){
  for(const b of panel.querySelectorAll('[data-series]')){
   const dot=b.querySelector('.manga-new-dot');
   dot.hidden=!unlocked||!withPages(readableEpisodes(b.dataset.series,unlocked)).some(e=>isNew(e.id));
  }
 }

 function render(){
  for(const b of panel.querySelectorAll('[data-series]')){const on=b.dataset.series===state.series;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
  for(const b of panel.querySelectorAll('[data-player]'))b.setAttribute('aria-pressed',String(b.dataset.player===state.player));
  const series=seriesById(state.series);
  panel.style.setProperty('--book',series.color);panel.style.setProperty('--ink',series.ink);panel.style.setProperty('--paper',series.paper);
  if(!state.player){
   eps=[];readable=[];unlocked=null;toc.replaceChildren();renderBookDots();
   setView('empty');setMessage('<p>だれが よむ？ 上で えらんでね。</p>');updateBar();updatePager();return;
  }
  unlocked=readUnlocks(storage)[state.player];
  // はじめて ひらいた人は、いま よめる話を「よんだ」にする（前から よめた話に NEW を つけない）
  if(seedRead(shelf,state.player,allEpisodes().filter(e=>unlocked.has(e.id)).map(e=>e.id)))save();
  renderBookDots();
  readable=readableEpisodes(state.series,unlocked);
  eps=withPages(readable);
  if(!readable.length){setView('empty');toc.replaceChildren();setMessage(`<p>まだ よめる おはなしが ないよ。</p><p>${series.hint??'ピヨドリルの ピヨ探検で 📚 を みつけると、この本が ふえるよ。'}</p>`);updateBar();updatePager();return;}
  if(!eps.length){setView('empty');toc.replaceChildren();setMessage('<p>おはなしの え を じゅんびちゅう。もうすこし まってね。</p>');updateBar();updatePager();return;}
  if(state.view==='read'&&state.pos){state.pos=clampPosition(eps,state.pos);showPage();return;}
  showToc();
 }
 function setView(view){
  stage.dataset.view=view;
  if(view!=='read'){pages.show(null);hideBanner();}
  if(view==='toc'){stage.dataset.state='toc';message.textContent='';}
 }

 // ---------- もくじ ----------
 function showToc(){
  state.view='toc';setView('toc');
  const last=shelf.last[state.player]?.[state.series]?.episode;
  toc.replaceChildren(...readable.map(e=>{
   const ep=eps.find(x=>x.id===e.id),ready=!!ep,fresh=ready&&isNew(e.id);
   const b=document.createElement('button');b.type='button';b.className='manga-card';b.setAttribute('role','listitem');
   b.dataset.episode=e.id;b.disabled=!ready;
   b.setAttribute('aria-label',`${epLabel(e)} ${e.title}${fresh?' NEW':''}${ready?'':' じゅんびちゅう'}`);
   b.innerHTML=`<span class="manga-thumb">${ready?`<img alt="" loading="lazy" decoding="async" width="${ep.pages[0].w}" height="${ep.pages[0].h}">`:'<span class="manga-thumb-wait">じゅんびちゅう</span>'}</span>
<span class="manga-card-no">${epLabel(e)}</span><span class="manga-card-title"></span>
${fresh?'<span class="manga-badge-new">NEW</span>':''}${!fresh&&e.id===last?'<span class="manga-badge-last">つづき</span>':''}`;
   b.querySelector('.manga-card-title').textContent=e.title;
   if(ready)b.querySelector('img').src=ep.pages[0].src;
   return b;
  }));
  updateBar();updatePager();
  // NEW か「つづき」の カードが 見えるところまで
  const focus=toc.querySelector('.manga-badge-new')?.closest('.manga-card')??toc.querySelector('.manga-badge-last')?.closest('.manga-card');
  focus?.scrollIntoView?.({block:'nearest'});
 }

 // ---------- よむ ----------
 function openEpisode(id){
  const ep=eps.find(e=>e.id===id);if(!ep)return;
  state.view='read';state.pos={episode:id,page:0};
  showPage({announce:true});
 }
 function showPage({announce=false}={}){
  state.view='read';setView('read');
  const ep=eps.find(e=>e.id===state.pos.episode);
  img.alt=`${seriesById(state.series).title} ${epLabel(ep)}「${ep.title}」`;
  if(announce)showBanner(ep);
  pages.show(pageAt(eps,state.pos));
  pages.prefetch(pageAt(eps,stepPosition(eps,state.pos,1)));
  (shelf.last[state.player]??={})[state.series]={...state.pos};
  shelf.player=state.player;
  if(markRead(shelf,state.player,ep.id))renderBookDots();
  save();
  updateBar();updatePager();
 }
 // 話が かわったら タイトルを 大きく出す（すこしで きえる。タップでも きえる）
 function showBanner(ep){
  clearTimeout(bannerTimer);
  banner.innerHTML=`<span class="manga-banner-no">${epLabel(ep)}</span><span class="manga-banner-title"></span>`;
  banner.querySelector('.manga-banner-title').textContent=ep.title;
  banner.classList.add('on');
  bannerTimer=setTimeout(hideBanner,1600);
 }
 function hideBanner(){clearTimeout(bannerTimer);banner.classList.remove('on');}

 function updateBar(){
  const reading=state.view==='read'&&!!state.pos;
  $('[data-toc]').hidden=!reading;
  const ep=reading&&eps.find(e=>e.id===state.pos.episode);
  now.textContent=ep?`${epLabel(ep)}「${ep.title}」`:(state.player&&eps.length?'よみたい おはなしを えらんでね':'');
 }
 function updatePager(){
  const pager=$('.manga-pager'),prev=$('[data-step="-1"]'),next=$('[data-step="1"]');
  const reading=state.view==='read'&&state.pos&&eps.length;
  pager.hidden=!reading;
  if(!reading)return;
  prev.disabled=!stepPosition(eps,state.pos,-1);
  const n=stepPosition(eps,state.pos,1);
  next.disabled=false;
  next.textContent=!n?'📖 もくじへ':n.episode!==state.pos.episode?'つぎの おはなし ▶':'つぎ ▶';
 }
 function step(dir){
  if(state.view!=='read'||!state.pos)return;
  const to=stepPosition(eps,state.pos,dir);
  if(!to){if(dir>0)showToc();return;}
  const changed=to.episode!==state.pos.episode;
  state.pos=to;showPage({announce:changed});
  stage.scrollTo?.(0,0);
 }
 function pick({series=state.series,player=state.player}={}){
  if(series!==state.series||player!==state.player){state.pos=null;state.view='toc';}
  if(player&&player!==state.player){shelf.player=player;save();}
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
   state={player:defaultPlayer(storage,shelf),series:seriesById(seriesId)?.id??state.series,pos:null,view:'toc'};
   panel.hidden=false;
   addEventListener('storage',onStorage);
   render();
   $('.manga-close').focus({preventScroll:true});
  },
  close(){
   if(panel.hidden)return;
   panel.hidden=true;pages.clear();hideBanner();
   removeEventListener('storage',onStorage);
   onClose();
  },
  step,pick,openEpisode,
  showToc(){if(eps.length)showToc();},
 };
 panel.addEventListener('click',e=>{
  if(e.target.closest('.manga-banner')){hideBanner();return;}
  const t=e.target.closest('button');if(!t)return;
  if(t.matches('.manga-close'))api.close();
  else if(t.dataset.series)pick({series:t.dataset.series});
  else if(t.dataset.player)pick({player:t.dataset.player});
  else if(t.hasAttribute('data-toc'))showToc();
  else if(t.dataset.episode)openEpisode(t.dataset.episode);
  else if(t.dataset.step)step(Number(t.dataset.step));
  else if(t.hasAttribute('data-retry'))pages.retry();
 });
 // 背景（シートの外）をタップしても閉じる
 panel.addEventListener('pointerdown',e=>{if(e.target===panel)api.close();});
 panel.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(state.view==='read'&&eps.length)showToc();else api.close();}
  else if(e.key==='ArrowRight'){e.preventDefault();step(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
 });
 // 左右に スワイプ：左へ はらうと つぎ（よんでいるときだけ）
 stage.addEventListener('pointerdown',e=>{swipe=state.view==='read'?{x:e.clientX,y:e.clientY}:null;});
 stage.addEventListener('pointerup',e=>{
  if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);
 });
 stage.addEventListener('pointercancel',()=>{swipe=null;});
 return api;
}
