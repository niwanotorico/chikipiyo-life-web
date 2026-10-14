// E2E テストの共通部品。
import {expect} from '@playwright/test';

// サイトのページ一覧（src/nav/places.js と同じ並び）。「あかばぬ。」のページができたらここに足す。
export const PAGES=[
 {id:'house',path:'',title:/ちきぴよ暮らし/},
 {id:'river',path:'river.html',title:/渓流つり/},
 {id:'drill',path:'drill.html',title:/ピヨドリル/},
 {id:'okoshi',path:'okoshi.html',title:/ぴよみ起こし/},
];

// 想定ずみの警告（エラーではない）。console.error / pageerror は 1 件でも失敗にする。
const IGNORED_ERRORS=[
 // 外部フォント（Google Fonts）に届かない環境ではシステムフォントに切り替わるだけ
 /fonts\.(googleapis|gstatic)\.com/,
 // VR 機器のない Chromium が「VRで入る」を押したときに自分で出すメッセージ。サイトは失敗を受けとめてボタンに表示している
 /Could not create a session because: No runtimes supported the requested configuration/,
];

// ページで起きたエラー・読み込み失敗を集める。テストの最後に expectClean(page) で確かめる。
export function watchPage(page){
 const problems=[];
 const origin=()=>new URL(page.url()||'http://x').origin;
 const sameSite=url=>{try{return new URL(url).origin===origin();}catch{return false;}};
 const ignored=text=>IGNORED_ERRORS.some(re=>re.test(text));
 page.on('console',m=>{if(m.type()==='error'&&!ignored(m.text()+' '+(m.location()?.url||'')))problems.push(`console.error: ${m.text()}`);});
 page.on('pageerror',e=>problems.push(`pageerror: ${e.message}`));
 // 画像・GLB・音声・JS など、サイト内のファイルが 404 などで読めなかったら失敗
 page.on('response',r=>{if(r.status()>=400&&sameSite(r.url()))problems.push(`HTTP ${r.status()}: ${r.url()}`);});
 page.on('requestfailed',r=>{
  const err=r.failure()?.errorText||'';
  // ページ移動・テスト終了で中断された読み込みは失敗あつかいしない
  if(/ERR_ABORTED|NS_BINDING_ABORTED/.test(err))return;
  if(sameSite(r.url()))problems.push(`request failed: ${r.url()} (${err})`);
 });
 page.__problems=problems;
 return problems;
}
export function expectClean(page){
 expect(page.__problems,'コンソールエラー・読み込み失敗がないこと').toEqual([]);
}

// Math.random を固定する（スクリーンショットを毎回同じにするため）。テスト側だけの差しかえ。
export async function seedRandom(page,seed=1234){
 await page.addInitScript(s=>{
  let a=s>>>0;
  Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 },seed);
}

// 3DPハウスの読み込み完了（家・家具・キャラの GLB まで）を待つ
export async function waitForHouse(page){
 await page.waitForFunction(()=>window.__house?.renderer,null,{timeout:90_000});
 await page.evaluate(()=>Promise.all(window.__house.characters.map(c=>c.visualReady)));
 // 描画ループが回っている（フレーム数が増える）
 await page.waitForFunction(()=>window.__house.renderer.info.render.frame>3);
}
export async function waitForRiver(page){
 await page.waitForFunction(()=>window.__river?.renderer&&document.body.classList.contains('ready'),null,{timeout:90_000});
}

// WebGL の画面に、何かが描かれているか（単色ではないか）を調べる。
// render() の直後に同じ処理の中で読むので preserveDrawingBuffer なしでも読める。
export async function sampleCanvas(page,global){
 return page.evaluate(g=>{
  const w=window[g],r=w.renderer;
  if(w.frame)w.frame(0);else r.render(w.scene,w.camera);
  const gl=r.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
  const colors=new Set(),px=new Uint8Array(4);let lit=0;
  for(let i=1;i<10;i++)for(let j=1;j<10;j++){
   gl.readPixels(Math.floor(W*i/10),Math.floor(H*j/10),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
   colors.add(px.slice(0,3).join(','));if(px[0]+px[1]+px[2]>30)lit++;
  }
  return {width:W,height:H,distinctColors:colors.size,litSamples:lit};
 },global);
}

// 描画ループが進んでいるか（ソフトウェア描画は 1 フレームが遅いので、数秒まで待つ）
export async function expectFramesAdvance(page,global,message='描画ループが動きつづける'){
 const f0=await page.evaluate(g=>window[g].renderer.info.render.frame,global);
 await expect.poll(()=>page.evaluate(g=>window[g].renderer.info.render.frame,global),{message,timeout:60_000}).toBeGreaterThan(f0);
}
