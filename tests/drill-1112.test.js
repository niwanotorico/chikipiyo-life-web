// 2026-11-12 ちきんの決定：ひみつの ごほうびは 開けた子に 中身を見せる／連載マンガは 話数の じゅん／テーマ曲の 音量
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REWARDS,emptyCubePlayer,season,sanitizeCubePlayer,mangaOf,mangaPlan,MANGA_ORDER_FROM} from '../src/drill/cosmicube.js';
import {parentLabel,openedLabel} from '../src/drill/parent-mode.js';
import {rewardFace,mangaName} from '../src/drill/cosmicube-ui.js';
import {QuestAudio,THEME_GAIN} from '../src/drill/audio.js';
import {trackBuffer,THEME,ENMO} from '../src/drill/bgm-pool.js';
import {episodeById} from '../src/manga/catalog.js';

const src=f=>readFileSync(new URL(`../src/drill/${f}`,import.meta.url),'utf8');

// ---------- ひみつの ごほうび ----------
test('ひみつの ごほうび：開けた子には 名前と 子ども向けの 説明を 見せる（名前は 親モードと 同じ）', ()=>{
 const cases=[['hard-goal','piyomi','ママと赤羽でフルーツサンドデート','ママと 赤羽で フルーツサンドを たべに いこう！'],
  ['deep','piyomi','メロガッパFC 3か月権','メロガッパの ファンクラブに 3か月 はいれるよ'],
  ['deep','piyokichi','プリンター稼働券 600ポイント','3Dプリンターを 600ぷん つかえるよ'],
  ['momiji-secret','piyomi','マクドナルド ランチ券','マクドナルドで ランチが たべられるよ'],
  ['momiji-secret','piyokichi','マクドナルド ランチ券','マクドナルドで ランチが たべられるよ']];
 for(const [id,who,name,note] of cases){
  assert.deepEqual(openedLabel(id,who),{name,note},`${id} ${who}`);
  assert.equal(parentLabel(id,who).name,name,'名前は 1か所（parent-mode.js）');
  const f=rewardFace(id,who,null,openedLabel);
  assert.equal(f.name,name);assert.equal(f.note,note);assert.equal(f.icon,REWARDS[id].icon);
  assert.doesNotMatch(note,/ひみつ|親から|渡す|おうちの人/,'親むけの 文は 子どもに 出さない');
 }
});
test('ひみつの ごほうび：switch2 と ぴよきちの ハードモードの ゴールは 開けても ❓ のまま。開ける前も ❓', ()=>{
 for(const who of ['piyomi','piyokichi'])assert.equal(openedLabel('switch2',who),null);
 assert.equal(openedLabel('hard-goal','piyokichi'),null,'中身が 未定');
 assert.equal(rewardFace('hard-goal','piyokichi',null,openedLabel).name,REWARDS['hard-goal'].name);
 assert.equal(rewardFace('switch2','piyomi',null,openedLabel).name,REWARDS.switch2.name);
 assert.equal(openedLabel('usako','piyomi'),null,'ひみつ以外は いつもどおり');
 // 開ける前（opened を わたさない）は これまでどおり
 for(const id of ['deep','hard-goal','momiji-secret'])assert.equal(rewardFace(id,'piyomi').name,REWARDS[id].name);
 // 開けた マスでだけ opened を つかう（ready・near・霧では ❓）
 const ui=src('cosmicube-ui.js');
 assert.match(ui,/const f=state==='open'\?openFace\(node\.reward,player\):rewardFace\(node\.reward,player,parent\)/);
 assert.match(ui,/parent&&node\.reward\?`❓ \$\{rewardFace\(node\.reward,player,parent\)\.name\}`:'❓ なにが でるかな？'/);
 assert.match(src('main.js'),/opened:openedLabel/);
});

