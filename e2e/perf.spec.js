// 描画性能のかんたんな記録（perf プロジェクト＝ほかのテストが全部終わってから、1 つずつ動く）。
// 結果は test-results/perf/<page>.json と、テストレポートの添付に残る。
// ソフトウェア描画（SwiftShader）なので時間の数字は実機よりずっと遅い。「前とくらべて急に増えていないか」を見る目安。
// ドローコール数・三角形数・GPU メモリ上の数は実機とほぼ同じになる。
// 下の上限（BUDGET）は いまの約 2 倍。わざと重くするときは数字を見直す。
import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {watchPage,expectClean,waitForHouse,waitForRiver} from './helpers.js';

// 数は「影の描画＋本番の描画（渓流は水の 2 パス目も）」の 1 フレーム分の合計
const BUDGET={
 house:{calls:1000,triangles:4_000_000,transferMB:80},
 river:{calls:500,triangles:5_500_000,transferMB:20},
};

async function measure(page,global){
 return page.evaluate(g=>{
  const w=window[g],r=w.renderer,info=r.info;
  // 1 フレーム分（渓流は 2 パス）の数を数える
  info.autoReset=false;info.reset();
  if(w.frame)w.frame(0);else r.render(w.scene,w.camera);
  const out={drawCalls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs?.length??null};
  info.autoReset=true;
  const nav=performance.getEntriesByType('navigation')[0];
  const res=performance.getEntriesByType('resource');
  const bytes=res.reduce((s,e)=>s+(e.transferSize||e.encodedBodySize||0),0);
  const biggest=res.map(e=>({url:e.name.replace(location.origin,''),kB:Math.round((e.encodedBodySize||0)/1024)})).sort((a,b)=>b.kB-a.kB).slice(0,5);
  return {...out,
   domContentLoadedMs:Math.round(nav.domContentLoadedEventEnd),
   loadMs:Math.round(nav.loadEventEnd),
   resources:res.length,transferMB:+(bytes/1048576).toFixed(1),biggest,
   jsHeapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,
   pixelRatio:r.getPixelRatio(),drawingBuffer:[r.getContext().drawingBufferWidth,r.getContext().drawingBufferHeight]};
 },global);
}

test.describe.configure({mode:'default'});// 同じワーカーで 1 つずつ（2 ページを同時に計らない）。片方が失敗しても もう片方は計る

for(const [name,path,global] of [['house','','__house'],['river','river.html','__river']]){
 test(`${name}: 初回表示時間・ドローコール・メモリを記録`,async({page},info)=>{
  watchPage(page);
  const t0=Date.now();
  await page.goto(path);
  if(name==='house')await waitForHouse(page);else await waitForRiver(page);
  const firstFrameMs=Date.now()-t0;
  await page.waitForTimeout(1_500);
  // 1 秒あたりのフレーム数（3 秒数える。ソフトウェア描画なので参考値）
  const fps=await page.evaluate(()=>new Promise(res=>{let n=0;const t=performance.now();const tick=()=>{n++;if(performance.now()-t<3000)requestAnimationFrame(tick);else res(+(n/((performance.now()-t)/1000)).toFixed(1));};requestAnimationFrame(tick);}));
  const m={page:name,firstFrameMs,fps,...await measure(page,global),measuredAt:new Date().toISOString(),renderer:'SwiftShader (software)'};
  mkdirSync('test-results/perf',{recursive:true});
  writeFileSync(`test-results/perf/${name}.json`,JSON.stringify(m,null,1));
  await info.attach(`perf-${name}.json`,{body:JSON.stringify(m,null,1),contentType:'application/json'});
  console.log(`[perf] ${name}`,JSON.stringify(m));
  const b=BUDGET[name];
  expect(m.drawCalls,'ドローコール数').toBeLessThanOrEqual(b.calls);
  expect(m.triangles,'三角形数').toBeLessThanOrEqual(b.triangles);
  expect(m.transferMB,'読み込んだデータ量(MB)').toBeLessThanOrEqual(b.transferMB);
  expectClean(page);
 });
}
