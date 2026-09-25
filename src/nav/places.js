// ちきぴよ暮らしの「場所」一覧。
// 新しい場所や遊びを足すときは、ここに1行追加して、同じ名前の HTML を置くだけ。
// （vite.config.js もこの一覧からビルド対象ページを作ります）
//   id    : ページ識別子（mountSiteNav に渡す current と対応）
//   page  : プロジェクト直下の HTML ファイル
//   href  : サイトのベースからの相対パス（'' はトップページ）
//   icon / label / short : ナビの表示。short はスマホ幅で使う短い名前
export const places=[
 {id:'house',page:'index.html',href:'',icon:'🏠',label:'3DPハウス',short:'ハウス'},
 {id:'river',page:'river.html',href:'river.html',icon:'🎣',label:'おさかな釣り',short:'釣り'},
];

// GitHub Pages のサブディレクトリ（/repo/）でも正しく動くよう、Vite の BASE_URL を基準にする。
export function siteBase(){
 const base=typeof import.meta!=='undefined'&&import.meta.env?.BASE_URL||'/';
 return base.endsWith('/')?base:base+'/';
}
export function placeHref(place,base=siteBase()){
 const b=base.endsWith('/')?base:base+'/';
 return b+place.href;
}
