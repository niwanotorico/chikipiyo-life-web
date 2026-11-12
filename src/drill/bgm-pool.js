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

// 再生用の 音のデータ（AudioBuffer）。audio.js が Web Audio で ループ再生する。
// <audio> を やめた理由：iPad（iOS）は <audio> の 音量（volume）が きかず、テーマ曲だけ 大きく なっていた（2026-11-12）。
// おぼえるのは いま つかう 1曲だけ（古い iPad の メモリを まもる）。読めなければ null（音なしで つづける）
let cache=null;
export function trackBuffer(ctx,track){
 if(!ctx||!track)return Promise.resolve(null);
 if(cache&&cache.id===track.id&&cache.ctx===ctx)return cache.p;
 const p=fetch(track.url)
  .then(r=>{if(!r.ok)throw new Error(String(r.status));return r.arrayBuffer();})
  .then(data=>new Promise((ok,ng)=>{const q=ctx.decodeAudioData(data,ok,ng);q?.catch?.(ng);}))
  .catch(()=>{if(cache?.p===p)cache=null;return null;});
 cache={id:track.id,ctx,p};
 return p;
}
