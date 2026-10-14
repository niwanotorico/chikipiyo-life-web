// 渓流つり・ピヨドリル・ぴよみ起こしの基本動作。
import {test,expect} from '@playwright/test';
import {watchPage,expectClean,waitForRiver} from './helpers.js';

test.describe('おさかな釣り（river.html）',()=>{
 test('スコア表・音量・キャンプのボタンが出て、水面タップで落ちない',async({page,isMobile})=>{
  watchPage(page);
  await page.goto('river.html');
  await waitForRiver(page);
  await expect(page.locator('[data-count="chiki"]')).toHaveText(/\d+/);
  await expect(page.locator('[data-count="piyo"]')).toHaveText(/\d+/);
  await expect(page.locator('[data-count="piyomi"]')).toHaveText(/\d+/);
  await expect(page.locator('.river-topbar nav.site-nav')).toBeVisible();
  // 画面の真ん中（川のあたり）をタップ／クリック：「合わせ」の操作。エラーで落ちないこと
  const vp=page.viewportSize();
  for(let i=0;i<3;i++){
   if(isMobile)await page.touchscreen.tap(vp.width/2,vp.height*.6);else await page.mouse.click(vp.width/2,vp.height*.6);
   await page.waitForTimeout(300);
  }
  const t0=await page.evaluate(()=>__river.shared.uTime.value);
  await expect.poll(()=>page.evaluate(()=>__river.shared.uTime.value),{timeout:60_000}).toBeGreaterThan(t0);
  expectClean(page);
 });
});

test.describe('ピヨドリル（drill.html）',()=>{
 test('プレイヤーを選ぶと はじめられて、問題が出る。「やめる」でもどる',async({page})=>{
  watchPage(page);
  await page.goto('drill.html');
  const start=page.locator('[data-start]');
  await expect(start).toBeDisabled();
  await page.locator('label.dq-player.is-piyokichi').click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.locator('[data-screen="play"]')).toBeVisible();
  await expect(page.locator('[data-question]')).not.toBeEmpty();
  // テンキーで入力できる
  await page.locator('[data-pad] [data-key="7"]').click();
  await expect(page.locator('[data-input]')).toHaveText(/7/);
  // 「やめる」は 2 回押し（1回目で「ほんとに やめる？」）
  const quit=page.locator('[data-quit]');
  await quit.click();
  await expect(quit).toHaveText(/ほんとに やめる/);
  await quit.click();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  expectClean(page);
 });
});

test.describe('ぴよみ起こし（okoshi.html）',()=>{
 test('ゲームの iframe が読み込まれ、「ゲームだけの画面」へのリンクがある',async({page})=>{
  watchPage(page);
  await page.goto('okoshi.html');
  const frame=page.frameLocator('.ok-frame iframe');
  await expect(frame.locator('canvas').first()).toBeAttached({timeout:60_000});
  await expect(page.locator('a.ok-full')).toHaveAttribute('href','games/piyomi-okoshi/index.html');
  await expect(page.locator('.ok-how li')).toHaveCount(5);
  expectClean(page);
 });
});
