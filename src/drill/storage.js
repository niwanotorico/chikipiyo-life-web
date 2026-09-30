// ピヨドリル：記録の保存（v0.1 は端末内 localStorage だけ）。
// 既存のチキンポイント通帳（Firestore records）は、ちきんの管理者ログインでしか書けない。
// ドリルから安全に加算する手段がまだ無いので、ここでは Firestore に一切触らず、別のキーに分けて保存する。
import {PLAYERS,playerIds} from './questions.js';
import {scoreAnswers} from './scoring.js';

export const STORE_KEY='chikipiyo-quest:v1';
export const BROKEN_KEY=STORE_KEY+':broken';
export const DAILY_REWARD_SESSIONS=3; // 1日にポイントがもらえるのは3回まで。それ以降は「れんしゅう」
const HISTORY_LIMIT=30,COMMITTED_LIMIT=100,DAYS_LIMIT=60,MAX_POINTS=1000000;
const DAY_RE=/^\d{4}-\d{2}-\d{2}$/;

const nat=(v,max=MAX_POINTS)=>Number.isSafeInteger(v)&&v>=0?Math.min(v,max):0;
const bool=v=>v===true;
const day=v=>typeof v==='string'&&DAY_RE.test(v)?v:null;

export function todayKey(date=new Date()){
 const p=n=>String(n).padStart(2,'0');
 return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`;
}

export function emptyPlayer(){return {points:0,pudding:{earned:false,earnedOn:null,displayed:false},days:{},history:[]};}
export function emptyStore(){return {version:1,selected:null,players:Object.fromEntries(playerIds.map(id=>[id,emptyPlayer()])),committed:[]};}
export function emptyDay(){return {sessions:0,rewarded:0,cleared:false,clearBonus:false,perfectBonus:false,bestCorrect:0,bestCombo:0,points:0};}

function sanitizeDay(d){
 if(!d||typeof d!=='object')return emptyDay();
 return {sessions:nat(d.sessions,9999),rewarded:nat(d.rewarded,9999),cleared:bool(d.cleared),clearBonus:bool(d.clearBonus),perfectBonus:bool(d.perfectBonus),bestCorrect:nat(d.bestCorrect,10),bestCombo:nat(d.bestCombo,10),points:nat(d.points)};
}
function sanitizeHistory(h){
 if(!h||typeof h!=='object'||typeof h.id!=='string'||!day(h.day))return null;
 return {id:h.id.slice(0,80),day:h.day,correct:nat(h.correct,10),maxCombo:nat(h.maxCombo,10),points:nat(h.points,100),practice:bool(h.practice)};
}
function sanitizePlayer(p){
 if(!p||typeof p!=='object')return emptyPlayer();
 const pud=p.pudding&&typeof p.pudding==='object'?p.pudding:{};
 const earned=bool(pud.earned);
 const days={};
 if(p.days&&typeof p.days==='object')for(const k of Object.keys(p.days).filter(day).sort().slice(-DAYS_LIMIT))days[k]=sanitizeDay(p.days[k]);
 return {
  points:nat(p.points),
  pudding:{earned,earnedOn:earned?day(pud.earnedOn):null,displayed:earned&&bool(pud.displayed)},
  days,
  history:(Array.isArray(p.history)?p.history:[]).map(sanitizeHistory).filter(Boolean).slice(-HISTORY_LIMIT),
 };
}
export function sanitizeStore(raw){
 const s=emptyStore();
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
 s.selected=playerIds.includes(raw.selected)?raw.selected:null;
 const players=raw.players&&typeof raw.players==='object'?raw.players:{};
 for(const id of playerIds)s.players[id]=sanitizePlayer(players[id]);
 s.committed=(Array.isArray(raw.committed)?raw.committed:[]).filter(v=>typeof v==='string').slice(-COMMITTED_LIMIT);
 return s;
}

// localStorage が使えない環境（プライベートモードなど）でも落ちないように
export function safeStorage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch{return null;}}

// 戻り値 {store, status}: 'new' 初めて / 'ok' 読めた / 'recovered' 壊れていたので作りなおした / 'unavailable' 保存できない
export function loadStore(storage=safeStorage()){
 if(!storage)return {store:emptyStore(),status:'unavailable'};
 let text=null;
 try{text=storage.getItem(STORE_KEY);}catch{return {store:emptyStore(),status:'unavailable'};}
 if(text==null)return {store:emptyStore(),status:'new'};
 try{
  const raw=JSON.parse(text);
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)throw new Error('bad shape');
  return {store:sanitizeStore(raw),status:'ok'};
 }catch{
  // 壊れたデータは消さずに退避してから、まっさらで始める
  try{storage.setItem(BROKEN_KEY,text);}catch{}
  return {store:emptyStore(),status:'recovered'};
 }
}
export function saveStore(store,storage=safeStorage()){
 if(!storage)return false;
 try{storage.setItem(STORE_KEY,JSON.stringify(store));return true;}catch{return false;}
}

export function dayInfo(store,player,dayKey){return store.players[player]?.days[dayKey]??emptyDay();}
export function sessionsLeft(store,player,dayKey){return Math.max(0,DAILY_REWARD_SESSIONS-dayInfo(store,player,dayKey).rewarded);}

// 1回分の結果を保存する。同じ sessionId は二度と加算しない（更新・戻る・連打対策）。
// oks: 各問の正誤（boolean の配列）。ポイントはここで計算しなおし、画面側の数字は信じない。
export function commitResult(store,{sessionId,player,dayKey,oks}){
 if(!PLAYERS[player])throw new Error(`unknown player: ${player}`);
 if(typeof sessionId!=='string'||!sessionId)throw new Error('sessionId required');
 if(store.committed.includes(sessionId)){
  return {store,duplicate:true,award:null};
 }
 const next=sanitizeStore(JSON.parse(JSON.stringify(store)));
 const p=next.players[player];
 const d={...dayInfo(next,player,dayKey)};
 const practice=d.rewarded>=DAILY_REWARD_SESSIONS;
 const base=scoreAnswers(oks);
 let award;
 if(practice){
  award={...base,questionPoints:0,comboPoints:0,clearBonus:0,perfectBonus:0,points:0};
 }else{
  award=scoreAnswers(oks,{clearBonus:!d.clearBonus,perfectBonus:!d.perfectBonus});
  d.rewarded++;
  if(award.clearBonus)d.clearBonus=true;
  if(award.perfectBonus)d.perfectBonus=true;
 }
 award.practice=practice;
 award.clearBonusAlready=base.cleared&&!practice&&!award.clearBonus;
 award.perfectBonusAlready=base.perfect&&!practice&&!award.perfectBonus;
 award.puddingNew=base.cleared&&!p.pudding.earned;
 if(award.puddingNew)p.pudding={earned:true,earnedOn:dayKey,displayed:false};
 d.sessions++;
 d.cleared=d.cleared||base.cleared;
 d.bestCorrect=Math.max(d.bestCorrect,base.correct);
 d.bestCombo=Math.max(d.bestCombo,base.maxCombo);
 d.points=Math.min(MAX_POINTS,d.points+award.points);
 p.days[dayKey]=d;
 p.points=Math.min(MAX_POINTS,p.points+award.points);
 p.history=[...p.history,{id:sessionId,day:dayKey,correct:base.correct,maxCombo:base.maxCombo,points:award.points,practice}].slice(-HISTORY_LIMIT);
 next.committed=[...next.committed,sessionId].slice(-COMMITTED_LIMIT);
 next.selected=player;
 return {store:sanitizeStore(next),duplicate:false,award};
}

export function setPuddingDisplayed(store,player,displayed=true){
 const next=sanitizeStore(JSON.parse(JSON.stringify(store)));
 if(next.players[player]?.pudding.earned)next.players[player].pudding.displayed=!!displayed;
 return next;
}
export function selectPlayer(store,player){
 const next=sanitizeStore(JSON.parse(JSON.stringify(store)));
 next.selected=playerIds.includes(player)?player:null;
 return next;
}
