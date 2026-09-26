import {BufferAttribute,BufferGeometry,Vector3} from 'three';

// 柔らかい形（ソファなど）の法線を作り直す。
// Blender から来たソファは細長い三角形が多く、同じ位置の頂点でも法線が割れているため、
// 近くで見ると（VR・AR）肘掛けの側面などにギザギザの陰が出る。
// ・同じ位置の頂点はひとつの点として扱う（法線の割れを閉じる）
// ・各面の法線を「その角の大きさ」で重み付けして平均する（細長い三角形の影響を小さくする）
// ・creaseAngle より急に折れている面どうしは混ぜない（クッションの縁などの角は残す）
// 形（頂点の位置）と UV は変えない。インデックスなしのジオメトリを返す。
export const softNormalsCreaseAngle=Math.PI*50/180;

export function smoothSoftNormals(geometry,{creaseAngle=softNormalsCreaseAngle}={}){
 const source=geometry.index?geometry.toNonIndexed():geometry.clone();
 const pos=source.attributes.position,count=pos.count,faces=count/3;
 // 同じ位置の頂点をまとめる（モデルの大きさに対して十分小さい誤差で）
 source.computeBoundingBox();
 const size=source.boundingBox.getSize(new Vector3()).length()||1,quantum=size*1e-6;
 const keyOf=i=>`${Math.round(pos.getX(i)/quantum)},${Math.round(pos.getY(i)/quantum)},${Math.round(pos.getZ(i)/quantum)}`;
 const welded=new Int32Array(count),ids=new Map();
 for(let i=0;i<count;i++){const k=keyOf(i);let id=ids.get(k);if(id===undefined){id=ids.size;ids.set(k,id);}welded[i]=id;}
 // 面の法線と、各角の角度
 const faceNormal=new Float32Array(faces*3),cornerAngle=new Float32Array(count);
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),e1=new Vector3(),e2=new Vector3(),n=new Vector3();
 for(let f=0;f<faces;f++){
  a.fromBufferAttribute(pos,f*3);b.fromBufferAttribute(pos,f*3+1);c.fromBufferAttribute(pos,f*3+2);
  n.crossVectors(e1.subVectors(c,b),e2.subVectors(a,b));
  if(n.lengthSq()>0)n.normalize();
  faceNormal.set([n.x,n.y,n.z],f*3);
  const corner=(p,q,r)=>{e1.subVectors(q,p);e2.subVectors(r,p);return e1.lengthSq()&&e2.lengthSq()?e1.angleTo(e2):0;};
  cornerAngle[f*3]=corner(a,b,c);cornerAngle[f*3+1]=corner(b,c,a);cornerAngle[f*3+2]=corner(c,a,b);
 }
 // 点ごとに、その点を共有する角の一覧
 const corners=Array.from({length:ids.size},()=>[]);
 for(let i=0;i<count;i++)corners[welded[i]].push(i);
 const crease=Math.cos(creaseAngle),normals=new Float32Array(count*3),own=new Vector3(),other=new Vector3(),sum=new Vector3();
 for(let i=0;i<count;i++){
  const f=Math.floor(i/3);own.fromArray(faceNormal,f*3);sum.set(0,0,0);
  for(const j of corners[welded[i]]){
   const g=Math.floor(j/3);other.fromArray(faceNormal,g*3);
   if(g===f||other.dot(own)>=crease)sum.addScaledVector(other,cornerAngle[j]);
  }
  if(sum.lengthSq()===0)sum.copy(own);
  sum.normalize();normals.set([sum.x,sum.y,sum.z],i*3);
 }
 const result=new BufferGeometry();
 for(const [name,attribute] of Object.entries(source.attributes))if(name!=='normal')result.setAttribute(name,attribute);
 result.setAttribute('normal',new BufferAttribute(normals,3));
 for(const group of source.groups)result.addGroup(group.start,group.count,group.materialIndex);
 result.userData.softNormals=true;
 return result;
}

// ソファなど、近くで見られやすい柔らかい家具だけに使う（部屋全体には使わない）。
export const softNormalFurniture=['sofa'];
export function applySoftNormals(meshes,furnitureIds=softNormalFurniture){
 let changed=0;
 for(const mesh of meshes){
  if(!furnitureIds.includes(mesh.userData.furnitureId)||mesh.geometry.userData.softNormals)continue;
  const old=mesh.geometry;mesh.geometry=smoothSoftNormals(old);old.dispose();changed++;
 }
 return changed;
}
