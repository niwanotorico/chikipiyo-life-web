// ピヨドリル：ピヨ探検 🎵 ごほうびの「テーマソング」。音源ファイルを扱うのはこのファイルだけ。
// テーマソングは トップ（待機画面）と ピヨ探検マップで流す。ゲーム中は audio.js がその場で合成する（曲の えらびかたは gameSong）。
export const THEME={id:'usako',url:new URL('../../bgm/usako.mp3',import.meta.url).href};
// もみじの もりの 曲マスで ひらく。enmo_8bit.mp3（フル版）は つかわない
export const ENMO={id:'enmo',url:new URL('../../bgm/enmo_loop.mp3',import.meta.url).href};

// effects：cube.effects(player)。'enmo'（もみじの曲マス）があれば ENMO、'bgm'（🎵 テーマソングのごほうび）があれば THEME、なければ null
export function themeTrack(effects){
 if(effects?.has?.('enmo'))return ENMO;
 return effects?.has?.('bgm')?THEME:null;
}
// ゲーム中の 合成BGM（audio.js の SONGS の id）。'enmo' があれば えんも、なければ いつもの曲
export function gameSong(effects){return effects?.has?.('enmo')?'enmo':'default';}

// 再生用の <audio>（1つを使いまわす。Web Audio へは audio.js がつなぐ）
let el=null;
export function trackElement(track){
 if(!track||typeof Audio==='undefined')return null;
 if(!el){el=new Audio();el.loop=true;el.preload='auto';}
 if(el.dataset.track!==track.id){el.src=track.url;el.dataset.track=track.id;}
 return el;
}
