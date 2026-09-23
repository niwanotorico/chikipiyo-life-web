
// 透過（transmission）素材が1つでも見えていると、three.js は毎フレーム不透明物を全部
// もう一度フル解像度のターゲットへ描き直す（描画回数・三角形がほぼ2倍）。
// ここでは「不透明にしてよい」と確認済みの対象だけを台帳で明示し、読み込み時に置き換える。
// GLBファイルは変更しない。台帳にない透過素材（今後のガラス・カーテン・エフェクト等）は一切触らない。
//
// 各対象は、アセット・メッシュ名・親の名前・素材名・元の透過値の組で特定する（名前だけに頼らない）。
// どれかが食い違えば置き換えず警告する＝アセットが作り直されたら、確認し直すまで元の見た目のまま。
const blenderWhite={material:'white',transmission:0.23622047901153564,color:'ffffff'};
export const opaqueTransmissionTargets=[
 // 2026-09-23 A1：Blender由来の白い紙・コップ・掃除機パイプ。透過は約0.24で、いつものカメラでも寄りでも差は最大19/255。
 {asset:'room',mesh:'Plane151',parent:'book',...blenderWhite,note:'机の下の本（ページ）'},
 {asset:'room',mesh:'Plane001_2',parent:'book001',...blenderWhite,note:'机の下の本（ページ）'},
 {asset:'room',mesh:'Plane009',parent:'book002',...blenderWhite,note:'ベッド脇の本（ページ）'},
 {asset:'room',mesh:'Plane013',parent:'book004',...blenderWhite,note:'棚の本（ページ）'},
 {asset:'room',mesh:'Cylinder002_2',parent:'Cylinder002',...blenderWhite,note:'テーブルのコップ'},
 {asset:'vacuum',mesh:'13_Vacuum_|_Cube002',parent:'Scene',...blenderWhite,note:'掃除機のパイプ'},
];

const matches=(target,mesh,material)=>mesh.name===target.mesh&&(mesh.parent?.name??'')===target.parent&&material?.name===target.material
 &&Math.abs((material.transmission??0)-target.transmission)<1e-6&&material.color?.getHexString?.()===target.color;

// 台帳の対象メッシュだけ、不透明コピーの素材へ差し替える。元の素材は共有されていても書き換えないので、
// 台帳にない別メッシュが同じ素材を使っていれば、そちらは透過のまま残る。
export function applyOpaqueTransmissionTargets(root,asset,{targets=opaqueTransmissionTargets,warn=console.warn}={}){
 const wanted=targets.filter(t=>t.asset===asset),found=new Set(),copies=new Map(),unlisted=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const next=list.map(material=>{
   if(!(material?.transmission>0))return material;
   const target=wanted.find(t=>matches(t,mesh,material));
   if(!target){unlisted.push(`${mesh.name}（${material.name||'名前なし'}、透過${material.transmission.toFixed(2)}）`);return material;}
   found.add(target);
   let copy=copies.get(material);
   if(!copy){copy=material.clone();copy.transmission=0;copy.name=`${material.name}__opaque`;copy.userData.opaqueFrom=material.uuid;copies.set(material,copy);}
   return copy;
  });
  mesh.material=Array.isArray(mesh.material)?next:next[0];
 });
 const missing=wanted.filter(t=>!found.has(t));
 if(missing.length)warn(`[transmission] ${asset}: 台帳の対象が見つからないか値が変わっています（不透明化していません）: ${missing.map(t=>`${t.parent}/${t.mesh}`).join(', ')}`);
 if(unlisted.length)warn(`[transmission] ${asset}: 台帳にない透過素材はそのまま使います（毎フレームの透過用の描き直しが有効になります）: ${unlisted.join(', ')}`);
 return {applied:[...found],missing,unlisted};
}
