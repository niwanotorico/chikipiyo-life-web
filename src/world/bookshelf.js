import {Box3,CanvasTexture,Mesh,MeshStandardMaterial,PlaneGeometry,Quaternion,SRGBColorSpace,Vector3} from 'three';
import {SERIES} from '../manga/catalog.js';

// 戸棚（Blender の Plane086）の上の段に もとからある オレンジの本3冊（book007・book006・book005、左から）を、
// マンガの本の入口にする。新しい本は足さない。本ごとに色を わけ、背表紙に 本の名前を入れるだけ。
// 中身は クリックで ひらく大きなリーダー（src/manga/reader.js）で読む。
export const shelfUnit='Plane086';
export const shelfBooks=['book007','book006','book005'];   // 左から マイクラ本・まったり日常本・季節の本（SERIES の順）
const spineFace='Material.001';   // 本の表紙・背表紙（3冊で共有しているので、本ごとに複製して色をかえる）

export function installBookshelf(room,{createCanvas,series=SERIES}={}){
 const unit=room.getObjectByName(shelfUnit);
 const groups=shelfBooks.map(n=>room.getObjectByName(n));
 if(!unit||groups.some(g=>!g))return null;
 room.updateMatrixWorld(true);
 const books=series.slice(0,groups.length).map((s,i)=>{
  const mesh=groups[i];
  mesh.userData.mangaSeries=s.id;
  const box=new Box3().setFromObject(mesh);
  let face=null;
  mesh.traverse(o=>{
   if(!o.isMesh)return;
   const mats=[].concat(o.material);
   const next=mats.map(m=>{
    if(m.name!==spineFace)return m;
    const c=m.clone();c.color.set(s.color);c.emissive?.set(s.color);c.emissiveIntensity=0;face=c;return c;
   });
   o.material=Array.isArray(o.material)?next:next[0];
  });
  // 背表紙（手前の面）に 本の名前。本と いっしょに当たり判定に入るよう、本の子にする
  const label=spineLabel(s,box,createCanvas);
  if(label){
   // 向きと大きさは 部屋の正面・実寸のまま（もとの本のモデルは 縮小して置いてあるので、その分を もどす）
   const scale=mesh.getWorldScale(new Vector3());
   mesh.worldToLocal(label.position);label.quaternion.copy(mesh.getWorldQuaternion(new Quaternion()).invert());
   label.scale.set(1/scale.x,1/scale.y,1/scale.z);mesh.add(label);
  }
  return {series:s.id,mesh,face,box};
 });
 const all=new Box3();for(const b of books)all.union(b.box);
 const unitBox=new Box3().setFromObject(unit);
 const anchor=new Vector3();
 let lit=null;
 return {
  unit,books,front:unitBox.max.z,
  // クリック判定：本 {distance, series} ／ 本だな（本のない ところ）{distance, series:null}
  hit(raycaster){
   const hit=raycaster.intersectObjects([...books.map(b=>b.mesh),unit],true)[0];
   if(!hit)return null;
   const b=books.find(b=>isInside(hit.object,b.mesh));
   return {distance:hit.distance,series:b?.series??null};
  },
  // カーソルを合わせた本を すこし明るく（null で もどす）
  highlight(series){
   if(series===lit)return;
   for(const b of books)if(b.face)b.face.emissiveIntensity=b.series===series?.22:0;
   lit=series;
  },
  // 入口ラベルの位置：本の まうえ、戸棚の天板の上（ラベルは この点より上に出るので、本に かぶらない）
  entryAnchor(){return anchor.set((all.min.x+all.max.x)/2,unitBox.max.y+.02,(all.min.z+all.max.z)/2);},
 };
}

const isInside=(object,root)=>{for(let o=object;o;o=o.parent)if(o===root)return true;return false;};

// 背表紙のラベル：たて書きの 本の名前と、小さな しるし
function spineLabel(s,box,createCanvas=()=>typeof document!=='undefined'?document.createElement('canvas'):null){
 const canvas=createCanvas();const ctx=canvas?.getContext?.('2d');
 if(!ctx)return null;
 const W=64,H=256;canvas.width=W;canvas.height=H;
 ctx.fillStyle=s.paper;ctx.beginPath();ctx.roundRect?.(4,4,W-8,H-8,10);if(!ctx.roundRect)ctx.rect(4,4,W-8,H-8);ctx.fill();
 ctx.fillStyle=s.ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 30px sans-serif';
 const text=s.title.replace(/の?本$/,'').replace('まったり日常','まったり');
 const step=Math.min(34,(H-60)/text.length);
 [...text].forEach((ch,i)=>ctx.fillText(ch,W/2,26+step/2+i*step));
 ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(W/2,H-26,11,0,Math.PI*2);ctx.fill();
 const tex=new CanvasTexture(canvas);tex.colorSpace=SRGBColorSpace;tex.anisotropy=4;
 const w=(box.max.x-box.min.x)*.66,h=(box.max.y-box.min.y)*.72;
 const plane=new Mesh(new PlaneGeometry(w,h),new MeshStandardMaterial({map:tex,roughness:.8,transparent:true}));
 plane.name=`MangaSpine-${s.id}`;
 plane.position.set((box.min.x+box.max.x)/2,(box.min.y+box.max.y)/2,box.max.z+.003);
 return plane;
}
