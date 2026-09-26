// 動くAR箱庭（アニメ付き USDZ・iPhone Quick Look 用）の設定。
// scripts/build-ar-anim-usdz.mjs・src/ar/ar-dollhouse.js・テストで共有。静止AR版（dollhouse-config.js）とは別ファイル。
// 色補正はしない（AR 環境光の影響が大きく、素材側の軽い補正では効果が小さかった）。質感だけマット寄りにする（MATTE）。
export const ANIM_USDZ_FILE='assets/ar/chikipiyo-dollhouse-anim.usdz';          // 本番：3人の日常＋プリン、マット調整済み
export const ANIM_POSTER_FILE='assets/ar/chikipiyo-dollhouse-anim-poster.jpg';  // iPhone の「動くAR」リンクに使う画像
export const ANIM_FPS=24;
export const ANIM_SEED=20260926;       // 生活シミュレーションの乱数を固定して、毎回同じ「一日」を記録する
export const ANIM_CROSSFADE=1.2;       // ループ最後の数秒で、最初のポーズへなめらかにつなぐ（秒）
export const ANIM_MAX_SECONDS=60;

// 3人の日常（アプリと同じ LifeSimulation を「監督」が順番に動かす）。
// 全員が開始位置から出発して、ソファで並んでのんびりし、また開始位置へ戻って前を向く → そこで一周。
//   wait：その場でひとやすみ（秒）／go：家具へ（アプリと同じ command）／home：開始位置へ歩いて戻る（moveTo）
export const DAILY_SCRIPT={
 piyo:  [{wait:.6},{go:'sofa'},{home:true}],
 chiki: [{wait:2.2},{go:'sofa'},{home:true}],
 piyomi:[{wait:3.8},{go:'sofa'},{home:true}],
};
export const HOME_YAW=0;               // 開始時の向き（createCharacter の既定と同じ）

