import * as T from 'three';
import {riverCenter,flowAt,WATER_Y,TERRAIN} from './terrain.js';
import {seamlessBuffer,pickAudioFile} from './audio-loop.js';

// 川のせせらぎ。assets/audio/river-stream.(ogg|m4a|mp3|wav) を置くと鳴る。
// 音源が無いときは何もしない（代わりの合成音は作らない）。
const FILES=import.meta.glob('../../assets/audio/river-stream.{ogg,m4a,mp3,wav}',{eager:true,query:'?url',import:'default'});

// しくみ：
//  - 川の中心線に沿って 16m おきに「音の出る点」を並べ、聞いている人のまわりの N 個だけ鳴らす。
//    歩くと、いちばん遠い点が反対側の先へ移る（音量 0 からフェードイン）ので、どこを歩いても川沿いに音がある
//  - 点ごとに同じ素材の再生位置をずらして、同じ音が重なって響く（くし形の響き）のを防ぐ
//  - 流れの速い瀬の近くは少し大きく、淵は静かに
//  - 川から離れても無音にならないよう、定位しない薄いベッドを 1 本だけ重ねる
//  - VR でもカメラ（＝頭）に AudioListener を付けているので、頭の向きで左右・距離が変わる
export function createRiverAudio({camera,scene,mobile=false,volume=.5,files=FILES}={}){
 const probe=typeof document!=='undefined'?document.createElement('audio'):null;
 const url=pickAudioFile(files,m=>!!(probe&&probe.canPlayType(m)));
 if(!url)return null;

 const listener=new T.AudioListener();camera.add(listener);
 const ctx=listener.context,N=mobile?4:6,SPACING=16,half=Math.floor(N/2);
 const group=new T.Group();group.name='RiverAudio';scene.add(group);
 const bed=new T.Audio(listener);
 const emitters=Array.from({length:N},()=>{
  const a=new T.PositionalAudio(listener);
  a.setDistanceModel('inverse');a.setRefDistance(6);a.setRolloffFactor(1.1);a.setMaxDistance(150);
  a.panner.panningModel=mobile?'equalpower':'HRTF';
  group.add(a);return {a,slot:null};
 });
 let buffer=null,started=false,wantOn=true;
 new T.AudioLoader().load(url,buf=>{buffer=seamlessBuffer(ctx,buf);start();},undefined,e=>console.warn('[river-audio] 読み込み失敗',e));

 const flowGain=z=>{const f=flowAt(riverCenter(z),z);return .55+.45*Math.min(1,Math.hypot(f[0],f[1])/1.1);};
 const lp=new T.Vector3();
 function place(initial=false){
  camera.getWorldPosition(lp);
  const k0=Math.round(lp.z/SPACING)-half,t=ctx.currentTime;
  for(let k=k0;k<k0+N;k++){
   const e=emitters[((k%N)+N)%N];if(e.slot===k)continue;
   e.slot=k;const z=k*SPACING,inside=Math.abs(z)<TERRAIN.length/2;
   e.a.position.set(riverCenter(z),WATER_Y+.3,z);e.a.updateMatrixWorld();
   const g=e.a.gain.gain,target=inside?volume*flowGain(z):0;
   g.cancelScheduledValues(t);
   if(initial)g.setValueAtTime(target,t);else{g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+.05);g.linearRampToValueAtTime(target,t+1.6);}
  }
 }
 function start(){
  if(!buffer||started||!wantOn||ctx.state!=='running')return;
  started=true;
  bed.setBuffer(buffer);bed.setLoop(true);bed.offset=0;bed.setVolume(volume*.16);bed.play();
  emitters.forEach((e,i)=>{e.a.setBuffer(buffer);e.a.setLoop(true);e.a.offset=(i*.37*buffer.duration)%buffer.duration;e.a.play();});
  place(true);
  const m=listener.gain.gain;m.setValueAtTime(0,ctx.currentTime);m.linearRampToValueAtTime(1,ctx.currentTime+2.5); // ふわっと始める
 }
 // ブラウザの自動再生制限：最初のタップ／クリック／キー操作（VRボタンも含む）で音を開始
 function resume(){if(ctx.state!=='running')ctx.resume().then(start).catch(()=>{});else start();}
 for(const ev of ['pointerdown','keydown','touchend'])addEventListener(ev,resume,{passive:true});
 // タブを隠したら止める
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(started)ctx.resume();});

 let acc=0;
 function update(dt){if(!started)return;acc+=dt;if(acc<.25)return;acc=0;place();}
 return {listener,update,resume,url,get playing(){return started&&ctx.state==='running';}};
}
