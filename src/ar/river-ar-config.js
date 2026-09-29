// 渓流のスマホAR（静止・v0.1）の設定。src/ar/ar-river.js・scripts/ar-river・テストで共有。
// v0.1 = 2026-09-29 に iPhone 実機（Quick Look）で床に置けることを確認したファイル。作り直すときは別名で書き出して比べる（scripts/ar-river/build.mjs）
export const RIVER_AR_VERSION='v0.1';
export const RIVER_AR_FILES={
 glb:'assets/ar/chikipiyo-river-camp.glb',              // Android：Scene Viewer
 usdz:'assets/ar/chikipiyo-river-camp.usdz',            // iPhone / iPad：Quick Look
 poster:'assets/ar/chikipiyo-river-camp-poster.jpg',    // シートの絵（iPhone では <a rel="ar"> の中の img）
};
// 実機確認済みファイルの指紋（うっかり上書きしたらテストで気づけるように）
export const RIVER_AR_SHA256={
 glb:'a9afc1c1f7af066e53f27a1c92f5c0f8cbb2784cefe28063692eb94124f7223b',
 usdz:'89a67af3af8ec5fe74377732101d4d21836c8a0e1f42eb7dbdb253dc191bf40b',
};
export const RIVER_AR_SIZE={width:3.4,depth:4.6,scale:'1/6',usdzMB:10};   // AR 上の大きさ（m）・案内用の容量

// Android の Scene Viewer を直接開く intent（model-viewer を読み込まずに済む）。
// ar_preferred：AR が使えない端末では 3D ビューアで開く。resizable：置いた後にピンチで拡大縮小
export function sceneViewerIntent(glbAbsUrl,fallbackUrl,title='ちきぴよ渓流'){
 const q=`file=${encodeURIComponent(glbAbsUrl)}&mode=ar_preferred&resizable=true&title=${encodeURIComponent(title)}`;
 return `intent://arvr.google.com/scene-viewer/1.2?${q}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
}
// どの AR を出すか：iPhone / iPad Safari（<a rel="ar"> が使える）→ quicklook、Android → sceneviewer、それ以外（PC）→ none
export function arPlatform({relArSupported=false,userAgent=''}={}){
 if(relArSupported)return 'quicklook';
 if(/Android/i.test(userAgent))return 'sceneviewer';
 return 'none';
}
