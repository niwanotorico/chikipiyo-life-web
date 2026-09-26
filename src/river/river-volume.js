// ─────────────────────────────────────────────────────────────
// 渓流のマスター音量（PC・スマホ共通）
//  - 音はすべて同じ AudioListener（main.js で 1 つだけ作る）を通るので、その出口に GainNode を 1 つ挟めば
//    せせらぎ・釣りの効果音・これから足す音が全部まとめて調整される（個々の音のコードは触らない）
//      各音 → listener.gain → [master] → スピーカー
//  - 音量は localStorage に保存（次に開いたときも同じ音量）。保存できない環境でも普通に動く
//  - VR 中も同じ AudioContext なので、入る前に決めた音量がそのまま効く
// ─────────────────────────────────────────────────────────────

export const VOLUME_KEY='chikipiyo.river.volume';
export const DEFAULT_VOLUME=.6;   // 初めての人は 6 割から（せせらぎは 2.5 秒かけてふわっと始まる）

// スライダー（0〜1）→ 実際の音量。耳の感じ方に合わせて小さい側を細かく
export const volumeToGain=v=>v<=0?0:Math.pow(Math.min(1,v),1.6);

export function loadVolume(storage=safeStorage()){
 try{const s=storage&&storage.getItem(VOLUME_KEY);if(s==null)return DEFAULT_VOLUME;
  const v=Number(s);return Number.isFinite(v)?Math.min(1,Math.max(0,v)):DEFAULT_VOLUME;}catch{return DEFAULT_VOLUME;}
}
export function saveVolume(v,storage=safeStorage()){try{storage&&storage.setItem(VOLUME_KEY,String(Math.round(v*100)/100));}catch{}}
function safeStorage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch{return null;}}

// listener の出口にマスター音量を挟む
export function createMasterVolume(listener,{storage=safeStorage()}={}){
 const ctx=listener.context,master=ctx.createGain();
 listener.gain.disconnect();listener.gain.connect(master);master.connect(ctx.destination);
 let value=loadVolume(storage),before=value>0?value:DEFAULT_VOLUME;const subs=new Set();
 master.gain.value=volumeToGain(value);
 function set(v,{save=true}={}){
  value=Math.min(1,Math.max(0,+v||0));if(value>0)before=value;
  master.gain.setTargetAtTime(volumeToGain(value),ctx.currentTime,.04);   // プツッと鳴らないよう少しなめらかに
  if(save)saveVolume(value,storage);for(const f of subs)f(value);
 }
 return {set,get value(){return value;},get muted(){return value===0;},toggleMute(){set(value>0?0:before);},
  onChange(f){subs.add(f);return ()=>subs.delete(f);},node:master};
}

// 画面の音量ボタン：普段は丸い 🔊 だけ（0% なら 🔇）。丸ボタンの役割は「音量パネルを開く／閉じる」だけ
//  - パネルはスライダーと％だけ。ミュートしたいときはスライダーを 0% に
//  - 外側を触る・Esc でも閉じる
const icon=v=>v===0?'🔇':'🔊';
export function mountVolumeControl(volume,parent=document.body,{prepend=false}={}){
 const box=document.createElement('div');box.className='river-volume';
 box.innerHTML=`<button type="button" class="volume-toggle" aria-expanded="false" aria-controls="river-volume-panel"></button>
<div class="volume-panel" id="river-volume-panel" hidden>
 <input type="range" min="0" max="100" step="1" aria-label="渓流の音量">
 <output></output>
</div>`;
 const toggle=box.querySelector('.volume-toggle'),panel=box.querySelector('.volume-panel'),
  input=box.querySelector('input'),out=box.querySelector('output');
 function show(v=volume.value){
  const pct=Math.round(v*100);
  toggle.textContent=icon(v);
  const label=v===0?'音量（ミュート中）':`音量 ${pct}%`;
  toggle.setAttribute('aria-label',label);toggle.title=label;
  if(+input.value!==pct)input.value=pct;out.textContent=`${pct}%`;box.classList.toggle('is-muted',v===0);
 }
 const open=o=>{panel.hidden=!o;toggle.setAttribute('aria-expanded',String(o));box.classList.toggle('is-open',o);document.body.classList.toggle('volume-open',o);show();};
 toggle.addEventListener('click',()=>open(panel.hidden));
 input.addEventListener('input',()=>volume.set(+input.value/100));
 // 外側を触る・Esc で閉じる（閉じるだけで、その操作は釣り・カメラにそのまま届く）
 addEventListener('pointerdown',e=>{if(!panel.hidden&&!box.contains(e.target))open(false);},{passive:true});
 addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){open(false);toggle.focus();}});
 volume.onChange(()=>show());show();
 if(prepend)parent.prepend(box);else parent.appendChild(box);
 return box;
}
