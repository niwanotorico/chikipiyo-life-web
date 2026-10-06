// 3DPハウスの本だな：だれが どの話を よめるか。ピヨドリルの保存データを「読むだけ」で調べる。
// ピヨドリルのキー（chikipiyo-cosmicube:v1 / chikipiyo-quest:v1）には ぜったいに書かない。
// 本だな自身が おぼえるのは「さいごに えらんだ人」と「さいごに よんだ ところ」だけで、別のキーに置く。
import {sanitizeCubePlayer,mangaOf} from '../drill/cosmicube.js';
import {MANGA_PLAYERS,seriesById} from './catalog.js';

// キー名は cosmicube-store.js / storage.js と同じ（そちらを import すると ドリルの問題データまで ハウスに入るので、ここに書く。テストで一致を確認）
export const CUBE_KEY='chikipiyo-cosmicube:v1';   // ピヨ探検（ごほうび）
export const QUEST_KEY='chikipiyo-quest:v1';      // ピヨドリルの記録（selected = さいごに あそんだ人）
export const SHELF_KEY='chikipiyo-manga:v1';      // 本だなの おぼえごと

export function safeStorage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch{return null;}}
function readJSON(storage,key){
 try{const text=storage?.getItem(key);return text==null?null:JSON.parse(text);}catch{return null;}
}
const isPlayer=id=>MANGA_PLAYERS.some(p=>p.id===id);

// 端末の日付 'YYYY-MM-DD'（storage.js の todayKey と同じ）。ハロウィンなど 日付つきの おまけの判定に使う
export function todayKey(date=new Date()){
 const p=n=>String(n).padStart(2,'0');
 return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`;
}

// 戻り値 {piyokichi:Set<話ID>, piyomi:Set<話ID>}。データがない・こわれていても 空の Set
export function readUnlocks(storage,dayKey=todayKey()){
 const raw=readJSON(storage,CUBE_KEY);
 const players=raw&&typeof raw==='object'&&raw.players&&typeof raw.players==='object'?raw.players:{};
 return Object.fromEntries(MANGA_PLAYERS.map(p=>[p.id,raw?.version===1?mangaOf(sanitizeCubePlayer(players[p.id]),dayKey):new Set()]));
}

export function readShelf(storage){
 const raw=readJSON(storage,SHELF_KEY);
 const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const last={};
 for(const p of MANGA_PLAYERS){
  const byPlayer=r.last?.[p.id];if(!byPlayer||typeof byPlayer!=='object')continue;
  for(const [series,v] of Object.entries(byPlayer)){
   if(!seriesById(series)||!v||typeof v.episode!=='string')continue;
   (last[p.id]??={})[series]={episode:v.episode.slice(0,40),page:Number.isSafeInteger(v.page)&&v.page>=0?Math.min(v.page,999):0};
  }
 }
 return {player:isPlayer(r.player)?r.player:null,last};
}
export function writeShelf(storage,shelf){
 try{storage?.setItem(SHELF_KEY,JSON.stringify({player:shelf.player,last:shelf.last}));return true;}catch{return false;}
}

// ひらいたときの人：ピヨドリルで いま えらばれている人 → 本だなで さいごに えらんだ人 → まだ わからない（null）
// （ドリルで あそんだ子が そのまま おうちに来たとき、その子の本だなが ひらくように）
export function defaultPlayer(storage,shelf=readShelf(storage)){
 const sel=readJSON(storage,QUEST_KEY)?.selected;
 return isPlayer(sel)?sel:shelf.player;
}
