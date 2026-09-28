import './passbook.css';
import piyokichiUrl from '../../assets/points/piyokichi.png?url';
import piyomiUrl from '../../assets/points/piyomi.png?url';
import {pointChildren,subscribePointBalances} from './ledger.js';

// 戸棚の中の「チキンポイント通帳」。3D には描かず HTML で重ねる。見るだけ（加算・消費はしない）。
export const pointsAppUrl='https://niwanotorico.github.io/creative-chicken-points/';
const art={'ぴよきち':{id:'piyokichi',src:piyokichiUrl,alt:'ゲームで遊ぶぴよきち'},'ぴよみ':{id:'piyomi',src:piyomiUrl,alt:'タブレットを使うぴよみ'}};
const number=new Intl.NumberFormat('ja-JP');

// host：3D 表示のエリア（.world）。パネルはここに重ねる。
// entryHost：キャンバスの入れ物（#canvas-host）。入口ラベルはキャンバスと同じ座標で置く。
export function createPassbook(host,entryHost=host,{subscribe=subscribePointBalances}={}){
 const entry=document.createElement('button');
 entry.type='button';entry.className='passbook-entry';entry.hidden=true;
 entry.setAttribute('aria-label','チキンポイント通帳をひらく');
 entry.innerHTML='<span class="passbook-entry-icon" aria-hidden="true"></span>ポイント通帳';

 const panel=document.createElement('section');
 panel.className='passbook-panel';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','passbook-title');
 panel.innerHTML=`<div class="passbook-head"><div><div class="passbook-eyebrow">CHICKEN POINT PASSBOOK</div><h2 id="passbook-title">チキンポイント通帳</h2></div><button type="button" class="passbook-close" aria-label="通帳を閉じる">×</button></div>
<div class="passbook-balances">${pointChildren.map(name=>`<article class="passbook-card ${art[name].id}"><img data-src="${art[name].src}" alt="${art[name].alt}" width="104" height="120" decoding="async"><h3>${name}</h3><p><strong data-points="${art[name].id}">—</strong><span>pt</span></p></article>`).join('')}</div>
<p class="passbook-status" role="status">通帳を読み込んでいます…</p>
<p class="passbook-note">ここでは見るだけ。ポイントの記録は<a href="${pointsAppUrl}" target="_blank" rel="noopener">ちきんポイント通帳</a>で。</p>`;
 entryHost.append(entry);host.append(panel);

 const status=panel.querySelector('.passbook-status');
 let stop=null;
 const show=({ready,balances})=>{
  for(const name of pointChildren)panel.querySelector(`[data-points="${art[name].id}"]`).textContent=ready?number.format(balances[name]):'—';
  status.textContent=ready?'いまのポイントです':'接続を確認しています…';
  panel.classList.toggle('is-ready',ready);
 };
 const fail=()=>{
  for(const el of panel.querySelectorAll('[data-points]'))el.textContent='—';
  panel.classList.remove('is-ready');
  status.textContent='ポイントを読み込めませんでした。通信状況を確認して、もう一度ひらいてください。';
 };
 const api={
  entry,panel,
  get isOpen(){return !panel.hidden;},
  open(){
   if(!panel.hidden)return;
   // イラストは初めてひらいたときに読み込む（おうちの初期表示を重くしない）。
   for(const img of panel.querySelectorAll('img[data-src]')){img.src=img.dataset.src;img.removeAttribute('data-src');}
   panel.hidden=false;entry.setAttribute('aria-expanded','true');
   show({ready:false,balances:{}});status.textContent='通帳を読み込んでいます…';
   stop=subscribe(show,fail);
   panel.querySelector('.passbook-close').focus({preventScroll:true});
  },
  close(){
   if(panel.hidden)return;
   panel.hidden=true;entry.setAttribute('aria-expanded','false');
   stop?.();stop=null;
  },
  // 入口ラベルを画面上の点 (x,y)（host 基準の px）に置く。null で隠す。
  placeEntry(point){
   if(!point){entry.hidden=true;return;}
   entry.hidden=false;
   entry.style.transform=`translate(${Math.round(point.x)}px,${Math.round(point.y)}px) translate(-50%,-100%)`;
  },
 };
 entry.addEventListener('click',()=>api.isOpen?api.close():api.open());
 panel.querySelector('.passbook-close').addEventListener('click',()=>api.close());
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){api.close();entry.focus({preventScroll:true});}});
 return api;
}
