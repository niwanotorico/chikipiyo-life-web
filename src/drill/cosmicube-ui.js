// ピヨドリル：ピヨ探検のマップ画面と、ゲートが開くときの演出。保存は cube（CubeStore）にまかせる。
import {PLAYERS} from './questions.js';
import {SEASON,MAP,REWARDS,nodeById,mapView,season,cubeBalance,foundCount,giftsOf,giftOn,giftAvailable,DAILY_GIFTS} from './cosmicube.js';

// ---------- マップの現在地キャラ（ドット絵素材） ----------
// 元素材：piyodrill/characters/*_ipad.png（100×115）。遊んでいる人の絵を出す
export const MAP_CHAR={
 piyokichi:new URL('../../assets/drill/characters/piyokichi_ipad.png',import.meta.url).href,
 piyomi:new URL('../../assets/drill/characters/piyomi_ipad.png',import.meta.url).href,
};

// ごほうびの絵（ドット絵素材）。開放したあとのマップのマスと、開放演出で使う。
// ない ごほうびは絵文字のまま。未開放のあいだは ❓ のまま（絵は出さない）
//   元素材：piyodrill/characters/
export const REWARD_ART={
 toramana:new URL('../../assets/drill/characters/toramana_jump.png',import.meta.url).href,
};
// 毎日の ごほうびの シール（ドット絵）。元素材：piyodrill/stickers/（01_music は 黄色いひよこの音楽スプライト集 から切り出し）
const sticker=name=>new URL(`../../assets/drill/stickers/${name}.png`,import.meta.url).href;
export const STICKER_ART={
 onpu:sticker('onpu'),wink:sticker('wink'),dj:sticker('dj'),banzai:sticker('banzai'),headphones:sticker('headphones'),
 duo:sticker('duo'),batsu1:sticker('batsu1'),batsu2:sticker('batsu2'),radio:sticker('radio'),kurutto:sticker('kurutto'),
 piyokichi:MAP_CHAR.piyokichi,piyomi:MAP_CHAR.piyomi,toramana:REWARD_ART.toramana,
};
// ごほうびの 見せかた（ホーム・結果・シールちょう で共通）
export const giftLabel=g=>g.sticker?`シール「${g.name}」`:`${g.name}（3DPハウスの 本だなで よめるよ）`;
export function giftImg(g,className){
 if(!g.sticker||!STICKER_ART[g.sticker])return null;
 const img=document.createElement('img');img.className=className;img.src=STICKER_ART[g.sticker];img.alt=g.name;img.decoding='async';
 return img;
}
function artImg(rewardId,className){
 const img=document.createElement('img');
 img.className=className;img.src=REWARD_ART[rewardId];img.alt='';img.decoding='async';
 return img;
}

