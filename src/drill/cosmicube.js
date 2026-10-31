// ピヨドリル：ピヨ探検（10月の報酬マップ）のルール。DOM なし・保存なし・純粋関数。
// 保存は cosmicube-store.js がまとめて受け持つ。ここは「データを受け取って新しいデータを返す」だけ。
//
// しくみ
//  - 10問クリア（ポイントがもらえる回＝1日3回まで）で、scoring.js のポイントをそのままピヨ探検pt（コード上は cubePt）として貯める
//  - キューブpt は「もらった記録（earned）」の合計 − 「ひらいたゲートのコスト」の合計。残高そのものは保存しない
//    （2台の iPad の記録を合わせるとき、記録どうしを足し合わせるだけで残高が自然に正しくなる）
//  - ゲートは排他ではない。どの順番でも、最後はぜんぶ開けられる
//  - 見えかた：開いた場所・となり（❓）だけ見える。遠くは霧で見えない

// 11月も 同じ シーズン（id は 2026-10 のまま）で つづける：pt・ひらいた ゲート・ほし は そのまま 持ちこし。
// 11月の マスは べつの マップ「もみじの もり」（MOMIJI）に 足していく
export const SEASON={id:'2026-10',start:'2026-10-03',end:'2026-11-30',title:'ピヨ探検',sub:'ほしぞら と もみじの もり'};
export const DAILY_CUBE_SESSIONS=3;   // キューブpt がもらえるのは1日3回まで（storage.js の DAILY_REWARD_SESSIONS と同じ）
// マンガのゲートは、この日（端末の日付）から。それより前は いままでどおり ❓じゅんびちゅう。
// 公開した時刻に関係なく 日付で切りかわる（画面を開いたまま 日付をまたいでも、つぎの表示から反映）。ポイントの計算は変えない
export const UPDATE_FROM='2026-10-07';

