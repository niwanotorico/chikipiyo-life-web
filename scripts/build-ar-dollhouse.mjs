// AR 用ドールハウス GLB を作る（開発時だけ使う。公開サイトはできあがった GLB を読むだけ）。
//   node scripts/build-ar-dollhouse.mjs
// 入力：assets/room/human-room.glb ＋ assets/characters/*.glb（通常表示・VR と同じ元データ）
// 出力：assets/ar/chikipiyo-dollhouse.glb
//  1. 部屋とキャラクター（開始位置に立った姿）を、アプリと同じ組み立て方で並べる
//  2. 寝ている時用の布団など通常は見えない物を除外、透過素材は不透明に（AR ビューアの互換性のため）
//  3. 三角形を間引いて軽くする（meshoptimizer）。テクスチャは無いので UV も捨てる
//  4. 幅 DOLLHOUSE_WIDTH（40cm）に縮め、床の中心を原点に置く（Scene Viewer / Quick Look は実寸で置くため）
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeVertices,toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';
import {characterDefinitions} from '../src/characters/config.js';
import {createCharacter} from '../src/characters/model.js';
import {characterAssetPaths,installCharacterVisual} from '../src/characters/gltf.js';
import {DOLLHOUSE_WIDTH,DOLLHOUSE_FILE,DOLLHOUSE_EXCLUDE_PARTS} from '../src/ar/dollhouse-config.js';

const root=new URL('../',import.meta.url);
const read=p=>{const b=readFileSync(new URL(p,root));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const loader=new GLTFLoader();
const SIMPLIFY_ERROR=+(process.env.AR_ERROR||.01),CREASE=Math.PI*(+(process.env.AR_CREASE||55))/180;

// GLTFExporter（バイナリ出力）が使う FileReader を Node 用に最小限だけ用意
globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:'+(blob.type||'application/octet-stream')+';base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});}};

const house=new T.Group();house.name='ChikipiyoDollhouse';

// 1) 部屋
const room=(await loader.parseAsync(read('assets/room/human-room.glb'),'')).scene;room.name='Room';
const drop=[];room.traverse(o=>{if(DOLLHOUSE_EXCLUDE_PARTS.includes(o.userData.roomPart)||DOLLHOUSE_EXCLUDE_PARTS.includes(o.name))drop.push(o);});
drop.forEach(o=>o.removeFromParent());
house.add(room);

// 1b) キャラクター：アプリと同じ createCharacter ＋ installCharacterVisual（開始位置・立ち姿）
for(const def of characterDefinitions){
 const c=createCharacter(def);
 const gltf=await loader.parseAsync(read(characterAssetPaths[c.variant].replace('../','')),'');
 installCharacterVisual(c,gltf.scene);
 // ひとやすみ中と同じ見た目：食べ物・VRゴーグル・ほうきは持たない（animation.js の待機時と同じ）
 c.food.visible=false;c.vr.visible=false;c.broom.visible=false;
 c.root.name=`Character_${def.id}`;house.add(c.root);
}
house.updateMatrixWorld(true);

// 2) 見えない物を外し、素材を AR ビューア向けに整える
const matCache=new Map();
const arMaterial=m=>{
 if(matCache.has(m))return matCache.get(m);
 const n=new T.MeshStandardMaterial({name:m.name,color:m.color,roughness:m.roughness??.8,metalness:m.metalness??0,side:m.side,
  emissive:m.emissive,emissiveIntensity:m.emissiveIntensity??1,transparent:!!m.transparent&&m.opacity<1,opacity:m.opacity??1,flatShading:!!m.flatShading});
 if(m.map)n.map=m.map;
 matCache.set(m,n);return n;
};
const meshes=[];
house.traverse(o=>{if(o.isMesh)meshes.push(o);});
let before=0,after=0;
await MeshoptSimplifier.ready;
for(const mesh of meshes){
 let visible=true;for(let p=mesh;p;p=p.parent)if(!p.visible)visible=false;
 if(!visible){mesh.removeFromParent();continue;}
 mesh.material=Array.isArray(mesh.material)?mesh.material.map(arMaterial):arMaterial(mesh.material);
 mesh.castShadow=mesh.receiveShadow=false;
 // 3) 軽量化：位置だけで頂点を溶接 → 間引き → 角度 35° 以上の折れ目だけ法線を分ける（トゥーン調の角は残る）
 let g=mesh.geometry.clone();
 for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);
 g.morphAttributes={};
 const hadGroups=g.groups.length>0;
 g=mergeVertices(g,1e-5);
 const tris=g.index.count/3;before+=tris;
 if(tris>200&&!hadGroups){
  const ratio=tris>60000?.04:tris>20000?.08:tris>6000?.15:tris>1500?.25:.45;
  const idx=new Uint32Array(g.index.array),pos=new Float32Array(g.attributes.position.array);
  const [out]=MeshoptSimplifier.simplify(idx,pos,3,Math.max(36,Math.floor(tris*ratio)*3),SIMPLIFY_ERROR,[]);
  if(out.length>=36||out.length>=idx.length*.5){
   const map=new Int32Array(pos.length/3).fill(-1),np=[],ni=new Uint32Array(out.length);let n=0;
   for(let i=0;i<out.length;i++){const v=out[i];if(map[v]<0){map[v]=n++;np.push(pos[v*3],pos[v*3+1],pos[v*3+2]);}ni[i]=map[v];}
   const s=new T.BufferGeometry();s.setAttribute('position',new T.Float32BufferAttribute(np,3));s.setIndex(Array.from(ni));g=s;
  }
 }
 g=mergeVertices(toCreasedNormals(g,CREASE),1e-4);
 after+=g.index.count/3;mesh.geometry=g;
}

// 4) 幅 40cm・床の中心を原点に
const box=new T.Box3().setFromObject(house),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
const scale=DOLLHOUSE_WIDTH/size.x;
const top=new T.Group();top.name='ChikipiyoDollhouseAR';top.add(house);
house.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);house.scale.setScalar(scale);
const glb=await new GLTFExporter().parseAsync(top,{binary:true,onlyVisible:true});
const outPath=new URL(DOLLHOUSE_FILE,root);mkdirSync(dirname(outPath.pathname),{recursive:true});
writeFileSync(outPath,Buffer.from(glb));
console.log(`triangles ${Math.round(before)} -> ${Math.round(after)}, size ${(glb.byteLength/1048576).toFixed(2)} MB, `+
 `dollhouse ${(size.x*scale*100).toFixed(1)} x ${(size.y*scale*100).toFixed(1)} x ${(size.z*scale*100).toFixed(1)} cm (scale 1/${(1/scale).toFixed(1)})`);
