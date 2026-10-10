// 3DPハウス：ピヨ探検で トラマナちゃんを ひらいた子が いると、トラマナちゃんが あそびに くる。
// ピヨドリルの保存データは 読むだけ（書かない）。モデル（約1.3MB）は 来るときだけ 読みこむので、まだの 端末では 何も ふえない。
// 元モデル：01_Projects/FreebirdCollabo/my_scene/とらちもハンバーガー.blend（姿勢を固定・絵は 1024 に縮めて 書き出し）
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {sanitizeCubePlayer} from '../drill/cosmicube.js';
import {CUBE_KEY,safeStorage} from '../manga/unlocks.js';
import {MANGA_PLAYERS} from '../manga/catalog.js';

// ベッドと VR の あいだ、部屋の 手前。カメラの ほうを むく
export const VISIT_SPOT={x:-1.6,z:3.0,yaw:.8};
const LINES=['トラマナちゃん「あそびに きたよ！」','トラマナちゃん「カレー ある？」','トラマナちゃん「この おうち、すてき！」','トラマナちゃん「ドリル、がんばってるね！」'];

// トラマナちゃんを ひらいた子（ゲートか ごほうびに toramana がある）。データが ない・こわれていても []
export function toramanaVisitors(storage=safeStorage()){
 let raw=null;try{const text=storage?.getItem(CUBE_KEY);raw=text==null?null:JSON.parse(text);}catch{return [];}
 if(raw?.version!==1||!raw.players||typeof raw.players!=='object')return [];
 return MANGA_PLAYERS.map(p=>p.id).filter(id=>{
  const player=sanitizeCubePlayer(raw.players[id]);
  return Object.values(player.seasons).some(s=>s.gates.toramana||s.rewards.toramana);
 });
}

export function installToramanaVisit(scene,{onSay=()=>{},storage=safeStorage(),loadUrl=()=>import('../../assets/characters/toramana.glb?url').then(m=>m.default)}={}){
 const root=new Group();root.name='ToramanaVisit';root.visible=false;
 root.position.set(VISIT_SPOT.x,0,VISIT_SPOT.z);root.rotation.y=VISIT_SPOT.yaw;
 scene.add(root);
 let loading=null,time=0,hop=0,line=0;
 async function load(){
  const url=await loadUrl();
  const gltf=await new GLTFLoader().loadAsync(url);
  gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  root.add(gltf.scene);
 }
 // 来る子が いれば 読みこんで 出す。いなければ かくす（読みこみは 1回だけ）
 function check(){
  const come=toramanaVisitors(storage).length>0;
  if(come&&!loading)loading=load().catch(e=>{loading=null;console.warn('[toramana]',e);});
  if(!come){root.visible=false;return;}
  loading?.then(()=>{if(!root.visible){root.visible=true;onSay('トラマナちゃんが あそびに きたよ！');}});
 }
 check();
 // ドリルで ひらいて もどってきたとき（べつの タブ・アプリの 切りかえ）にも 反映
 addEventListener('storage',e=>{if(e.key===CUBE_KEY)check();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
 return {
  root,
  ready:()=>loading??Promise.resolve(),
  // タップの 当たり判定。見えていないときは null
  hit(raycaster){return root.visible?raycaster.intersectObject(root,true)[0]??null:null;},
  tap(){hop=1;onSay(LINES[line++%LINES.length]);},
  update(dt){
   if(!root.visible)return;
   time+=dt;hop=Math.max(0,hop-dt*2);
   root.position.y=Math.sin(hop*Math.PI)*.35+Math.abs(Math.sin(time*2.2))*.03;   // タップで ぴょん。ふだんは ゆらゆら
   root.rotation.z=Math.sin(time*1.6)*.04;
  },
 };
}
