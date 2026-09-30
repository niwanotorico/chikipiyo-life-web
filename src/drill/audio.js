// ちきぴよクエスト v0.2：音（BGM・効果音）。すべて Web Audio API でその場で合成するオリジナル。
// 音源ファイル・外部素材は使わない。曲（コード進行・メロディ）もこのファイルに書いた自作。
//
// しくみ
//  - BGM は 16分音符のシーケンサー（先読み 0.12 秒）。hype.js の LAYERS の段階ごとに楽器が重なっていく
//  - 効果音は「いま鳴っているコードの音」から音程を選ぶので、BGM とハモる。コンボが増えるほど音程が上がる
//  - 拍ごとに onBeat(遅れms, 小節頭か) を呼ぶ。画面のキャラ・背景がそれに合わせて脈打つ
//  - 最初のユーザー操作（unlock）まで AudioContext を作らない（自動再生制限）
//  - ミュートは localStorage に保存。ページを離れたら suspend
import {layersFor,tempo,keyShift} from './hype.js';

export const SOUND_KEY='chikipiyo-quest:sound';
const mtof=m=>440*2**((m-69)/12);

// F → Dm → B♭ → C（ヘ長調の I–vi–IV–V）。tones は中音域の和音、bass は低音
const PROG=[
 {bass:41,tones:[65,69,72]},
 {bass:38,tones:[62,65,69]},
 {bass:46,tones:[62,65,70]},
 {bass:48,tones:[64,67,72]},
];
// 「おまつり」から入るメロディ（8分音符×8／小節、0 は休み）。ちきぴよクエストのための書きおろし
const HOOK=[
 [72,0,69,72,74,72,69,0],
 [69,0,65,69,72,69,65,0],
 [70,0,74,77,74,70,69,0],
 [67,69,72,74,76,0,79,0],
];
const TOY=[0,1,2,1,0,2,1,2];      // トイピアノの分散和音の並び
const ARP=[0,1,2,3,2,1,2,3];      // 3 = 根音の1オクターブ上

function readMuted(storage){try{return storage?.getItem(SOUND_KEY)==='off';}catch{return false;}}
function safeStorage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch{return null;}}

