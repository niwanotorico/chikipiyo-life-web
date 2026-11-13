// ピヨドリル：親モード（仮実装）。
// いまは URL に ?parent=1 をつけたときだけ親モードになる。これは確認用の仮の方法で、
// 公開時の正式な秘密保持の方法ではない（URL を知っていれば誰でも開けるし、下の文字列はブラウザから読める）。
// 方法を変えるときは、このファイルだけを差し替える。ほかのファイルは isParentMode() と parentLabel() を呼ぶだけ。
//   例：あいことば入力、親の端末だけの設定、ログインした親にだけサーバーから中身を返す など

export function isParentMode(loc=globalThis.location){
 try{return new URLSearchParams(loc?.search??'').get('parent')==='1';}catch{return false;}
}

// ごほうびの中身（プレイヤーごと）。name は親モードと、下の openedLabel（開けた子の画面）で つかう。
// note は親むけの メモ（子どもには 出さない）。kid は 開けた子の画面に 出す 説明（kid が ないものは 開けても ❓ のまま）
const PARENT_LABELS={
 deep:{
  piyomi:{name:'メロガッパFC 3か月権',note:'10/27 に 黒コインで 前倒しスタート（ぴよきちと 交換した 黒コインを 使った）',kid:'メロガッパの ファンクラブに 3か月 はいれるよ'},
  piyokichi:{name:'プリンター稼働券 600ポイント',note:'親から渡す特別ごほうび',kid:'3Dプリンターを 600ぷん つかえるよ'},
 },
 // ハードモードの ゴール：現実の ごほうび
 'hard-goal':{
  piyomi:{name:'ママと赤羽でフルーツサンドデート',note:'ハードモードの ゴール。親から渡す 現実の ごほうび',kid:'ママと 赤羽で フルーツサンドを たべに いこう！'},
  // 中身が まだ きまっていないので kid は なし（開けても ❓ のまま）。きまったら name と kid を 書く
  piyokichi:{name:'（未定）ハードモードの ごほうび',note:'親から渡す 現実の ごほうび。中身は ちきんが 決める（子どもの画面では ひみつ）'},
 },
 // もみじの もりの 大ゴール：2人の 協力ゴール
 switch2:{
  piyomi:{name:'Switch 2 かいほう券（2人そろったら）',note:'2人とも 大ゴールを ひらいたら かいほう（子どもの画面では シルエットだけ）'},
  piyokichi:{name:'Switch 2 かいほう券（2人そろったら）',note:'2人とも 大ゴールを ひらいたら かいほう（子どもの画面では シルエットだけ）'},
 },
 // もみじの もり（11月）の 小ゴール
 'momiji-secret':{
  piyomi:{name:'マクドナルド ランチ券',note:'もみじの もりの 小ゴール。親から渡す 現実の ごほうび',kid:'マクドナルドで ランチが たべられるよ'},
  piyokichi:{name:'マクドナルド ランチ券',note:'もみじの もりの 小ゴール。親から渡す 現実の ごほうび',kid:'マクドナルドで ランチが たべられるよ'},
 },
 // もみじの 奥の道（11/13〜）の 券。ひみつでは ないので、開けた子にも この 名前が 見える（名前は cosmicube.js の REWARDS と おなじ）
 'momiji-oku-mac':{
  piyomi:{name:'マクドナルド ランチ券',note:'奥の道 oku-07。親から渡す 現実の ごほうび（ひみつの マスの 券とは べつに もう1まい）'},
  piyokichi:{name:'マクドナルド ランチ券',note:'奥の道 oku-07。親から渡す 現実の ごほうび（ひみつの マスの 券とは べつに もう1まい）'},
 },
 'momiji-oku-cream':{
  piyomi:{name:'シュークリーム券',note:'奥の道 oku-11。親から渡す 現実の ごほうび'},
  piyokichi:{name:'シュークリーム券',note:'奥の道 oku-11。親から渡す 現実の ごほうび'},
 },
};
export function parentLabel(rewardId,player){return PARENT_LABELS[rewardId]?.[player]??null;}

// 開けた子の画面で 中身を 見せる ひみつの ごほうび（2026-11-12 ちきんの決定）。開ける前は これまでどおり ❓。
// switch2（もみじの 大ゴール）は ふくめない：2人そろうまで シルエットだけ
const SHOW_WHEN_OPENED=new Set(['deep','hard-goal','momiji-secret']);
export function openedLabel(rewardId,player){
 if(!SHOW_WHEN_OPENED.has(rewardId))return null;
 const p=PARENT_LABELS[rewardId]?.[player];
 return p?.kid?{name:p.name,note:p.kid}:null;
}
