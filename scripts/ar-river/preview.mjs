// 確認用の静止画（全景・3人と川・キャンプ・テント窓・低い位置の川）を model-work/ar-river/preview-*.jpg に書き出す
import {chromium} from 'playwright';
import {writeFileSync,readFileSync} from 'node:fs';
import {serve} from './serve.mjs';
import {RIVER_AR} from './config.js';
const root=new URL('../../',import.meta.url).pathname,work=process.env.AR_RIVER_WORK||root+'model-work/ar-river';
const glb=process.env.AR_RIVER_GLB||RIVER_AR.files.glb;
const VIEWS=JSON.parse(readFileSync(new URL('./preview-views.json',import.meta.url)));
const only=process.env.VIEWS?process.env.VIEWS.split(','):null;
const server=await serve(root);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto(server.url+'scripts/ar-river/preview.html');await page.waitForFunction(()=>window.__ready);
const views=VIEWS.filter(v=>!only||only.includes(v.id));
const imgs=await page.evaluate(({url,views})=>window.renderViews(url,views),{url:'/'+glb,views});
imgs.forEach((d,i)=>{const f=`${work}/preview-${views[i].id}.jpg`;writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));console.log(f);});
await browser.close();await server.close();
