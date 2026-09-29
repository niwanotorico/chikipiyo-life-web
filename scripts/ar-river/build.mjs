// 渓流AR（静止・試作）の書き出し：capture.json → assets/ar/chikipiyo-river-camp.glb / .usdz
//   node scripts/ar-river/capture.mjs   （先に取り込み）
//   node scripts/ar-river/build.mjs
// 組み立て自体は build-page.js（ブラウザの中）。テクスチャの書き出し（canvas）が要るのでヘッドレス Chromium で動かす
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {serve} from './serve.mjs';
import {RIVER_AR} from './config.js';
const root=new URL('../../',import.meta.url).pathname;
const work=process.env.AR_RIVER_WORK||root+'model-work/ar-river';
const params=process.env.AR_PARAMS?JSON.parse(process.env.AR_PARAMS):{};
const server=await serve(root);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
page.on('console',m=>{if(m.type()==='error')console.log('[page]',m.text());});
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto(server.url+'scripts/ar-river/build.html');
await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
const capture=readFileSync(work+'/capture.json','utf8');
const png='data:image/png;base64,'+readFileSync(work+'/terrain-albedo.png').toString('base64');
const res=await page.evaluate(async({capture,png,params})=>{
 const img=new Image();img.src=png;await img.decode();
 const r=await window.buildRiverAR({capture:JSON.parse(capture),terrainImage:img,params});
 const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
 return {glb:b64(r.glb),usdz:b64(r.usdz),stats:r.stats,transform:r.transform};
},{capture,png,params});
// 既定では model-work/ar-river/out/ へ書き出す（実機確認済みの v0.1＝assets/ar のファイルを上書きしない）。
// 公開用に差し替えるときだけ AR_RIVER_PUBLISH=1（tests/ar-river.test.js の指紋も更新すること）
const out=process.env.AR_RIVER_OUT||(process.env.AR_RIVER_PUBLISH==='1'?'':'model-work/ar-river/out/chikipiyo-river-camp');
const glbPath=root+(out?out+'.glb':RIVER_AR.files.glb),usdzPath=root+(out?out+'.usdz':RIVER_AR.files.usdz);
mkdirSync(dirname(glbPath),{recursive:true});
const glb=Buffer.from(res.glb,'base64'),usdz=Buffer.from(res.usdz,'base64');
writeFileSync(glbPath,glb);writeFileSync(usdzPath,usdz);
writeFileSync(work+'/build-stats.json',JSON.stringify({...res.stats,transform:res.transform,glbBytes:glb.length,usdzBytes:usdz.length},null,1));
console.log(JSON.stringify(res.stats,null,1));
console.log(`glb ${(glb.length/1048576).toFixed(2)} MB → ${glbPath}\nusdz ${(usdz.length/1048576).toFixed(2)} MB → ${usdzPath}`);
await browser.close();await server.close();