// ---------- 共通ドットキャラ ----------
// 12×12 のドット絵。ぴよきち・ぴよみは同じ形で、ぴよみはリボンつき
const PIX_ROWS=[
 '....kkkk....',
 '...kyyyyk...',
 '..kyyyyyyk..',
 '.kyyeyyeyyk.',
 '.kyyyooyyyk.',
 '.kypyyyyypk.',
 '.kyyyyyyyyk.',
 'kyyyyyyyyyyk',
 'kyyyyyyyyyyk',
 '.kyyyyyyyyk.',
 '..kkyyyykk..',
 '...oo..oo...',
];
const PIX_COLORS={k:'#8a5a3c',y:'#ffd84d',o:'#f39a3a',e:'#3a2a20',p:'#ff9db0',r:'#ee4a62'};
export function pixelChar(player){
 const rows=PIX_ROWS.map(r=>r.split(''));
 if(player==='piyomi'){rows[0][2]='r';rows[0][3]='r';rows[1][2]='r';}
 let rects='';
 rows.forEach((row,y)=>row.forEach((c,x)=>{if(PIX_COLORS[c])rects+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${PIX_COLORS[c]}"/>`;}));
 return `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

// ごほうびの見せかた。secret のごほうびは、子どもには中身を出さない。
// parent：親モードのときだけ {label(rewardId, player)}（parent-mode.js の parentLabel）。それ以外は null
export function rewardFace(id,player,parent=null){
 const r=REWARDS[id];
 if(!r)return {icon:'❓',name:'？',note:''};
 const p=parent?.label?.(id,player);
 if(p)return {icon:r.icon,name:p.name,note:p.note};
 return {icon:r.icon,name:r.name,note:r.note};
}

const fmtDay=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
export const seasonPeriod=()=>`${fmtDay(SEASON.start)}〜${fmtDay(SEASON.end)}`;

export function createCubeMap({cube,audio,particles,flash,reduced,getPlayer,today,parent=null}){
 const $=(sel,root=document)=>root.querySelector(sel);
 let selected=null,revealAt=0;
 const dailySeen=new Set();   // 「まいにちの みち」の ひらく演出を 見せた日（このページを ひらいている あいだだけ おぼえる。保存はしない）

 function render(){
  const player=getPlayer();if(!player)return;
  const dayKey=today(),p=cube.player(player),s=season(p),view=mapView(s,{parent,dayKey}),bal=cubeBalance(s),foundN=foundCount(s);
  const stateOf=Object.fromEntries(view.map(v=>[v.node.id,v.state]));
  $('[data-map-pt]').textContent=bal;
  $('[data-map-sub]').textContent=`${PLAYERS[player].name}の マップ・${seasonPeriod()}${parent?'（親モード：ぜんぶ見えています）':''}`;
  $('[data-map-found]').textContent=`${foundN}こ`;
  $('[data-map-note]').textContent=dayKey>SEASON.end?`ピヨ探検pt を ためられるのは ${fmtDay(SEASON.end)} まで。のこりの pt で ゲートは ひらけるよ`
   :dayKey<SEASON.start?`ピヨ探検pt が たまるのは ${fmtDay(SEASON.start)} から`:'10もん クリアで ピヨ探検pt が たまるよ（1日3回まで）。ゲートは どの じゅんばんでも ぜんぶ ひらけるよ';
  // 線
  const svgNS='http://www.w3.org/2000/svg',lines=$('[data-map-lines]');
  lines.replaceChildren();
  for(const n of MAP.nodes)for(const r of n.requires){
   const a=nodeById(r),l=document.createElementNS(svgNS,'line');
   l.setAttribute('x1',a.x);l.setAttribute('y1',a.y);l.setAttribute('x2',n.x);l.setAttribute('y2',n.y);
   const st=stateOf[n.id];
   if(st==='open')l.classList.add('is-open');else if(st==='fog'||stateOf[r]==='fog')l.classList.add('is-fog');
   lines.append(l);
  }
  // ノード
  const box=$('[data-map-nodes]');box.replaceChildren();
  for(const {node,state} of view){
   const el=document.createElement(state==='fog'?'span':'button');
   el.className=`dq-node is-${state}`;el.style.left=`${node.x}%`;el.style.top=`${node.y}%`;
   let icon='❓',label='',tag='';
   if(state==='fog'){icon='🌫️';el.setAttribute('aria-hidden','true');}
   else{
    el.type='button';el.dataset.node=node.id;el.setAttribute('aria-pressed',String(selected===node.id));
    if(node.id===MAP.start){icon='⭐';label=node.label;}
    else if(node.reward&&(state==='open'||parent)){const f=rewardFace(node.reward,player,parent);icon=f.icon;label=f.name;}
    else if(state==='soon'){label='じゅんびちゅう';}
    if(state==='ready')tag=`${node.cost}pt`;
    if(state==='near')tag='🔒';
    el.setAttribute('aria-label',state==='open'?label:state==='ready'?`なにかが ある ゲート。${node.cost} ピヨ探検pt で ひらく`:state==='near'?'まだ ひらけない ゲート':'じゅんびちゅう');
   }
   el.innerHTML=`<span class="dq-node-icon"></span>${label?'<span class="dq-node-label"></span>':''}${tag?'<span class="dq-node-cost"></span>':''}`;
   if(state==='open'&&REWARD_ART[node.reward])$('.dq-node-icon',el).append(artImg(node.reward,'dq-node-art'));
   else $('.dq-node-icon',el).textContent=icon;
   if(label)$('.dq-node-label',el).textContent=label;
   if(tag)$('.dq-node-cost',el).textContent=tag;
   if(s.position===node.id){el.classList.add('is-here');const img=document.createElement('img');img.className='dq-map-char';img.src=MAP_CHAR[player];img.alt='';img.width=100;img.height=115;img.decoding='async';el.append(img);}
   box.append(el);
  }
  renderDetail(player,s,bal,stateOf);
  renderDaily(player,p,dayKey);
  renderStickers(p);
 }

 // まいにちの みち：その日はじめて 10もん クリアすると、つぎの マスが pt なしで ひらく（中身は 毎日の ごほうび）。
 // ひらいた マスと、つぎの 1マスだけ 見せる（ぜんぶで 何マスかは 出さない）
 function renderDaily(player,p,dayKey){
  const box=$('[data-daily]');if(!box)return;
  const got=giftsOf(p),avail=giftAvailable(p,dayKey),todayGift=giftOn(p,dayKey),done=got.length>=DAILY_GIFTS.length;
  box.hidden=!got.length&&!avail;
  if(box.hidden)return;
  const step=(cls,icon,label)=>{
   const li=document.createElement('li');li.className=`dq-daily-step ${cls}`;
   const i=document.createElement('span');i.className='dq-daily-icon';if(typeof icon==='string')i.textContent=icon;else i.append(icon);
   const t=document.createElement('small');t.textContent=label;li.append(i,t);return li;
  };
  const items=got.map(g=>step(g.day===dayKey?'is-open is-today':'is-open',giftImg(g,'dq-daily-img')??'📚',g.name));
  if(avail)items.push(step('is-next','❓','10もんで ひらく'));
  else if(done&&!todayGift)items.push(step('is-soon','❓','じゅんびちゅう'));
  const path=$('[data-daily-path]');path.replaceChildren(...items);
  path.scrollLeft=path.scrollWidth;
  $('[data-daily-note]').textContent=todayGift?'きょうの マスが ひらいたよ！ また あした':avail?'きょう はじめて 10もん クリアすると、つぎの マスが ひらくよ':'つぎの マスは じゅんびちゅう';
  // きょう ひらいた マスは、マップを ひらいたときに 1回だけ 演出
  const key=`${player}:${dayKey}`;
  if(todayGift&&!dailySeen.has(key)){dailySeen.add(key);revealFace(giftImg(todayGift,'dq-reveal-art')??'📚',`${todayGift.sticker?`シール「${todayGift.name}」`:todayGift.name} を 手に入れた！`,todayGift.sticker?'シールちょうに はったよ':'3DPハウスの 本だなで よめるよ');}
 }

 // シールちょう：もらった シールだけ ならべる（まだの数・ぜんぶの数は 出さない）
 function renderStickers(p){
  const got=giftsOf(p).filter(g=>g.sticker);
  const box=$('[data-stickers]');if(!box)return;
  box.hidden=!got.length;
  $('[data-sticker-list]').replaceChildren(...got.map(g=>{
   const fig=document.createElement('figure');fig.className='dq-sticker';
   const cap=document.createElement('figcaption');cap.textContent=g.name;
   fig.append(giftImg(g,'dq-sticker-img'),cap);return fig;
  }));
 }

 function renderDetail(player,s,bal,stateOf){
  const d=$('[data-map-detail]');
  const node=selected&&nodeById(selected);
  const st=node&&stateOf[node.id];
  if(!node||st==='fog'){d.innerHTML='<p>ゲートを タップしてね。ちかくの ❓ は、ピヨ探検pt で ひらけるよ。</p>';return;}
  const h=document.createElement('h3'),p=document.createElement('p');
  const parts=[h,p];
  if(node.id===MAP.start){h.textContent='⭐ スタート';p.textContent='ここから ぼうけんが はじまる。';}
  else if(st==='open'){
   const f=rewardFace(node.reward,player,parent),got=s.rewards[node.reward];
   h.textContent=`${f.icon} ${f.name}`;p.textContent=f.note+(got?.on?`（${fmtDay(got.on)}に ゲット）`:'');
   if(got?.house&&!REWARDS[node.reward].secret){const q=document.createElement('p');q.textContent='🏠 3DPハウスに あそびにくる じゅんびを しているよ';parts.push(q);}
  }
  else if(st==='ready'){
   h.textContent=parent&&node.reward?`❓ ${rewardFace(node.reward,player,parent).name}`:'❓ なにが でるかな？';
   p.textContent=bal>=node.cost?`${node.cost} ピヨ探検pt で ひらけるよ。`:`ひらくには ${node.cost} ピヨ探検pt。あと ${node.cost-bal} pt！`;
   const b=document.createElement('button');b.type='button';b.className='dq-btn is-open-gate';b.dataset.openGate=node.id;
   b.textContent=`ひらく（${node.cost} pt）`;b.disabled=bal<node.cost;parts.push(b);
  }
  else if(st==='near'){
   const need=node.requires.filter(id=>!s.gates[id]&&id!==MAP.start).map(id=>{const n=nodeById(id);return stateOf[id]==='open'||parent?rewardFace(n.reward,player,parent).name:'となりの ❓';});
   h.textContent=parent&&node.reward?`🔒 ${rewardFace(node.reward,player,parent).name}`:'🔒 まだ ひらけない ゲート';
   p.textContent=`${[...new Set(need)].join(' と ')} を ひらくと、いけるようになるよ。`;
  }
  else{h.textContent='❓ じゅんびちゅう';p.textContent='まだ なにも ない ばしょ。これから なにかが とどくかも？';}
  d.replaceChildren(...parts);
 }

 function select(id){selected=id;audio.tap();render();}

 function open(nodeId){
  const player=getPlayer();if(!player)return;
  const res=cube.openGate(player,nodeId,today());
  if(!res.ok){render();return;}
  selected=nodeId;render();
  reveal(player,res.reward);
 }

 // 派手な非ドット演出：キューブがほどけて、光の中からごほうび
 function reveal(player,rewardId){
  const f=rewardFace(rewardId,player,parent);
  revealFace(REWARD_ART[rewardId]?artImg(rewardId,'dq-reveal-art'):f.icon,`${f.name} を 手に入れた！`,f.note);
 }
 // icon：絵（img）か 文字。ゲートの ごほうびと、まいにちの みちで 共通
 function revealFace(iconArt,title,note){
  const ov=$('[data-cube-reveal]'),icon=$('[data-reveal-icon]');
  if(typeof iconArt==='string')icon.textContent=iconArt;else icon.replaceChildren(iconArt);
  $('[data-reveal-title]').textContent=title;
  $('[data-reveal-note]').textContent=note;
  ov.classList.remove('go');ov.hidden=false;void ov.offsetWidth;ov.classList.add('go');
  revealAt=performance.now();
  audio.whoosh();
  setTimeout(()=>{audio.fanfare();flash(.7);const W=innerWidth,H=innerHeight;particles.burst(W/2,H*.42,{count:reduced()?20:90,kinds:['star','confetti','dot','feather'],speed:reduced()?300:850,up:280,life:1.3});},650);
  if(!reduced())setTimeout(()=>particles.rain({count:45,kinds:['star','confetti'],life:2.6}),1100);
 }
 function closeReveal(){
  if(performance.now()-revealAt<1200)return;
  $('[data-cube-reveal]').hidden=true;particles.clear();
 }

 function bind(){
  $('[data-map-nodes]').addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(b)select(b.dataset.node);});
  $('[data-map-detail]').addEventListener('click',e=>{const b=e.target.closest('[data-open-gate]');if(b&&!b.disabled)open(b.dataset.openGate);});
  $('[data-cube-reveal]').addEventListener('click',closeReveal);
 }
 return {render,bind,reset(){selected=null;},isRevealing:()=>!$('[data-cube-reveal]').hidden};
}

