// 渓流スマホAR（静止・試作）の設定。capture.mjs・build-page.js・preview で共有
// 渓流の世界は 1単位＝1m（ちきん 1.42m・川幅 約12m）。AR（Scene Viewer / Quick Look）も 1単位＝1m の実寸で置くので、縮小率をモデルに焼き込む
export const RIVER_AR={
 scale:1/6,                                  // 1/6：川幅 約2m・ちきん 約24cm・テント 約60cm
 crop:{x0:-4,x1:15.5,z0:57,z1:84},           // 切り出し（渓流の座標、m）：左岸の坂〜対岸の岸 19.5m × 流れ方向 27m
 corner:1.6,                                 // 切り出しの角の丸み（m）。四角い台座に見せないため
 edgeWobble:.35,                             // 切り口の輪郭の揺らぎ（m）
 season:'summer',camp:true,
 captureUrl:'river.html?still&camp=1&season=summer',
 terrainTex:2048,                            // 地面テクスチャ（真上から焼く）の解像度
 files:{glb:'assets/ar/chikipiyo-river-camp.glb',usdz:'assets/ar/chikipiyo-river-camp.usdz'},   // v0.1（iPhone 実機確認済み 2026-09-29）。build.mjs は既定でここへ書かない
};
