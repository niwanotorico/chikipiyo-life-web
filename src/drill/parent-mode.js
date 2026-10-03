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
  piyomi:{name:'メロガッパFC 3か月権',note:'親から渡す特別ごほうび（ぴよみの画面では ひみつ）'},
  piyokichi:{name:'（未定）',note:'ぴよきちの さいおく報酬は まだ決めていない'},
 },
};
export function parentLabel(rewardId,player){return PARENT_LABELS[rewardId]?.[player]??null;}
