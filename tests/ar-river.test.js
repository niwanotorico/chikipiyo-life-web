// 渓流AR（静止・試作）：書き出したファイルの形と大きさの確認（中身の見た目は実機・プレビューで確認）
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {RIVER_AR} from '../scripts/ar-river/config.js';
const root=new URL('../',import.meta.url);
test('river AR config: 1/6, camp, summer, crop about 19.5m x 27m',()=>{
 assert.equal(RIVER_AR.scale,1/6);assert.equal(RIVER_AR.camp,true);assert.equal(RIVER_AR.season,'summer');
 assert.equal(RIVER_AR.crop.x1-RIVER_AR.crop.x0,19.5);assert.equal(RIVER_AR.crop.z1-RIVER_AR.crop.z0,27);
});
test('river AR GLB: valid glTF binary, within the prototype budget',{skip:!existsSync(new URL(RIVER_AR.files.glb,root))},()=>{
 const b=readFileSync(new URL(RIVER_AR.files.glb,root));
 assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);
 assert.ok(b.length<6.5*1048576,`glb ${b.length}`);
 const json=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 assert.ok(json.materials.length<=40,`materials ${json.materials.length}`);
 assert.ok(json.images.length<=6,`images ${json.images.length}`);
});
test('river AR USDZ: model.usda first, 64-byte aligned, within the prototype budget',{skip:!existsSync(new URL(RIVER_AR.files.usdz,root))},()=>{
 const b=readFileSync(new URL(RIVER_AR.files.usdz,root));
 assert.equal(b.readUInt32LE(0),0x04034b50);
 const nameLen=b.readUInt16LE(26),extraLen=b.readUInt16LE(28);
 assert.equal(b.toString('utf8',30,30+nameLen),'model.usda');
 assert.equal((30+nameLen+extraLen)%64,0);
 assert.ok(b.length<11*1048576,`usdz ${b.length}`);
});

// ── v0.1（2026-09-29 iPhone 実機で床に置けた）を壊さない ──
import {createHash} from 'node:crypto';
import {RIVER_AR_FILES,RIVER_AR_SHA256,RIVER_AR_VERSION,sceneViewerIntent,arPlatform} from '../src/ar/river-ar-config.js';
test('river AR v0.1 files are the ones confirmed on iPhone (fingerprint)',()=>{
 assert.equal(RIVER_AR_VERSION,'v0.1');
 for(const k of ['glb','usdz']){
  const h=createHash('sha256').update(readFileSync(new URL(RIVER_AR_FILES[k],root))).digest('hex');
  assert.equal(h,RIVER_AR_SHA256[k],`${RIVER_AR_FILES[k]} changed — rebuilds go to model-work/ar-river/out unless AR_RIVER_PUBLISH=1`);
 }
 assert.deepEqual([RIVER_AR.files.glb,RIVER_AR.files.usdz],[RIVER_AR_FILES.glb,RIVER_AR_FILES.usdz]);
 const poster=readFileSync(new URL(RIVER_AR_FILES.poster,root));assert.equal(poster[0],0xff);assert.equal(poster[1],0xd8);
});
test('river AR entry: iPhone → Quick Look, Android → Scene Viewer, PC → none',()=>{
 assert.equal(arPlatform({relArSupported:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}),'quicklook');
 assert.equal(arPlatform({relArSupported:false,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8)'}),'sceneviewer');
 assert.equal(arPlatform({relArSupported:false,userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}),'none');
 const u=sceneViewerIntent('https://example.com/a/b.glb','https://example.com/river.html');
 assert.ok(u.startsWith('intent://arvr.google.com/scene-viewer/1.2?file=https%3A%2F%2Fexample.com%2Fa%2Fb.glb&mode=ar_preferred'));
 assert.ok(u.includes('package=com.google.android.googlequicksearchbox')&&u.includes('S.browser_fallback_url=https%3A%2F%2Fexample.com%2Friver.html')&&u.endsWith(';end;'));
});
test('river page mounts the 📦 AR button in its top bar',()=>{
 const main=readFileSync(new URL('src/river/main.js',root),'utf8');
 assert.match(main,/import \{mountRiverAR\} from '\.\.\/ar\/ar-river\.js'/);assert.match(main,/mountRiverAR\(topbar\)/);
 const js=readFileSync(new URL('src/ar/ar-river.js',root),'utf8');
 assert.match(js,/chikipiyo-river-camp\.usdz\?url/);assert.match(js,/chikipiyo-river-camp\.glb\?url/);assert.match(js,/rel="ar"/);
});