// ごほうび。effects はドリル側で読む効果。house:true をつけると、開けたときに「3DPハウス来訪待ち」フラグを保存する
// （トラマナちゃんは 3DPハウスの src/world/toramana-visit.js が ゲート・ごほうびを 読んで 部屋に 出す）
// secret：子どもの画面では中身を見せない（❓表示）。親にだけ見せる中身は parent-mode.js に置く
export const REWARDS={
 // うさこ：11月の「もみじの もり」の マス
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
 // もと「まいにちの みち」で とどける予定だった マンガ（10/10 から マップへ）
 'manga-11':{icon:'📚',name:'マンガ「近道」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-05'],effects:[]},
 'manga-12':{icon:'📚',name:'マンガ「かたつむりのかさ」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-05'],effects:[]},
 'manga-13':{icon:'📚',name:'マンガ「みずたまりのそら」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-06'],effects:[]},
 // シール（ドット絵。シールちょうに はる）。仮の マスの 中身
 'manga-14':{icon:'🎃',name:'マンガ「ハロウィン攻略法」',note:'3DPハウスの 本だなで よめるよ',manga:['season-01'],effects:[]},
 'st-dj':{icon:'🏷️',name:'シール「DJ」',label:'DJ',note:'シールちょうに はったよ',sticker:'dj',effects:[]},
 'st-headphones':{icon:'🏷️',name:'シール「ヘッドホン」',label:'ヘッドホン',note:'シールちょうに はったよ',sticker:'headphones',effects:[]},
 // ---- ハードモード（さいおくの さらに おく。10/21〜）----
 // マンガは 1マス1話。シールは まだ つかっていなかった ドット絵
 'manga-15':{icon:'📚',name:'マンガ「ひみつの入口」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-09'],effects:[]},
 'manga-16':{icon:'📚',name:'マンガ「くしゃみのしゅっぱつ」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-10'],effects:[]},
 'manga-17':{icon:'📚',name:'マンガ「おかわり」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-10'],effects:[]},
 'manga-18':{icon:'📚',name:'マンガ「しずくのまちあわせ」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-11'],effects:[]},
 'manga-19':{icon:'📚',name:'マンガ「かくれんぼ」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-11'],effects:[]},
 'manga-20':{icon:'📚',name:'マンガ「おさんぽのおきゃくさん」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-12'],effects:[]},
 'manga-21':{icon:'📚',name:'マンガ「まんしつ」',note:'3DPハウスの 本だなで よめるよ',manga:['mc-12'],effects:[]},
 'manga-22':{icon:'📚',name:'マンガ「かえりみちのおと」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-13'],effects:[]},
 'manga-23':{icon:'📚',name:'マンガ「とんぼのとまりぎ」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-14'],effects:[]},
 'manga-24':{icon:'📚',name:'マンガ「どんぐりのぼうし」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-15'],effects:[]},
 'manga-25':{icon:'📚',name:'マンガ「ありさんのさんぽみち」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-16'],effects:[]},
 'manga-26':{icon:'📚',name:'マンガ「はっぱのおめん」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-17'],effects:[]},
 'manga-27':{icon:'📚',name:'マンガ「ちいさなふね」「ふーのあと」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-18','daily-20'],effects:[]},
 'manga-28':{icon:'📚',name:'マンガ「ゴールがにげた」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-19'],effects:[]},
 'st-banzai':{icon:'🏷️',name:'シール「バンザイ」',label:'バンザイ',note:'シールちょうに はったよ',sticker:'banzai',effects:[]},
 'st-wink':{icon:'🏷️',name:'シール「ウインクダンス」',label:'ウインクダンス',note:'シールちょうに はったよ',sticker:'wink',effects:[]},
 'st-radio':{icon:'🏷️',name:'シール「ラジカセ」',label:'ラジカセ',note:'シールちょうに はったよ',sticker:'radio',effects:[]},
 'st-kurutto':{icon:'🏷️',name:'シール「くるっと」',label:'くるっと',note:'シールちょうに はったよ',sticker:'kurutto',effects:[]},
 'st-duo':{icon:'🏷️',name:'シール「ふたりでダンス」',label:'ふたりでダンス',note:'シールちょうに はったよ',sticker:'duo',effects:[]},
 'st-piyomi':{icon:'🏷️',name:'シール「iPadの ぴよみ」',label:'iPadの ぴよみ',note:'シールちょうに はったよ',sticker:'piyomi',effects:[]},
 'st-piyokichi':{icon:'🏷️',name:'シール「iPadの ぴよきち」',label:'iPadの ぴよきち',note:'シールちょうに はったよ',sticker:'piyokichi',effects:[]},
 'hard-goal':{icon:'🔥',name:'ハードモードの ❓',note:'なにが あるかは まだ ひみつ。ひらいたら、おうちの人に つたえてね',secret:true},
 // ---- もみじの もり（11/1〜）----
 'manga-29':{icon:'📚',name:'マンガ「ちかみち」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-21'],effects:[]},
 'manga-30':{icon:'📚',name:'マンガ「めじるし」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-22'],effects:[]},
 'manga-31':{icon:'📚',name:'マンガ「くさのトンネル」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-23'],effects:[]},
 'manga-32':{icon:'📚',name:'マンガ「ちず」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-24'],effects:[]},
 'manga-33':{icon:'📚',name:'マンガ「いちばんのり」',note:'3DPハウスの 本だなで よめるよ',manga:['daily-25'],effects:[]},
 morisaku:{icon:'🎤',name:'もりと さくま',note:'もんだいに もりと さくまが でてくる',effects:['morisaku']},
 'momiji-secret':{icon:'🎁',name:'もみじの もりの ❓',note:'なにが あるかは まだ ひみつ。ひらいたら、おうちの人に つたえてね',secret:true},
};

