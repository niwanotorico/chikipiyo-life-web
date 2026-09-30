// ピヨドリル（drill.html）のブラウザ確認：スマホ幅で主要ボタンが画面内に収まるか、
// 1回あそんで結果・二重加算防止まで通るか、PC／スマホのスクリーンショットを撮る。
// サーバーは立てず、Playwright の route でプロジェクトのファイルをそのまま返す。
//   node scripts/drill-layout-check.mjs [出力フォルダ]
// 必要：playwright（NODE_PATH で見つかる場所）と Chromium
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {extname,join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');

const root=resolve(import.meta.dirname,'..');
const out=resolve(process.argv[2]??join(root,'Claude outputs','drill-shots'));
mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const ORIGIN='http://drill.local';
const problems=[];
const check=(cond,msg)=>{if(!cond)problems.push(msg);console.log(`${cond?'ok  ':'NG  '} ${msg}`);};

// 画面の式（aria-label）から答えを計算（たし算・ひき算・かけ算・わり算・小数）
function solve(text){
 const m=text.match(/^([\d.]+) ([+−×÷]) ([\d.]+) = □$/);
 if(!m)return null;
 const t=s=>{const [w,f='']=s.split('.');return Number(w)*10+Number(f||0);},A=t(m[1]),B=t(m[3]);
 const r={'+':A+B,'−':A-B,'×':A*B/10,'÷':A/(B/10)}[m[2]];
 return r%10===0?String(r/10):`${Math.floor(r/10)}.${r%10}`;
}

async function inView(page,selector,label){
 const res=await page.$$eval(selector,(els)=>els.filter(e=>e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};}));
 const vw=await page.evaluate(()=>[innerWidth,innerHeight]);
 const bad=res.filter(r=>r.l<0||r.r>vw[0]+.5||r.t<0||r.b>vw[1]+.5);
 check(res.length>0&&bad.length===0,`${label}: ${selector} ${res.length}個が画面内（${vw[0]}×${vw[1]}）`);
}
async function noHScroll(page,label){
 const [sw,iw]=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
 check(sw<=iw,`${label}: 横スクロールなし（${sw}≤${iw}）`);
}

