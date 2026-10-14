// 3DPハウス（index.html）の基本操作：キャラ選択・家具の指示・一時停止・視点リセット・3D 内のクリック／タップ。
import {test,expect} from '@playwright/test';
import {watchPage,expectClean,waitForHouse} from './helpers.js';

test.beforeEach(async({page})=>{
 watchPage(page);
 await page.goto('');
 await waitForHouse(page);
});
test.afterEach(async({page})=>expectClean(page));

// 3D の中の家具の、画面上の候補点（メッシュの中心）を集める。かくれている点もあるので、テスト側で順にためす。
async function furnitureScreenPoints(page,ids){
 return page.evaluate(ids=>{
  const {camera,furniture,renderer}=window.__house;
  const V=camera.position.constructor;// THREE.Vector3（three を import せずに使う）
  const rect=renderer.domElement.getBoundingClientRect(),out=[];
  for(const id of ids){
   const f=furniture.find(x=>x.id===id);if(!f)continue;
   f.group.updateWorldMatrix(true,true);
   f.group.traverse(o=>{
    if(!o.isMesh||!o.geometry||out.filter(p=>p.id===id).length>=4)return;
    o.geometry.computeBoundingBox();const c=new V();o.geometry.boundingBox.getCenter(c);c.applyMatrix4(o.matrixWorld);
    const v=c.project(camera);if(Math.abs(v.x)>.85||Math.abs(v.y)>.85||v.z>1)return;
    const x=rect.left+(v.x+1)/2*rect.width,y=rect.top+(1-v.y)/2*rect.height;
    if(y>4&&y<innerHeight-4&&x>4&&x<innerWidth-4)out.push({id,x,y});
   });
  }
  return out;
 },ids);
}

test('キャラクターを選ぶと、選択中の名前と家具ボタンが切り替わる',async({page})=>{
 const cards=page.locator('[data-character]');
 await expect(cards).toHaveCount(3);
 await expect(cards.first()).toHaveAttribute('aria-pressed','true');
 const piyo=page.locator('[data-character="piyo"]');
 await piyo.click();
 await expect(piyo).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#selected-name')).toHaveText('ぴよきち');
 await expect(page.locator('[data-character="chiki"]')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#furniture-grid [data-furniture]').first()).toBeVisible();
});

test('家具ボタン → 「やってみる」で行動を指示できる',async({page})=>{
 await page.locator('[data-character="chiki"]').click();
 await page.locator('#furniture-grid [data-furniture="sofa"]').click();
 const pop=page.locator('#action-popover');
 await expect(pop).toBeVisible();
 await expect(page.locator('#popover-furniture')).toHaveText('ソファ');
 await page.locator('#perform-action').click();
 await expect(pop).toBeHidden();
 await expect(page.locator('#toast')).toHaveText(/ちきんがソファへ|もうひとりが使っています/);
 // シミュレーション側にも指示が届いている（ソファへ向かう／もう使用中）
 const target=await page.evaluate(()=>__house.characters.find(c=>c.id==='chiki').target?.id??null);
 expect(['sofa',null]).toContain(target);
});

test('ポップオーバーは × と Esc で閉じる',async({page})=>{
 await page.locator('#furniture-grid [data-furniture="bed"]').click();
 await expect(page.locator('#action-popover')).toBeVisible();
 await page.locator('#close-popover').click();
 await expect(page.locator('#action-popover')).toBeHidden();
 await page.locator('#furniture-grid [data-furniture="bed"]').click();
 await expect(page.locator('#action-popover')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#action-popover')).toBeHidden();
});

test('一時停止で生活時計が止まり、再開で動く',async({page})=>{
 const pause=page.locator('#pause');
 await pause.click();
 await expect(pause).toHaveText(/再開する/);
 await expect(page.locator('#world-state')).toHaveText(/一時停止中/);
 const t0=await page.evaluate(()=>__house.simulation.time);
 await page.waitForTimeout(800);
 expect(await page.evaluate(()=>__house.simulation.time)).toBe(t0);
 await pause.click();
 await expect(pause).toHaveText(/一時停止/);
 await expect.poll(()=>page.evaluate(()=>__house.simulation.time),{timeout:60_000}).toBeGreaterThan(t0);
});

test('視点リセット（⌂）で初期カメラに戻る',async({page})=>{
 // カメラを動かしてから戻す
 await page.evaluate(()=>{const {camera,controls}=__house;camera.position.set(-8,6,-10);controls.target.set(2,1,2);controls.update();});
 await page.locator('#home').click();
 await page.waitForTimeout(300);
 const cam=await page.evaluate(()=>{const {camera,controls}=__house;return {p:camera.position.toArray(),t:controls.target.toArray()};});
 // OrbitControls のなめらか移動（damping）があるので少しの誤差は許す
 expect(cam.t[0]).toBeCloseTo(0,0);expect(cam.t[1]).toBeCloseTo(.5,0);expect(cam.t[2]).toBeCloseTo(0,0);
 const d=Math.hypot(cam.p[0]-13,cam.p[1]-12,cam.p[2]-17);
 expect(d,'初期位置 (13,12,17) の近く').toBeLessThan(2.5);
});

test('3D の家具をクリック（スマホはタップ）すると、行動のポップオーバーが出る',async({page,isMobile})=>{
 // キャラが家具の前に来ないよう止めておく
 await page.locator('#pause').click();
 await page.locator('#canvas-host canvas').scrollIntoViewIfNeeded();
 const points=await furnitureScreenPoints(page,['bed','sofa','table','printer','vr','vacuum']);
 expect(points.length,'画面内に家具が見えている').toBeGreaterThan(0);
 const pop=page.locator('#action-popover');
 let opened=null;
 for(const p of points){
  if(isMobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
  if(await pop.isVisible()){opened=await page.locator('#popover-furniture').textContent();break;}
 }
 expect(opened,'どれかの家具でポップオーバーが出る').toBeTruthy();
 await page.locator('#perform-action').click();
 await expect(pop).toBeHidden();
});