export class QuestAudio{
 constructor({storage=safeStorage(),AudioCtx=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
  this.storage=storage;this.AudioCtx=AudioCtx;
  this.muted=readMuted(storage);
  this.ctx=null;this.stage=0;this.trans=0;this.bpm=tempo(0);this.layers=layersFor(0);
  this.playing=false;this.reach=false;this.step=0;this.nextTime=0;this.timer=0;this.reachStart=0;
  this.onBeat=null;   // (delayMs, isBarStart) => void
 }
 get available(){return !!this.AudioCtx;}
 get stepDur(){return 60/this.bpm/4;}
 now(){return this.ctx?this.ctx.currentTime:0;}

 // 最初のユーザー操作の中で呼ぶ
 unlock(){
  if(!this.AudioCtx)return null;
  if(!this.ctx){
   try{this.ctx=new this.AudioCtx({latencyHint:'interactive'});}catch{this.AudioCtx=null;return null;}
   this.build();
  }
  if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
  return this.ctx;
 }
 build(){
  const c=this.ctx;
  this.master=c.createGain();this.master.gain.value=this.muted?0:.85;
  const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.18;
  this.master.connect(comp);comp.connect(c.destination);
  this.output=comp; // 録画用に外から拾えるように
  // 残響（自作のノイズ減衰インパルス）
  const len=Math.floor(c.sampleRate*1.3),ir=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len)**3.2;}
  this.reverb=c.createConvolver();this.reverb.buffer=ir;
  const wet=c.createGain();wet.gain.value=.22;this.reverb.connect(wet);wet.connect(this.master);
  // BGM：music → duck（まちがい時にしずむ）→ filter（リーチでこもる）→ master
  this.musicFilter=c.createBiquadFilter();this.musicFilter.type='lowpass';this.musicFilter.frequency.value=18000;this.musicFilter.Q.value=.8;
  this.duck=c.createGain();this.duck.gain.value=1;
  this.music=c.createGain();this.music.gain.value=.5;
  this.music.connect(this.duck);this.duck.connect(this.musicFilter);this.musicFilter.connect(this.master);
  this.padBus=c.createGain();this.padBus.gain.value=1;this.padBus.connect(this.music);   // キックに合わせてうねる
  this.sfx=c.createGain();this.sfx.gain.value=.9;this.sfx.connect(this.master);
  const noise=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=noise.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  this.noiseBuf=noise;
 }

 // ---------- 音量・ミュート・ページ離脱 ----------
 setMuted(m){
  this.muted=!!m;
  try{this.storage?.setItem(SOUND_KEY,m?'off':'on');}catch{}
  if(this.ctx){const g=this.master.gain,t=this.now();g.cancelScheduledValues(t);g.setTargetAtTime(m?0:.85,t,.03);}
 }
 suspend(){if(this.ctx&&this.ctx.state==='running')this.ctx.suspend().catch(()=>{});}
 resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}

 // ---------- 部品 ----------
 env(t,{a=.004,peak=1,d=.2,hold=0}={}){
  const g=this.ctx.createGain(),p=Math.max(.0002,peak);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(p,t+a);
  if(hold)g.gain.setValueAtTime(p,t+a+hold);
  g.gain.exponentialRampToValueAtTime(.0001,t+a+hold+d);
  return g;
 }
 osc(type,f,t,stop,out,detune=0){
  const o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);if(detune)o.detune.value=detune;
  o.connect(out);o.start(t);o.stop(stop+.05);return o;
 }
 noise(t,stop,out){const s=this.ctx.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;s.connect(out);s.start(t);s.stop(stop+.05);return s;}
 filter(type,f,q=.7){const n=this.ctx.createBiquadFilter();n.type=type;n.frequency.value=f;n.Q.value=q;return n;}
 out(node,bus,{rev=0,pan=0}={}){
  let last=node;
  if(pan&&this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner();p.pan.value=pan;node.connect(p);last=p;}
  last.connect(bus);
  if(rev){const s=this.ctx.createGain();s.gain.value=rev;last.connect(s);s.connect(this.reverb);}
 }
 ok(){return !!this.ctx&&!this.muted&&this.ctx.state!=='closed';}
 chordAt(step=this.step){return PROG[Math.floor(step/16)%4];}
 // コードの i 番目の音（3 以上はオクターブ上へ）
 tone(i,step){const ch=this.chordAt(step);return ch.tones[i%3]+12*Math.floor(i/3)+this.trans;}

 // ---------- 楽器 ----------
 kick(t,v=.9,bus=this.music){
  const g=this.env(t,{a:.002,peak:v,d:.28});const o=this.osc('sine',150,t,t+.32,g);
  o.frequency.exponentialRampToValueAtTime(44,t+.13);this.out(g,bus);
 }
 clap(t,v=.5){
  const f=this.filter('bandpass',1600,1.2);
  for(const dt of [0,.012,.024]){const g=this.env(t+dt,{a:.001,peak:v*(dt?.7:1),d:dt===.024?.16:.03});this.noise(t+dt,t+dt+.2,g);g.connect(f);}
  this.out(f,this.music,{rev:.25});
 }
 hat(t,v=.12,open=false){const f=this.filter('highpass',7500);const g=this.env(t,{a:.001,peak:v,d:open?.18:.045});this.noise(t,t+.25,f);f.connect(g);this.out(g,this.music,{pan:.25});}
 shaker(t,v=.05){const f=this.filter('bandpass',5200,2);const g=this.env(t,{a:.008,peak:v,d:.05});this.noise(t,t+.1,f);f.connect(g);this.out(g,this.music,{pan:-.2});}
 snare(t,v=.3){
  const f=this.filter('bandpass',1900,.9);const g=this.env(t,{a:.001,peak:v,d:.14});this.noise(t,t+.2,f);f.connect(g);this.out(g,this.music,{rev:.2});
  const g2=this.env(t,{a:.001,peak:v*.5,d:.08});this.osc('triangle',190,t,t+.1,g2);this.out(g2,this.music);
 }
 crash(t,v=.25,bus=this.music){const f=this.filter('highpass',4200);const g=this.env(t,{a:.002,peak:v,d:1.2});this.noise(t,t+1.3,f);f.connect(g);this.out(g,bus,{rev:.3});}
 bass(t,m,dur,v=.32){
  const f=this.filter('lowpass',700);const g=this.env(t,{a:.006,peak:v,d:dur});
  this.osc('triangle',mtof(m),t,t+dur+.05,f);this.osc('sine',mtof(m-12),t,t+dur+.05,f);f.connect(g);this.out(g,this.music);
 }
 toy(t,m,v=.08,pan=0,bus=this.music){ // トイピアノ：三角波＋2倍音、すぐ減衰
  const g=this.env(t,{a:.002,peak:v,d:.42});this.osc('triangle',mtof(m),t,t+.5,g);
  const g2=this.env(t,{a:.002,peak:v*.35,d:.12});this.osc('sine',mtof(m)*4,t,t+.15,g2);g2.connect(g);
  this.out(g,bus,{rev:.25,pan});
 }
 pluck(t,m,v=.05,pan=0){const f=this.filter('lowpass',2400);const g=this.env(t,{a:.002,peak:v,d:.16});this.osc('square',mtof(m),t,t+.2,f);f.connect(g);this.out(g,this.music,{rev:.15,pan});}
 pad(t,notes,dur,v=.03,bright=900){
  const f=this.filter('lowpass',bright);const g=this.env(t,{a:.25,peak:v,hold:dur*.5,d:dur*.5});
  for(const m of notes){this.osc('sawtooth',mtof(m),t,t+dur+.1,f,-7);this.osc('sawtooth',mtof(m),t,t+dur+.1,f,7);}
  f.connect(g);this.out(g,this.padBus,{rev:.3});
 }
 lead(t,m,dur,v=.06){
  const f=this.filter('lowpass',2600);const g=this.env(t,{a:.01,peak:v,hold:dur*.4,d:dur*.8});
  const o=this.osc('square',mtof(m),t,t+dur*1.3,f);
  const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain();lfo.frequency.value=5.5;lg.gain.value=6;lfo.connect(lg);lg.connect(o.detune);lfo.start(t);lfo.stop(t+dur*1.3+.05);
  f.connect(g);this.out(g,this.music,{rev:.3,pan:.1});
 }
 brass(t,notes,dur=.16,v=.05,bus=this.music){
  const f=this.filter('lowpass',500,2);f.frequency.setValueAtTime(500,t);f.frequency.linearRampToValueAtTime(3200,t+.04);f.frequency.exponentialRampToValueAtTime(900,t+dur);
  const g=this.env(t,{a:.012,peak:v,hold:dur*.5,d:dur*.6});
  for(const m of notes){this.osc('sawtooth',mtof(m),t,t+dur+.1,f,-5);this.osc('sawtooth',mtof(m),t,t+dur+.1,f,6);}
  f.connect(g);this.out(g,bus,{rev:.2});
 }
 bell(t,m,v=.12,dur=.9,pan=0,bus=this.sfx){ // チャイム：基音＋非整数倍音
  const g=this.env(t,{a:.002,peak:v,d:dur});this.osc('sine',mtof(m),t,t+dur+.05,g);
  const g2=this.env(t,{a:.002,peak:v*.4,d:dur*.35});this.osc('sine',mtof(m)*2.76,t,t+dur*.4,g2);g2.connect(g);
  this.out(g,bus,{rev:.35,pan});
 }
 chirp(t,m,v=.1,bus=this.sfx,pan=0){ // 「ぴよ」：上へすべる短い鳴き声を2回
  for(const [dt,up] of [[0,1.5],[.085,1.35]]){
   const g=this.env(t+dt,{a:.004,peak:v,d:.07});const o=this.osc('sine',mtof(m),t+dt,t+dt+.09,g);
   o.frequency.exponentialRampToValueAtTime(mtof(m)*up,t+dt+.05);o.frequency.exponentialRampToValueAtTime(mtof(m)*up*.92,t+dt+.08);
   this.out(g,bus,{rev:.2,pan});
  }
 }
 riser(t,dur=2.4,v=.14){
  const f=this.filter('bandpass',400,3);f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(5200,t+dur);
  const g=this.ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+dur);g.gain.exponentialRampToValueAtTime(.0001,t+dur+.08);
  this.noise(t,t+dur+.1,f);f.connect(g);this.out(g,this.sfx,{rev:.2});
 }
 boom(t,v=1){this.kick(t,v,this.sfx);const g=this.env(t,{a:.003,peak:v*.45,d:.9});const o=this.osc('sine',70,t,t+1,g);o.frequency.exponentialRampToValueAtTime(34,t+.8);this.out(g,this.sfx);this.crash(t,.35*v,this.sfx);}
 duckMusic(depth=.45,dur=.4){const g=this.duck.gain,t=this.now();g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(depth,t+.03);g.linearRampToValueAtTime(1,t+dur);}

 // ---------- BGM ----------
 setStage(stage){
  this.stage=stage;this.layers=layersFor(stage);
  this.bpm=tempo(stage);this.trans=keyShift(stage);
 }
 startMusic(stage=0){
  this.unlock();this.setStage(stage);
  if(!this.ctx||this.playing)return;
  this.playing=true;this.step=0;this.nextTime=this.now()+.08;
  if(this.music){const g=this.music.gain,t=this.now();g.cancelScheduledValues(t);g.setValueAtTime(.5,t);}
  this.timer=setInterval(()=>this.tick(),25);this.tick();
 }
 stopMusic(fade=0){
  this.playing=false;clearInterval(this.timer);this.timer=0;this.setReach(false,{silent:true});
  if(this.ctx&&fade){const g=this.music.gain,t=this.now();g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(.0001,t+fade);}
 }
 tick(){
  if(!this.playing||!this.ctx)return;
  const now=this.now();
  if(this.nextTime<now-.2)this.nextTime=now+.02; // タブ復帰などで遅れたら追いつかせずに今から
  while(this.nextTime<now+.12){this.scheduleStep(this.step,this.nextTime);this.nextTime+=this.stepDur;this.step++;}
 }
 // 次の小節の頭へ跳ぶ（リーチ解放・フィーバー突入の「ドン」）
 downbeat(){this.step=Math.ceil(this.step/16)*16;this.nextTime=this.now()+.005;}

 scheduleStep(step,t){
  const s=step%16,bar=Math.floor(step/16)%4,ch=PROG[bar],k=this.trans,L=this.layers,sd=this.stepDur;
  if(s%4===0&&this.onBeat)this.onBeat(Math.max(0,(t-this.now())*1000),s===0);
  if(this.muted)return;
  if(this.reach){ // さいごの1もん：こもった音でスネアが詰まっていく
   const e=Math.min(1,(t-this.reachStart)/3);
   if(s%4===0){this.kick(t,.8);this.bass(t,ch.bass+k,sd*3,.3);}
   if(s%(e>.6?1:e>.3?2:4)===0)this.snare(t,.08+.3*e);
   if(s===0)this.pad(t,ch.tones.map(m=>m+k),sd*16,.035,600+1600*e);
   return;
  }
  if(L.has('toy')&&s%2===0){const i=TOY[(s/2)%8];this.toy(t,ch.tones[i]+12+k,.075,i===1?.3:-.3);}
  if(L.has('arp')){const i=ARP[s%8],m=i===3?ch.tones[0]+12:ch.tones[i];this.pluck(t,m+12+k+(this.stage>=4&&s>=8?12:0),.04,s%2?.3:-.3);}
  if(L.has('shaker'))this.shaker(t,s%2?.045:.025);
  const kick=(L.has('kick4')&&s%4===0)||(L.has('kick13')&&(s===0||s===8))||(L.has('kick1')&&s===0);
  if(kick){
   this.kick(t,L.has('kick4')?.9:.6);
   if(L.has('duck')){const g=this.padBus.gain;g.setValueAtTime(.35,t);g.linearRampToValueAtTime(1,t+sd*3);}
  }
  if(s===0&&L.has('pad'))this.pad(t,ch.tones.map(m=>m+k),sd*15,.022+.006*Math.min(4,this.stage),700+300*this.stage);
  if(L.has('bass')){if(s%4===0)this.bass(t,ch.bass+k,sd*2.5);else if(this.stage>=3&&s%4===2)this.bass(t,ch.bass+12+k,sd*1.2,.2);}
  if(L.has('clap')&&(s===4||s===12))this.clap(t,.45);
  if(L.has('hat')&&s%4===2)this.hat(t,.13,this.stage>=4);
  if(L.has('hat16')&&s%2===1)this.hat(t,.05);
  if(L.has('chirp')&&s===14&&bar%2===1)this.chirp(t,ch.tones[2]+24+k,.035,this.music,.35);
  if(L.has('lead')&&s%2===0){const m=HOOK[bar][s/2];if(m)this.lead(t,m+k,sd*1.8);}
  if(L.has('fill')&&bar===3&&s>=12)this.snare(t,.1+(s-12)*.06);
  if(L.has('crash')&&bar===0&&s===0)this.crash(t,.12);
  if(L.has('brass')&&s%4===2)this.brass(t,ch.tones.map(m=>m+12+k),sd*1.4,.035);
 }

 setReach(on,{silent=false}={}){
  if(on===this.reach||!this.ctx){this.reach=on;return;}
  this.reach=on;const t=this.now(),f=this.musicFilter.frequency;
  f.cancelScheduledValues(t);f.setValueAtTime(f.value,t);
  if(on){this.reachStart=t;f.exponentialRampToValueAtTime(1100,t+.6);if(!silent&&!this.muted)this.riser(t,3.2,.12);}
  else f.exponentialRampToValueAtTime(18000,t+.05);
 }

 // ---------- 効果音 ----------
 // テンキー：入力した桁数でコードの音を上っていく木の実のような「ぽこ」
 key(n=0){
  if(!this.ok())return;const t=this.now(),m=Math.min(96,this.tone(n)+24);
  const g=this.env(t,{a:.001,peak:.11,d:.06});const o=this.osc('sine',mtof(m),t,t+.08,g);o.frequency.exponentialRampToValueAtTime(mtof(m)*.8,t+.05);this.out(g,this.sfx);
  const g2=this.env(t,{a:.001,peak:.05,d:.02});this.osc('triangle',mtof(m)*2,t,t+.03,g2);this.out(g2,this.sfx);
 }
 erase(){if(!this.ok())return;const t=this.now();const g=this.env(t,{a:.002,peak:.07,d:.08});const o=this.osc('sine',700,t,t+.1,g);o.frequency.exponentialRampToValueAtTime(380,t+.08);this.out(g,this.sfx);}
 tap(){if(!this.ok())return;const t=this.now();this.toy(t,this.tone(2)+24,.07,0,this.sfx);}
 // 正解：「ぴよっ」＋チャイムの和音。コンボで音程が上がり、段階で音が厚くなる
 correct(stage,combo){
  if(!this.ok())return;const t=this.now(),base=Math.min(93,this.tone(combo)+24);
  this.chirp(t,base+12,.09);
  this.bell(t,base,.13+.02*stage,.9,-.2);
  this.bell(t+.05,base+7,.09+.02*stage,.8,.25);
  if(stage>=1)this.bell(t+.1,base+12,.07+.02*stage,.9,-.3);
  if(stage>=2){this.clap(t,.28);}
  if(stage>=3){this.toy(t+.14,base+16,.06,.4,this.sfx);this.crash(t,.1+.03*stage,this.sfx);}
  if(stage>=4)this.brass(t,[base-12,base-8,base-5],.22,.05,this.sfx);
 }
 // コンボの節目：下から駆け上がるきらきら
 comboUp(size=1){
  if(!this.ok())return;const t=this.now(),n=3+size*2;
  for(let i=0;i<n;i++)this.toy(t+.08+i*.045,this.tone(i)+24,.06+.01*size,i%2?.4:-.4,this.sfx);
  if(size>=2)this.chirp(t+.08+n*.045,Math.min(96,this.tone(n)+24),.08);
  if(size>=3){this.crash(t+.08,.14,this.sfx);this.kick(t+.08,.7,this.sfx);}
 }
 // ポイントがポイント表示に届いたとき
 point(){if(!this.ok())return;const t=this.now(),m=Math.min(96,this.tone(2)+24);this.bell(t,m,.07,.35,.3);this.bell(t+.07,m+5,.08,.5,.3);}
 // まちがい：「ぽよん」。BGM が一瞬しずむだけで、警告音にはしない
 wrong(){
  if(!this.ctx)return;this.duckMusic(.45,.45);if(this.muted)return;
  const t=this.now(),f=this.filter('lowpass',1200),g=this.env(t,{a:.005,peak:.2,d:.34});
  const o=this.osc('sine',330,t,t+.4,f);o.frequency.exponentialRampToValueAtTime(190,t+.12);o.frequency.exponentialRampToValueAtTime(250,t+.3);
  f.connect(g);this.out(g,this.sfx);
 }
 // さいごの1もん（リーチ）
 reachOn(){if(this.ctx)this.setReach(true);}
 // フィーバー突入：ドン！＋ひよこの大合唱＋次の小節頭からフィーバー曲
 feverIn(){
  if(!this.ctx)return;this.setReach(false,{silent:true});
  if(!this.muted){
   const t=this.now(),root=65+2;
   this.boom(t,1);
   this.brass(t,[root,root+4,root+7,root+12],.5,.09,this.sfx);
   for(let i=0;i<7;i++)this.chirp(t+.12+i*.07,root+24+[0,4,7,12,7,12,16][i],.06,this.sfx,(i%2?.5:-.5));
  }
  this.setStage(5);this.downbeat();
 }
 // プリン出現ファンファーレ（タ・タ・タ・ターン、タ・ターーン）
 fanfare(){
  if(!this.ok())return;const t=this.now(),r=65+this.trans;
  const line=[[0,.11],[4,.11],[7,.11],[12,.34],[9,.12],[12,.12],[16,.7]];
  let at=t;
  for(const [n,d] of line){this.brass(at,[r+n,r+n-12],d,.075,this.sfx);this.bell(at,r+n+12,.05,.5,0);at+=d+.03;}
  this.brass(at-.72,[r+4,r+7],.7,.05,this.sfx);
  this.crash(at-.72,.3,this.sfx);
  for(let i=0;i<10;i++)this.bell(at-.6+i*.05,r+24+[0,4,7,12,16][i%5],.04,.5,i%2?.5:-.5);
 }
 // プリンの「ぷるるん」
 jiggle(){
  if(!this.ok())return;const t=this.now();
  const g=this.env(t,{a:.01,peak:.2,d:.75});const o=this.osc('sine',240,t,t+.8,g);
  const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain();lfo.frequency.setValueAtTime(15,t);lfo.frequency.linearRampToValueAtTime(7,t+.7);
  lg.gain.setValueAtTime(70,t);lg.gain.exponentialRampToValueAtTime(3,t+.75);lfo.connect(lg);lg.connect(o.frequency);lfo.start(t);lfo.stop(t+.85);
  o.frequency.exponentialRampToValueAtTime(170,t+.7);this.out(g,this.sfx,{rev:.2});
 }
 // 目玉焼き：ひゅー（落下）→ ぽすっ（着地）→ ぷるん（黄身）→ ぴょん（小さく跳ねる）。
 // 画面の EGG_TIMES（ms）と同じ時刻を AudioContext の時計で予約するので、絵と音がずれない
 egg({land=380,jiggle=470,hop=820}={}){
  if(!this.ok())return;const t=this.now(),L=land/1000,J=jiggle/1000,H=hop/1000;
  const g0=this.env(t,{a:.02,peak:.06,hold:L-.08,d:.06});const o0=this.osc('sine',1600,t,t+L,g0);o0.frequency.exponentialRampToValueAtTime(420,t+L);this.out(g0,this.sfx);
  const g1=this.env(t+L,{a:.002,peak:.34,d:.16});const o1=this.osc('sine',220,t+L,t+L+.2,g1);o1.frequency.exponentialRampToValueAtTime(80,t+L+.12);this.out(g1,this.sfx);
  const f=this.filter('lowpass',900),g2=this.env(t+L,{a:.001,peak:.18,d:.08});this.noise(t+L,t+L+.1,f);f.connect(g2);this.out(g2,this.sfx);
  const g3=this.env(t+J,{a:.01,peak:.15,d:.4});const o3=this.osc('sine',540,t+J,t+J+.48,g3);
  const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain();lfo.frequency.setValueAtTime(18,t+J);lfo.frequency.linearRampToValueAtTime(8,t+J+.4);
  lg.gain.setValueAtTime(90,t+J);lg.gain.exponentialRampToValueAtTime(4,t+J+.42);lfo.connect(lg);lg.connect(o3.frequency);lfo.start(t+J);lfo.stop(t+J+.5);this.out(g3,this.sfx,{rev:.2});
  const f4=this.filter('lowpass',2400),g4=this.env(t+H,{a:.004,peak:.12,d:.18});const o4=this.osc('square',420,t+H,t+H+.22,f4);o4.frequency.exponentialRampToValueAtTime(1300,t+H+.14);f4.connect(g4);this.out(g4,this.sfx,{rev:.2});
  this.chirp(t+H+.16,91,.07);
 }
 // 2人が画面外から飛び込むときの「ひゅーん」
 whoosh(){if(!this.ok())return;const t=this.now();const f=this.filter('bandpass',600,1.5);f.frequency.setValueAtTime(600,t);f.frequency.exponentialRampToValueAtTime(3200,t+.3);f.frequency.exponentialRampToValueAtTime(900,t+.5);const g=this.env(t,{a:.05,peak:.16,hold:.2,d:.25});this.noise(t,t+.55,f);f.connect(g);this.out(g,this.sfx,{rev:.2});this.chirp(t+.32,86,.06);}
 // さいごをまちがえたとき：やさしい締め
 finishSoft(){if(!this.ok())return;const t=this.now(),r=65+this.trans;[0,4,7,12].forEach((n,i)=>this.bell(t+i*.09,r+12+n,.08,1.1,i%2?.3:-.3));}
}