// マップ。x,y はマップ上の位置（%）。requires は「ぜんぶ開いていれば挑戦できる」ゲート。
// 1マス 20pt（カレーだけ 50pt）。1日1〜2回 あそべば、だいたい 毎日 なにかが ひらく（10/10〜）。
// small：大きいゲートの手前の 小さいマス。大きいゲートの pt を そのぶん下げたので、道の合計 pt は もとのまま（中身のあるゲート 合計390pt ＋ 仮の slot-d 20pt）。
// 中身が まだ きまっていない マスは「仮」で シールを入れてある（あとで かえられる）。
// before：その先の 大きいゲート。もう ひらいている子は、手前の 小さいマスを pt なしで ひらける（もう とおった道。costOf）
// reward:null は小ネタ用の空きスロット（中身を REWARDS に足して reward を書けば、そのまま開けられるようになる）
export const MAP={
 start:'start',
 nodes:[
  {id:'start',x:50,y:93,cost:0,reward:null,requires:[],label:'スタート'},
  {id:'slot-left',x:22,y:76,cost:20,reward:'manga-1',requires:['start'],from:UPDATE_FROM},
  {id:'curry',x:78,y:76,cost:50,reward:'curry',requires:['start']},   // カレーは 50pt のまま（もう ひらいた子が おおいので）
  {id:'slot-a',x:9,y:60,cost:20,reward:'manga-2',requires:['slot-left'],from:UPDATE_FROM},
  {id:'step-bgm-1',x:42,y:81,cost:20,reward:'manga-5',requires:['start'],small:true,before:'bgm'},
  {id:'step-bgm-2',x:38,y:66,cost:20,reward:'manga-6',requires:['step-bgm-1'],small:true,before:'bgm'},
  {id:'bgm',x:28,y:52,cost:20,reward:'bgm',requires:['step-bgm-2']},
  {id:'step-tora-1',x:66,y:64,cost:20,reward:'manga-7',requires:['curry'],small:true,before:'toramana'},
  {id:'step-tora-2',x:54,y:55,cost:20,reward:'manga-8',requires:['step-tora-1'],small:true,before:'toramana'},
  {id:'step-tora-3',x:62,y:45,cost:20,reward:'manga-11',requires:['step-tora-2'],small:true,before:'toramana'},
  {id:'toramana',x:78,y:35,cost:20,reward:'toramana',requires:['step-tora-3']},
  {id:'slot-b',x:91,y:60,cost:20,reward:'manga-3',requires:['curry'],from:UPDATE_FROM},
  {id:'slot-e',x:93,y:46,cost:20,reward:'manga-14',requires:['slot-b'],small:true},   // ハロウィンの マンガ（トラマナちゃんとは べつの道）
  {id:'slot-c',x:12,y:36,cost:20,reward:'manga-4',requires:['bgm'],from:UPDATE_FROM},
  {id:'slot-d',x:90,y:22,cost:20,reward:'st-headphones',requires:['toramana']},   // 仮：シール。うさこ（10月後半）が きまったら 中身を かえる
  {id:'step-deep-1',x:48,y:42,cost:20,reward:'manga-9',requires:['bgm','toramana'],small:true,before:'deep'},
  {id:'step-deep-2',x:36,y:33,cost:20,reward:'manga-10',requires:['step-deep-1'],small:true,before:'deep'},
  {id:'step-deep-3',x:24,y:24,cost:20,reward:'manga-12',requires:['step-deep-2'],small:true,before:'deep'},
  {id:'step-deep-4',x:30,y:12,cost:20,reward:'manga-13',requires:['step-deep-3'],small:true,before:'deep'},
  {id:'step-deep-5',x:44,y:20,cost:20,reward:'st-dj',requires:['step-deep-4'],small:true,before:'deep'},   // 仮：シール
  {id:'deep',x:62,y:12,cost:20,reward:'deep',requires:['step-deep-5']},
 ],
};
// ハードモード：さいおく（deep）を ひらいた子だけ 入れる、べつの マップ（10/21〜）。
//  - 入口 hard-start は deep を ひらくと 自動で ひらく（pt なし・保存しない。opensWith）
//  - star:true の マス（⭐）は pt に くわえて「パーフェクトの ほし」が 1こ いる。
//    ほしは ピヨ探検pt が もらえる回（1日3回まで）に 10もん ぜんぶ せいかい すると 1こ（earned の perfect）。
//    のこりの ほし ＝ もらった ほし − ⭐の マスを ひらいた数（残高と おなじく 記録から 毎回 計算する）
//  - pt は 1マス 15→20、ゴール 30（合計 290pt ＋ ほし 4こ）。10/27 に hard-06 から先を 安くした（20→15・25→20）
//    ぴよみ（10/26 夜で hard-05 まで・のこり27pt）が 1日 40pt くらいで 10/31 に とどく見こみ
//  - 10/27：シールの マス5つを マンガ（daily-15〜20）に 入れかえ。ゴールの 1つ手前（hard-16）は「ゴールがにげた」
//  - ぜんぶ 小さいマス（絵だけ・名前は タップで）。ゴール（hard-goal）の 中身は ひみつ（親モードで 見える）
export const HARD={
 start:'hard-start',opensWith:'deep',from:'2026-10-21',
 nodes:[
  {id:'hard-start',x:50,y:92,cost:0,reward:null,requires:[],label:'さいおく から'},
  {id:'hard-01',x:27,y:83,cost:15,reward:'manga-15',requires:['hard-start'],small:true},
  {id:'hard-02',x:73,y:83,cost:15,reward:'st-banzai',requires:['hard-start'],small:true},
  {id:'hard-03',x:14,y:71,cost:15,reward:'manga-16',requires:['hard-01'],small:true},
  {id:'hard-04',x:86,y:71,cost:15,reward:'manga-17',requires:['hard-02'],small:true,star:true},
  {id:'hard-05',x:50,y:64,cost:15,reward:'st-wink',requires:['hard-03','hard-04'],small:true},
  {id:'hard-06',x:29,y:54,cost:15,reward:'manga-18',requires:['hard-05'],small:true},
  {id:'hard-07',x:71,y:54,cost:15,reward:'manga-24',requires:['hard-05'],small:true},
  {id:'hard-08',x:15,y:43,cost:15,reward:'manga-19',requires:['hard-06'],small:true,star:true},
  {id:'hard-09',x:85,y:43,cost:15,reward:'manga-20',requires:['hard-07'],small:true},
  {id:'hard-10',x:50,y:36,cost:15,reward:'manga-25',requires:['hard-08','hard-09'],small:true},
  {id:'hard-11',x:29,y:27,cost:15,reward:'manga-21',requires:['hard-10'],small:true},
  {id:'hard-12',x:71,y:27,cost:15,reward:'manga-26',requires:['hard-10'],small:true},
  {id:'hard-13',x:14,y:17,cost:20,reward:'manga-22',requires:['hard-11'],small:true,star:true},
  {id:'hard-14',x:86,y:17,cost:20,reward:'manga-27',requires:['hard-12'],small:true},
  {id:'hard-15',x:50,y:20,cost:20,reward:'manga-23',requires:['hard-13','hard-14'],small:true},
  {id:'hard-16',x:31,y:8,cost:20,reward:'manga-28',requires:['hard-15'],small:true},
  {id:'hard-goal',x:66,y:9,cost:30,reward:'hard-goal',requires:['hard-16'],star:true},
 ],
};
// もみじの もり：11/1 から だれでも 入れる、べつの マップ（入口は さいしょから ひらいている）。
//  - ぜんぶの マスに from:'2026-11-01'。それより前は タブも 出さない
//  - 小ネタ（small）：マンガ・シール。小ゴール：もりと さくま・うさこ・曲・ひみつ（マクドナルド）。大ゴール：いちばん おく
//  - reward:null の マスは ❓じゅんびちゅう：曲（momiji-song）・シール（momiji-st1・st2）・大ゴール（momiji-goal）。
//    中身が できたら REWARDS に 足して reward を 書けば、そのまま ひらけるようになる
//  - ひみつの 小ゴール（momiji-secret）の 中身は 親モードで 見える
const MOMIJI_FROM='2026-11-01';
export const MOMIJI={
 start:'momiji-start',from:MOMIJI_FROM,
 nodes:[
  {id:'momiji-start',x:50,y:92,cost:0,reward:null,requires:[],label:'森の 入口'},
  {id:'momiji-01',x:28,y:83,cost:20,reward:'manga-29',requires:['momiji-start'],small:true},
  {id:'momiji-02',x:72,y:83,cost:20,reward:'manga-30',requires:['momiji-start'],small:true},
  {id:'momiji-morisaku',x:13,y:69,cost:30,reward:'morisaku',requires:['momiji-01']},
  {id:'momiji-usako',x:87,y:69,cost:30,reward:'usako',requires:['momiji-02']},
  {id:'momiji-03',x:50,y:66,cost:20,reward:'manga-31',requires:['momiji-01','momiji-02'],small:true},
  {id:'momiji-04',x:30,y:53,cost:20,reward:'manga-32',requires:['momiji-morisaku'],small:true},
  {id:'momiji-05',x:70,y:53,cost:20,reward:'manga-33',requires:['momiji-usako'],small:true},
  {id:'momiji-secret',x:18,y:37,cost:40,reward:'momiji-secret',requires:['momiji-04']},
  {id:'momiji-song',x:82,y:37,cost:30,reward:null,requires:['momiji-05']},
  {id:'momiji-st1',x:36,y:24,cost:20,reward:null,requires:['momiji-secret'],small:true},
  {id:'momiji-st2',x:64,y:24,cost:20,reward:null,requires:['momiji-song'],small:true},
  {id:'momiji-goal',x:50,y:10,cost:50,reward:null,requires:['momiji-st1','momiji-st2']},
 ].map(n=>({...n,from:MOMIJI_FROM})),
};
export const momijiOpen=dayKey=>typeof dayKey==='string'&&dayKey>=MOMIJI.from;
const MAPS={main:MAP,hard:HARD,momiji:MOMIJI};
const NODE=Object.fromEntries([...MAP.nodes,...HARD.nodes.map(n=>({...n,map:'hard'})),...MOMIJI.nodes.map(n=>({...n,map:'momiji'}))].map(n=>[n.id,n]));
const isStartId=id=>id===MAP.start||id===HARD.start||id===MOMIJI.start;
export const nodeById=id=>NODE[id]??null;
// ひらける（中身のある）ゲート。空きスロットは数えない
export const openableNodes=()=>MAP.nodes.filter(n=>n.id!==MAP.start&&n.reward&&REWARDS[n.reward]);
// from のあるゲート（と おまけ）は、その日から（dayKey がわからないときは まだ）
export const nodeActive=(node,dayKey)=>!node.from||(typeof dayKey==='string'&&dayKey>=node.from);
// ハードモードに 入れるか（さいおくを ひらいている）。10/21 より前は まだ
// ---- きょうだい（10/23〜）----
// おかえりボーナス：ぴよきちは 10/23〜10/31 の あいだ、もらえる ピヨ探検pt が 1.5倍（ドリルの ポイントは そのまま）
export const BOOSTS={piyokichi:{from:'2026-10-23',to:'2026-10-31',rate:1.5,label:'おかえりボーナス'}};
export function boostFor(playerId,dayKey){const b=BOOSTS[playerId];return b&&typeof dayKey==='string'&&dayKey>=b.from&&dayKey<=b.to?b:null;}
// おうえん：ぴよみが 10/23 から もらった ピヨ探検pt の 3わりが、ぴよきちにも とどく（ぴよみの pt は へらない）。
// ぴよきちの earned に「cheer:」つきの 記録として 足す。id が きまっているので、何回 足しても 2台で 合わせても ふえない
export const CHEER={from:'piyomi',to:'piyokichi',start:'2026-10-23',rate:0.3};
const cheerPt=pt=>Math.round(pt*CHEER.rate);
const cheerSource=e=>!e.cheer&&e.day>=CHEER.start&&e.day<=SEASON.end&&cheerPt(e.pt)>0;
// fromPlayer（ぴよみ）の 記録から、toPlayer（ぴよきち）に まだ ない おうえんを 足す。かわらなければ toPlayer を そのまま返す
export function applyCheer(toPlayer,fromPlayer){
 const add=season(fromPlayer).earned.filter(cheerSource);
 const have=new Set(season(toPlayer).earned.map(e=>e.id));
 const missing=add.filter(e=>!have.has(`cheer:${e.id}`.slice(0,80)));
 if(!missing.length)return toPlayer;
 const next=sanitizeCubePlayer(clone(toPlayer)),s=season(next);
 for(const e of missing)s.earned.push({id:`cheer:${e.id}`.slice(0,80),day:e.day,pt:cheerPt(e.pt),cheer:true});
 s.earned.sort((a,b)=>a.day.localeCompare(b.day));
 next.seasons[SEASON.id]=sanitizeSeason(s);
 return next;
}
export function cheerReceived(s){return s.earned.filter(e=>e.cheer).reduce((a,e)=>a+e.pt,0);}
export function cheerGiven(s){return s.earned.filter(cheerSource).reduce((a,e)=>a+cheerPt(e.pt),0);}
export const hardOpen=(s,dayKey)=>!!s.gates[HARD.opensWith]&&typeof dayKey==='string'&&dayKey>=HARD.from;

