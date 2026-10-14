// スクリーンショット比較（見た目が意図せず変わっていないか）。
// アニメーション・ランダムで毎回こけないよう、比較するのは「止めた状態」の画面だけ：
//   - Math.random を固定（テスト側だけ）
//   - ハウスは一時停止して生活時計を 0 に、渓流は ?still で描画ループを止めて 1 枚だけ描く
//   - 許容誤差は playwright.config.js の toHaveScreenshot（2% まで）＋ここでの個別指定
// 基準画像は e2e/__screenshots__/。見た目を「わざと」変えたときは npm run test:e2e:update で作りなおす。
// 基準画像は Linux（GitHub Actions と同じ）で作ったもの。Windows / Mac では描画が少しちがうのでスキップする。
import {test,expect} from '@playwright/test';
import {watchPage,expectClean,seedRandom} from './helpers.js';

// 要素のうち、画面に見えている部分だけを切り出す範囲（要素スクショは画面サイズを一時的に変えることがあるため使わない）
async function visibleClip(page,selector){
 await page.evaluate(()=>scrollTo(0,0));
 const b=await page.locator(selector).boundingBox(),vp=page.viewportSize();
 const x=Math.max(0,b.x),y=Math.max(0,b.y);
 return {x,y,width:Math.min(vp.width,b.x+b.width)-x,height:Math.min(vp.height,b.y+b.height)-y};
}

test.skip(()=>process.platform!=='linux','基準画像は Linux（CI）用');

test('house: 一時停止した部屋の 3D',async({page})=>{
 watchPage(page);
 await seedRandom(page);
 await page.goto('');
 // 描画ループが始まった瞬間に一時停止（キャラが歩き出す前＝初期位置で止める）
 await page.waitForFunction(()=>{const h=window.__house;if(!h)return false;h.simulation.paused=true;h.simulation.time=0;return true;},null,{timeout:90_000,polling:'raf'});
 await page.evaluate(()=>Promise.all(__house.characters.map(c=>c.vrVisualReady)));
 await page.locator('#home').click();
 await page.waitForTimeout(1_500);// カメラのなめらか移動・プリンのゆれが落ちつくまで
 // 動きの更新（生活・アニメ・カメラ）を止めて、描画だけを続けるループに差しかえる（テスト側だけの操作）。
 // 描画まで止めると、撮影中の画面サイズ変更でキャンバスが消えたまま写ってしまう
 await page.evaluate(()=>{const h=__house;h.camera.position.set(13,12,17);h.controls.target.set(0,.5,0);h.controls.update();h.renderer.setAnimationLoop(()=>h.renderer.render(h.scene,h.camera));});
 await expect(page).toHaveScreenshot('house-paused.png',{clip:await visibleClip(page,'#canvas-host canvas'),maxDiffPixelRatio:.03,timeout:90_000});
 expectClean(page);
});

test('river: 止めた渓流（夏・キャンプなし）',async({page})=>{
 watchPage(page);
 await seedRandom(page);
 await page.goto('river.html?still&season=summer&camp=0');
 await page.waitForFunction(()=>window.__river?.frame,null,{timeout:90_000});
 await page.waitForTimeout(2_000);// テクスチャなどの読み込み
 // 時間を進めない frame(0) だけを回す（?still で止めた描画ループの代わり。画面サイズが変わっても描きなおせる）
 await page.evaluate(()=>__river.renderer.setAnimationLoop(()=>__river.frame(0)));
 await expect(page).toHaveScreenshot('river-still.png',{clip:await visibleClip(page,'#app canvas'),maxDiffPixelRatio:.03,timeout:90_000});
 expectClean(page);
});

test.describe('drill: ホーム画面',()=>{
 test.use({timezoneId:'Asia/Tokyo'});
 test('はじめて開いたときのホーム',async({page})=>{
  watchPage(page);
  // 日付で表示が変わる（ピヨ探検の期間など）ので、日付だけ固定する。タイマーは本物のまま
  await page.clock.setFixedTime(new Date('2026-10-14T10:00:00+09:00'));
  await page.goto('drill.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.complete||new Promise(r=>{i.onload=i.onerror=r;}))));
  await expect(page.locator('.dq-pgrid')).toHaveScreenshot('drill-players.png');
  expectClean(page);
 });
});
