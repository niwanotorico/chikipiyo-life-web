// WebXR：自動テストは「VRで入る」ボタンが出る・押してもエラーで落ちない、まで。
// ?xr を付けると非対応ブラウザでもボタンが出る（src/xr/xr-session.js の whenXRSupported）。
// 実際に VR に入れるか・コントローラー・歩行は Quest 実機で確認する（docs/notes/test-plan.md のチェックリスト）。
import {test,expect} from '@playwright/test';
import {watchPage,expectClean,waitForHouse,waitForRiver,expectFramesAdvance} from './helpers.js';

test.skip(({isMobile})=>isMobile,'VR ボタンは PC 幅で確認すれば十分');

for(const [name,path] of [['house','?xr'],['river','river.html?xr']]){
 test(`${name}: 「VRで入る」ボタンが出て、押してもページが落ちない`,async({page})=>{
  watchPage(page);
  await page.goto(path);
  if(name==='house')await waitForHouse(page);else await waitForRiver(page);
  const btn=page.locator('button.xr-enter');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('VRで入る');
  await btn.click();
  // ヘッドセットがないので開始できない → ボタンにメッセージが出て、少しすると元にもどる
  await expect(btn).toHaveText(/VRを開始できませんでした|VRで入る/);
  await expect(btn).toHaveText('VRで入る',{timeout:10_000});
  // 3D の描画は続いている
  const g=name==='house'?'__house':'__river';
  await expectFramesAdvance(page,g);
  expectClean(page);
 });
}

test('house: ?xr なしの PC では「VRで入る」ボタンを出さない',async({page})=>{
 watchPage(page);
 await page.goto('');
 await waitForHouse(page);
 await page.waitForTimeout(500);
 await expect(page.locator('button.xr-enter')).toHaveCount(0);
 expectClean(page);
});
