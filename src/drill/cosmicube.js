// ピヨドリル：ピヨ探検（10月の報酬マップ）のルール。DOM なし・保存なし・純粋関数。
// 保存は cosmicube-store.js がまとめて受け持つ。ここは「データを受け取って新しいデータを返す」だけ。
//
// しくみ
//  - 10問クリア（ポイントがもらえる回＝1日3回まで）で、scoring.js のポイントをそのままピヨ探検pt（コード上は cubePt）として貯める
//  - キューブpt は「もらった記録（earned）」の合計 − 「ひらいたゲートのコスト」の合計。残高そのものは保存しない
//    （2台の iPad の記録を合わせるとき、記録どうしを足し合わせるだけで残高が自然に正しくなる）
//  - ゲートは排他ではない。どの順番でも、最後はぜんぶ開けられる
//  - 見えかた：開いた場所・となり（❓）だけ見える。遠くは霧で見えない

export const SEASON={id:'2026-10',start:'2026-10-03',end:'2026-10-31',title:'ピヨ探検',sub:'10月の ほしぞら マップ'};
export const DAILY_CUBE_SESSIONS=3;   // キューブpt がもらえるのは1日3回まで（storage.js の DAILY_REWARD_SESSIONS と同じ）
// マンガのゲートと ハロウィンの自動解放は、この日（端末の日付）から。それより前は いままでどおり ❓じゅんびちゅう。
// 公開した時刻に関係なく 日付で切りかわる（画面を開いたまま 日付をまたいでも、つぎの表示から反映）。ポイントの計算は変えない
export const UPDATE_FROM='2026-10-07';

// ごほうび。effects はドリル側で読む効果。house:true をつけると、開けたときに「3DPハウス来訪待ち」フラグを保存する
// （ハウス側は pendingHouseVisits() で読む想定。いまはフラグ保存のみ）
// secret：子どもの画面では中身を見せない（❓表示）。親にだけ見せる中身は parent-mode.js に置く
export const REWARDS={
 // うさこ：10月後半に別のごほうびとして追加予定。いまはマップのどこにも置かない（定義だけ残す）
 usako:{icon:'🐰',name:'うさこ',note:'もんだいに うさこが でてくる',effects:['usako']},   // 3DPハウス来訪は GLB ができたら house:true を足す
 bgm:{icon:'🎵',name:'テーマソング',note:'トップで「テーマソング」が ながれる',effects:['bgm']},
 curry:{icon:'🍛',name:'カレー',note:'文章題に カレーが でてくる',effects:['curry']},
 toramana:{icon:'🐯',name:'トラマナちゃん',note:'もんだいに トラマナちゃんが でてくる／カレーが もっと でてくる／3DPハウスに あそびにくる',effects:['toramana','curry'],house:true},
 deep:{icon:'🌫️',name:'さいおくの ❓',note:'なにが あるかは まだ ひみつ。ひらいたら、おうちの人に つたえてね',secret:true},
 // マンガ：manga に書いた話（src/manga/catalog.js の話ID）が、3DPハウスの本だなで よめるようになる。
 // 1つのごほうびで「マイクラ本」「まったり日常本」が1話ずつ ふえる。話の順番は catalog.js の順（ひらいた順ではない）
 'manga-1':{icon:'📚',name:'マンガ「自動化の沼」「葉っぱの行き先」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-01','daily-01'],effects:[]},
 'manga-2':{icon:'📚',name:'マンガ「寝る場所」「かげのせいくらべ」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-02','daily-02'],effects:[]},
 'manga-3':{icon:'📚',name:'マンガ「宝さがし」「くものおやつ」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-03','daily-03'],effects:[]},
 'manga-4':{icon:'📚',name:'マンガ「おともだち」「いしのひなた」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-04','daily-04'],effects:[]},
 // 小さいマスの マンガ（1話ずつ）
 'manga-5':{icon:'📚',name:'マンガ「人気者」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-06'],effects:[]},
 'manga-6':{icon:'📚',name:'マンガ「おなかのおへんじ」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-07'],effects:[]},
 'manga-7':{icon:'📚',name:'マンガ「いいながめ」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-07'],effects:[]},
 'manga-8':{icon:'📚',name:'マンガ「かぜのかくれんぼ」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-08'],effects:[]},
 'manga-9':{icon:'📚',name:'マンガ「ねこの指定席」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-08'],effects:[]},
 'manga-10':{icon:'📚',name:'マンガ「くものいす」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-09'],effects:[]},
};

