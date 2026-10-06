import './bookshelf.css';
import {SERIES} from './catalog.js';
import {safeStorage} from './unlocks.js';

// 本だなの入口：本の上に出す小さなラベル（3冊を えらぶボタンつき）と、リーダーの読みこみ。
// ラベルは ふだん かくしておき、本だなに ふれている あいだだけ出す。
//   PC：本だなに カーソルを合わせている あいだ（はなれたら かくす）
//   iPad：本だなを タップして えらんでいる あいだ（ほかの場所を タップしたら かくす）
// リーダー（reader.js / reader.css）は はじめて ひらくときに import() する（おうちの初期表示を重くしない）。
// host：3D 表示のエリア（.world）。entryHost：キャンバスの入れ物（#canvas-host）
const hideDelay=250;   // カーソルを 本だな → ラベルへ うごかす あいだに 消えないように

export function createShelfEntry(host,entryHost=host,{loadReader=()=>import('./reader.js'),series=SERIES}={}){
 const entry=document.createElement('div');
 entry.className='bookshelf-entry';entry.hidden=true;
 entry.setAttribute('role','group');entry.setAttribute('aria-label','本だなの マンガ');
 entry.innerHTML=`<span class="bookshelf-entry-title" aria-hidden="true">📚 本だな</span>${series.map(s=>`<button type="button" data-series="${s.id}" style="--book:${s.color};--ink:${s.ink};--paper:${s.paper}">${s.title.replace(/の?本$/,'').replace('まったり日常','まったり')}</button>`).join('')}`;
 entryHost.append(entry);
 let reader=null,loading=null,hover=false,selected=false,onLabel=false,timer=null;
 const visible=()=>hover||selected||onLabel;
 const later=fn=>{clearTimeout(timer);timer=setTimeout(fn,hideDelay);};
 const api={
  entry,
  get reader(){return reader;},
  get isOpen(){return !!reader?.isOpen;},
  get visible(){return visible();},
  get selected(){return selected;},
  // PC：本だなに カーソルが のった／はなれた
  setHover(on){
   if(on){clearTimeout(timer);hover=true;}
   else if(hover)later(()=>{hover=false;});
  },
  // iPad（や クリック）：本だなを えらんだ／えらぶのを やめた
  setSelected(on){selected=!!on;if(!on)onLabel=false;},
  // series を省くと、さいごに ひらいた本（はじめては マイクラ本）
  async open(seriesId){
   hover=selected=onLabel=false;clearTimeout(timer);entry.hidden=true;
   loading??=loadReader().then(m=>{reader=m.createMangaReader(host,{storage:safeStorage()});return reader;})
    .catch(error=>{loading=null;throw error;});
   (await loading).open(seriesId);
  },
  close(){reader?.close();},
  // ラベルを画面上の点 (x,y)（host 基準の px）に置く。null や 見せない状態では かくす
  placeEntry(point){
   if(!point||!visible()){entry.hidden=true;return;}
   entry.hidden=false;
   entry.style.transform=`translate(${Math.round(point.x)}px,${Math.round(point.y)}px) translate(-50%,-100%)`;
  },
 };
 entry.addEventListener('click',e=>{
  const b=e.target.closest('button[data-series]');
  if(b)api.open(b.dataset.series).catch(err=>console.warn('[manga]',err));
 });
 entry.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){clearTimeout(timer);onLabel=true;}});
 entry.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')later(()=>{onLabel=false;});});
 return api;
}
