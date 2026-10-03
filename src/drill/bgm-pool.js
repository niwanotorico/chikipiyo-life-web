// ピヨドリル：ピヨ探検 🎵 ごほうびの「ランダムBGMプール」。音源ファイルを扱うのはこのファイルだけ。
// ふだんの曲は audio.js がその場で合成する。ごほうびを開けると、ここの曲が抽選に加わる。
// 曲を足すときは BGM_TRACKS に1行追加して、web/bgm/ に音源を置くだけ。
export const BGM_TRACKS=[
 {id:'usako',url:new URL('../../bgm/usako.mp3',import.meta.url).href},
];

// effects：cube.effects(player)。'bgm' があれば「合成の曲（null）＋ BGM_TRACKS」から等確率で1つ
export function pickTrack(effects,rng=Math.random){
 if(!effects?.has?.('bgm'))return null;
 const pool=[null,...BGM_TRACKS];
 return pool[Math.floor(rng()*pool.length)];
}

// 再生用の <audio>（1つを使いまわす。Web Audio へは audio.js がつなぐ）
let el=null;
export function trackElement(track){
 if(!track||typeof Audio==='undefined')return null;
 if(!el){el=new Audio();el.loop=true;el.preload='auto';}
 if(el.dataset.track!==track.id){el.src=track.url;el.dataset.track=track.id;}
 return el;
}
