// AR 用のメッシュ軽量化（scripts/build-ar-dollhouse.mjs の「3) 軽量化」と同じ手順・同じ強さ）。
// 位置だけで頂点を溶接 → meshoptimizer で間引き → 55° 以上の折れ目だけ法線を分ける（トゥーン調の角は残る）。
// 開発時のスクリプト専用（meshoptimizer は devDependency）。
import * as T from 'three';
import {mergeVertices,toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';

export const AR_SIMPLIFY={error:.01,crease:Math.PI*55/180};
// ratio を渡すとその割合まで（1 なら間引かない）。省略時は三角形数に応じた段階（静止AR版と同じ）
export const defaultRatio=tris=>tris>60000?.04:tris>20000?.08:tris>6000?.15:tris>1500?.25:.45;
export async function simplifyMeshForAR(mesh,{error=AR_SIMPLIFY.error,crease=AR_SIMPLIFY.crease,ratio=null}={}){
 await MeshoptSimplifier.ready;
 let g=mesh.geometry.clone();
 for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);
 g.morphAttributes={};
 const hadGroups=g.groups.length>0;
 g=mergeVertices(g,1e-5);
 const tris=g.index.count/3;
 const r=ratio??defaultRatio(tris);
 if(tris>200&&!hadGroups&&r<1){
  const idx=new Uint32Array(g.index.array),pos=new Float32Array(g.attributes.position.array);
  const [out]=MeshoptSimplifier.simplify(idx,pos,3,Math.max(36,Math.floor(tris*r)*3),error,[]);
  if(out.length>=36||out.length>=idx.length*.5){
   const map=new Int32Array(pos.length/3).fill(-1),np=[],ni=new Uint32Array(out.length);let n=0;
   for(let i=0;i<out.length;i++){const v=out[i];if(map[v]<0){map[v]=n++;np.push(pos[v*3],pos[v*3+1],pos[v*3+2]);}ni[i]=map[v];}
   const s=new T.BufferGeometry();s.setAttribute('position',new T.Float32BufferAttribute(np,3));s.setIndex(Array.from(ni));g=s;
  }
 }
 g=mergeVertices(toCreasedNormals(g,crease),1e-4);
 const after=g.index.count/3;mesh.geometry=g;
 return {before:tris,after};
}
