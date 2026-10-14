// スマホのタッチ操作（mobile プロジェクトだけ）：1本指ドラッグで回転、ピンチでズーム。
// Playwright の touchscreen はタップしかないので、Chromium の CDP でタッチを送る。
import {test,expect} from '@playwright/test';
import {watchPage,expectClean,waitForHouse,waitForRiver} from './helpers.js';

test.skip(({isMobile})=>!isMobile,'スマホ（タッチ）だけ');

async function touch(page){
 const cdp=await page.context().newCDPSession(page);
 const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
 return {
  async drag([x0,y0],[x1,y1],steps=12){
   await send('touchStart',[[x0,y0]]);
   for(let i=1;i<=steps;i++){await send('touchMove',[[x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps]]);await page.waitForTimeout(16);}
   await send('touchEnd',[]);
  },
  async pinch([cx,cy],from,to,steps=12){
   await send('touchStart',[[cx-from,cy],[cx+from,cy]]);
   for(let i=1;i<=steps;i++){const d=from+(to-from)*i/steps;await send('touchMove',[[cx-d,cy],[cx+d,cy]]);await page.waitForTimeout(16);}
   await send('touchEnd',[]);
  },
 };
}
const camState=(page,g)=>page.evaluate(g=>{const {camera,controls}=window[g];return {p:camera.position.toArray(),dist:camera.position.distanceTo(controls.target)};},g);

for(const [name,path,global,box] of [['house','','__house','#canvas-host canvas'],['river','river.html','__river','#app canvas']]){
 test(`${name}: 1本指ドラッグで回転・ピンチでズーム`,async({page})=>{
  test.slow();// スマホ解像度のソフトウェア描画は 1 フレームが数秒かかることがある
  watchPage(page);
  await page.goto(path);
  if(name==='house'){await waitForHouse(page);await page.locator('#pause').click();}else await waitForRiver(page);
  const canvas=page.locator(box);
  await canvas.scrollIntoViewIfNeeded();
  const b=await canvas.boundingBox();
  // キャラにふれると「つまんで移動」になるので、部屋の外（canvas の上のほうの背景）でドラッグする
  const cx=b.x+b.width/2,cy=Math.max(b.y,0)+(name==='house'?50:Math.min(b.height,page.viewportSize().height-b.y)/2);
  const t=await touch(page);

  const before=await camState(page,global);
  await t.drag([cx-80,cy],[cx+80,cy]);
  // カメラは描画ループの controls.update() で動く（なめらか移動つき）ので、数フレーム待つ
  const moved=async()=>{const c=await camState(page,global);return Math.hypot(...c.p.map((v,i)=>v-before.p[i]));};
  await expect.poll(moved,{message:'カメラが回る',timeout:40_000}).toBeGreaterThan(.3);
  await page.waitForTimeout(1_000);
  const rotated=await camState(page,global);

  await t.pinch([cx,cy],40,130);
  await expect.poll(async()=>(await camState(page,global)).dist,{message:'ピンチアウトで近づく',timeout:40_000}).toBeLessThan(rotated.dist-.2);
  expectClean(page);
 });
}

test('house: キャラカードはタップで選べる',async({page})=>{
 watchPage(page);
 await page.goto('');
 await waitForHouse(page);
 const card=page.locator('[data-character="piyomi"]');
 await card.tap();
 await expect(card).toHaveAttribute('aria-pressed','true');
 await page.locator('#furniture-grid [data-furniture]').first().tap();
 await expect(page.locator('#action-popover')).toBeVisible();
 expectClean(page);
});
