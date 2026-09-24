import {Box3,Matrix4,Quaternion,Vector3} from 'three';

// burger.glb（human で軽量化したもの）が正：
//  14_Dessert_|_Circle001 … お皿
//  Circle033             … バーガー本体（まるごと。Circle072 / _1 / _2 の3マテリアル）
//  potato_ALL            … お皿のポテトの山
//  potato_single         … その中の1本（ぴよみがつまむ分。つまんだら皿からは消す）
// 食べかけは別GLB（同じ置き場所・同じ変形で作ってある）：
//  burger_bite01.glb … burgar_bite01（上のパンをひと口）
//  burger_bite02.glb … burgar_bite02（手前をがぶっ）
// どちらもかじった所はお皿の上の向きで -Z 側（＝奥の椅子のぴよみ側）。
// ぴよみの演技（characters/meal.js）が毎フレーム actor.meal に置き場所と段階を書き、ここで反映する。
const PLATE='14_Dessert_|_Circle001',BODY='Circle033',FRIES='potato_ALL',FRY='potato_single';

function rest(o){return {position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()};}
function restore(o,r){o.position.copy(r.position);o.quaternion.copy(r.quaternion);o.scale.copy(r.scale);}
// 食べかけGLBの中身（シーン直下のグループ）。名前はモデル側の綴りのまま（burgar_bite01 など）。
function biteBody(scene,index){
 const named=scene.getObjectByName(`burgar_bite0${index}`)??scene.getObjectByName(`burger_bite0${index}`);
 const body=named??scene.children.find(o=>!o.isLight&&!o.isCamera);
 if(!body)throw new Error(`burger_bite0${index}.glb has no burger`);
 return body;
}

// bites：[burger_bite01 のシーン, burger_bite02 のシーン]。お皿のセット（root）の中へ移して一緒に出し入れする。
export function installBurgerMotion(root,bites=[]){
 const body=root.getObjectByName(BODY),plate=root.getObjectByName(PLATE);
 if(!body)throw new Error('Burger GLB is missing Circle033');
 if(!plate)throw new Error(`Burger GLB is missing ${PLATE}`);
 const fries=root.getObjectByName(FRIES),fry=root.getObjectByName(FRY);
 root.updateWorldMatrix(true,true);
 const stages=[body];
 bites.forEach((scene,i)=>{if(!scene)return;scene.updateWorldMatrix(true,true);const b=biteBody(scene,i+1);root.attach(b);b.visible=false;stages.push(b);});
 const bounds=new Box3().setFromObject(body),plateBounds=new Box3().setFromObject(plate);
 const center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3()),plateCenter=plateBounds.getCenter(new Vector3());
 const fryCenter=fry?new Box3().setFromObject(fry).getCenter(new Vector3()):center.clone();
 const parts=[plate,fries,fry,...stages].filter(Boolean);
 const motion={
  body,stages,plate,fries,fry,
  rests:new Map(parts.map(o=>[o,rest(o)])),
  // お皿は裏の中心からぽんっとふくらむ
  pivot:new Vector3(plateCenter.x,plateBounds.min.y,plateCenter.z),
  center,localCenter:body.worldToLocal(center.clone()),radius:Math.max(size.x,size.z)/2,
  bodyWorldQuat:body.getWorldQuaternion(new Quaternion()),
  fryCenter,
 };
 root.userData.burgerMotion=motion;
 // 演技側が「どこへ翼を伸ばすか」を知るための、お皿の上の置き場所（ワールド）。
 return {burger:center.toArray(),radius:motion.radius,fry:fryCenter.toArray()};
}

// くちばしの先：Head の一番前の頂点の平均（表情メッシュ・小物は除く）。
export function getBeakTip(actor){
 actor.head.updateWorldMatrix(true,true);
 const head=actor.head.getObjectByName('Head');
 if(!head)return null;
 const forward=new Vector3(0,0,1).transformDirection(actor.head.matrixWorld);
 const tip=new Vector3(),vertex=new Vector3(),inverseHead=actor.head.matrixWorld.clone().invert();let furthest=-Infinity,count=0;
 const visit=node=>{
  if(node.name.startsWith('eye_'))return;
  if(node.isMesh){
   const matrix=new Matrix4().multiplyMatrices(inverseHead,node.matrixWorld);
   for(let i=0;i<node.geometry.attributes.position.count;i++){
    node.getVertexPosition(i,vertex).applyMatrix4(matrix);
    const distance=vertex.z;
    if(distance>furthest+1e-5){furthest=distance;tip.copy(vertex);count=1;}
    else if(Math.abs(distance-furthest)<=1e-5){tip.add(vertex);count++;}
   }
  }
  node.children.forEach(visit);
 };
 visit(head);
 if(!Number.isFinite(furthest))return null;
 actor.head.localToWorld(tip.divideScalar(count));
 return {tip,forward};
}

