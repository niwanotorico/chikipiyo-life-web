// ピヨドリル：ピヨ探検（10月の報酬マップ）のルール。DOM なし・保存なし・純粋関数。
// 保存は cosmicube-store.js がまとめて受け持つ。ここは「データを受け取って新しいデータを返す」だけ。
//
// しくみ
//  - 10問クリア（ポイントがもらえる回＝1日3回まで）で、scoring.js のポイントをそのままピヨ探検pt（コード上は cubePt）として貯める
//  - キューブpt は「もらった記録（earned）」の合計 − 「ひらいたゲートのコスト」の合計。残高そのものは保存しない
//    （2台の iPad の記録を合わせるとき、記録どうしを足し合わせるだけで残高が自然に正しくなる）
//  - ゲートは排他ではない。どの順番でも、最後はぜんぶ開けられる（コンプ 100%）
//  - 見えかた：開いた場所・となり（❓）だけ見える。遠くは霧で見えない

export const SEASON={id:'2026-10',start:'2026-10-03',end:'2026-10-31',title:'ピヨ探検',sub:'10月の ほしぞら マップ'};
export const DAILY_CUBE_SESSIONS=3;   // キューブpt がもらえるのは1日3回まで（storage.js の DAILY_REWARD_SESSIONS と同じ）

// ごほうび。effects はドリル側で読む効果。house:true をつけると、開けたときに「3DPハウス来訪待ち」フラグを保存する
// （ハウス側は pendingHouseVisits() で読む想定。いまはフラグ保存のみ）
// secret：子どもの画面では中身を見せない（❓表示）。親にだけ見せる中身は parent-mode.js に置く
export const REWARDS={
 // うさこ：10月後半に別のごほうびとして追加予定。いまはマップのどこにも置かない（定義だけ残す）
 usako:{icon:'🐰',name:'うさこ',note:'もんだいに うさこが でてくる',effects:['usako']},   // 3DPハウス来訪は GLB ができたら house:true を足す
 bgm:{icon:'🎵',name:'BGM',note:'あたらしい きょく「うさこ」が ランダムで ながれる',effects:['bgm']},
 curry:{icon:'🍛',name:'カレー',note:'文章題に カレーが でてくる',effects:['curry']},
 toramana:{icon:'🐯',name:'トラマナちゃん',note:'もんだいに トラマナちゃんが でてくる／カレーが もっと でてくる／3DPハウスに あそびにくる',effects:['toramana','curry'],house:true},
 deep:{icon:'🌫️',name:'さいおくの ❓',note:'なにが あるかは まだ ひみつ。ひらいたら、おうちの人に つたえてね',secret:true},
};

// マップ。x,y はマップ上の位置（%）。requires は「ぜんぶ開いていれば挑戦できる」ゲート。
// reward:null は小ネタ用の空きスロット（中身を REWARDS に足して reward を書けば、そのまま開けられるようになる）
export const MAP={
 start:'start',
 nodes:[
  {id:'start',x:50,y:92,cost:0,reward:null,requires:[],label:'スタート'},
  {id:'slot-left',x:24,y:70,cost:40,reward:null,requires:['start']},   // 左40pt：空きスロット（❓）。中身は未定
  {id:'curry',x:76,y:70,cost:50,reward:'curry',requires:['start']},
  {id:'slot-a',x:12,y:52,cost:30,reward:null,requires:['slot-left']},
  {id:'bgm',x:34,y:42,cost:60,reward:'bgm',requires:['start']},       // 左40pt が空きのあいだも、最奥まで行けるようにスタートから
  {id:'toramana',x:66,y:42,cost:80,reward:'toramana',requires:['curry']},
  {id:'slot-b',x:88,y:52,cost:30,reward:null,requires:['curry']},
  {id:'slot-c',x:14,y:24,cost:40,reward:null,requires:['bgm']},
  {id:'slot-d',x:86,y:24,cost:40,reward:null,requires:['toramana']},
  {id:'deep',x:50,y:15,cost:120,reward:'deep',requires:['bgm','toramana']},
 ],
};
const NODE=Object.fromEntries(MAP.nodes.map(n=>[n.id,n]));
export const nodeById=id=>NODE[id]??null;
// ひらける（中身のある）ゲート。空きスロットはコンプ率に数えない
export const openableNodes=()=>MAP.nodes.filter(n=>n.id!==MAP.start&&n.reward&&REWARDS[n.reward]);

export function inSeason(dayKey,season=SEASON){return typeof dayKey==='string'&&dayKey>=season.start&&dayKey<=season.end;}

