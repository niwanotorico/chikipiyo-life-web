// 3DPハウスの本だな：マンガの本（シリーズ）と話の一覧。DOM なし。
// 本はシリーズごとに1冊。ピヨドリルのピヨ探検で ごほうびを ひらくと、その話が本に ふえる
// （どの ごほうびで どの話が ふえるかは src/drill/cosmicube.js の REWARDS[].manga）。
// 話を足すとき：ここに話を足す → piyodrill/manga/<folder>/ に「…_タイトル.png」 → npm run manga（scripts/build-manga.mjs）
// → cosmicube.js の ごほうびに話IDを書く。総話数は どこにも出さない（あとから ふえるため）。
import {MANGA_PAGES} from './pages.js';

export const SERIES=[
 {id:'mc',title:'マイクラ本',folder:'01_minecraft',color:'#5c9a3c',ink:'#2f4a1f',paper:'#eef6e4',
  episodes:[
   {id:'mc-01',no:1,title:'自動化の沼'},
   {id:'mc-02',no:2,title:'寝る場所'},
   {id:'mc-03',no:3,title:'宝さがし'},
   {id:'mc-04',no:4,title:'おともだち'},
  ]},
 {id:'daily',title:'まったり日常本',folder:'02_slowlife',color:'#e7a6a0',ink:'#6b3f3a',paper:'#fdf3ea',
  episodes:[
   {id:'daily-01',no:1,title:'葉っぱの行き先'},
   {id:'daily-02',no:2,title:'かげのせいくらべ'},
   {id:'daily-03',no:3,title:'くものおやつ'},
   {id:'daily-04',no:4,title:'いしのひなた'},
  ]},
 // 季節の本：イベントの話。ピヨ探検のゲートではなく、条件を満たすと自動で ふえる（cosmicube.js の AUTO_MANGA）
 {id:'season',title:'季節の本',folder:'03_event',color:'#e8893a',ink:'#4a2d5c',paper:'#fbf0e2',
  hint:'ピヨ探検を すすめると、いつのまにか この本が ふえるかも？',   // 条件（トラマナちゃん＋BGM）は 子どもには ひみつ
  episodes:[
   {id:'season-01',no:1,title:'ハロウィン攻略法'},
  ]},
];
export const seriesById=id=>SERIES.find(s=>s.id===id)??null;
export const allEpisodes=()=>SERIES.flatMap(s=>s.episodes.map(e=>({...e,series:s.id})));
export const episodeById=id=>allEpisodes().find(e=>e.id===id)??null;

// ピヨドリルのプレイヤー（src/drill/questions.js の PLAYERS と同じ。ドリルの問題データまで読みこまないよう、ここに名前だけ持つ）
export const MANGA_PLAYERS=[{id:'piyokichi',name:'ぴよきち'},{id:'piyomi',name:'ぴよみ'}];

// 配信用の画像（public/manga/ 以下）。GitHub Pages のサブディレクトリでも動くよう Vite の BASE_URL を前につける
function baseUrl(){
 const base=typeof import.meta!=='undefined'&&import.meta.env?.BASE_URL||'/';
 return base.endsWith('/')?base:base+'/';
}
// 話のページ一覧 [{src,w,h}]。まだ画像が とどいていない話は []
export function episodePages(id,base=baseUrl()){
 return (MANGA_PAGES[id]??[]).map(p=>({src:base+p.src,w:p.w,h:p.h}));
}

// シリーズの中で よめる話（catalog の順）。unlocked は話IDの Set
export function readableEpisodes(seriesId,unlocked){
 return (seriesById(seriesId)?.episodes??[]).filter(e=>unlocked.has(e.id));
}
