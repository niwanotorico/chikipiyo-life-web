import './ar-river.css';
import glbUrl from '../../assets/ar/chikipiyo-river-camp.glb?url';
import usdzUrl from '../../assets/ar/chikipiyo-river-camp.usdz?url';
import posterUrl from '../../assets/ar/chikipiyo-river-camp-poster.jpg?url';
import {RIVER_AR_SIZE,sceneViewerIntent,arPlatform} from './river-ar-config.js';
import {MODEL_VIEWER_SOURCES} from './dollhouse-config.js';

// 渓流のスマホAR「📦 AR」（静止 v0.1）。3DPハウスの「ARで召喚」と同じ考え方で、渓流の上部の並びにボタンを置く。
//   iPhone / iPad（Safari）→ <a rel="ar"> で USDZ を Quick Look へ（iPhone 実機確認済みのファイル）
//   Android → intent で GLB を Scene Viewer へ
//   PC など → 絵と案内。「3Dで見る」でその場の 3D プレビュー（model-viewer はそのときだけ読む）
// 渓流の描画（main.js）・VR・釣りには触れない。

const relAr=()=>{try{const a=document.createElement('a');return !!(a.relList&&a.relList.supports&&a.relList.supports('ar'));}catch{return false;}};
export const riverArPlatform=()=>arPlatform({relArSupported:relAr(),userAgent:navigator.userAgent});

function loadModelViewer(){
 if(customElements.get('model-viewer'))return Promise.resolve();
 return (async()=>{
  for(const src of MODEL_VIEWER_SOURCES){
   try{
    await new Promise((res,rej)=>{const s=document.createElement('script');s.type='module';s.src=src;s.onload=res;s.onerror=()=>{s.remove();rej(new Error(src));};document.head.appendChild(s);});
    await Promise.race([customElements.whenDefined('model-viewer'),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),15000))]);return;
   }catch(e){console.warn('[river-ar] model-viewer',e);}
  }
  throw new Error('model-viewer を読み込めませんでした');
 })();
}

function visualFor(platform){
 const img=`<img src="${posterUrl}" width="640" height="448" alt="部屋の床に置いたちきぴよ渓流（3人の釣りとキャンプ）">`;
 if(platform==='quicklook')return `<div class="river-ar-visual"><a rel="ar" href="${usdzUrl}">${img}</a><span class="river-ar-go passive" aria-hidden="true">床に置く</span>
  <div class="river-ar-loading" role="status" hidden><span class="river-ar-spin" aria-hidden="true"></span><strong>渓流を準備中…</strong><small>初回は少し時間がかかります（約${RIVER_AR_SIZE.usdzMB}MB）</small></div></div>`;
 if(platform==='sceneviewer')return `<div class="river-ar-visual">${img}<button type="button" class="river-ar-go" data-go="sceneviewer">床に置く</button></div>`;
 return `<div class="river-ar-visual">${img}</div>`;
}
const metaFor=p=>p==='quicklook'?'<b>iPhone Safari</b>画像をタップするとカメラが開きます'
 :p==='sceneviewer'?'<b>Android</b>Google の AR 表示が開きます'
 :'<b>スマホで</b>iPhone の Safari か Android の Chrome でこのページを開くと、床に置けます';

// Quick Look から戻ってきたら読み込み表示を消す（戻りを検知できなくても 25 秒で消える）
function watchQuickLook(sheet){
 const link=sheet.querySelector('a[rel=ar]'),box=sheet.querySelector('.river-ar-loading');if(!link||!box)return;
 let t=0,at=0;const hide=()=>{box.hidden=true;clearTimeout(t);};
 link.addEventListener('click',()=>{box.hidden=false;at=Date.now();clearTimeout(t);t=setTimeout(hide,25000);});
 const back=()=>{if(!box.hidden&&Date.now()-at>1200)hide();};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')back();});addEventListener('pageshow',back);addEventListener('focus',back);
}

export function openRiverAR(platform=riverArPlatform()){
 const opener=document.activeElement;
 const sheet=document.createElement('div');sheet.className='river-ar-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','ARで渓流を部屋に置く');
 sheet.dataset.platform=platform;
 sheet.innerHTML=`<div class="river-ar-card">
  <button class="river-ar-close" type="button" aria-label="閉じる">×</button>
  <div class="river-ar-head"><small>AR RIVER</small><strong>渓流を、あなたの部屋へ。</strong>
   <p>3人が釣りをしている川辺を、床に<b>幅 約${RIVER_AR_SIZE.width}m × 奥行き 約${RIVER_AR_SIZE.depth}m</b>（${RIVER_AR_SIZE.scale}）で置けます。広い場所で、置いたあとは歩き回って眺めてください。指で回転・拡大縮小もできます。</p></div>
  ${visualFor(platform)}
  <p class="river-ar-meta">${metaFor(platform)}</p>
  ${platform==='none'?'<button type="button" class="river-ar-pc">🧊 3Dで見る（このパソコンで）</button>':''}
 </div>`;
 document.body.appendChild(sheet);document.body.classList.add('river-ar-open');
 const close=()=>{sheet.remove();document.body.classList.remove('river-ar-open');removeEventListener('keydown',onKey);opener?.focus?.();};
 const onKey=e=>{if(e.key==='Escape')close();};addEventListener('keydown',onKey);
 sheet.querySelector('.river-ar-close').addEventListener('click',close);
 sheet.addEventListener('click',e=>{if(e.target===sheet)close();});
 // 渓流の操作（カメラ・釣りのタップ）へイベントを渡さない
 for(const t of ['pointerdown','pointerup','wheel','touchstart'])sheet.addEventListener(t,e=>e.stopPropagation(),{passive:true});
 if(platform==='quicklook')watchQuickLook(sheet);
 sheet.querySelector('[data-go=sceneviewer]')?.addEventListener('click',()=>{
  location.href=sceneViewerIntent(new URL(glbUrl,location.href).href,location.href);
 });
 sheet.querySelector('.river-ar-pc')?.addEventListener('click',e=>{
  const b=e.currentTarget,vis=sheet.querySelector('.river-ar-visual');b.disabled=true;b.textContent='3Dを準備中…';
  loadModelViewer().then(()=>{
   const mv=document.createElement('model-viewer');
   Object.entries({src:new URL(glbUrl,location.href).href,alt:'ちきぴよ渓流（3人の釣りとキャンプ）','camera-controls':'','touch-action':'pan-y','shadow-intensity':'1',exposure:'1','environment-image':'neutral','interaction-prompt':'none','camera-orbit':'40deg 58deg auto'}).forEach(([k,v])=>mv.setAttribute(k,v));
   mv.addEventListener('load',()=>{b.remove();},{once:true});
   vis.replaceChildren(mv);b.textContent='3Dを読み込み中…（約6MB）';
  }).catch(()=>{b.textContent='3Dを読み込めませんでした';});
 });
 return {sheet,close};
}

// 「📦 AR」ボタン。渓流の上部の並び（topbar）の先頭に置く。スマホ幅では CSS で並びのすぐ上の右端に浮かぶ
export function mountRiverAR(parent){
 const b=document.createElement('button');b.type='button';b.className='river-ar-btn';
 b.innerHTML='<span aria-hidden="true">📦</span>AR';b.setAttribute('aria-label','ARで渓流を部屋に置く');b.title='スマホのカメラ越しに、渓流を部屋の床へ';
 b.addEventListener('click',()=>openRiverAR());
 parent?parent.prepend(b):document.body.appendChild(b);
 return b;
}
