// E2E テスト（Playwright）の設定。くわしくは docs/notes/test-plan.md。
// ビルド済みのサイト（npm run build → vite preview）に対して動かす。
//   :4173  … ふつうのビルド（ローカルの npm run preview と同じ）
//   :4174  … GitHub Pages と同じサブパス（--base /chikipiyo-life-web/）のビルド
import {defineConfig,devices} from '@playwright/test';

const ROOT_PORT=4173,PAGES_PORT=4174;
export const PAGES_BASE='/chikipiyo-life-web/';
// WebGL を GPU なし（CI・ヘッドレス）でも動かすためのソフトウェア描画（SwiftShader）
const webglArgs=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const ci=!!process.env.CI;

export default defineConfig({
 testDir:'./e2e',
 testMatch:'**/*.spec.js',
 // ソフトウェア描画は重いので、余裕をもたせる
 timeout:120_000,
 expect:{timeout:30_000,toHaveScreenshot:{maxDiffPixelRatio:.02,threshold:.2,animations:'disabled',caret:'hide'}},
 fullyParallel:true,
 workers:ci?2:3,
 retries:ci?1:0,
 forbidOnly:ci,
 reporter:ci?[['list'],['html',{open:'never'}]]:[['list']],
 // スクリーンショットの基準画像は e2e/__screenshots__/ に置く
 snapshotPathTemplate:'{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
 use:{
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
  launchOptions:{args:webglArgs},
 },
 projects:[
  {name:'desktop',testIgnore:['**/pages-subpath.spec.js','**/perf.spec.js'],use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800},baseURL:`http://127.0.0.1:${ROOT_PORT}/`}},
  // スマホ：Pixel 7 の画面幅・タッチ・UA。画素密度だけ 1 にする（ソフトウェア描画で 1 フレーム数秒かかるのを避ける）
  {name:'mobile',testIgnore:['**/pages-subpath.spec.js','**/perf.spec.js'],use:{...devices['Pixel 7'],deviceScaleFactor:1,baseURL:`http://127.0.0.1:${ROOT_PORT}/`}},
  // 性能の記録：ほかのテストと同時に動くと CPU を取りあって数字がくるうので、全部が終わってから動かす
  {name:'perf',testMatch:'**/perf.spec.js',dependencies:['desktop','mobile','pages-subpath'],use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800},baseURL:`http://127.0.0.1:${ROOT_PORT}/`}},
  {name:'pages-subpath',testMatch:'**/pages-subpath.spec.js',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800},baseURL:`http://127.0.0.1:${PAGES_PORT}${PAGES_BASE}`}},
 ],
 webServer:[
  {
   command:`npm run build && npm run preview -- --port ${ROOT_PORT} --strictPort`,
   url:`http://127.0.0.1:${ROOT_PORT}/`,
   reuseExistingServer:!ci,timeout:180_000,stdout:'ignore',stderr:'pipe',
  },
  {
   command:`npx vite build --base ${PAGES_BASE} --outDir dist-pages && npx vite preview --host 127.0.0.1 --base ${PAGES_BASE} --outDir dist-pages --port ${PAGES_PORT} --strictPort`,
   url:`http://127.0.0.1:${PAGES_PORT}${PAGES_BASE}`,
   reuseExistingServer:!ci,timeout:180_000,stdout:'ignore',stderr:'pipe',
  },
 ],
});
