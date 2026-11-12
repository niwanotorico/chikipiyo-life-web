// ピヨドリル：ピヨ探検のマップ画面と、ゲートが開くときの演出。保存は cube（CubeStore）にまかせる。
import {PLAYERS} from './questions.js';
import {episodeById} from '../manga/catalog.js';
import {SEASON,MAP,HARD,MOMIJI,momijiOpen,REWARDS,nodeById,mapView,season,cubeBalance,costOf,foundCount,stickersOf,hardOpen,starBalance,BOOSTS,boostFor,CHEER,cheerReceived,cheerGiven,COOP_GOAL} from './cosmicube.js';

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
 switch2:new URL('../../assets/drill/rewards/switch2-silhouette.svg',import.meta.url).href,   // 大ゴール：形だけ
};
// 2人そろった ときの 絵。ここ 1か所（この ファイルを おなじ名前で さしかえるだけ）
export const COOP_GET_ART=new URL('../../assets/drill/rewards/switch2-get.png',import.meta.url).href;
// 毎日の ごほうびの シール（ドット絵）。元素材：piyodrill/stickers/（01_music は 黄色いひよこの音楽スプライト集 から切り出し）
const sticker=name=>new URL(`../../assets/drill/stickers/${name}.png`,import.meta.url).href;
export const STICKER_ART={
 onpu:sticker('onpu'),wink:sticker('wink'),dj:sticker('dj'),banzai:sticker('banzai'),headphones:sticker('headphones'),
 duo:sticker('duo'),batsu1:sticker('batsu1'),batsu2:sticker('batsu2'),radio:sticker('radio'),kurutto:sticker('kurutto'),
 piyokichi:MAP_CHAR.piyokichi,piyomi:MAP_CHAR.piyomi,toramana:REWARD_ART.toramana,
};
// マップの シールの マス：ひらいたら シールの絵
for(const [id,r] of Object.entries(REWARDS))if(r.sticker&&STICKER_ART[r.sticker])REWARD_ART[id]=STICKER_ART[r.sticker];
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

// ごほうびの見せかた。secret のごほうびは、開ける前の子どもには中身を出さない。
// parent：親モードのときだけ {label(rewardId, player)}（parent-mode.js の parentLabel）。それ以外は null
// opened：開けたマスのときだけ (rewardId, player) => {name, note} | null（parent-mode.js の openedLabel。開けた子に 中身を見せる）
export function rewardFace(id,player,parent=null,opened=null){
 const r=REWARDS[id];
 if(!r)return {icon:'❓',name:'？',note:''};
 const p=parent?.label?.(id,player);
 if(p)return {icon:r.icon,name:p.name,note:p.note};
 const o=opened?.(id,player);
 if(o)return {icon:r.icon,name:o.name,note:o.note};
 return {icon:r.icon,name:r.name,note:r.note};
}
// マンガの ごほうび：じっさいに ふえた話の 名前（連載は 話数の じゅんに ふえるので、マスに 書いた話と ちがうことがある）
export function mangaName(eps){return eps?.length?'マンガ'+eps.map(e=>`「${episodeById(e)?.title??e}」`).join(''):null;}

const fmtDay=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
export const seasonPeriod=()=>`${fmtDay(SEASON.start)}〜${fmtDay(SEASON.end)}`;

