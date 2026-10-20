// ピヨドリル：ピヨ探検の きょうだい同期（2台の iPad の 記録を あわせる）。
// Firebase（チキンポイント通帳と おなじ creative-chicken-points）の Firestore に、プレイヤーごと 1ドキュメント
//   piyoTanken/{piyokichi|piyomi} = {data: JSON文字列（cosmicube の プレイヤー1人ぶん）, device, updatedAt}
// を おく。ログインは「匿名」：iPad が うらで 見えない ID を もらうだけで、子どもは なにも しなくてよい。
//
// やること（sync）：
//   1) 2人ぶんの ドキュメントを 読む → mergeCubePlayer で 足し合わせる（cube.mergeRemote。記録は 消えない・二重にならない）
//   2) あわせた 結果が サーバーと ちがえば 書きもどす
//   3) おうえん（ぴよみ → ぴよきち）を 足す
// ネットが ない・Firebase の 設定が まだ・エラー → なにも しないで status だけ かえる（ドリルは そのまま あそべる）。
// チキンポイント通帳（records）には さわらない。
import {playerIds} from './questions.js';
import {firebaseConfig} from '../points/ledger.js';
import {sameCube} from './cosmicube-store.js';

export const SYNC_COLLECTION='piyoTanken';
const sdkBase='https://www.gstatic.com/firebasejs/12.0.0/';
const MAX_DATA=200000;

// Firebase を つかう部分（テストでは にせものに さしかえる）
export async function firebaseRemote({importModule=url=>import(/* @vite-ignore */url)}={}){
 const [{initializeApp,getApps},{getAuth,signInAnonymously},{getFirestore,doc,getDoc,setDoc,serverTimestamp}]=await Promise.all([
  importModule(`${sdkBase}firebase-app.js`),importModule(`${sdkBase}firebase-auth.js`),importModule(`${sdkBase}firebase-firestore.js`),
 ]);
 const name='piyo-tanken-sync';   // 通帳の 読みとり用アプリとは べつの 名前
 const app=getApps().find(a=>a.name===name)||initializeApp(firebaseConfig,name);
 const auth=getAuth(app);
 if(!auth.currentUser)await signInAnonymously(auth);
 const db=getFirestore(app);
 return {
  async read(id){const snap=await getDoc(doc(db,SYNC_COLLECTION,id));if(!snap.exists())return null;const d=snap.data();return typeof d?.data==='string'?JSON.parse(d.data):null;},
  async write(id,player,device){const data=JSON.stringify(player);if(data.length>MAX_DATA)throw new Error('too large');await setDoc(doc(db,SYNC_COLLECTION,id),{data,device:String(device??'').slice(0,40),updatedAt:serverTimestamp()});},
 };
}

// status: 'idle' | 'syncing' | 'ok' | 'error'。lastOk：さいごに つながった 時刻（ms）
export function createCubeSync({cube,openRemote=()=>firebaseRemote(),now=()=>Date.now(),onChange=()=>{}}){
 let remotePromise=null,running=null,again=false;
 const state={status:'idle',lastOk:0,error:null};
 const set=patch=>{Object.assign(state,patch);onChange({...state});};
 async function once(){
  remotePromise??=openRemote();
  let remote;
  try{remote=await remotePromise;}catch(e){remotePromise=null;throw e;}
  let changed=false;
  for(const id of playerIds){
   const theirs=await remote.read(id);
   if(theirs&&cube.mergeRemote(id,theirs))changed=true;
   const mine=cube.player(id);
   // 相手に ない 記録が あるときだけ 書く（だれも あそんでいない 子の からっぽの 記録は 書かない）
   const empty=!mine.updatedAt;
   if(!empty&&(!theirs||!sameCube(theirs,mine)))await remote.write(id,mine,cube.data.device);
  }
  const before=JSON.stringify(cube.player('piyokichi'));
  cube.applyCheer();
  if(JSON.stringify(cube.player('piyokichi'))!==before){changed=true;await remote.write('piyokichi',cube.player('piyokichi'),cube.data.device);}
  return changed;
 }
 // 同時に よばれたら 1回に まとめる（おわったあと もう1回）
 async function sync(){
  if(running){again=true;return running;}
  set({status:'syncing'});
  running=(async()=>{
   let changed=false;
   try{do{again=false;if(await once())changed=true;}while(again);set({status:'ok',lastOk:now(),error:null});}
   catch(e){set({status:'error',error:String(e?.code||e?.message||e)});}
   finally{running=null;}
   return changed;
  })();
  return running;
 }
 return {sync,state:()=>({...state})};
}