// ---------- 連載マンガ ----------
const AFTER='2026-11-14',BEFORE='2026-11-10';
function withRewards(list){   // [[ごほうびID, ひらいた日]]
 const p=emptyCubePlayer();const s=season(p);
 for(const [id,on] of list)s.rewards[id]={on,house:false};
 return sanitizeCubePlayer(p);
}
const mangaIds=Object.keys(REWARDS).filter(id=>REWARDS[id].manga);
const no=e=>Number(e.split('-')[1]);
test('連載マンガ：11/13 より前に ひらいた 話は これまでどおり（よめていた話は へらない）', ()=>{
 assert.equal(MANGA_ORDER_FROM,'2026-11-13');
 const all=withRewards(mangaIds.map(id=>[id,BEFORE]));
 assert.deepEqual([...mangaOf(all,BEFORE)].sort(),[...new Set(mangaIds.flatMap(id=>REWARDS[id].manga))].sort());
 const skip=withRewards([['manga-29',BEFORE],['manga-34',BEFORE]]);   // 日常21話・26話だけ
 assert.deepEqual([...mangaOf(skip,AFTER)].sort(),['daily-21','daily-26']);
 assert.deepEqual(mangaPlan(skip,AFTER).byReward,{});
});
test('連載マンガ：11/13 から あとは、まだ よめない いちばん わかい話から ふえる（とばした話を さきに うめる）', ()=>{
 // 日常1〜21話のうち 18話・20話（manga-27）だけ まだ。ほかは 11/13 より前に ひらいた
 const legacy=mangaIds.filter(id=>REWARDS[id].manga.every(e=>/^(mc|daily)-/.test(e)&&no(e)<=21)&&id!=='manga-27');
 let list=legacy.map(id=>[id,BEFORE]);
 const before=mangaOf(withRewards(list),AFTER);
 assert.ok(!before.has('daily-18')&&!before.has('daily-20')&&before.has('daily-21'));
 // マスに 書いた話は 25話・27話・28話 だが、ふえるのは 18話 → 20話 → 22話
 list=[...list,['manga-33',AFTER],['manga-35','2026-11-15'],['manga-36','2026-11-16']];
 const plan=mangaPlan(withRewards(list),'2026-11-16');
 assert.deepEqual(plan.byReward,{'manga-33':['daily-18'],'manga-35':['daily-20'],'manga-36':['daily-22']});
 for(const e of ['daily-18','daily-20','daily-22'])assert.ok(plan.set.has(e),e);
 for(const e of ['daily-25','daily-27','daily-28'])assert.ok(!plan.set.has(e),e);
 // 日常本は 1話から 22話まで ぜんぶ よめて、とびとびに なっていない
 const daily=[...plan.set].filter(e=>e.startsWith('daily-')).map(no).sort((a,b)=>a-b);
 assert.deepEqual(daily,Array.from({length:22},(_,i)=>i+1));
 assert.equal(mangaName(plan.byReward['manga-33']),`マンガ「${episodeById('daily-18').title}」`);
 assert.match(mangaName(['daily-18']),/^マンガ「.+」$/);
});
test('連載マンガ：ゲートの みちは かわらない・どの じゅんに ひらいても 同じ話が そろう', ()=>{
 const a=withRewards([['manga-30',AFTER],['manga-29',AFTER],['manga-31',AFTER]]);
 const b=withRewards([['manga-31',AFTER],['manga-29',AFTER],['manga-30',AFTER]]);
 assert.deepEqual([...mangaOf(a,AFTER)].sort(),['daily-01','daily-02','daily-03']);
 assert.deepEqual([...mangaOf(a,AFTER)].sort(),[...mangaOf(b,AFTER)].sort());
 // 2話いりの マス（マイクラ1話＋日常1話）は シリーズごとに 1話ずつ
 assert.deepEqual(mangaPlan(withRewards([['manga-1',AFTER]]),AFTER).byReward['manga-1'],['mc-01','daily-01']);
 // 季節の本（れんさいではない）は 書いた話の まま
 assert.ok(mangaOf(withRewards([['manga-14',AFTER]]),AFTER).has('season-01'));
});

