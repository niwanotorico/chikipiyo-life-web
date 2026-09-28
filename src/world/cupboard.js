import {BoxGeometry,CanvasTexture,Group,Mesh,MeshStandardMaterial,Raycaster,SRGBColorSpace,Vector3} from 'three';

// 戸棚（Blender の Plane.086）の下段にある既存の開き戸 hirakiL / hirakiR を、そのまま蝶番で開け閉めする。
// 新しい戸棚は作らない。扉の原点は Blender 側で蝶番の位置（外側の縁）に置いてあるので、Y 軸回転だけで開く。
// 開いている間だけ、中にチキンポイント通帳の入口（小さな通帳）を出す。
export const cupboardDoorNames={left:'hirakiL',right:'hirakiR'};
export const cupboardOpenAngle=1.35; // 約77°。左隣のキッチン収納や右の壁に当たらない角度。
const swingSeconds=.45,showEntryAt=.7;
const ease=t=>t*t*(3-2*t);

export function installCupboard(room,{createCanvas}={}){
 const left=room.getObjectByName(cupboardDoorNames.left),right=room.getObjectByName(cupboardDoorNames.right);
 if(!left||!right)return null;
 const doors=[{mesh:left,sign:-1,restY:left.rotation.y},{mesh:right,sign:1,restY:right.rotation.y}];
 for(const d of doors)d.mesh.traverse(o=>{o.userData.cupboardDoor=true;});
 // 扉を閉じた状態の外形から、戸棚の中（扉のすぐ奥の床）を測る。
 room.updateMatrixWorld(true);
 const box=doorBounds(doors);
 const entry=createPassbookEntry(createCanvas);
 const spot=new Vector3((box.min.x+box.max.x)/2+.1,0,box.min.z-.15);
 spot.y=innerFloor(room,spot,box,doors)??box.min.y;
 entry.position.copy(spot);
 entry.rotation.y=-.18;entry.visible=false;
 room.add(entry);entry.updateMatrixWorld(true);
 const cupboard={
  doors,entry,front:box.max.z,open:false,progress:0,listeners:new Set(),
  anchor:new Vector3(),
  get entryVisible(){return entry.visible;},
  setOpen(value){
   value=!!value;if(value===cupboard.open)return;
   cupboard.open=value;
   // 閉じ始めたらすぐ入口を隠す（通帳パネルもこの通知で閉じる）。
   if(!value)entry.visible=false;
   for(const fn of cupboard.listeners)fn(value);
  },
  toggle(){cupboard.setOpen(!cupboard.open);},
  onChange(fn){cupboard.listeners.add(fn);return()=>cupboard.listeners.delete(fn);},
  update(dt){
   const target=cupboard.open?1:0;
   if(cupboard.progress===target)return;
   const step=dt/swingSeconds;
   cupboard.progress=target>cupboard.progress?Math.min(target,cupboard.progress+step):Math.max(target,cupboard.progress-step);
   applyDoorPose(cupboard);
  },
  // クリック判定：扉と通帳のうち一番手前の当たりを返す（見えていない物は無視）。
  hit(raycaster){
   const targets=[left,right];if(entry.visible)targets.push(entry);
   const hit=raycaster.intersectObjects(targets,true)[0];
   if(!hit)return null;
   return {...hit,kind:isInside(hit.object,entry)?'passbook':'door'};
  },
  // 入口ラベルを重ねる位置（ワールド座標、通帳の少し上）。
  entryAnchor(){return entry.localToWorld(cupboard.anchor.set(0,.07,0));},
 };
 return cupboard;
}

function applyDoorPose(c){
 const a=cupboardOpenAngle*ease(c.progress);
 for(const d of c.doors)d.mesh.rotation.y=d.restY+d.sign*a;
 c.entry.visible=c.open&&c.progress>=showEntryAt;
}

// 戸棚の中の床（下段の棚板）の高さを、扉の上端の少し下から真下へ測る。扉は除く。
function innerFloor(room,spot,box,doors){
 const skip=new Set();for(const d of doors)d.mesh.traverse(o=>skip.add(o));
 const hits=new Raycaster(new Vector3(spot.x,box.max.y-.05,spot.z),new Vector3(0,-1,0),0,box.max.y).intersectObject(room,true);
 return hits.find(h=>!skip.has(h.object)&&h.object.visible)?.point.y+.002;
}

function doorBounds(doors){
 const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity),p=new Vector3();
 for(const {mesh} of doors)mesh.traverse(o=>{
  if(!o.isMesh)return;
  const pos=o.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);o.localToWorld(p);min.min(p);max.max(p);}
 });
 return {min,max};
}

const isInside=(object,root)=>{for(let o=object;o;o=o.parent)if(o===root)return true;return false;};

// 小さな通帳：クリーム色の表紙にひよこ色の帯。表紙だけ文字入りのテクスチャ。
function createPassbookEntry(createCanvas){
 const group=new Group();group.name='ChickenPointPassbook';
 const w=.24,h=.022,d=.3;
 const paper=new MeshStandardMaterial({color:0xfbf5e4,roughness:.85});
 const coverMap=passbookCoverTexture(createCanvas);
 const cover=new MeshStandardMaterial({color:0xffffff,map:coverMap,roughness:.7,emissive:0xffe7a8,emissiveIntensity:coverMap?.04:.2});
 const edge=new MeshStandardMaterial({color:0xe7b94c,roughness:.7});
 // BoxGeometry の面順：+x,-x,+y,-y,+z,-z。天面（+y）が表紙。
 const book=new Mesh(new BoxGeometry(w,h,d),[paper,edge,cover,paper,paper,edge]);
 book.position.y=h/2;book.castShadow=true;book.receiveShadow=true;book.userData.passbookEntry=true;
 group.add(book);
 return group;
}

function passbookCoverTexture(createCanvas=()=>typeof document!=='undefined'?document.createElement('canvas'):null){
 const canvas=createCanvas();const ctx=canvas?.getContext?.('2d');
 if(!ctx)return null;
 canvas.width=200;canvas.height=260;
 ctx.fillStyle='#eeb93f';ctx.fillRect(0,0,200,260);
 ctx.fillStyle='#fffaf0';ctx.fillRect(14,14,172,232);
 ctx.fillStyle='#e9a93a';ctx.fillRect(14,176,172,34);
 // ひよこの顔
 ctx.fillStyle='#ffd24d';ctx.beginPath();ctx.arc(100,92,42,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#4a3a2c';ctx.beginPath();ctx.arc(86,86,5,0,Math.PI*2);ctx.arc(114,86,5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f08a3c';ctx.beginPath();ctx.moveTo(92,100);ctx.lineTo(108,100);ctx.lineTo(100,110);ctx.closePath();ctx.fill();
 ctx.fillStyle='#5b4a33';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText('つうちょう',100,155);
 ctx.fillStyle='#fffaf0';ctx.font='bold 18px sans-serif';ctx.fillText('CHICKEN PT',100,193);
 const tex=new CanvasTexture(canvas);tex.colorSpace=SRGBColorSpace;return tex;
}