// 決まった種から同じ乱数列を作る（mulberry32）
export function seededRandom(seed=ANIM_SEED){
 let a=seed>>>0;
 return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

// プリン：2秒ごとに「ぷるん」→減衰。底を支点に縦に伸び縮み＋少し傾く。ループ長は2秒の倍数にそろえる
export const PUDDING_PERIOD=2;
export function puddingJiggle(t,period=PUDDING_PERIOD){
 const u=((t%period)+period)%period,decay=Math.exp(-2.8*u),a=decay*Math.sin(Math.PI*2*3.2*u);
 return {sy:1+.16*a,sx:1-.08*a,rx:.04*decay*Math.sin(Math.PI*2*2.4*u),rz:.06*decay*Math.sin(Math.PI*2*2.1*u)};
}

// ループの長さ：全員が帰って落ち着いた時刻を、プリンの周期（2秒）の倍数に切り上げる
export const loopSeconds=(settled,period=PUDDING_PERIOD)=>Math.ceil(settled/period)*period;

// 最後の crossfade 秒で 0→1 になる重み（なめらかに）
export function crossfadeWeight(t,loop,fade=ANIM_CROSSFADE){
 const s=(t-(loop-fade))/fade;if(s<=0)return 0;if(s>=1)return 1;return s*s*(3-2*s);
}

// 時間サンプルを間引く：前後の残したサンプルの直線補間で誤差 eps 以内に収まるフレームは書かない
// （座っている間・待っている間など動きのない区間や、まっすぐ歩く区間が軽くなる）。先頭と末尾は必ず残す
export function reduceKeyframes(samples,eps=4e-4){
 const n=samples.length;if(n<=2)return samples.map((m,i)=>[i,m]);
 const keep=[0];let k=0;
 while(k<n-1){
  let j=k+1;
  while(j+1<n){
   const c=j+1;let ok=true;
   for(let f=k+1;f<c&&ok;f++){const w=(f-k)/(c-k);for(let e=0;e<samples[f].length;e++){if(Math.abs(samples[k][e]+(samples[c][e]-samples[k][e])*w-samples[f][e])>eps){ok=false;break;}}}
   if(!ok)break;j=c;
  }
  keep.push(j);k=j;
 }
 return keep.map(i=>[i,samples[i]]);
}

// ── 質感：マット調整（動き・大きさ・ループには関係しない。素材だけ）──
// Quick Look の AR は周りの明るさを映り込ませるので、ツヤ（roughness）を上げ、映り込みの強さ（ior）も下げて「てかてか」を抑える。
// 色は家まわりだけ少し彩度を落とす。キャラの顔・体の色はほぼそのまま（くすませない）。metallic は 0。
export const MATTE={
 ior:1.25,                       // 映り込みの強さ：既定 1.5（反射率 約4%）→ 1.25（約1.2%）。対応していない環境では無視されるだけ
 house:{roughness:.95,sat:.9,vividSat:.95,whiteLight:.97},   // 床・壁・家具・ソファ・キッチンなど：ほぼマット、彩度 −10%（鮮やかな色は −5%）、白は明度 −3%
 soft:{roughness:1},             // 白・ミント系（テカリが目立つ色）：完全マット
 character:{roughness:.85,sat:.97},  // キャラ：少しだけしっとり、彩度 −3%（顔の黒・くちばし・黄色は保つ）
 pudding:{roughness:.55},        // プリン：ぷるっと感を残すため少しだけツヤを残す（元 .5 前後）
};
const isMint=({h,s})=>h*360>=130&&h*360<=175&&s>=.08;
const isWhite=({s,l})=>s<.15&&l>.8;
// part: 'house' | 'character' | 'pudding'。戻り値は新しい {h,s,l,roughness,metalness}
export function matteMaterial({h,s,l,roughness=1},part='house',m=MATTE){
 if(part==='character')return {h,s:s*m.character.sat,l,roughness:Math.max(roughness,m.character.roughness),metalness:0};
 if(part==='pudding')return {h,s,l,roughness:Math.max(roughness,m.pudding.roughness),metalness:0};
 const soft=isMint({h,s})||isWhite({s,l});
 return {h,s:s*(s>=.8?m.house.vividSat:m.house.sat),l:isWhite({s,l})?l*m.house.whiteLight:l,
  roughness:Math.max(roughness,soft?m.soft.roughness:m.house.roughness),metalness:0};
}

// ── AR 近接品質の優先部品リスト ──
// ARでは箱庭にかなり近づいて見られるので、近くで見たくなる部品だけ間引きを弱める（それ以外は静止AR版と同じ軽量化のまま）。
// 対象の部品は、軽量化前の元データ（assets/room/human-room.glb）から ratio（残す三角形の割合。1＝間引かない）で作り直す。
//   furnitureId … room-layout と同じ家具ID（GLB の extras）
// 方針：全体は軽くし、実機で近づいて破綻が見えた部品だけここに足して救済する（2026-09-27 ソファを 60% で採用）。
// 候補：キャラの顔まわり・プリン・テーブルの小物・3Dプリンター周辺（破綻が見つかったら追加）。
export const AR_CLOSEUP_PARTS=[
 {id:'sofa',label:'ソファ',furnitureId:'sofa',ratio:.6},
];

// USDZ の数値の桁数（見た目は変えずにファイルを軽くする）。USDZExporter は 7 桁で書く。
// 点の位置は 5 桁（家の座標で 0.1mm 以下、40cm の箱庭では数ミクロン）、法線は小数 3 桁
export const USD_DIGITS={points:5,normals:3};
export function trimUsdNumbers(text,d=USD_DIGITS){
 const trim=s=>s.replace(/(\.\d*?)0+(?=$|e)/,'$1').replace(/\.(?=$|e)/,'');
 return text.split('\n').map(line=>{
  const isP=line.includes('point3f[] points'),isN=line.includes('normal3f[] normals');
  if(!isP&&!isN)return line;
  return line.replace(/-?\d+\.?\d*(?:e[-+]?\d+)?/g,n=>{const v=+n;if(!Number.isFinite(v))return n;
   const s=isP?v.toPrecision(d.points):v.toFixed(d.normals);return trim(s.includes('e')?String(+s):s)||'0';});
 }).join('\n');
}