// ---------- テーマ曲 ----------
test('テーマ曲：iPad（lite）でも <audio> を やめて Web Audio で ならす。音量は 0.34', ()=>{
 assert.equal(THEME_GAIN,.34);
 const a=src('audio.js'),b=src('bgm-pool.js');
 assert.ok(!a.includes('createMediaElementSource')&&!a.includes('.volume='),'<audio> の 音量に たよらない');
 assert.ok(!b.includes('new Audio('));
 // 効果音・ゲーム中の BGM の 大きさは かえていない
 assert.match(a,/this\.music=c\.createGain\(\);this\.music\.gain\.value=\.5;/);
 assert.match(a,/this\.sfx=c\.createGain\(\);this\.sfx\.gain\.value=\.9;/);
 assert.match(a,/this\.master\.gain\.value=this\.muted\?0:\.85;/);
});
function fakeAudio(){
 const made=[];
 const param=v=>({value:v,cancelScheduledValues(){},setValueAtTime(x){this.value=x;},linearRampToValueAtTime(x){this.value=x;}});
 const ctx={currentTime:0,state:'running',
  createGain(){return {gain:param(1),connect(){},disconnect(){}};},
  createBufferSource(){const s={buffer:null,loop:false,starts:0,stop(){s.stopped=true;},start(){s.starts++;},connect(n){s.out=n;}};made.push(s);return s;}};
 const a=new QuestAudio({storage:null,AudioCtx:null});a.ctx=ctx;a.master={};
 return {a,made};
}
const tick=()=>new Promise(r=>setTimeout(r,0));
test('テーマ曲：1曲だけ ループ。同じ曲は かさねない・よみこみ中に きりかえたら 新しい曲だけ', async ()=>{
 const {a,made}=fakeAudio();
 const load=async(ctx,t)=>({id:t.id});
 assert.equal(a.playTheme(THEME,load),true);await tick();
 assert.equal(made.length,1);assert.equal(made[0].loop,true);assert.equal(made[0].out.gain.value,THEME_GAIN);
 assert.equal(a.themeOn,true);assert.equal(a.themeId,'usako');
 a.playTheme(THEME,load);await tick();assert.equal(made.length,1,'かさねない');
 a.stopTheme();assert.equal(made[0].stopped,true);assert.equal(a.themeOn,false);
 // よみこみが おそい あいだに 曲が かわる → あとの曲だけ
 let release;const slow=(ctx,t)=>t.id==='usako'?new Promise(r=>{release=()=>r({id:t.id});}):Promise.resolve({id:t.id});
 a.playTheme(THEME,slow);a.playTheme(ENMO,slow);await tick();release();await tick();
 assert.equal(made.length,2);assert.equal(made[1].buffer.id,'enmo');assert.equal(a.themeId,'enmo');
 // よみこみ中に とめたら ならさない
 a.stopTheme();a.playTheme(THEME,slow);a.stopTheme();release();await tick();
 assert.equal(made.length,2);assert.equal(a.themeOn,false);
 // ミュート中・よめなかったときは ならさない
 a.muted=true;assert.equal(a.playTheme(THEME,load),false);a.muted=false;
 a.playTheme(THEME,async()=>null);await tick();assert.equal(a.themeOn,false);
});
test('テーマ曲：音のデータは 1曲だけ おぼえる。よめなければ null', async ()=>{
 const real=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;return url.includes('bad')?{ok:false,status:404}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};};
 const ctx={decodeAudioData:(d,ok)=>{ok({decoded:true});}};
 try{
  const x=await trackBuffer(ctx,THEME),y=await trackBuffer(ctx,THEME);
  assert.deepEqual(x,{decoded:true});assert.equal(y,x);assert.equal(calls,1);
  await trackBuffer(ctx,ENMO);assert.equal(calls,2);
  assert.equal(await trackBuffer(ctx,{id:'bad',url:'bad.mp3'}),null);
  assert.equal(await trackBuffer(null,THEME),null);
 }finally{globalThis.fetch=real;}
});