// ---------- データの形 ----------
// プレイヤー1人ぶん（この形のまま、将来 Firestore などに1ドキュメントとして置ける）
//   earned:  [{id:セッションID, day:'YYYY-MM-DD', pt}]   キューブpt の入金記録（同じ id は二度入らない）
//   gates:   {ノードID: {on:日付, cost}}                  ひらいたゲート
//   rewards: {ごほうびID: {on:日付, house:bool}}           もらったごほうび（house=3DPハウス来訪待ち）
//   position: ノードID                                     マップ上のいまの場所
//   coin:    {日付: セッションID}                          チキンコインミッション達成（その日の1回目クリア）
export function emptySeason(){return {earned:[],gates:{},rewards:{},position:MAP.start};}
export function emptyCubePlayer(){return {seasons:{[SEASON.id]:emptySeason()},coin:{},updatedAt:0};}

const DAY_RE=/^\d{4}-\d{2}-\d{2}$/;
const nat=(v,max=100000)=>Number.isSafeInteger(v)&&v>=0?Math.min(v,max):0;
const day=v=>typeof v==='string'&&DAY_RE.test(v)?v:null;
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const EARNED_LIMIT=200,COIN_DAYS_LIMIT=120;

export function sanitizeSeason(raw){
 const r=obj(raw),s=emptySeason();
 const seen=new Set();
 for(const e of Array.isArray(r.earned)?r.earned:[]){
  if(!e||typeof e.id!=='string'||!e.id||!day(e.day)||seen.has(e.id))continue;
  seen.add(e.id);s.earned.push({id:e.id.slice(0,80),day:e.day,pt:nat(e.pt,1000)});
 }
 s.earned=s.earned.slice(-EARNED_LIMIT);
 for(const [id,g] of Object.entries(obj(r.gates)))if(NODE[id]&&id!==MAP.start)s.gates[id]={on:day(obj(g).on),cost:nat(obj(g).cost,100000)};
 for(const [id,v] of Object.entries(obj(r.rewards)))if(REWARDS[id])s.rewards[id]={on:day(obj(v).on),house:obj(v).house===true&&!!REWARDS[id].house};   // 来訪のないごほうびにはフラグを残さない
 s.position=NODE[r.position]&&(r.position===MAP.start||s.gates[r.position])?r.position:MAP.start;
 return s;
}
export function sanitizeCubePlayer(raw){
 const r=obj(raw),p=emptyCubePlayer();
 for(const [id,season] of Object.entries(obj(r.seasons)))if(/^\d{4}-\d{2}$/.test(id))p.seasons[id]=sanitizeSeason(season);
 if(!p.seasons[SEASON.id])p.seasons[SEASON.id]=emptySeason();
 const coin={};
 for(const k of Object.keys(obj(r.coin)).filter(day).sort().slice(-COIN_DAYS_LIMIT))if(typeof r.coin[k]==='string')coin[k]=r.coin[k].slice(0,80);
 p.coin=coin;
 p.updatedAt=nat(r.updatedAt,Number.MAX_SAFE_INTEGER);
 return p;
}
const clone=v=>JSON.parse(JSON.stringify(v));

// ---------- 読むだけ ----------
export const season=(player,id=SEASON.id)=>player.seasons[id]??emptySeason();
export function cubeBalance(s){
 const inn=s.earned.reduce((a,e)=>a+e.pt,0);
 const out=Object.values(s.gates).reduce((a,g)=>a+g.cost,0);
 return Math.max(0,inn-out);
}
export function cubeEarnedTotal(s){return s.earned.reduce((a,e)=>a+e.pt,0);}
export function playsOn(s,dayKey){return s.earned.filter(e=>e.day===dayKey).length;}
export function cubeSessionsLeft(s,dayKey){return inSeason(dayKey)?Math.max(0,DAILY_CUBE_SESSIONS-playsOn(s,dayKey)):0;}
export function completion(s){
 const list=openableNodes();
 const done=list.filter(n=>s.gates[n.id]).length;
 return {done,total:list.length,percent:list.length?Math.floor(done/list.length*100):0};
}
export const isOpen=(s,id)=>id===MAP.start||!!s.gates[id];
// 全プレイヤー共通で、ごほうびが持つ効果（usako / curry / toramana / bgm）
export function effectsOf(player){
 const set=new Set();
 for(const s of Object.values(player.seasons))for(const id of Object.keys(s.rewards))for(const e of REWARDS[id]?.effects??[])set.add(e);
 return set;
}

// ノードの見えかた
//   'open'   ひらいた
//   'ready'  となりまで来ている（前のゲートがぜんぶ開いた）→ ❓＋コスト
//   'near'   前のゲートの一部が開いた（まだ開けられない）→ ❓＋🔒
//   'soon'   となりだけど、中身がまだない空きスロット → ❓ じゅんびちゅう
//   'fog'    遠くて見えない
export function nodeState(s,node){
 if(isOpen(s,node.id))return 'open';
 const met=node.requires.filter(id=>isOpen(s,id)).length;
 if(met===0)return 'fog';
 if(!node.reward||!REWARDS[node.reward])return 'soon';
 return met===node.requires.length?'ready':'near';
}
export function mapView(s,{parent=false}={}){
 return MAP.nodes.map(n=>{
  const state=nodeState(s,n);
  return {node:n,state:parent&&state==='fog'?(n.reward?'near':'soon'):state};
 });
}