async function run(browser,{name,width,height,player,shots,reducedMotion='no-preference',egg=false}){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:width<700,isMobile:width<700,locale:'ja-JP',reducedMotion});
 await ctx.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==ORIGIN)return route.abort();
  const file=join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!existsSync(file))return route.fulfill({status:404,body:'not found'});
  route.fulfill({status:200,contentType:types[extname(file)]??'application/octet-stream',body:readFileSync(file)});
 });
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message);});
 await page.goto(`${ORIGIN}/drill.html?debug=1${egg?'&egg=1':'&egg=0'}`);
 await page.waitForSelector('[data-screen="home"]:not([hidden])');
 await noHScroll(page,`${name} ホーム`);
 await inView(page,'.dq-player',`${name} ホーム`);
 await page.click(`.dq-player.is-${player}`);
 await inView(page,'[data-start]',`${name} ホーム`);
 await page.evaluate(()=>document.fonts.ready);
 if(shots)await page.screenshot({path:join(out,`${name}-1-home.png`),fullPage:true});
 await page.click('[data-start]');
 await page.waitForSelector('[data-screen="play"]:not([hidden])');
 await noHScroll(page,`${name} もんだい`);
 await inView(page,'[data-pad] button',`${name} もんだい`);
 await inView(page,'[data-submit]',`${name} もんだい`);
 await inView(page,'[data-quit]',`${name} もんだい`);
 await inView(page,'.dq-bar [data-sound]',`${name} もんだい（おとボタン）`);
 let pts=0,eggSeen=false,duoSeen=false;
 const D=f=>page.evaluate(f);
 // キャラの舞台は回答欄より下（回答欄を隠さない）
 {const r=await D(()=>{const a=document.querySelector('[data-readout]').getBoundingClientRect(),m=document.querySelector('.dq-actor-move').getBoundingClientRect(),p=document.querySelector('[data-pad]').getBoundingClientRect();return {ro:a.bottom,top:m.top,bottom:m.bottom,pad:p.top};});check(r.top>=r.ro-1&&r.bottom<=r.pad+1,`${name} キャラの舞台は回答欄とテンキーの間 ${JSON.stringify(r)}`);}

 for(let i=0;i<10;i++){
  const text=await page.getAttribute('[data-question]','aria-label');
  const ans=solve(text);
  const wrong=i===3||ans===null;
  const input=wrong?(ans==null?'99999':ans==='1'?'2':'1'):ans;  // 計算できない問題（分数・文章題）はありえない数で「まちがい」にする
  if(i%2===0)await page.keyboard.type(input);   // キーボード
  else for(const ch of input)await page.click(`[data-key="${ch}"]`); // タップ
  if(i===0&&shots)await page.screenshot({path:join(out,`${name}-2-question.png`)});
  await page.keyboard.press('Enter');
  await page.waitForSelector(wrong?'[data-card].is-miss':'[data-card].is-ok');
  if(!wrong)pts++;
  {const img=await D(()=>__drill.stageImg()),kind=await D(()=>__drill.stageKind());
   const eggNow=egg&&!wrong&&!eggSeen&&await D(()=>__drill.eggs())===1;
   if(eggNow){eggSeen=true;check(true,`${name} ?egg=1 で目玉焼き`);if(shots){await page.waitForTimeout(reducedMotion==='reduce'?300:520);await page.screenshot({path:join(out,`${name}-egg.png`)});}
    await page.waitForTimeout(1700);check(await D(()=>__drill.eggs())===0,`${name} 目玉焼きの要素が片づく`);}
   else if(wrong)check(/-wrong\.png/.test(img),`${name} ${i+1}問目 まちがいは専用の絵 ${img.split('/').pop()}`);
   else{const duo=/_duo/.test(img);if(duo)duoSeen=true;
    check(/(dance0|spin|hands_up|headphones|dj|_duo)/.test(img)&&!/-wrong/.test(img),`${name} ${i+1}問目 正解の絵 ${img.split('/').pop()} ${kind}`);
    const combo=Number(await page.textContent('[data-combo]'));
    if(i<9)check(duo===(combo===5||combo===8),`${name} 2人は節目だけ（コンボ${combo}）`);
    if(player==='piyokichi'&&!duo)check(/(dance01|spin)/.test(img),`${name} ぴよきちの絵`);
    if(player==='piyomi'&&!duo)check(/(dance02|hands_up|headphones|dj)/.test(img),`${name} ぴよみの絵`);}
   const p1=await D(()=>{const p=document.querySelector('[data-pad]');return p.getBoundingClientRect().top+'|'+p.getAnimations().length+'|'+getComputedStyle(p).transform;});
   await page.waitForTimeout(120);
   const p2=await D(()=>{const p=document.querySelector('[data-pad]');return p.getBoundingClientRect().top+'|'+p.getAnimations().length+'|'+getComputedStyle(p).transform;});
   if(i===2||i===8)check(p1===p2&&/\|0\|none$/.test(p1),`${name} テンキーは揺れない ${p1}`);
  }
  if(shots&&(i===2||i===3))await page.waitForTimeout(350);
  if(shots&&i===2)await page.screenshot({path:join(out,`${name}-3-correct-combo.png`)});
  if(shots&&i===3)await page.screenshot({path:join(out,`${name}-4-miss.png`)});
  if(i===9&&!wrong){await page.waitForSelector('[data-fever]:not([hidden])');check(true,`${name} プリンフィーバー表示`);if(shots){await page.waitForTimeout(2300);await page.screenshot({path:join(out,`${name}-4b-fever.png`)});}}
  if(i===3){check(/だいじょうぶ|おしい/.test(await page.textContent('[data-react-line]')),`${name} まちがいは責めない言い方`);check(await page.textContent('[data-combo]')==='0',`${name} まちがいでコンボ0`);}
  await page.keyboard.press('Enter');
 }
 await page.waitForSelector('[data-screen="result"]:not([hidden])');
 await page.waitForTimeout(250);
 {const left=await D(()=>({t:__drill.timers(),a:__drill.actorTimers(),b:__drill.actorBusy(),e:__drill.eggs(),f:__drill.flies()}));check(left.t===0&&left.a===0&&!left.b&&left.e===0&&left.f===0,`${name} 結果画面でタイマー・演出の残りなし ${JSON.stringify(left)}`);}
 if(egg)check(eggSeen,`${name} 1プレイで目玉焼きを見た`);
 await noHScroll(page,`${name} けっか`);
 await inView(page,'.dq-actions .dq-btn',`${name} けっか`);
 const got=Number(await page.textContent('[data-r="points"]'));
 check(got>0,`${name} けっか ${await page.textContent('[data-r="correct"]')}/10・${got}pt`);
 check(await page.isVisible('[data-reward].is-new'),`${name} はじめてのプリン`);
 if(shots)await page.screenshot({path:join(out,`${name}-5-result.png`),fullPage:true});
 await page.click('[data-display]');
 check(await page.isDisabled('[data-display]'),`${name} おうちにかざる → 保存`);
 // 更新しても再加算されない
 const before=await page.evaluate(()=>localStorage.getItem('chikipiyo-quest:v1'));
 await page.reload();
 await page.waitForSelector('[data-screen="home"]:not([hidden])');
 const after=await page.evaluate(()=>localStorage.getItem('chikipiyo-quest:v1'));
 check(before===after,`${name} 更新しても記録が変わらない`);
 check(Number(await page.textContent(`[data-points="${player}"]`))===got,`${name} ホームのポイント=${got}`);
 check(/クリア/.test(await page.textContent(`[data-today="${player}"]`)),`${name} きょうはクリア表示`);
 if(shots)await page.screenshot({path:join(out,`${name}-6-home-after.png`),fullPage:true});
 // おとボタン：ミュートが保存される
 await page.click('.dq-top [data-sound]');
 await page.reload();await page.waitForSelector('[data-screen="home"]:not([hidden])');
 check(await page.getAttribute('.dq-top [data-sound]','aria-pressed')==='false',`${name} ミュートが保存される`);
 await page.click('.dq-top [data-sound]');
 // 壊れた保存データでも開ける
 await page.evaluate(()=>localStorage.setItem('chikipiyo-quest:v1','{broken'));
 await page.reload();
 await page.waitForSelector('[data-screen="home"]:not([hidden])');
 check(await page.isVisible('[data-notice]'),`${name} 壊れたデータ → お知らせを出して復帰`);
 check(errors.length===0,`${name} ページのエラーなし ${errors.join(' / ')}`);
 await ctx.close();
}

const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
for(const cfg of [
 {name:'sp375',width:375,height:667,player:'piyomi',shots:true,egg:true},
 {name:'sp360',width:360,height:640,player:'piyomi',shots:false},
 {name:'sp390',width:390,height:844,player:'piyokichi',shots:true},
 {name:'pc',width:1280,height:800,player:'piyokichi',shots:true},
 {name:'sp375-reduced',width:375,height:667,player:'piyomi',shots:false,reducedMotion:'reduce',egg:true},
 {name:'sp375-kichi',width:375,height:667,player:'piyokichi',shots:true},
])await run(browser,cfg);
await browser.close();
console.log(problems.length?`\nNG ${problems.length}件`:'\nすべてOK');
process.exit(problems.length?1:0);