export function inSeason(dayKey,season=SEASON){return typeof dayKey==='string'&&dayKey>=season.start&&dayKey<=season.end;}

// ---------- データの形 ----------
// プレイヤー1人ぶん（この形のまま、将来 Firestore などに1ドキュメントとして置ける）
//   earned:  [{id:セッションID, day:'YYYY-MM-DD', pt, perfect?, cheer?}]   キューブpt の入金記録（同じ id は二度入らない）。perfect:true＝パーフェクトの ほし 1こ。cheer:true＝きょうだいの おうえん（あそんだ回には 数えない）
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
// earned は 残高の もとなので、古い記録が 切りすてられると pt が へる。10〜11月の 2か月（ぴよきちは おうえんの 記録も 入る）でも あふれない数に
const EARNED_LIMIT=500,COIN_DAYS_LIMIT=120;

export function sanitizeSeason(raw){
 const r=obj(raw),s=emptySeason();
 const seen=new Set();
 for(const e of Array.isArray(r.earned)?r.earned:[]){
  if(!e||typeof e.id!=='string'||!e.id||!day(e.day)||seen.has(e.id))continue;
  seen.add(e.id);s.earned.push({id:e.id.slice(0,80),day:e.day,pt:nat(e.pt,1000),...(e.perfect===true?{perfect:true}:{}),...(e.cheer===true?{cheer:true}:{})});
 }
 s.earned=s.earned.slice(-EARNED_LIMIT);
 for(const [id,g] of Object.entries(obj(r.gates)))if(NODE[id]&&!isStartId(id))s.gates[id]={on:day(obj(g).on),cost:nat(obj(g).cost,100000)};
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
export function playsOn(s,dayKey){return s.earned.filter(e=>e.day===dayKey&&!e.cheer).length;}
export function cubeSessionsLeft(s,dayKey){return inSeason(dayKey)?Math.max(0,DAILY_CUBE_SESSIONS-playsOn(s,dayKey)):0;}
// みつけた ごほうびの数（画面の「みつけた ごほうび ○こ」）＝ 中身のあるゲートを ひらいた数。総数は出さない（あとから ふえるため）
// マンガのゲートは 2話ぶんでも 1こ。自動の おまけ（AUTO_MANGA）が あっても 数えない
export function foundCount(s){return Object.keys(s.gates).filter(id=>REWARDS[NODE[id]?.reward]).length;}
export function completion(s){
 const list=openableNodes();
 const done=list.filter(n=>s.gates[n.id]).length;
 return {done,total:list.length,percent:list.length?Math.floor(done/list.length*100):0};
}
export const isOpen=(s,id)=>id===MAP.start||id===MOMIJI.start||!!s.gates[id]||(id===HARD.start&&!!s.gates[HARD.opensWith]);
// パーフェクトの ほし：もらった数 − ⭐の マスで つかった数
export function starsEarned(s){return s.earned.filter(e=>e.perfect&&!e.cheer).length;}
export function starsUsed(s){return Object.keys(s.gates).filter(id=>NODE[id]?.star).length;}
export function starBalance(s){return Math.max(0,starsEarned(s)-starsUsed(s));}
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
// 10/9 の 1日だけで おわり（10/10 からは マップの マスが こまかくなったので、まいにちの みちは やめた）。
// 10/9 に とどいた シール（おんぷダンス）は そのまま のこす。のこりの マンガ3話は マップへ。シールは マップの 仮の マスへ
export const GIFT_FROM='2026-10-09',GIFT_TO='2026-10-09';
export const DAILY_GIFTS=[
 {id:'st-onpu',sticker:'onpu',name:'おんぷダンス'},
];
// まだ どこにも つかっていない シール（あとで マップの 仮の マスなどに つかえる）
export const SPARE_STICKERS=[
 {id:'st-batsu1',sticker:'batsu1',name:'×その1'},
 {id:'st-batsu2',sticker:'batsu2',name:'×その2'},
 {id:'st-toramana',sticker:'toramana',name:'トラマナちゃん'},
];
// とどいた ごほうび [{day, ...ごほうび}]（とどいた じゅん）
export function giftsOf(player){
 const days=Object.keys(player.coin??{}).filter(d=>d>=GIFT_FROM&&d<=GIFT_TO).sort();
 return days.slice(0,DAILY_GIFTS.length).map((day,i)=>({day,...DAILY_GIFTS[i]}));
}
// シールちょうに はる シール [{id, sticker, name}]：10/9 の 毎日の ごほうび ＋ マップで ひらいた シールの マス
export function stickersOf(player){
 const list=giftsOf(player).filter(g=>g.sticker).map(g=>({id:g.id,sticker:g.sticker,name:g.name}));
 for(const s of Object.values(player.seasons))for(const id of Object.keys(s.gates)){const r=REWARDS[NODE[id]?.reward];if(r?.sticker)list.push({id:NODE[id].reward,sticker:r.sticker,name:r.label});}
 return list;
}
export const giftOn=(player,dayKey)=>giftsOf(player).find(g=>g.day===dayKey)??null;
// きょう まだ もらっていなくて、クリアすれば もらえるか
export const giftAvailable=(player,dayKey)=>typeof dayKey==='string'&&dayKey>=GIFT_FROM&&dayKey<=GIFT_TO&&!player.coin?.[dayKey]&&giftsOf(player).length<DAILY_GIFTS.length;

// 自動でふえるマンガ：requires の ごほうびを ぜんぶ持っていれば、pt なし・ゲートなしで よめる。
// 保存はしない（毎回 持っている ごほうびから決める）ので、条件を先に満たしていた子にも そのまま効く。最奥など ほかの ごほうびは変えない
export const AUTO_MANGA=[
 // いまは なし（ハロウィンの マンガは 10/10 から マップの ふつうの マス slot-e に した）
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
 if(NODE[node.id]?.map==='hard'&&!hardOpen(s,dayKey))return isOpen(s,node.id)?'open':'fog';
 if(isOpen(s,node.id))return 'open';
 const met=node.requires.filter(id=>isOpen(s,id)).length;
 if(met===0)return 'fog';
 if(!node.reward||!REWARDS[node.reward]||!nodeActive(node,dayKey))return 'soon';
 return met===node.requires.length?'ready':'near';
}
export function mapView(s,{parent=false,dayKey,map='main'}={}){
 return (MAPS[map]??MAP).nodes.map(n=>{
  const state=nodeState(s,n,dayKey);
  return {node:n,state:parent&&state==='fog'?(n.reward&&nodeActive(n,dayKey)?'near':'soon'):state};
 });
}

// ---------- 書きかえ（新しいオブジェクトを返す） ----------
// 1回分（10問クリア）を入金する。award は storage.js commitResult の戻り値
// 戻り値 {player, cubePt, coinNew, reason, star}（star：パーフェクトの ほしを もらった）
//   reason: 'ok' | 'practice'（4回目以降）| 'season'（期間外）| 'limit'（その日3回ずみ）| 'duplicate'
// boost：おかえりボーナスの 倍率（BOOSTS。なければ 1）
export function recordSession(player,{sessionId,dayKey,award,boost=1}){
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
 else{cubePt=Math.round(nat(award?.points,1000)*(boost>1&&boost<=3?boost:1));s.earned.push({id:sessionId,day:dayKey,pt:cubePt,...(award?.perfect===true?{perfect:true}:{})});}
 next.seasons[SEASON.id]=sanitizeSeason(s);
 return {player:next,cubePt,basePt:reason==='ok'?nat(award?.points,1000):0,coinNew,reason,star:reason==='ok'&&award?.perfect===true};
}

// ゲートを開ける。戻り値 {player, ok, reason, reward}
//   reason: 'ok' | 'unknown' | 'open' | 'locked' | 'empty' | 'short'（pt 不足）| 'star'（ほし 不足）
export function openGate(player,nodeId,dayKey){
 const node=NODE[nodeId];
 if(!node||isStartId(nodeId))return {player,ok:false,reason:'unknown'};
 const s0=season(player);
 if(s0.gates[nodeId])return {player,ok:false,reason:'open'};
 if(!node.reward||!REWARDS[node.reward]||!nodeActive(node,dayKey))return {player,ok:false,reason:'empty'};
 if(node.map==='hard'&&!hardOpen(s0,dayKey))return {player,ok:false,reason:'locked'};
 if(!node.requires.every(id=>isOpen(s0,id)))return {player,ok:false,reason:'locked'};
 const cost=costOf(s0,node);
 if(cubeBalance(s0)<cost)return {player,ok:false,reason:'short'};
 if(node.star&&starBalance(s0)<1)return {player,ok:false,reason:'star'};
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
