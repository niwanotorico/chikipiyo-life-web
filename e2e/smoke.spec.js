// 全ページ：起動する・コンソールエラーが出ない・アセット（画像・GLB・音声など）が 404 にならない・3D が描かれる。
// desktop（PC）と mobile（スマホ）の両方で動く。
import {test,expect} from '@playwright/test';
import {PAGES,watchPage,expectClean,waitForHouse,waitForRiver,sampleCanvas,expectFramesAdvance} from './helpers.js';

for(const p of PAGES){
 test(`${p.id}: 起動してエラー・読み込み失敗がない`,async({page})=>{
  watchPage(page);
  await page.goto(p.path);
  await expect(page).toHaveTitle(p.title);
  // サイト共通ナビ（ハウス・釣り・ドリル・起こし）が出ている
  await expect(page.locator('nav.site-nav')).toBeVisible();
  if(p.id==='house')await waitForHouse(page);
  if(p.id==='river')await waitForRiver(page);
  if(p.id==='drill')await expect(page.locator('[data-screen="home"]')).toBeVisible();
  if(p.id==='okoshi'){
   // ゲーム（Godot の書き出し）は iframe の中。canvas が出るまで待つ
   const game=page.frameLocator('.ok-frame iframe');
   await expect(game.locator('canvas').first()).toBeAttached({timeout:60_000});
  }
  // 遅れて読み込まれるもの（キャラの GLB、効果音など）の分も少し待つ
  await page.waitForTimeout(2_000);
  expectClean(page);
 });
}

test('house: Three.js の canvas が表示され、描画が始まる',async({page})=>{
 watchPage(page);
 await page.goto('');
 await waitForHouse(page);
 const canvas=page.locator('#canvas-host canvas');
 await expect(canvas).toBeVisible();
 const box=await canvas.boundingBox();
 expect(box.width).toBeGreaterThan(200);expect(box.height).toBeGreaterThan(200);
 const s=await sampleCanvas(page,'__house');
 expect(s.distinctColors,'単色ではなく、家や家具が描かれている').toBeGreaterThan(5);
 await expectFramesAdvance(page,'__house');
 expectClean(page);
});

test('river: Three.js の canvas が表示され、描画が始まる',async({page})=>{
 watchPage(page);
 await page.goto('river.html');
 await waitForRiver(page);
 // 「渓流をつくってるよ…」は body.ready で透明になって消える
 await expect(page.locator('.river-loading')).toHaveCSS('opacity','0');
 const canvas=page.locator('#app canvas');
 await expect(canvas).toBeVisible();
 const s=await sampleCanvas(page,'__river');
 expect(s.distinctColors,'単色ではなく、渓流が描かれている').toBeGreaterThan(5);
 const t0=await page.evaluate(()=>__river.shared.uTime.value);
 await expect.poll(()=>page.evaluate(()=>__river.shared.uTime.value),{message:'アニメーションが進む',timeout:60_000}).toBeGreaterThan(t0);
 expectClean(page);
});

test('サイト共通ナビで ページを行き来できる',async({page,isMobile})=>{
 // 既知の不具合（2026-10-14 調査で発見、未修正）：スマホ幅のドリルでは、画面下に浮かぶナビが
 // .dq-main の下にかくれてタップできない（.dq-top と .dq-main がどちらも z-index:1 のため）。
 // 直したら この fixme を消す。くわしくは docs/notes/test-plan.md
 test.fixme(isMobile,'スマホ幅のドリルでナビが内容の下にかくれる（既知の不具合）');
 watchPage(page);
 await page.goto('drill.html');
 const nav=page.locator('nav.site-nav');
 await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href',/drill\.html$/);
 await nav.locator('a[href$="okoshi.html"]').click();
 await expect(page).toHaveURL(/okoshi\.html$/);
 await expect(page).toHaveTitle(/ぴよみ起こし/);
 expectClean(page);
});
