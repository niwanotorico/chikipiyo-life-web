// GitHub Pages と同じサブパス（/chikipiyo-life-web/）でビルドしたサイトの確認。pages-subpath プロジェクトだけで動く。
// ページ・JS・画像・GLB・音声が、ドメイン直下（/assets/...）ではなく /chikipiyo-life-web/ の下から読まれること。
import {test,expect} from '@playwright/test';
import {PAGES,watchPage,expectClean,waitForHouse,waitForRiver} from './helpers.js';

const BASE='/chikipiyo-life-web/';

for(const p of PAGES){
 test(`${p.id}: サブパスで読み込める`,async({page})=>{
  watchPage(page);
  const outside=[];
  page.on('request',r=>{const u=new URL(r.url());if(u.hostname==='127.0.0.1'&&!u.pathname.startsWith(BASE))outside.push(u.pathname);});
  await page.goto(p.path);
  await expect(page).toHaveTitle(p.title);
  if(p.id==='house')await waitForHouse(page);
  if(p.id==='river')await waitForRiver(page);
  if(p.id==='okoshi')await expect(page.frameLocator('.ok-frame iframe').locator('canvas').first()).toBeAttached({timeout:60_000});
  await page.waitForTimeout(1_500);
  expect(outside,'サブパスの外（/assets/... など）を読みにいっていない').toEqual([]);
  // ナビのリンクもサブパスの下を向いている
  for(const href of await page.locator('nav.site-nav a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))))expect(href.startsWith(BASE)).toBe(true);
  expectClean(page);
 });
}
