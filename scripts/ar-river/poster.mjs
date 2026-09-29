// AR シート用の絵（assets/ar/chikipiyo-river-camp-poster.jpg・640×448）。3DPハウスの動くARの絵と同じ大きさ・背景
//   node scripts/ar-river/poster.mjs
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {serve} from './serve.mjs';
import {RIVER_AR_FILES} from '../../src/ar/river-ar-config.js';
const root=new URL('../../',import.meta.url).pathname;
const server=await serve(root);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.goto(server.url+'scripts/ar-river/preview.html');await page.waitForFunction(()=>window.__ready);
const [img]=await page.evaluate(({url})=>window.renderViews(url,[{pos:[1.55,1.25,1.7],at:[-0.62,.36,-0.05],fov:40}],1280,896,{bg:0xeeeeee,floor:false,outW:640,outH:448}),{url:'/'+RIVER_AR_FILES.glb});
const buf=Buffer.from(img.split(',')[1],'base64');writeFileSync(root+RIVER_AR_FILES.poster,buf);console.log(RIVER_AR_FILES.poster,buf.length);
await browser.close();await server.close();
