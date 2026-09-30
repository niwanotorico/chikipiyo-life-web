// ピヨドリル v0.2：もりあがり（ドパ演出）の設計値。DOM も音もない純粋な表なので、テストで上昇曲線を確かめられる。
//
//   0 ふつう → 1 すこし楽しい → 2 もりあがる → 3 かなり盛り上がる → 4 おまつり → 5 プリンフィーバー
//
// コンボで段階が上がる。まちがえるとコンボは 0 にもどるが、後半（7問目以降）は「ふつう」まで落とさない。
export const STAGE_NAMES=['ふつう','すこし楽しい','もりあがる','かなり盛り上がる','おまつり','プリンフィーバー'];
export const FEVER=5;

export function stageFor({combo=0,index=0}={}){
 const byCombo=combo>=8?4:combo>=5?3:combo>=3?2:combo>=2?1:0;
 const byProgress=index>=6?1:0;
 return Math.max(byCombo,byProgress);
}

// コンボの節目（カットイン＋コンボ上昇音）
export function comboMilestone(combo){
 if(combo===2)return {size:1,text:'2れんぞく！'};
 if(combo===3)return {size:2,text:'3れんぞく！'};
 if(combo===5)return {size:3,text:'5れんぞく！'};
 if(combo>=8)return {size:4,text:`${combo}れんぞく！`};
 return null;
}

// 正解→次の問題まで（ms）。0.6〜1.0秒の間で、盛り上がるほど余韻をすこし長く
export function nextDelay(stage){return Math.round(650+Math.min(4,Math.max(0,stage))*80);}
export const WRONG_DELAY=2200;     // まちがい：正しい答えを読める長さ（ボタン／Enter ですぐ次へも行ける）
export const FEVER_MS=3900;        // プリンフィーバーの画面（最後の正解から 0.3 秒後に開き、約3.9秒。1.2秒後からタップ／Enter でスキップ可）
export const FEVER_SKIP_AFTER=1200;
export const SOFT_FINISH_MS=1300;  // 最後の問題をまちがえたときの、やさしい締め

// 音楽：テンポ・調・楽器の重なり
export function tempo(stage){return [112,115,118,122,126,138][Math.min(FEVER,Math.max(0,stage))];}
export function keyShift(stage){return stage>=FEVER?2:0;}
export const LAYERS=[
 ['toy','shaker','kick1','pad'],                                     // 0 ふつう：木琴のようなトイピアノと軽いシェイカー
 ['toy','shaker','kick13','pad','bass'],                             // 1 ベースが入る
 ['toy','shaker','kick4','pad','bass','clap','chirp'],               // 2 4つ打ち＋手拍子＋ぴよチャープ
 ['arp','shaker','kick4','pad','bass','clap','chirp','hat','duck'],  // 3 アルペジオ・裏打ちハイハット・うねり
 ['arp','shaker','kick4','pad','bass','clap','chirp','hat','duck','lead','fill','crash'], // 4 メロディ・フィル
 ['arp','shaker','kick4','pad','bass','clap','chirp','hat','duck','lead','fill','crash','brass','hat16'], // 5 フィーバー
];
export function layersFor(stage){return new Set(LAYERS[Math.min(FEVER,Math.max(0,stage))]);}

// 画面の演出量。reduced は prefers-reduced-motion
export function visuals(stage,{reduced=false}={}){
 const s=Math.min(FEVER,Math.max(0,stage));
 const v={
  particles:[12,18,28,42,64,120][s],
  kinds:[['star','dot'],['star','dot','feather'],['star','dot','feather','confetti'],['star','dot','feather','confetti'],['star','dot','feather','confetti','pudding'],['star','dot','feather','confetti','pudding']][s],
  shake:[0,0,2,4,6,10][s],
  flash:[0,0,0,.18,.3,.6][s],
  hop:['hop','hop','hop2','spin','wild','fever'][s],
  ghosts:s>=4,
 };
 if(reduced)return {...v,particles:Math.ceil(v.particles/4),shake:0,flash:0,hop:'nod',ghosts:false};
 return v;
}

// ---------- v0.3 キャラクター演出（完成済みの一枚絵 PNG を切り替えて、CSS／WAAPI で動かす） ----------
// 素材：assets/drill/characters（piyodrill/characters の原本をコピー。原本は変更しない）
export const CHARACTER_DIR='assets/drill/characters/';
export const POSES={
 piyokichi:{light:'dance01',strong:'spin',high:['spin','spin'],wrong:'piyokichi-wrong'},
 piyomi:{light:'dance02',strong:'hands_up',high:['headphones','dj'],wrong:'piyomi-wrong'},
};
export const DUO={mid:'music_duo',high:'radio_duo'};
export const ALL_POSE_FILES=[...new Set([...Object.values(POSES).flatMap(p=>[p.light,p.strong,...p.high,p.wrong]),DUO.mid,DUO.high])];

// 1問ごとの演出の計画。
//  from: 最初に出す絵 / apex: ジャンプ・回転の頂点で切り替える絵（null なら切り替えない）
//  move: small（小ジャンプ）/ big（大ジャンプ＋左右の傾き）/ turn（回転して行き過ぎて戻る）
//        duo（2人が画面外から飛び込む）/ wild（大回転＋残像＋フラッシュ）/ wrong（びくっ→沈む）
//  2人の絵は節目（5コンボ＝music_duo、8コンボ＝radio_duo）とフィーバーだけ
export function actorPlan({player='piyokichi',ok=true,combo=0}={}){
 const p=POSES[player]||POSES.piyokichi;
 if(!ok)return {move:'wrong',from:p.wrong,apex:null,ghosts:0,flash:false,duo:false};
 if(combo===5)return {move:'duo',from:DUO.mid,apex:null,ghosts:0,flash:false,duo:true};
 if(combo===8)return {move:'duo',from:DUO.high,apex:null,ghosts:3,flash:true,duo:true};
 if(combo>=9)return {move:'wild',from:p.high[0],apex:p.high[1],ghosts:3,flash:true,duo:false};
 if(combo>=6)return {move:'turn',from:p.strong,apex:p.high[0],ghosts:0,flash:false,duo:false};
 if(combo>=3)return {move:'big',from:p.light,apex:p.strong,ghosts:0,flash:false,duo:false};
 return {move:'small',from:p.light,apex:null,ghosts:0,flash:false,duo:false};
}
export const DUO_COMBOS=[5,8];

// 目玉焼き（レア演出）：正解時 8%、1プレイ最大1回、10問目（フィーバー）と2人の節目では出ない。
// force（URL ?egg=1）なら次の正解で必ず。ポイント・保存には関係しない。
export const EGG_CHANCE=.08;
export function eggRoll({rng=Math.random,used=false,isLast=false,combo=0,force=false}={}){
 if(used||isLast||DUO_COMBOS.includes(combo))return false;
 if(force)return true;
 return rng()<EGG_CHANCE;
}
// 目玉焼きのタイムライン（ms）。音も同じ値で予約する
export const EGG_TIMES={fall:0,land:380,jiggle:470,hop:820,happy:700,leave:1150,end:1500};
export const EGG_NEXT_DELAY=1500;   // 目玉焼きのときは、見終わってから次の問題へ（1.3〜1.8秒）
