// WebXR の入口（通常Web → VR → 将来の AR/MR）。
// three.js の renderer.xr を薄く包むだけにして、どのページ（渓流・ハウス…）からも使えるようにしている。
// ページ側は「対応していればボタンを出す → enter('vr') → onStart/onEnd で自分の世界を切り替える」だけ。

export const XR_MODES={
 vr:{session:'immersive-vr',required:['local-floor'],optional:['bounded-floor','hand-tracking','layers']},
 // 将来の MR 用（Quest 3 のパススルー）。hit-test / anchors / plane-detection で現実の床や机に置く
 ar:{session:'immersive-ar',required:['local-floor'],optional:['hit-test','anchors','plane-detection','dom-overlay','hand-tracking','layers']},
};

export async function detectXR(nav=globalThis.navigator){
 const out={vr:false,ar:false},xr=nav&&nav.xr;
 if(!xr||typeof xr.isSessionSupported!=='function')return out;
 await Promise.all(Object.keys(XR_MODES).map(async k=>{try{out[k]=!!await xr.isSessionSupported(XR_MODES[k].session);}catch{out[k]=false;}}));
 return out;
}

export function createXRSession(renderer,{onStart,onEnd,framebufferScale=1,foveation=1}={}){
 let session=null,mode=null,starting=null;
 async function enter(m='vr',{optionalFeatures=[],domOverlay=null}={}){
  if(session)return session;if(starting)return starting;
  const cfg=XR_MODES[m];if(!cfg)throw new Error('unknown XR mode '+m);
  const init={requiredFeatures:cfg.required,optionalFeatures:[...cfg.optional,...optionalFeatures]};
  if(domOverlay)init.domOverlay={root:domOverlay};
  starting=(async()=>{
   const s=await navigator.xr.requestSession(cfg.session,init);
   renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(framebufferScale);
   await renderer.xr.setSession(s);renderer.xr.setFoveation(foveation);
   // three.js 側の後片付け（画面サイズの復元など）の後に呼ばれるよう、setSession の後で登録する
   s.addEventListener('end',()=>{const was=mode;session=null;mode=null;onEnd&&onEnd(was);});
   session=s;mode=m;onStart&&onStart(m,s);return s;
  })();
  try{return await starting;}finally{starting=null;}
 }
 return {enter,exit:()=>session&&session.end(),get session(){return session;},get mode(){return mode;},get active(){return !!session;}};
}

// ページに浮かべる「VRで入る」ボタン。対応環境でだけ呼ぶ
// ボタンの見た目（どのワールドでも同じ）。ページの CSS で .xr-enter の位置だけ上書きしてよい
const BUTTON_CSS=`.xr-enter{position:fixed;z-index:21;left:16px;bottom:16px;padding:12px 20px;border:0;border-radius:999px;background:rgba(255,255,255,.86);backdrop-filter:blur(8px);color:#24403a;font:700 15px/1 "Noto Sans JP",sans-serif;letter-spacing:.06em;box-shadow:0 4px 18px rgba(20,50,40,.2);cursor:pointer}
.xr-enter::before{content:"🥽 "}
.xr-enter:hover{background:#fff}
.xr-enter[data-state="starting"]{opacity:.7;cursor:wait}
.xr-enter.xr-error{background:#ffe1dc;color:#9a3526}
@media (max-width:520px){.xr-enter{left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom,0px))}}`;
function injectButtonCSS(){
 if(document.getElementById('xr-enter-style'))return;
 const st=document.createElement('style');st.id='xr-enter-style';st.textContent=BUTTON_CSS;
 document.head.prepend(st); // 先頭に入れて、ページ側の CSS で上書きできるようにする
}

export function mountXRButton(parent,{label='VRで入る',exitLabel='VRを終了',onEnter,onExit,className='xr-enter'}={}){
 injectButtonCSS();
 const el=document.createElement('button');el.type='button';el.className=className;
 const set=(state,text)=>{el.dataset.state=state;el.textContent=text;el.disabled=state==='starting';};
 set('idle',label);
 el.addEventListener('click',async()=>{
  if(el.dataset.state==='active'){onExit&&onExit();return;}
  set('starting','準備中…');
  try{await onEnter();set('active',exitLabel);}
  catch(e){console.warn('[xr]',e);set('idle',label);el.title=String(e&&e.message||e);el.classList.add('xr-error');setTimeout(()=>el.classList.remove('xr-error'),2400);}
 });
 parent.appendChild(el);
 return {el,idle:()=>set('idle',label),active:()=>set('active',exitLabel)};
}

// 対応ブラウザ（Meta Quest など）でだけ true。?xr を付けると非対応でも true（ボタン確認・エミュレーター用）。
// ページ側はこれが true の時だけ VR 用コードを import する（PC・スマホの通常表示には読み込まれない）。
export async function whenXRSupported(params=new URLSearchParams(globalThis.location?.search||''),nav=globalThis.navigator){
 let ok=false;
 try{ok=!!(nav&&nav.xr&&nav.xr.isSessionSupported&&await nav.xr.isSessionSupported('immersive-vr'));}catch{ok=false;}
 return ok||params.has('xr');
}

// VR の画質設定。Quest（ブラウザ内の Quest も含む）は少し軽く。?xrscale で上書き
export const isStandaloneHeadset=(ua=globalThis.navigator?.userAgent||'')=>/OculusBrowser|Quest|Pico/i.test(ua);
export function xrProfile(params=new URLSearchParams(globalThis.location?.search||''),ua){
 const quest=isStandaloneHeadset(ua);
 return {quest,xrScale:+(params.get('xrscale')||(quest?.9:1))};
}
