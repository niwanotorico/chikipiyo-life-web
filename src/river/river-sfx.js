import * as T from 'three';
import {pickAudioFile} from './audio-loop.js';

// 釣りの効果音（立体音響）。assets/audio/se-*.ogg / .m4a を鳴らす。ファイルが無い音は鳴らさない。
//  land    … ウキ（仕掛け）の着水        se-lure-land    （素材：Fish Pond Splash）
//  lift    … 魚が水面から抜ける釣り上げ   se-fish-lift    （素材：Caught Fish 3）
//  release … 魚を川へ戻すリリース         se-fish-release （素材：Fish Splash）
const FILES=import.meta.glob('../../assets/audio/se-*.{ogg,m4a,mp3,wav}',{eager:true,query:'?url',import:'default'});
export const SFX={
 land:{file:'se-lure-land',gain:1,rate:[.94,1.12]},
 lift:{file:'se-fish-lift',gain:.9,rate:[.95,1.06]},
 release:{file:'se-fish-release',gain:.45,rate:[.95,1.05]},
};
export const filesFor=(all,name)=>Object.fromEntries(Object.entries(all).filter(([p])=>p.replace(/^.*\//,'').startsWith(name+'.')));

export function createRiverSfx({camera,scene,listener=null,mobile=false,files=FILES}={}){
 if(!listener){listener=new T.AudioListener();camera.add(listener);}
 const ctx=listener.context,probe=document.createElement('audio'),buffers={},loader=new T.AudioLoader();
 for(const [type,s] of Object.entries(SFX)){
  const url=pickAudioFile(filesFor(files,s.file),m=>!!probe.canPlayType(m));
  if(url)loader.load(url,b=>{buffers[type]=b;},undefined,e=>console.warn('[river-sfx]',type,e));
 }
 // 同時に鳴るのは数個だけ：使い回しのプール
 const pool=Array.from({length:mobile?4:6},()=>{
  const a=new T.PositionalAudio(listener);a.setDistanceModel('inverse');a.setRefDistance(4);a.setRolloffFactor(1.2);a.setMaxDistance(80);
  a.panner.panningModel=mobile?'equalpower':'HRTF';scene.add(a);return a;
 });
 let next=0;const stats={land:0,lift:0,release:0};
 function play(type,pos){
  const b=buffers[type],s=SFX[type];if(!b||!s||ctx.state!=='running')return false;
  let a=pool.find(p=>!p.isPlaying);if(!a){a=pool[next++%pool.length];a.stop();}
  a.setBuffer(b);a.position.copy(pos);a.updateMatrixWorld();
  a.setPlaybackRate(s.rate[0]+Math.random()*(s.rate[1]-s.rate[0]));   // 毎回ほんの少し音程を変えて単調さを消す
  a.setVolume(s.gain*(.88+Math.random()*.16));a.play();stats[type]++;return true;
 }
 const resume=()=>{if(ctx.state!=='running')ctx.resume().catch(()=>{});};
 for(const ev of ['pointerdown','keydown','touchend'])addEventListener(ev,resume,{passive:true});
 return {play,buffers,stats,listener};
}
