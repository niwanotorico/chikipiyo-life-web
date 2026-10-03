// ピヨドリル：ピヨ探検の保存。キューブpt・ゲート・ごほうび・マップ位置・その日の回数・
// チキンコインミッション・コンプ率の保存と読み込みは、ぜんぶこのファイルだけで行う（ほかのファイルは localStorage に触らない）。
//
// 保存先は「アダプタ」で差し替えられる。いまは端末内（localStorage）だけ。
//   adapter = { load(): object|null, save(data): boolean }
// 将来 ぴよきち・ぴよみ の iPad の進捗を共有するときは、たとえば Firestore のアダプタを足して
//   1) 起動時やプレイ後に、相手端末の記録を取ってきて mergeCubePlayer() で足し合わせる（remote → local）
//   2) 自分の記録を送る（local → remote）
// とすればよい。データはプレイヤーごとに独立した1かたまり（players[id]）なので、そのまま1ドキュメントにできる。
// 兄弟ゲートは snapshotAll()（2人ぶんのまとめ）を見て判定する想定。
import {playerIds} from './questions.js';
import {SEASON,emptyCubePlayer,sanitizeCubePlayer,recordSession,openGate,mergeCubePlayer,season,cubeBalance,cubeEarnedTotal,playsOn,cubeSessionsLeft,completion,effectsOf,inSeason} from './cosmicube.js';

export const CUBE_KEY='chikipiyo-cosmicube:v1';
export const CUBE_BROKEN_KEY=CUBE_KEY+':broken';

function emptyCubeStore(){return {version:1,device:null,players:Object.fromEntries(playerIds.map(id=>[id,emptyCubePlayer()]))};}
function sanitizeCubeStore(raw){
 const s=emptyCubeStore();
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
 s.device=typeof raw.device==='string'?raw.device.slice(0,40):null;
 const players=raw.players&&typeof raw.players==='object'?raw.players:{};
 for(const id of playerIds)s.players[id]=sanitizeCubePlayer(players[id]);
 return s;
}

// ---------- アダプタ ----------
export function localCubeAdapter(storage){
 return {
  kind:'local',
  load(){
   if(!storage)return {data:null,status:'unavailable'};
   let text;try{text=storage.getItem(CUBE_KEY);}catch{return {data:null,status:'unavailable'};}
   if(text==null)return {data:null,status:'new'};
   try{const raw=JSON.parse(text);if(!raw||raw.version!==1)throw new Error('bad shape');return {data:raw,status:'ok'};}
   catch{try{storage.setItem(CUBE_BROKEN_KEY,text);}catch{}return {data:null,status:'recovered'};}   // 壊れたデータは消さずに退避
  },
  save(data){if(!storage)return false;try{storage.setItem(CUBE_KEY,JSON.stringify(data));return true;}catch{return false;}},
 };
}
// テスト・保存できない環境用
export function memoryCubeAdapter(initial=null){
 let data=initial?JSON.parse(JSON.stringify(initial)):null;
 return {kind:'memory',load:()=>({data:data&&JSON.parse(JSON.stringify(data)),status:data?'ok':'new'}),save(d){data=JSON.parse(JSON.stringify(d));return true;}};
}

const newDeviceId=()=>`dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export class CubeStore{
 constructor({adapter,now=()=>Date.now()}){
  this.adapter=adapter;this.now=now;
  this.data=emptyCubeStore();this.status='new';
  this.listeners=new Set();
  this.reload();
 }
 // 保存先から読みなおす（別タブ・同期のあと）
 reload(){
  const {data,status}=this.adapter.load();
  this.status=status;
  this.data=sanitizeCubeStore(data);
  if(!this.data.device){this.data.device=newDeviceId();if(status!=='unavailable')this.write();}
  return this;
 }
 write(){return this.adapter.save(this.data);}
 // 1人ぶんを書きかえる唯一の入り口：読みなおし → 変更 → updatedAt → 保存 → 通知
 update(id,fn){
  this.reload();
  const before=this.data.players[id];
  if(!before)throw new Error(`unknown player: ${id}`);
  const res=fn(before);
  const after=res?.player??res;
  if(after&&after!==before){
   this.data.players[id]=sanitizeCubePlayer({...after,updatedAt:this.now()});
   this.write();
   for(const f of this.listeners)f(id);
  }
  return res;
 }
 onChange(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}

 player(id){return this.data.players[id];}
 // 10問クリア → キューブpt を入金（＋その日の1回目クリアならコインミッション達成）
 recordSession(id,{sessionId,dayKey,award}){return this.update(id,p=>recordSession(p,{sessionId,dayKey,award}));}
 openGate(id,nodeId,dayKey){return this.update(id,p=>openGate(p,nodeId,dayKey));}
 // 将来の同期：相手端末の記録（1人ぶん）を足し合わせる
 mergeRemote(id,remotePlayer){return this.update(id,p=>mergeCubePlayer(p,remotePlayer));}

 // 画面や他ページ・兄弟ゲート用のまとめ（保存データから毎回計算する）
 snapshot(id,dayKey){
  const p=this.player(id),s=season(p);
  return {
   player:id,season:SEASON.id,inSeason:inSeason(dayKey),
   cubePt:cubeBalance(s),earnedTotal:cubeEarnedTotal(s),
   playsToday:playsOn(s,dayKey),sessionsLeft:cubeSessionsLeft(s,dayKey),
   gates:Object.keys(s.gates),rewards:Object.keys(s.rewards),position:s.position,
   coinToday:!!p.coin[dayKey],coinDays:Object.keys(p.coin),
   completion:completion(s),effects:[...effectsOf(p)],updatedAt:p.updatedAt,
  };
 }
 snapshotAll(dayKey){return Object.fromEntries(playerIds.map(id=>[id,this.snapshot(id,dayKey)]));}
 effects(id){return effectsOf(this.player(id));}
}
