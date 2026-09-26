import './ar.css';
import dollhouseUrl from '../../assets/ar/chikipiyo-dollhouse.glb?url';
import {DOLLHOUSE_WIDTH,MODEL_VIEWER_SOURCES,modelViewerAttributes} from './dollhouse-config.js';
// 動くAR（3人の日常＋プリン、マット調整済みのアニメ付き USDZ）。iPhone の Quick Look だけが対応（Android の Scene Viewer は静止版のまま）
import animUsdzUrl from '../../assets/ar/chikipiyo-dollhouse-anim.usdz?url';
import animPosterUrl from '../../assets/ar/chikipiyo-dollhouse-anim-poster.jpg?url';

// スマホの AR「ドールハウス召喚」。VR（src/xr・xr-house）とは完全に別の入口。
// 押すとプレビュー画面を開き、<model-viewer> の AR ボタンで
//   Android → Scene Viewer / iPhone → Quick Look
// に渡して、現実の床や机の上に幅40cmのハウスを置く。3D の家本体（main.js の描画）には触れない。

// iPhone / iPad の Safari（AR Quick Look）なら <a rel="ar"> が使える
export function supportsQuickLook(doc=globalThis.document){
 try{const a=doc.createElement('a');return !!(a.relList&&a.relList.supports&&a.relList.supports('ar'));}catch{return false;}
}
// 「動くAR」カード：<a rel="ar"> の中は img 1枚だけ（Quick Look の決まり）。ボタン風の文字と読み込み表示は上に重ね、タップは画像へ通す
function animCard(){
 return `<section class="ar-choice ar-choice-anim">
  <div class="ar-choice-head"><strong>🎬 動くAR</strong><small>3人が動く・約30秒でくり返し</small></div>
  <div class="ar-anim"><a rel="ar" href="${animUsdzUrl}"><img src="${animPosterUrl}" width="640" height="448" alt="動くドールハウス（3人の日常）"></a>
   <span class="ar-anim-go" aria-hidden="true">動くARで置く</span>
   <div class="ar-anim-loading" role="status" hidden><span class="ar-spinner" aria-hidden="true"></span><strong>動くおうちを準備中…</strong><small>初回は少し時間がかかります</small></div>
  </div>
  <p class="ar-choice-meta"><span class="ar-badge">iPhone Safari対応</span>初回は読み込みに少し時間がかかります<small>（約10MB）</small></p>
 </section>`;
}
// 「動くARで置く」を押した直後の読み込み表示。Quick Look の起動は止めない（preventDefault しない）。
// Quick Look から戻ってきたら（画面に戻る・フォーカスが戻る）消す。戻りを検知できなくても 25 秒で消える
function watchAnimLoading(card){
 const link=card?.querySelector('.ar-anim a[rel=ar]'),box=card?.querySelector('.ar-anim-loading');if(!link||!box)return;
 let timer=0,shownAt=0;
 const hide=()=>{box.hidden=true;clearTimeout(timer);};
 link.addEventListener('click',()=>{box.hidden=false;shownAt=Date.now();clearTimeout(timer);timer=setTimeout(hide,25000);});
 const back=()=>{if(!box.hidden&&Date.now()-shownAt>1200)hide();};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')back();});
 addEventListener('focus',back);addEventListener('pageshow',back);
}

let viewerReady=null;
function loadModelViewer(){
 if(customElements.get('model-viewer'))return Promise.resolve();
 if(viewerReady)return viewerReady;
 viewerReady=(async()=>{
  for(const src of MODEL_VIEWER_SOURCES){
   try{
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.type='module';s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error(src));};document.head.appendChild(s);});
    await Promise.race([customElements.whenDefined('model-viewer'),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),15000))]);
    return;
   }catch(e){console.warn('[ar] model-viewer',e);}
  }
  viewerReady=null;throw new Error('model-viewer を読み込めませんでした');
 })();
 return viewerReady;
}

