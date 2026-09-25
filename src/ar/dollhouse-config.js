// AR ドールハウスの設定（src/ar と scripts/build-ar-dollhouse.mjs、テストで共有）。
// Scene Viewer / Quick Look はモデルを「1単位＝1m」の実寸で置くので、家は AR 用 GLB の中で縮めておく。
export const DOLLHOUSE_WIDTH=.40;          // 初期の幅（m）。置いた後はピンチで拡大縮小できる
export const DOLLHOUSE_FILE='assets/ar/chikipiyo-dollhouse.glb';
// AR に入れないもの：寝ている時だけ見える布団（通常は非表示）。
// 空・背景色・霧・地面（y=-.48 の大きな板）は main.js 側で作っているので、元々 GLB には入っていない。
export const DOLLHOUSE_EXCLUDE_PARTS=['Blanket_in_use'];

// <model-viewer>（Google）の three.js 同梱版。アプリ本体の three（0.180）とは別物なので npm には入れず、
// 「ARで召喚」を押した時だけ読み込む（PC・スマホ・VR の通常表示には一切影響しない）。上から順に試す
export const MODEL_VIEWER_VERSION='4.1.0';
export const MODEL_VIEWER_SOURCES=[
 `https://ajax.googleapis.com/ajax/libs/model-viewer/${MODEL_VIEWER_VERSION}/model-viewer.min.js`,
 `https://cdn.jsdelivr.net/npm/@google/model-viewer@${MODEL_VIEWER_VERSION}/dist/model-viewer.min.js`,
 `https://unpkg.com/@google/model-viewer@${MODEL_VIEWER_VERSION}/dist/model-viewer.min.js`,
];

// <model-viewer> に渡す属性。
//  ar-modes   … Android は Scene Viewer、iPhone は Quick Look（USDZ は model-viewer がその場で変換）
//  ar-scale   … auto＝置いた後にピンチで拡大縮小できる（初期は GLB の実寸＝幅40cm）
//  ar-placement … floor＝床や机など水平な面に置く
export function modelViewerAttributes(src){
 return {
  src,ar:'','ar-modes':'scene-viewer quick-look','ar-scale':'auto','ar-placement':'floor',
  'camera-controls':'','touch-action':'pan-y','camera-orbit':'-25deg 62deg auto','shadow-intensity':'1','shadow-softness':'.8',
  exposure:'1.05','interaction-prompt':'none',alt:'ちきん・ぴよきち・ぴよみの3Dプリントハウス（ドールハウス）',
 };
}
