// ピヨドリル：親モード（仮実装）。
// いまは URL に ?parent=1 をつけたときだけ親モードになる。これは確認用の仮の方法で、
// 公開時の正式な秘密保持の方法ではない（URL を知っていれば誰でも開けるし、下の文字列はブラウザから読める）。
// 方法を変えるときは、このファイルだけを差し替える。ほかのファイルは isParentMode() と parentLabel() を呼ぶだけ。
//   例：あいことば入力、親の端末だけの設定、ログインした親にだけサーバーから中身を返す など

export function isParentMode(loc=globalThis.location){
 try{return new URLSearchParams(loc?.search??'').get('parent')==='1';}catch{return false;}
}

// 親にだけ見せる ごほうびの中身（プレイヤーごと）。子どもの画面には出さない
const PARENT_LABELS={
 deep:{
  piyomi:{name:'メロガッパFC 3か月権',note:'10/27 に 黒コインで 前倒しスタート（ぴよきちと 交換した 黒コインを 使った）。ぴよみの画面では ひみつ'},
  piyokichi:{name:'プリンター稼働券 600ポイント',note:'親から渡す特別ごほうび（ぴよきちの画面では ひみつ）'},
 },
 // ハードモードの ゴール：現実の ごほうび
 'hard-goal':{
  piyomi:{name:'Switch 2 にだいめ かいほう券',note:'ハードモードを クリアしたら Switch 2 の 2台目（ぴよみ用）を かいほう。メロガッパFC は 10/27 に 黒コインで 先にスタートしたので、ゴールは こちらに変更（子どもの画面では ひみつ）'},
  piyokichi:{name:'（未定）ハードモードの ごほうび',note:'親から渡す 現実の ごほうび。中身は ちきんが 決める（子どもの画面では ひみつ）'},
 },
};
export function parentLabel(rewardId,player){return PARENT_LABELS[rewardId]?.[player]??null;}
