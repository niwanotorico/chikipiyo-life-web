// 🎵 もみじの曲マス：テーマソング enmo_loop とゲーム中の えんも合成版
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {emptyCubePlayer,openGate,season,effectsOf,nodeById,REWARDS,sanitizeCubePlayer,cubeBalance} from '../src/drill/cosmicube.js';
import {themeTrack,gameSong,THEME,ENMO} from '../src/drill/bgm-pool.js';
import {QuestAudio,SONGS} from '../src/drill/audio.js';
import {tempo} from '../src/drill/hype.js';

const N1='2026-11-01';
function rich(pt){let p=emptyCubePlayer();for(let i=0;i<Math.ceil(pt/100);i++)season(p).earned.push({id:`r${i}`,day:'2026-10-10',pt:100});return sanitizeCubePlayer(p);}
const open=(p,ids)=>{for(const id of ids){const r=openGate(p,id,N1);assert.equal(r.ok,true,`${id} ${r.reason}`);p=r.player;}return p;};
const PATH=['momiji-02','momiji-usako','momiji-05','momiji-35','momiji-37'];
const MUTE=['kick','clap','hat','shaker','snare','crash','bass','toy','pluck','pad','brass','chirp'];
function fakeAudio(stage,song){
 const a=new QuestAudio({storage:null,AudioCtx:null});const leads=[];
 for(const m of MUTE)a[m]=()=>{};
 a.lead=(t,m,dur,v)=>leads.push({m,dur,v});a.now=()=>0;a.padBus={gain:{setValueAtTime(){},linearRampToValueAtTime(){}}};
 if(song)a.setSong(song);
 a.setStage(stage);
 for(let i=0;i<64;i++)a.scheduleStep(i,0);
 return {a,leads};
}

test('曲マス：30pt で ひらくと enmo の 効果が つく。ひらくまでは 何も かわらない', ()=>{
 assert.equal(nodeById('momiji-song').cost,30);
 assert.equal(REWARDS['momiji-song'].name,'えんもたけなわ');
 let p=open(rich(1000),PATH);
 assert.ok(!effectsOf(p).has('enmo'));
 const bal=cubeBalance(season(p));
 p=open(p,['momiji-song']);
 assert.ok(effectsOf(p).has('enmo'));
 assert.equal(cubeBalance(season(p)),bal-30,'つかうのは 30pt だけ');
});

test('テーマソング：未解放は これまでどおり。解放後は enmo_loop（軽い方）', ()=>{
 assert.equal(themeTrack(new Set()),null);
 assert.equal(themeTrack(new Set(['bgm'])),THEME);
 assert.equal(themeTrack(new Set(['enmo'])),ENMO);
 assert.equal(themeTrack(new Set(['bgm','enmo'])),ENMO);
 assert.ok(ENMO.url.endsWith('/bgm/enmo_loop.mp3'));
 const file=new URL('../bgm/enmo_loop.mp3',import.meta.url);
 assert.ok(existsSync(file));assert.ok(statSync(file).size<800*1024,'800KB 以下');
});

test('ゲーム中の曲：解放した子だけ えんも', ()=>{
 assert.equal(gameSong(new Set()),'default');
 assert.equal(gameSong(new Set(['bgm','usako'])),'default');
 assert.equal(gameSong(new Set(['enmo'])),'enmo');
});

test('いつもの曲は これまでと おなじ（段階4から メロディ・音量 .06・テンポそのまま）', ()=>{
 assert.equal(new QuestAudio({storage:null,AudioCtx:null}).song,SONGS.default);
 assert.equal(fakeAudio(3).leads.length,0);
 const {a,leads}=fakeAudio(4);
 assert.equal(a.bpm,tempo(4));
 assert.ok(leads.length>0);assert.ok(leads.every(l=>l.v===.06));
 assert.equal(leads[0].m,SONGS.default.hook[0][0]);
});

test('えんも：はじめから メロディが 鳴る。音は 表のとおり。段階で テンポと 音量が 上がる', ()=>{
 const notes=SONGS.enmo.hook.flat().filter(Boolean);
 const s0=fakeAudio(0,'enmo'),s4=fakeAudio(4,'enmo');
 assert.deepEqual(s0.leads.map(l=>l.m),notes);
 assert.equal(s0.a.bpm,tempo(0)+8);assert.equal(fakeAudio(2,'enmo').a.bpm,126);
 assert.ok(s0.leads[0].v<s4.leads[0].v);assert.ok(Math.abs(s4.leads[0].v-.06)<1e-9);
 // フィーバーは 全音あがる（いつもの曲と おなじ）
 assert.equal(fakeAudio(5,'enmo').leads[0].m,79+2);
});

test('えんも：次の音まで のばす（さいだい 2拍）。休符は 鳴らさない', ()=>{
 const {a,leads}=fakeAudio(0,'enmo'),sd=a.stepDur;
 const near=(x,y)=>Math.abs(x-y)<1e-9;
 assert.ok(near(leads[0].dur,sd*2*2*.9),'79 は 次の 76 まで 2つぶん');
 assert.ok(near(leads[1].dur,sd*2*2*.9),'76 も 2つぶん');
 assert.ok(near(leads[2].dur,sd*2*.9),'74 は 1つぶん');
 assert.equal(leads[9].m,76);assert.ok(near(leads[9].dur,sd*2*4*.9),'小節おわりの 76 は さいだい 2拍');
});

test('わからない 曲名は いつもの曲に もどる', ()=>{
 const a=new QuestAudio({storage:null,AudioCtx:null});
 a.setSong('enmo');assert.equal(a.song,SONGS.enmo);
 a.setSong('george');assert.equal(a.song,SONGS.default);assert.equal(a.bpm,tempo(0));
});