function openSheet(){
 const sheet=document.createElement('div');sheet.className='ar-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','ARでドールハウスを召喚');
 const quickLook=supportsQuickLook();
 sheet.innerHTML=`<div class="ar-card${quickLook?' two':''}">
  <button class="ar-close" type="button" aria-label="閉じる">×</button>
  <div class="ar-head"><small>AR DOLLHOUSE</small><strong>おうちを、あなたの部屋へ。</strong><p>床や机の上に、幅およそ${Math.round(DOLLHOUSE_WIDTH*100)}cmのハウスを置けます。置いたあとは指で回転・拡大縮小できます。</p></div>
  <div class="ar-choices">
   <section class="ar-choice ar-choice-static">
    ${quickLook?'<div class="ar-choice-head"><strong>📱 すぐ置くAR</strong><small>軽くてすぐ表示</small></div>':''}
    <div class="ar-stage"><p class="ar-loading">ドールハウスを準備中…</p></div>
    ${quickLook?'<p class="ar-choice-meta"><span class="ar-badge">iPhone・Android</span>すぐに置けます</p>':''}
   </section>
   ${quickLook?animCard():''}
  </div>
  ${quickLook?'':'<p class="ar-anim-hint">🎬 3人が動く「動くAR」は、iPhone の Safari で見られます。</p>'}
  <p class="ar-note" hidden></p>
 </div>`;
 document.body.appendChild(sheet);document.body.classList.add('ar-open');watchAnimLoading(sheet);
 const close=()=>{sheet.remove();document.body.classList.remove('ar-open');removeEventListener('keydown',onKey);opener?.focus();};
 const onKey=e=>{if(e.key==='Escape')close();};addEventListener('keydown',onKey);
 const opener=document.activeElement;
 sheet.querySelector('.ar-close').addEventListener('click',close);
 sheet.addEventListener('click',e=>{if(e.target===sheet)close();});
 const stage=sheet.querySelector('.ar-stage'),note=sheet.querySelector('.ar-note');
 loadModelViewer().then(()=>{
  if(!sheet.isConnected)return;
  const mv=document.createElement('model-viewer');
  for(const [k,v] of Object.entries(modelViewerAttributes(new URL(dollhouseUrl,location.href).href)))mv.setAttribute(k,v);
  const go=document.createElement('button');go.type='button';go.slot='ar-button';go.className='ar-go';go.textContent='床や机に置く';mv.appendChild(go);
  mv.addEventListener('load',()=>{
   stage.classList.add('ready');
   if(!mv.canActivateAR){note.hidden=false;note.textContent='この端末ではARを起動できません。Android の Chrome か iPhone の Safari で開くと、カメラ越しに置けます。（ここでは指で回して見られます）';}
  });
  mv.addEventListener('ar-status',e=>{if(e.detail?.status==='failed'){note.hidden=false;note.textContent='ARを開始できませんでした。明るい場所で、床や机を映しながらもう一度お試しください。';}});
  mv.addEventListener('error',()=>{note.hidden=false;note.textContent='ドールハウスを読み込めませんでした。通信状況を確認して、もう一度開いてください。';});
  stage.appendChild(mv);window.__ar={viewer:mv};
 }).catch(()=>{stage.querySelector('.ar-loading').textContent='ARの部品を読み込めませんでした。通信状況を確認して、もう一度お試しください。';});
 return {sheet,close};
}

// ハウスでは「🥽 VRで入る」も同じ列（VR｜AR｜⌂）に並べる。VR の機能はそのまま、ボタンの置き場所と見た目だけ
export function dockXRButton(el,bar=document.querySelector('.scene-bottom')){
 if(!el||!bar)return false;
 el.classList.add('in-scene-bar');bar.insertBefore(el,bar.querySelector('.ar-summon')||bar.querySelector('#home'));return true;
}

// 「ARで召喚」ボタン。3D 画面の下（視点リセット ⌂ の左）に置く
export function mountARButton(parent=document.querySelector('.scene-bottom')){
 const el=document.createElement('button');el.type='button';el.className='ar-summon';el.textContent='ARで召喚';
 el.title='スマホのカメラ越しに、ドールハウスを床や机へ';
 el.addEventListener('click',()=>openSheet());
 if(parent){const home=parent.querySelector('#home');parent.insertBefore(el,home||null);}
 else{el.classList.add('floating');document.body.appendChild(el);}
 return {el,open:openSheet};
}
