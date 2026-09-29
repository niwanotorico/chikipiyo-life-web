// PC で開くだけで見られる確認ページ（GLB を埋め込んだ 1 ファイル。<model-viewer> は CDN から読む）
//   node scripts/ar-river/preview-html.mjs [出力先]  → 既定：Claude outputs/river-ar-preview.html
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {RIVER_AR} from './config.js';
const root=new URL('../../',import.meta.url).pathname;
const out=process.argv[2]||root+'Claude outputs/river-ar-preview.html';
const glb=readFileSync(root+RIVER_AR.files.glb),stats=JSON.parse(readFileSync((process.env.AR_RIVER_WORK||root+'model-work/ar-river')+'/build-stats.json'));
const views=JSON.parse(readFileSync(new URL('./preview-views.json',import.meta.url)));
const orbit=v=>{const d=v.pos.map((p,i)=>p-v.at[i]),r=Math.hypot(...d);return {orbit:`${(Math.atan2(d[0],d[2])*180/Math.PI).toFixed(1)}deg ${(Math.acos(d[1]/r)*180/Math.PI).toFixed(1)}deg ${r.toFixed(3)}m`,target:v.at.map(x=>x.toFixed(3)+'m').join(' '),fov:(v.fov||50)+'deg'};};
const names={'1-overview':'全景','2-anglers-river':'3人＋川','3-camp':'キャンプ','4-tent-window':'テントの窓','5-river-low':'低い位置の川'};
const s=stats.sizeAR,mb=b=>(b/1048576).toFixed(2);
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ちきぴよ渓流AR 試作プレビュー</title>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js" onerror="this.remove();const s=document.createElement('script');s.type='module';s.src='https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js';document.head.appendChild(s)"></script>
<style>
:root{--bg:#f3efe7;--ink:#2f2a22;--muted:#7a7263;--card:#fffdf8;--line:#e2dacb;--accent:#2f8f86}
@media (prefers-color-scheme:dark){:root{--bg:#1d1b18;--ink:#eee7da;--muted:#a79f90;--card:#26231f;--line:#3a352e;--accent:#58c2b6}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif}
header{padding:18px 20px 6px}h1{font-size:20px;margin:0}header p{margin:4px 0 0;color:var(--muted)}
main{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;padding:12px 20px 24px}
@media (max-width:860px){main{grid-template-columns:1fr}}
model-viewer{width:100%;height:min(72vh,720px);background:linear-gradient(#ebe5da,#d9cfbe);border-radius:14px;border:1px solid var(--line)}
.views{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.views button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer}
.views button:hover{border-color:var(--accent)}
aside{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}aside h2{font-size:15px;margin:0 0 6px}
dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0 0 12px}dt{color:var(--muted)}dd{margin:0;font-variant-numeric:tabular-nums}
.note{font-size:13px;color:var(--muted)}
</style></head><body>
<header><h1>ちきぴよ渓流AR 試作（静止・1/6・キャンプあり・夏）</h1><p>ドラッグで回転、ホイールで拡大。下のボタンで確認用の視点へ移動します。</p></header>
<main><section>
<model-viewer id="mv" alt="ちきぴよ渓流の一角（3人の釣りとキャンプ）" camera-controls touch-action="pan-y" shadow-intensity="1" shadow-softness=".8" exposure="1" environment-image="neutral" interaction-prompt="none" min-camera-orbit="auto auto 0.05m" max-camera-orbit="auto auto 12m" camera-orbit="${orbit(views[0]).orbit}" camera-target="${orbit(views[0]).target}" field-of-view="${orbit(views[0]).fov}"></model-viewer>
<div class="views">${views.map(v=>{const o=orbit(v);return `<button data-orbit="${o.orbit}" data-target="${o.target}" data-fov="${o.fov}">${names[v.id]||v.id}</button>`;}).join('')}</div>
</section><aside>
<h2>AR 上の大きさ</h2><dl><dt>幅</dt><dd>${s.x.toFixed(2)} m</dd><dt>奥行き</dt><dd>${s.z.toFixed(2)} m</dd><dt>高さ</dt><dd>${s.y.toFixed(2)} m（木の先まで）</dd><dt>縮尺</dt><dd>1/6（川幅 約2m・ちきん 約24cm）</dd></dl>
<h2>データ</h2><dl><dt>三角形</dt><dd>${stats.trianglesTotal.toLocaleString()}</dd><dt>マテリアル</dt><dd>${stats.materials}</dd><dt>テクスチャ</dt><dd>${stats.textures.length}（${stats.textures.join(' / ')}）</dd><dt>GLB</dt><dd>${mb(stats.glbBytes)} MB</dd><dt>USDZ</dt><dd>${mb(stats.usdzBytes)} MB</dd></dl>
<p class="note">このページは Android 用 GLB を PC で表示しています。iPhone の Quick Look（USDZ）での見え方・床への置き方は実機で確認してください。</p>
</aside></main>
<script>
const b64="${glb.toString('base64')}";
const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
const mv=document.getElementById('mv');mv.src=URL.createObjectURL(new Blob([bin],{type:'model/gltf-binary'}));
document.querySelectorAll('.views button').forEach(b=>b.onclick=()=>{mv.cameraTarget=b.dataset.target;mv.cameraOrbit=b.dataset.orbit;mv.fieldOfView=b.dataset.fov;});
</script></body></html>`;
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,html);console.log(out,(html.length/1048576).toFixed(2)+' MB');
