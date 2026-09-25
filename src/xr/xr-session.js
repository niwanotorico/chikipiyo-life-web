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
export function mountXRButton(parent,{label='VRで入る',exitLabel='VRを終了',onEnter,onExit,className='xr-enter'}={}){
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