// きょうだい同期の ようす（map の 下に 小さく）
export function syncLabel(st,fmtTime=t=>{const d=new Date(t);return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;}){
 if(!st||st.status==='idle')return '';
 if(st.status==='syncing')return '🔗 きょうだいと つないでいるよ…';
 if(st.status==='ok')return `🔗 きょうだいと つながったよ（${fmtTime(st.lastOk)}）`;
 return '🔗 いまは きょうだいと つながっていないよ（あそぶのは だいじょうぶ）';
}
// おかえりボーナス・おうえんの 文
export function familyLines(player,p,dayKey){
 const s=season(p),b=boostFor(player,dayKey),started=typeof dayKey==='string'&&dayKey>=CHEER.start;
 const boost=b?`🏠 ${b.label}：${fmtDay(b.to)} まで ピヨ探検pt が ${b.rate}ばい！`:'';
 let cheer='';
 if(started&&player===CHEER.to)cheer=`🤝 ${CHEER.from==='piyomi'?'ぴよみ':'ぴよきち'}の おうえん：これまで +${cheerReceived(s)} pt とどいたよ`;
 if(started&&player===CHEER.from)cheer=`🤝 ${CHEER.to==='piyokichi'?'ぴよきち':'ぴよみ'}を おうえんちゅう：これまで ${cheerGiven(s)} pt とどけたよ（ぴよみの pt は へらないよ）`;
 return {boost,cheer};
}

