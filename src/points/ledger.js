// チキンポイント通帳（creative-chicken-points）の Firestore を「見るだけ」で読む。
// 残高の計算ルールは creative-chicken-points/ledger.mjs と同じ：records 全件の earn − spend。
// 書き込み・削除・ログインはしない（管理は creative-chicken-points 側に残す）。
export const pointChildren=['ぴよきち','ぴよみ'];

export const firebaseConfig={
 apiKey:'AIzaSyDZ9ejh0DacIkYsbn-heMSvY3W-v2DeFNQ',
 authDomain:'creative-chicken-points.firebaseapp.com',
 projectId:'creative-chicken-points',
 storageBucket:'creative-chicken-points.firebasestorage.app',
 messagingSenderId:'627959552960',
 appId:'1:627959552960:web:a101af5ea0c29ea1c14625',
};

// 通帳アプリと同じ SDK 版。通帳を開いたときだけ読み込むので、おうちの初期表示は重くならない。
const sdkBase='https://www.gstatic.com/firebasejs/12.0.0/';

export function validPointRecord(r){
 return pointChildren.includes(r?.child)&&['earn','spend'].includes(r.type)&&Number.isSafeInteger(r.points)&&r.points>0&&r.points<=1000000&&typeof r.reason==='string'&&r.reason.trim().length>0&&r.reason.length<=200;
}

export function pointBalances(records){
 const result=Object.fromEntries(pointChildren.map(c=>[c,0]));
 for(const r of records)if(validPointRecord(r))result[r.child]+=r.points*(r.type==='earn'?1:-1);
 return result;
}

let firestorePromise=null;
async function openFirestore(importModule){
 const [{initializeApp,getApps},{getFirestore,collection,onSnapshot}]=await Promise.all([
  importModule(`${sdkBase}firebase-app.js`),importModule(`${sdkBase}firebase-firestore.js`),
 ]);
 // 名前付きアプリにして、同じページで他の Firebase を使っても衝突しないようにする。
 const name='chicken-points-readonly';
 const app=getApps().find(a=>a.name===name)||initializeApp(firebaseConfig,name);
 return {records:collection(getFirestore(app),'records'),onSnapshot};
}

// records を購読して残高を返す。戻り値は購読解除の関数。
// onChange({ready,balances}) — ready は「サーバーの最新値」かどうか（キャッシュだけなら false）。
export function subscribePointBalances(onChange,onError,{importModule=url=>import(/* @vite-ignore */url)}={}){
 let stop=null,cancelled=false;
 firestorePromise??=openFirestore(importModule);
 firestorePromise.then(({records,onSnapshot})=>{
  if(cancelled)return;
  stop=onSnapshot(records,{includeMetadataChanges:true},snapshot=>{
   onChange({ready:!snapshot.metadata.fromCache,balances:pointBalances(snapshot.docs.map(d=>d.data()))});
  },onError);
 }).catch(error=>{firestorePromise=null;if(!cancelled)onError(error);});
 return ()=>{cancelled=true;stop?.();stop=null;};
}