// ---------- 書きかえ（新しいオブジェクトを返す） ----------
// 1回分（10問クリア）を入金する。award は storage.js commitResult の戻り値
// 戻り値 {player, cubePt, coinNew, reason}
//   reason: 'ok' | 'practice'（4回目以降）| 'season'（期間外）| 'limit'（その日3回ずみ）| 'duplicate'
export function recordSession(player,{sessionId,dayKey,award}){
 const next=sanitizeCubePlayer(clone(player));
 const s=season(next);
 let coinNew=false;
 // チキンコインミッション：その日はじめて 10問クリアしたら達成（ポイントの回数制限とは別）。
 // 既存ルールは「ベースミッション（宿題・お手伝い）→ 赤・青コイン（お小遣いに上乗せ）」だけで、
 // 赤と青の使い分けのルールは見つからなかったので、いまは達成日の記録のみ（仮実装）
 if(award?.cleared&&!next.coin[dayKey]){next.coin[dayKey]=sessionId;coinNew=true;}
 let reason='ok',cubePt=0;
 if(s.earned.some(e=>e.id===sessionId))reason='duplicate';
 else if(award?.practice)reason='practice';
 else if(!inSeason(dayKey))reason='season';
 else if(playsOn(s,dayKey)>=DAILY_CUBE_SESSIONS)reason='limit';
 else{cubePt=nat(award?.points,1000);s.earned.push({id:sessionId,day:dayKey,pt:cubePt});}
 next.seasons[SEASON.id]=sanitizeSeason(s);
 return {player:next,cubePt,coinNew,reason};
}

// ゲートを開ける。戻り値 {player, ok, reason, reward}
//   reason: 'ok' | 'unknown' | 'open' | 'locked' | 'empty' | 'short'（pt 不足）
export function openGate(player,nodeId,dayKey){
 const node=NODE[nodeId];
 if(!node||nodeId===MAP.start)return {player,ok:false,reason:'unknown'};
 const s0=season(player);
 if(s0.gates[nodeId])return {player,ok:false,reason:'open'};
 if(!node.reward||!REWARDS[node.reward])return {player,ok:false,reason:'empty'};
 if(!node.requires.every(id=>isOpen(s0,id)))return {player,ok:false,reason:'locked'};
 if(cubeBalance(s0)<node.cost)return {player,ok:false,reason:'short'};
 const next=sanitizeCubePlayer(clone(player)),s=season(next);
 s.gates[nodeId]={on:dayKey,cost:node.cost};
 s.rewards[node.reward]={on:dayKey,house:!!REWARDS[node.reward].house};
 s.position=nodeId;
 next.seasons[SEASON.id]=sanitizeSeason(s);
 return {player:next,ok:true,reason:'ok',reward:node.reward};
}

// ---------- 2台の記録を合わせる（将来の端末間同期用） ----------
// どちらの端末で遊んだ記録も消えないよう「足し合わせ」にする。残高は記録から計算するので矛盾しない。
// 同じゲートを両方の端末で開けていた場合は、先に開けたほうの記録を残す（コストは1回ぶん）。
export function mergeCubePlayer(a,b){
 const A=sanitizeCubePlayer(a),B=sanitizeCubePlayer(b),out=emptyCubePlayer();
 for(const id of new Set([...Object.keys(A.seasons),...Object.keys(B.seasons)])){
  const x=A.seasons[id]??emptySeason(),y=B.seasons[id]??emptySeason();
  const earned=[...x.earned,...y.earned].sort((p,q)=>p.day.localeCompare(q.day));
  const gates={...y.gates};
  for(const [k,g] of Object.entries(x.gates))if(!gates[k]||(g.on??'')<=(gates[k].on??''))gates[k]=g;
  const rewards={...y.rewards};
  for(const [k,r] of Object.entries(x.rewards))rewards[k]=rewards[k]?{on:[r.on,rewards[k].on].filter(Boolean).sort()[0]??null,house:r.house&&rewards[k].house}:r;
  const newer=A.updatedAt>=B.updatedAt?x:y;
  out.seasons[id]=sanitizeSeason({earned,gates,rewards,position:newer.position});
 }
 out.coin={...B.coin,...A.coin};
 out.updatedAt=Math.max(A.updatedAt,B.updatedAt);
 return sanitizeCubePlayer(out);
}

// 3DPハウス側（将来）が「来訪待ち」を読んで、来たら消すための関数
export function pendingHouseVisits(player){
 const list=[];
 for(const s of Object.values(player.seasons))for(const [id,r] of Object.entries(s.rewards))if(r.house)list.push(id);
 return list;
}