export function createCubeMap({cube,audio,particles,flash,reduced,getPlayer,today,parent=null,opened=null,syncState=()=>null,onGateOpened=()=>{}}){
 const $=(sel,root=document)=>root.querySelector(sel);
 function openFace(rewardId,player){
  const f=rewardFace(rewardId,player,parent,opened);
  if(!parent&&REWARDS[rewardId]?.manga){const n=mangaName(cube.mangaPlan(player,today()).byReward[rewardId]);if(n)return {...f,name:n};}
  return f;
 }
 let selected=null,revealAt=0,mapId=null;   // mapId：'main'（ほしぞら）| 'momiji'（もみじの もり）| 'hard'（ハードモード）。null は おまかせ
 let scrolledFor=null;   // もみじの もりを いまの場所まで スクロールした 子とマップ（開いたあとの 再描画では 動かさない）
 const MAP_OF={main:MAP,hard:HARD,momiji:MOMIJI};

 // いまの場所：そのマップの マスに いれば そこ。いなければ、ほしぞらでは（ハードモードに いる子は さいおく）そのマップで さいごに ひらいた マス、なければ 入口
 function hereOn(s,id){
  const pos=nodeById(s.position),mapOf=n=>n?.map??'main';
  if(mapOf(pos)===id)return s.position;
  if(id==='main'&&mapOf(pos)==='hard')return HARD.opensWith;
  const last=Object.entries(s.gates).filter(([g])=>mapOf(nodeById(g))===id).sort((a,b)=>(a[1].on??'').localeCompare(b[1].on??'')).pop();
  return last?last[0]:MAP_OF[id].start;
 }

 function render(){
  const player=getPlayer();if(!player)return;
  const dayKey=today(),p=cube.player(player),s=season(p),hard=hardOpen(s,dayKey),momiji=momijiOpen(dayKey);
  // 11/1 からは もみじの もりを、ハードモードに 入れる子は ハードモードを、さいしょに 見せる
  const avail=['main',...(momiji?['momiji']:[]),...(hard?['hard']:[])];
  if(!avail.includes(mapId))mapId=momiji?'momiji':hard?'hard':'main';
  const M=MAP_OF[mapId];
  const view=mapView(s,{parent,dayKey,map:mapId}),bal=cubeBalance(s),foundN=foundCount(s),stars=starBalance(s);
  const stateOf=Object.fromEntries(view.map(v=>[v.node.id,v.state]));
  // マップの きりかえ（ほかの マップに 入れる子だけ）
  const tabs=$('[data-map-tabs]');
  if(tabs){tabs.hidden=avail.length<2;for(const b of tabs.querySelectorAll('[data-map-tab]')){const on=b.dataset.mapTab===mapId;b.hidden=!avail.includes(b.dataset.mapTab);b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));}}
  $('[data-map-space]').classList.toggle('is-hard',mapId==='hard');
  $('[data-map-space]').classList.toggle('is-momiji',mapId==='momiji');
  const starEl=$('[data-map-star]');
  if(starEl){starEl.hidden=!hard;starEl.textContent=`⭐ ×${stars}`;}
  const here=hereOn(s,mapId);
  $('[data-map-pt]').textContent=bal;
  $('[data-map-sub]').textContent=`${PLAYERS[player].name}の マップ・${seasonPeriod()}${parent?'（親モード：ぜんぶ見えています）':''}`;
  $('[data-map-found]').textContent=`${foundN}こ`;
  $('[data-map-note]').textContent=mapId==='hard'?'🔥 ハードモード：⭐の マスは「パーフェクトの ほし」も 1こ いるよ。ほしは 10もん ぜんぶ せいかい（ピヨ探検pt が もらえる回）で 1こ もらえる'
   :mapId==='momiji'?`🍁 もみじの もり：マップは うえへ スクロールできるよ。ピヨ探検pt は ほしぞらと おなじ。${fmtDay(SEASON.end)} まで たまるよ`
   :hard?'🔥 さいおくの さらに おくに ハードモードが あるよ！ うえの「ハードモード」から いけるよ'
   :dayKey>SEASON.end?`ピヨ探検pt を ためられるのは ${fmtDay(SEASON.end)} まで。のこりの pt で ゲートは ひらけるよ`
   :dayKey<SEASON.start?`ピヨ探検pt が たまるのは ${fmtDay(SEASON.start)} から`:'10もん クリアで ピヨ探検pt が たまるよ（1日3回まで）。ゲートは どの じゅんばんでも ぜんぶ ひらけるよ';
  // 線
  const svgNS='http://www.w3.org/2000/svg',lines=$('[data-map-lines]');
  lines.replaceChildren();
  for(const n of M.nodes)for(const r of n.requires){
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
   el.className=`dq-node is-${state}${node.small?' is-small':''}`;el.style.left=`${node.x}%`;el.style.top=`${node.y}%`;
   let icon='❓',label='',tag='';
   if(state==='fog'){icon='🌫️';el.setAttribute('aria-hidden','true');}
   else{
    el.type='button';el.dataset.node=node.id;el.setAttribute('aria-pressed',String(selected===node.id));
    if(node.id===MAP.start){icon='⭐';label=node.label;}
    else if(node.id===HARD.start){icon='🔥';label=node.label;}
    else if(node.id===MOMIJI.start){icon='🍁';label=node.label;}
    else if(node.reward&&(state==='open'||parent)){const f=state==='open'?openFace(node.reward,player):rewardFace(node.reward,player,parent);icon=f.icon;label=node.small?'':f.name;}   // 小さいマスは 絵だけ（名前は タップで）
    else if(state==='soon'){label='じゅんびちゅう';}
    const cost=costOf(s,node);
    if(state==='ready')tag=node.star?`⭐+${cost}pt`:`${cost}pt`;
    if(node.star&&state!=='open')el.classList.add('is-star');
    if(state==='near')tag='🔒';
    el.setAttribute('aria-label',state==='open'?label:state==='ready'?`なにかが ある ゲート。${node.star?'パーフェクトの ほし 1こと ':''}${cost} ピヨ探検pt で ひらく`:state==='near'?'まだ ひらけない ゲート':'じゅんびちゅう');
   }
   el.innerHTML=`<span class="dq-node-icon"></span>${label?'<span class="dq-node-label"></span>':''}${tag?'<span class="dq-node-cost"></span>':''}`;
   if(state==='open'&&REWARD_ART[node.reward]||node.silhouette&&state!=='fog')$('.dq-node-icon',el).append(artImg(node.reward,'dq-node-art'));
   else $('.dq-node-icon',el).textContent=icon;
   if(label)$('.dq-node-label',el).textContent=label;
   if(tag)$('.dq-node-cost',el).textContent=tag;
   if(here===node.id){el.classList.add('is-here');const img=document.createElement('img');img.className='dq-map-char';img.src=MAP_CHAR[player];img.alt='';img.width=100;img.height=115;img.decoding='async';el.append(img);}
   box.append(el);
  }
  // 見えているときだけ、はじめの 1回 いまの場所を まんなかへ（画面が かくれている あいだは 高さが 0 なので 次の 描画で）
  const space=$('[data-map-space]'),scrollKey=`${player}/${mapId}`;
  if(scrolledFor!==scrollKey&&space.clientHeight>0){
   scrolledFor=scrollKey;
   const hereEl=box.querySelector('.is-here');
   space.scrollTop=hereEl?hereEl.offsetTop-space.clientHeight/2:0;
  }
  renderDetail(player,s,bal,stateOf,stars);
  const fam=familyLines(player,p,dayKey),famBox=$('[data-map-family]');
  if(famBox){
   famBox.hidden=!fam.boost&&!fam.cheer;
   const bEl=$('[data-map-boost]'),cEl=$('[data-map-cheer]');
   bEl.hidden=!fam.boost;bEl.textContent=fam.boost;cEl.hidden=!fam.cheer;cEl.textContent=fam.cheer;
  }
  const sy=$('[data-map-sync]');
  if(sy){const t=syncLabel(syncState());sy.hidden=!t;sy.textContent=t;}
  renderStickers(p);
 }

 // シールちょう：もらった シールだけ ならべる（まだの数・ぜんぶの数は 出さない）
 function renderStickers(p){
  const got=stickersOf(p);
  const box=$('[data-stickers]');if(!box)return;
  box.hidden=!got.length;
  $('[data-sticker-list]').replaceChildren(...got.map(g=>{
   const fig=document.createElement('figure');fig.className='dq-sticker';
   const cap=document.createElement('figcaption');cap.textContent=g.name;
   fig.append(giftImg(g,'dq-sticker-img'),cap);return fig;
  }));
 }

 function renderDetail(player,s,bal,stateOf,stars){
  const d=$('[data-map-detail]');
  const node=selected&&nodeById(selected);
  const st=node&&stateOf[node.id];
  if(!node||st==='fog'){d.innerHTML='<p>ゲートを タップしてね。ちかくの ❓ は、ピヨ探検pt で ひらけるよ。</p>';return;}
  const h=document.createElement('h3'),p=document.createElement('p');
  const parts=[h,p];
  if(node.id===MAP.start){h.textContent='⭐ スタート';p.textContent='ここから ぼうけんが はじまる。';}
  else if(node.id===HARD.start){h.textContent='🔥 ハードモード';p.textContent='さいおくの さらに おく。⭐の マスは、パーフェクトの ほしが ないと ひらかないよ。';}
  else if(node.id===MOMIJI.start){h.textContent='🍁 もみじの もり';p.textContent='あたらしい もり。どんな ごほうびが かくれているかな？';}
  else if(st==='open'){
   const f=openFace(node.reward,player),got=s.rewards[node.reward];
   h.textContent=`${f.icon} ${f.name}`;p.textContent=f.note+(got?.on?`（${fmtDay(got.on)}に ゲット）`:'');
   if(got?.house&&!REWARDS[node.reward].secret){const q=document.createElement('p');q.textContent='🏠 3DPハウスに あそびにくる じゅんびを しているよ';parts.push(q);}
   if(node.id===COOP_GOAL&&!parent){
    const q=document.createElement('p');
    if(cube.coopReached()){q.textContent='🤝 ふたりで ゴール！';const b=document.createElement('button');b.type='button';b.className='dq-btn';b.dataset.coopShow='1';b.textContent='もういちど みる';parts.push(q,b);}
    else{q.textContent='🤝 もうひとりが ここに くるのを まっているよ';parts.push(q);}
   }
  }
  else if(st==='ready'){
   h.textContent=parent&&node.reward?`❓ ${rewardFace(node.reward,player,parent).name}`:'❓ なにが でるかな？';
   const cost=costOf(s,node),needStar=!!node.star,starOk=!needStar||stars>=1;
   if(needStar){
    const ptText=bal>=cost?`${cost} pt は OK`:`pt は あと ${cost-bal}`;
    p.textContent=`⭐ パーフェクトの ほし 1こ と ${cost} ピヨ探検pt で ひらくよ。（いま ⭐ ×${stars}・${ptText}）`+(starOk?'':'　10もん ぜんぶ せいかいで ほしが もらえるよ！');
   }
   else p.textContent=cost===0?'もう とおった みち だから、pt なしで ひらけるよ。':bal>=cost?`${cost} ピヨ探検pt で ひらけるよ。`:`ひらくには ${cost} ピヨ探検pt。あと ${cost-bal} pt！`;
   const b=document.createElement('button');b.type='button';b.className='dq-btn is-open-gate';b.dataset.openGate=node.id;
   b.textContent=needStar?`ひらく（⭐1 ＋ ${cost} pt）`:`ひらく（${cost} pt）`;b.disabled=bal<cost||!starOk;parts.push(b);
  }
  else if(st==='near'){
   const need=node.requires.filter(id=>!s.gates[id]&&id!==MAP.start&&id!==HARD.start&&id!==MOMIJI.start).map(id=>{const n=nodeById(id);return stateOf[id]==='open'?openFace(n.reward,player).name:parent?rewardFace(n.reward,player,parent).name:'となりの ❓';});
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
  if(REWARDS[res.reward].chickenPoints)openScratch(res.reward);else reveal(player,res.reward);
  onGateOpened(nodeId);
 }

 // 派手な非ドット演出：キューブがほどけて、光の中からごほうび
 function reveal(player,rewardId){
  const f=openFace(rewardId,player);
  revealFace(REWARD_ART[rewardId]?artImg(rewardId,'dq-reveal-art'):f.icon,`${f.name} を 手に入れた！`,f.note);
 }
 // icon：絵（img）か 文字
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
  checkCoop();
 }

 // ---- チキポスクラッチ ----
 // マスを ひらいた 時点で 記録は 保存ずみ。ここは 見せるだけ（とちゅうで アプリを とじても 金額は きえない）。
 // 古い iPad でも かるいように、けずった 割合は 画素を 読まず、ゆびが とおった ます目で かぞえる
 const SC_COLS=16,SC_ROWS=8,SC_NEED=.55;
 let sc=null;
 function openScratch(rewardId){
  const pt=REWARDS[rewardId].chickenPoints,ov=$('[data-chicken-scratch]'),cv=$('[data-scratch-cover]');
  $('[data-scratch-amount]').textContent=`${pt} pt`;
  $('[data-scratch-msg]').textContent='ゆびで ごしごし けずってね';
  $('[data-scratch-all]').hidden=false;$('[data-scratch-close]').hidden=true;
  cv.hidden=false;ov.hidden=false;
  const w=cv.clientWidth,h=cv.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
  const ctx=cv.getContext('2d');
  ctx.scale(dpr,dpr);
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ffd76a');g.addColorStop(1,'#f2b23e');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#8a5a3c';ctx.font=`800 ${Math.round(h*.2)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('けずってね',w/2,h/2);
  ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=h*.3;
  sc={pt,ctx,w,h,r:h*.15,hit:new Set(),last:null,down:false,done:false};
  audio.whoosh();
 }
 function scratchTo(x,y){
  if(!sc||sc.done)return;
  const a=sc.last??{x,y},dist=Math.hypot(x-a.x,y-a.y),steps=Math.max(1,Math.ceil(dist/(sc.r/2)));
  sc.ctx.beginPath();sc.ctx.moveTo(a.x,a.y);sc.ctx.lineTo(x+.01,y);sc.ctx.stroke();
  for(let i=0;i<=steps;i++){
   const px=a.x+(x-a.x)*i/steps,py=a.y+(y-a.y)*i/steps;
   for(let c=0;c<SC_COLS;c++)for(let r=0;r<SC_ROWS;r++){
    if(Math.hypot((c+.5)*sc.w/SC_COLS-px,(r+.5)*sc.h/SC_ROWS-py)<=sc.r)sc.hit.add(c*SC_ROWS+r);
   }
  }
  sc.last={x,y};
  if(sc.hit.size>=SC_COLS*SC_ROWS*SC_NEED)finishScratch();
 }
 function finishScratch(){
  if(!sc||sc.done)return;
  sc.done=true;
  $('[data-scratch-cover]').hidden=true;
  $('[data-scratch-msg]').textContent=`チキンポイント ${sc.pt}pt ゲット！`;
  $('[data-scratch-all]').hidden=true;$('[data-scratch-close]').hidden=false;
  audio.fanfare();flash(.5);
  particles.burst(innerWidth/2,innerHeight*.45,{count:reduced()?16:60,kinds:['star','confetti','dot','feather'],speed:reduced()?260:650,up:240,life:1.1});
 }
 function closeScratch(){
  if(!sc?.done)return;
  $('[data-chicken-scratch]').hidden=true;particles.clear();sc=null;
  checkCoop();
 }
 function scratchPoint(e){const cv=$('[data-scratch-cover]'),b=cv.getBoundingClientRect();return [(e.clientX-b.left)*cv.clientWidth/b.width,(e.clientY-b.top)*cv.clientHeight/b.height];}

 // ---- 2人そろった ときの 絵 ----
 const busy=()=>!$('[data-cube-reveal]').hidden||!$('[data-chicken-scratch]').hidden||!$('[data-coop-get]').hidden;
 function showCoop(){
  $('[data-coop-art]').src=COOP_GET_ART;
  $('[data-coop-get]').hidden=false;
  audio.fanfare();flash(.7);
  particles.burst(innerWidth/2,innerHeight*.42,{count:reduced()?20:90,kinds:['star','confetti','dot','feather'],speed:reduced()?300:850,up:280,life:1.3});
 }
 // 同期の あと・マップを ひらいた とき・ほかの 演出が おわった ときに よぶ。ドリルの とちゅうでは 出さない。親モードでは 見た ことに しない
 function checkCoop(){
  const v=document.body.dataset.view;
  if(parent||(v!=='map'&&v!=='home')||busy()||!cube.coopReached()||cube.coopSeen())return;
  showCoop();
 }
 function closeCoop(){$('[data-coop-get]').hidden=true;particles.clear();if(!parent)cube.markCoopSeen();}

 function bind(){
  $('[data-map-nodes]').addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(b)select(b.dataset.node);});
  $('[data-map-tabs]')?.addEventListener('click',e=>{const b=e.target.closest('[data-map-tab]');if(!b||b.dataset.mapTab===mapId)return;mapId=b.dataset.mapTab;selected=null;audio.tap();render();});
  $('[data-map-detail]').addEventListener('click',e=>{if(e.target.closest('[data-coop-show]')){if(!busy())showCoop();return;}const b=e.target.closest('[data-open-gate]');if(b&&!b.disabled)open(b.dataset.openGate);});
  $('[data-cube-reveal]').addEventListener('click',closeReveal);
  const cv=$('[data-scratch-cover]');
  cv.addEventListener('pointerdown',e=>{if(!sc)return;e.preventDefault();sc.down=true;sc.last=null;try{cv.setPointerCapture(e.pointerId);}catch{}scratchTo(...scratchPoint(e));});
  cv.addEventListener('pointermove',e=>{if(sc?.down)scratchTo(...scratchPoint(e));});
  for(const t of ['pointerup','pointercancel'])cv.addEventListener(t,()=>{if(sc){sc.down=false;sc.last=null;}});
  $('[data-scratch-all]').addEventListener('click',finishScratch);
  $('[data-scratch-close]').addEventListener('click',closeScratch);
  $('[data-coop-close]').addEventListener('click',closeCoop);
 }
 return {render,bind,checkCoop,reset(){selected=null;mapId=null;scrolledFor=null;},isRevealing:busy};
}