// マップ。x,y はマップ上の位置（%）。requires は「ぜんぶ開いていれば挑戦できる」ゲート。
// small：大きいゲートの手前の 小さいマス（10/9〜。マンガ1話ずつ）。大きいゲートの pt を そのぶん下げたので、道の合計 pt は もとのまま（中身のあるゲート 合計390pt）。
// before：その先の 大きいゲート。もう ひらいている子は、手前の 小さいマスを pt なしで ひらける（もう とおった道。costOf）
// reward:null は小ネタ用の空きスロット（中身を REWARDS に足して reward を書けば、そのまま開けられるようになる）
export const MAP={
 start:'start',
 nodes:[
  {id:'start',x:50,y:93,cost:0,reward:null,requires:[],label:'スタート'},
  {id:'slot-left',x:22,y:75,cost:20,reward:'manga-1',requires:['start'],from:UPDATE_FROM},   // もと空きスロット（左40pt）→ マンガ 20pt（マンガ4つで80pt。マンガ込み合計390pt、うさこ40ptを足して430pt）
  {id:'curry',x:78,y:75,cost:50,reward:'curry',requires:['start']},
  {id:'slot-a',x:10,y:57,cost:20,reward:'manga-2',requires:['slot-left'],from:UPDATE_FROM},
  {id:'step-bgm-1',x:41,y:79,cost:20,reward:'manga-5',requires:['start'],small:true,before:'bgm'},
  {id:'step-bgm-2',x:37,y:63,cost:20,reward:'manga-6',requires:['step-bgm-1'],small:true,before:'bgm'},
  {id:'bgm',x:30,y:47,cost:20,reward:'bgm',requires:['step-bgm-2']},       // もと 60pt（スタートから）→ マンガの小さいマス 20pt×2 ＋ 20pt
  {id:'step-tora-1',x:62,y:62,cost:20,reward:'manga-7',requires:['curry'],small:true,before:'toramana'},
  {id:'step-tora-2',x:66,y:52,cost:20,reward:'manga-8',requires:['step-tora-1'],small:true,before:'toramana'},
  {id:'toramana',x:70,y:40,cost:40,reward:'toramana',requires:['step-tora-2']},   // もと 80pt（カレーから）→ 20pt×2 ＋ 40pt
  {id:'slot-b',x:90,y:57,cost:20,reward:'manga-3',requires:['curry'],from:UPDATE_FROM},
  {id:'slot-c',x:12,y:28,cost:20,reward:'manga-4',requires:['bgm'],from:UPDATE_FROM},   // もと40pt → マンガ 20pt
  {id:'slot-d',x:88,y:24,cost:40,reward:null,requires:['toramana']},   // 空きスロット。うさこ（10月後半）用に残す
  {id:'step-deep-1',x:50,y:35,cost:20,reward:'manga-9',requires:['bgm','toramana'],small:true,before:'deep'},
  {id:'step-deep-2',x:50,y:24,cost:20,reward:'manga-10',requires:['step-deep-1'],small:true,before:'deep'},
  {id:'deep',x:50,y:12,cost:80,reward:'deep',requires:['step-deep-2']},   // もと 120pt → 20pt×2 ＋ 80pt
 ],
};
const NODE=Object.fromEntries(MAP.nodes.map(n=>[n.id,n]));
export const nodeById=id=>NODE[id]??null;
// ひらける（中身のある）ゲート。空きスロットは数えない
export const openableNodes=()=>MAP.nodes.filter(n=>n.id!==MAP.start&&n.reward&&REWARDS[n.reward]);
// from のあるゲート（と おまけ）は、その日から（dayKey がわからないときは まだ）
export const nodeActive=(node,dayKey)=>!node.from||(typeof dayKey==='string'&&dayKey>=node.from);

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
// みつけた ごほうびの数（画面の「みつけた ごほうび ○こ」）＝ 中身のあるゲートを ひらいた数。総数は出さない（あとから ふえるため）
// マンガのゲートは 2話ぶんでも 1こ。ハロウィンなどの 自動の おまけ（AUTO_MANGA）は 数えない
export function foundCount(s){return Object.keys(s.gates).filter(id=>REWARDS[NODE[id]?.reward]).length;}
export function completion(s){
 const list=openableNodes();
 const done=list.filter(n=>s.gates[n.id]).length;
 return {done,total:list.length,percent:list.length?Math.floor(done/list.length*100):0};
}
export const isOpen=(s,id)=>id===MAP.start||!!s.gates[id];
// いま ひらくのに いる pt。その先の 大きいゲートを もう ひらいていれば、手前の 小さいマスは 0pt
export const costOf=(s,node)=>node.before&&isOpen(s,node.before)?0:node.cost;
// 全プレイヤー共通で、ごほうびが持つ効果（usako / curry / toramana / bgm）
export function effectsOf(player){
 const set=new Set();
 for(const s of Object.values(player.seasons))for(const id of Object.keys(s.rewards))for(const e of REWARDS[id]?.effects??[])set.add(e);
 return set;
}
// マンガのごほうびで よめるようになった話ID（3DPハウスの本だなが読む。ハウスは読むだけで保存しない）
// ひらいたゲートからも数える：マンガを知らない古いページ（キャッシュ）が保存すると rewards の manga-* は消えるが、
// gates（slot-left など）は残るので、そこから取りもどせる
// ---------- 毎日の ごほうび（10/9 から） ----------
// その日はじめて 10もん クリアした日（＝チキンコインミッションを たっせいした日。player.coin に もう保存されている）に、
// おとどけリストの つぎの 1こが とどく。点数には 関係なし。ピヨ探検pt・ゲートとは べつ。
// 新しい保存データは 足さない：10/9 からの coin の日を じゅんばんに数えて、n日目に リストの n こ目、と毎回きめる
// （古いページが保存しても coin は のこるので、ごほうびも 消えない）。リストの最後まで とどいたら、それ以上は なし（あとから 足せる）
export const GIFT_FROM='2026-10-09';
export const DAILY_GIFTS=[
 {id:'st-onpu',sticker:'onpu',name:'おんぷダンス'},
 {id:'st-dj',sticker:'dj',name:'DJ'},
 {id:'mg-mc-05',manga:['mc-05'],name:'マンガ「近道」'},
 {id:'st-headphones',sticker:'headphones',name:'ヘッドホン'},
 {id:'st-banzai',sticker:'banzai',name:'バンザイ'},
 {id:'mg-daily-05',manga:['daily-05'],name:'マンガ「かたつむりのかさ」'},
 {id:'st-duo',sticker:'duo',name:'ふたりでダンス'},
 {id:'st-radio',sticker:'radio',name:'ラジカセ'},
 {id:'mg-daily-06',manga:['daily-06'],name:'マンガ「みずたまりのそら」'},
 {id:'st-wink',sticker:'wink',name:'ウインクダンス'},
 {id:'st-kurutto',sticker:'kurutto',name:'くるっと'},
 {id:'st-batsu1',sticker:'batsu1',name:'×その1'},
 {id:'st-batsu2',sticker:'batsu2',name:'×その2'},
 {id:'st-piyokichi',sticker:'piyokichi',name:'iPadの ぴよきち'},
 {id:'st-piyomi',sticker:'piyomi',name:'iPadの ぴよみ'},
 {id:'st-toramana',sticker:'toramana',name:'トラマナちゃん'},
];
// とどいた ごほうび [{day, ...ごほうび}]（とどいた じゅん）
export function giftsOf(player){
 const days=Object.keys(player.coin??{}).filter(d=>d>=GIFT_FROM&&d<=SEASON.end).sort();
 return days.slice(0,DAILY_GIFTS.length).map((day,i)=>({day,...DAILY_GIFTS[i]}));
}
export const giftOn=(player,dayKey)=>giftsOf(player).find(g=>g.day===dayKey)??null;
// きょう まだ もらっていなくて、クリアすれば もらえるか
export const giftAvailable=(player,dayKey)=>typeof dayKey==='string'&&dayKey>=GIFT_FROM&&dayKey<=SEASON.end&&!player.coin?.[dayKey]&&giftsOf(player).length<DAILY_GIFTS.length;