const tmp=new Vector3(),tmp2=new Vector3(),sideAxis=new Vector3(),upAxis=new Vector3(0,1,0),q=new Quaternion(),qTurn=new Quaternion();

export function updateBurgerMotion(root,actor){
 const motion=root.userData.burgerMotion;
 root.visible=!!actor;
 if(!motion)return;
 const {stages,plate,fries,fry,rests,pivot}=motion;
 for(const [o,r] of rests){restore(o,r);o.visible=true;}
 stages.forEach((b,i)=>b.visible=i===0);
 const meal=actor?.meal;
 if(!meal)return;
 const s=Math.max(0,meal.plateScale??1);
 if(s<=.001){root.visible=false;return;}
 // いまの段階（0 まるごと / 1 bite01 / 2 bite02 / 3 以上は食べ終わり）
 const stage=Math.max(0,Math.min(stages.length,meal.stage??0));
 stages.forEach((b,i)=>b.visible=i===stage);
 const body=stages[stage];
 // お皿・ポテト・（置いてある）バーガーを、お皿の裏の中心からまとめて拡大縮小
 for(const o of [plate,fries,fry,body]){
  if(!o)continue;const r=rests.get(o);
  o.position.copy(r.position).sub(pivot).multiplyScalar(s).add(pivot);o.scale.copy(r.scale).multiplyScalar(s);
 }
 if(fry)fry.visible=meal.fryOnPlate!==false;
 if(!body)return;
 const face=actor.target?.face??0,eaten=Math.max(.001,meal.burgerScale??1);
 sideAxis.set(Math.cos(face),0,-Math.sin(face));
 qTurn.setFromAxisAngle(upAxis,meal.turn??0);
 if(!meal.burgerOnPlate){
  // 持っているバーガー：水平のまま、少しだけ奥（見ている人の側）へ傾けて上のパンを見せる
  q.setFromAxisAngle(sideAxis,meal.tilt??0).multiply(qTurn).multiply(motion.bodyWorldQuat);
  body.quaternion.copy(q);
  body.scale.copy(rests.get(body).scale).multiplyScalar(eaten);
  body.position.copy(meal.burger).sub(tmp.copy(motion.localCenter).multiply(body.scale).applyQuaternion(q));
 }else{
  // お皿に置いてあるときも、回した向きのまま（本体の原点はバーガーの中心軸上）
  body.quaternion.copy(qTurn).multiply(motion.bodyWorldQuat);
  if(eaten<1)body.scale.multiplyScalar(eaten);
 }
 body.visible=eaten>.002;
}

export function installPotatoMotion(root){
 root.updateWorldMatrix(true,true);
 const bounds=new Box3().setFromObject(root),size=bounds.getSize(new Vector3());
 root.userData.potatoMotion={rest:root.position.clone(),restScale:root.scale.clone(),center:bounds.getCenter(new Vector3()),mouthClearance:size.z/2+.018};
}

// つまんだ1本：お皿の potato_single と同じ場所・形から、翼の先に付いてくちばしへ。
export function updatePotatoMotion(root,actor){
 const motion=root.userData.potatoMotion;
 root.visible=false;
 if(!motion)return;
 root.position.copy(motion.rest);root.scale.copy(motion.restScale);
 const meal=actor?.meal;
 if(!meal?.fryVisible)return;
 const k=Math.max(.001,meal.fryScale??1);
 // 中心を meal.fry に合わせ、中心まわりに縮める（ぱくっ）
 root.scale.multiplyScalar(k);
 tmp2.copy(motion.center).sub(motion.rest).multiplyScalar(k);
 root.position.copy(meal.fry).sub(tmp2);
 root.visible=true;
}
