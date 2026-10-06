// 本だなのマンガリーダー：読む順番と、画像の窓（いまの1枚＋つぎの1枚）。DOM の組み立ては reader.js。
import {episodePages} from './catalog.js';

// ---------- 読む順番（DOM なし） ----------
// eps：よめる話（catalog の順）。pos：{episode:話ID, page:0〜}
// 画像が まだ とどいていない話（ページ0枚）は とばす
export function withPages(eps,pagesOf=episodePages){return eps.map(e=>({...e,pages:pagesOf(e.id)})).filter(e=>e.pages.length);}
export function clampPosition(eps,pos){
 const ep=eps.find(e=>e.id===pos?.episode);
 if(!ep)return eps.length?{episode:eps[0].id,page:0}:null;
 return {episode:ep.id,page:Math.min(Math.max(0,pos.page|0),ep.pages.length-1)};
}
export function stepPosition(eps,pos,dir){
 const i=eps.findIndex(e=>e.id===pos?.episode);if(i<0)return null;
 const page=pos.page+dir;
 if(page>=0&&page<eps[i].pages.length)return {episode:pos.episode,page};
 const j=i+dir;if(j<0||j>=eps.length)return null;
 return {episode:eps[j].id,page:dir>0?0:eps[j].pages.length-1};
}
export const pageAt=(eps,pos)=>pos?eps.find(e=>e.id===pos.episode)?.pages[pos.page]??null:null;

// ---------- 画像の窓：いまの1枚 ＋ つぎの1枚（先読み）だけ ----------
// img：画面の <img>。createImage：先読み用（テストで差しかえ）
export function createPageWindow(img,{createImage=()=>new Image(),onState=()=>{}}={}){
 let token=0,preload=null,current=null,retry=0;
 const show=(page)=>{
  const my=++token;current=page;
  if(!page){img.removeAttribute('src');onState('empty');return;}
  onState('loading');
  img.onload=()=>{if(my===token)onState('ready');};
  img.onerror=()=>{if(my===token)onState('error');};
  img.width=page.w;img.height=page.h;
  // 失敗したあとの「もういちど」は、同じ URL だと読みなおさないブラウザがあるので ?r= をつける
  img.src=retry?`${page.src}?r=${retry}`:page.src;
 };
 return {
  show(page){retry=0;show(page);},
  retry(){retry++;show(current);},
  // つぎの1枚だけ先読み。まえの先読みは すてる（同時に持つのは いつも1枚まで）
  prefetch(page){
   if(preload){preload.onerror=null;preload.removeAttribute?.('src');}
   preload=null;
   if(!page)return;
   preload=createImage();preload.decoding='async';preload.onerror=()=>{};   // 先読みの失敗は無視（見るときに本番の img がもういちど読む）
   preload.src=page.src;
  },
  get preloading(){return preload?.src||null;},
  // 閉じたら画像を手ばなす
  clear(){token++;current=null;img.onload=img.onerror=null;img.removeAttribute('src');this.prefetch(null);},
 };
}