// 自動でふえるマンガ：requires の ごほうびを ぜんぶ持っていれば、pt なし・ゲートなしで よめる。
// 保存はしない（毎回 持っている ごほうびから決める）ので、条件を先に満たしていた子にも そのまま効く。最奥など ほかの ごほうびは変えない
export const AUTO_MANGA=[
 {id:'halloween',requires:['toramana','bgm'],manga:['season-01'],from:UPDATE_FROM},   // 季節の本「ハロウィン攻略法」
];
export function mangaOf(player,dayKey){
 const owned=new Set();
 for(const s of Object.values(player.seasons))for(const id of [...Object.keys(s.rewards),...Object.keys(s.gates).map(id=>NODE[id]?.reward)])if(id)owned.add(id);
 const set=new Set();
 for(const id of owned)for(const e of REWARDS[id]?.manga??[])set.add(e);
 for(const a of AUTO_MANGA)if(nodeActive(a,dayKey)&&a.requires.every(id=>owned.has(id)))for(const e of a.manga)set.add(e);
 for(const g of giftsOf(player))for(const e of g.manga??[])set.add(e);   // 毎日の ごほうびの マンガ
 return set;
}

// ノードの見えかた
//   'open'   ひらいた
//   'ready'  となりまで来ている（前のゲートがぜんぶ開いた）→ ❓＋コスト
//   'near'   前のゲートの一部が開いた（まだ開けられない）→ ❓＋🔒
//   'soon'   となりだけど、中身がまだない空きスロット → ❓ じゅんびちゅう
//   'fog'    遠くて見えない
export function nodeState(s,node,dayKey){
 if(isOpen(s,node.id))return 'open';
 const met=node.requires.filter(id=>isOpen(s,id)).length;
 if(met===0)return 'fog';
 if(!node.reward||!REWARDS[node.reward]||!nodeActive(node,dayKey))return 'soon';
 return met===node.requires.length?'ready':'near';
}
export function mapView(s,{parent=false,dayKey}={}){
 return MAP.nodes.map(n=>{
  const state=nodeState(s,n,dayKey);
  return {node:n,state:parent&&state==='fog'?(n.reward&&nodeActive(n,dayKey)?'near':'soon'):state};
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
 if(!node.reward||!REWARDS[node.reward]||!nodeActive(node,dayKey))return {player,ok:false,reason:'empty'};
 if(!node.requires.every(id=>isOpen(s0,id)))return {player,ok:false,reason:'locked'};
 const cost=costOf(s0,node);
 if(cubeBalance(s0)<cost)return {player,ok:false,reason:'short'};
 const next=sanitizeCubePlayer(clone(player)),s=season(next);
 s.gates[nodeId]={on:dayKey,cost};
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
