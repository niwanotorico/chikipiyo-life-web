// ピヨドリル：ピヨ探検 🎵 ごほうびの「テーマソング」。音源ファイルを扱うのはこのファイルだけ。
// テーマソングは トップ（待機画面）と ピヨ探検マップで流す。ゲーム中は audio.js がその場で合成する いつもの曲だけ。
export const THEME={id:'usako',url:new URL('../../bgm/usako.mp3',import.meta.url).href};

// effects：cube.effects(player)。'bgm'（🎵 テーマソングのごほうび）があれば THEME、なければ null
export function themeTrack(effects){
 return effects?.has?.('bgm')?THEME:null;
}

// 再生用の <audio>（1つを使いまわす。Web Audio へは audio.js がつなぐ）
let el=null;
export function trackElement(track){
 if(!track||typeof Audio==='undefined')return null;
 if(!el){el=new Audio();el.loop=true;el.preload='auto';}
 if(el.dataset.track!==track.id){el.src=track.url;el.dataset.track=track.id;}
 return el;
}
