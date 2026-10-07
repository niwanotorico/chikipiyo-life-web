// ピヨドリル v0.2：ホーム → 10問（音つきドパ演出）→ プリンフィーバー → 結果。記録は端末内（storage.js）。
import {PLAYERS,makeQuestionSet} from './questions.js';
import {createRun,answerRun} from './scoring.js';
import {loadStore,saveStore,commitResult,setPuddingDisplayed,selectPlayer,dayInfo,sessionsLeft,todayKey,DAILY_REWARD_SESSIONS,safeStorage} from './storage.js';
import {stageFor,comboMilestone,nextDelay,WRONG_DELAY,FEVER,FEVER_MS,FEVER_SKIP_AFTER,SOFT_FINISH_MS,HERO_MS,SUSPENSE_MS,SUSPENSE_MS_REDUCED,visuals,actorPlan,eggRoll,EGG_TIMES,EGG_NEXT_DELAY,POSES,DUO} from './hype.js';
import {Actor,POSE_URLS} from './actor.js';
import {QuestAudio} from './audio.js';
import {Particles,flyText,shake,replay,centerOf,prefersReducedMotion} from './fx.js';
import {mountSiteNav} from '../nav/site-nav.js';
import {CubeStore,localCubeAdapter,memoryCubeAdapter} from './cosmicube-store.js';
import {createCubeMap,pixelChar,seasonPeriod} from './cosmicube-ui.js';
import {pickTrack,trackElement} from './bgm-pool.js';
import {isParentMode,parentLabel} from './parent-mode.js';
import * as festival from './festival.js';

const art={
 piyokichi:new URL('../../assets/points/piyokichi.png',import.meta.url).href,
 piyomi:new URL('../../assets/points/piyomi.png',import.meta.url).href,
};
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const storage=safeStorage();
let {store,status}=loadStore(storage);
let play=null;   // {player, dayKey, sessionId, practice, run, input, feedback, committed, award, stage, token}
const audio=new QuestAudio({storage});
const particles=new Particles($('[data-fx]'));
let reduced=prefersReducedMotion();
try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{reduced=e.matches;});}catch{}
const params=new URLSearchParams(location.search);
const FORCE_EGG=params.get('egg')==='1';   // 確認用：?egg=1 で次の正解に目玉焼き（1プレイ1回）
const NO_EGG=params.get('egg')==='0';      // 録画用：?egg=0 で目玉焼きを出さない
// 演出モード（ふつう／おまつり）。演出だけを切り替える。初回は「ふつう」、あとは最後に選んだほうを覚える（festival.js の専用キー）。
// ?fx=normal|festival は確認用（保存はしない。ホームで押したときだけ保存）
let fxMode=['normal','festival'].includes(params.get('fx'))?params.get('fx'):festival.loadFxMode(storage);
const actor=new Actor($('[data-stage]'),{reduced:()=>reduced});
// ピヨ探検（10月の報酬マップ）。保存は cosmicube-store.js だけが行う。親モード（仮）の判定は parent-mode.js
const cube=new CubeStore({adapter:storage?localCubeAdapter(storage):memoryCubeAdapter()});
const PARENT=isParentMode()?{label:parentLabel}:null;
const cubeMap=createCubeMap({cube,audio,particles,flash:a=>flash(a),reduced:()=>reduced,getPlayer:()=>store.selected,today:()=>todayKey(),parent:PARENT});

const lines={
 start:{piyokichi:'さくっと 10もん いこう！',piyomi:'よーし、いっしょに がんばろ！'},
 ok:['せいかい！','いいね！','その ちょうし！','すごい！','ばっちり！'],
 hot:['とまらない！','ノリノリ！','きてる きてる！','おまつりだ！'],
 reach:'さいごの 1もん！ きめちゃおう！',
};
const pickLine=list=>list[Math.floor(Math.random()*list.length)];

// 画面切り替えのタイマーは、その回（token）が生きているときだけ動かす
const timers=new Set();
function later(ms,fn){const token=play?.token;const id=setTimeout(()=>{timers.delete(id);if(play&&play.token===token)fn();},ms);timers.add(id);return id;}
function clearTimers(){for(const id of timers)clearTimeout(id);timers.clear();}

function show(name){
 for(const s of $$('section[data-screen]'))s.hidden=s.dataset.screen!==name;
 document.body.dataset.view=name;
 window.scrollTo(0,0);
}
function persist(){saveStore(store,storage);}
function setHeat(stage){document.body.dataset.heat=String(stage);}

// ---------- 音のボタン ----------
function renderSound(){
 for(const b of $$('[data-sound]')){
  b.setAttribute('aria-pressed',String(!audio.muted));
  b.classList.toggle('is-off',audio.muted);
  $('[data-sound-label]',b).textContent=audio.muted?'おと なし':'おと あり';
  b.title=audio.muted?'おとを ならす':'おとを けす';
 }
}
function toggleSound(){audio.unlock();audio.setMuted(!audio.muted);renderSound();if(!audio.muted)audio.tap();}

// ---------- 演出モード（ふつう／おまつり） ----------
function renderFxMode(){
 document.body.dataset.fx=fxMode;
 for(const b of $$('[data-fxmode]'))b.setAttribute('aria-pressed',String(b.dataset.fxmode===fxMode));
}
function setFxMode(mode){
 if(mode===fxMode)return;
 fxMode=mode;festival.saveFxMode(storage,mode);renderFxMode();
 audio.unlock();audio.tap();
}

// ---------- ホーム ----------
function renderHome(){
 const today=todayKey();
 for(const id of Object.keys(PLAYERS)){
  const p=store.players[id],d=dayInfo(store,id,today);
  $(`[data-points="${id}"]`).textContent=p.points;
  $(`[data-today="${id}"]`).textContent=d.cleared?'きょうは クリア ✓':'きょうは まだ';
 }
 const sel=store.selected;
 for(const r of $$('input[name="player"]'))r.checked=r.value===sel;
 const start=$('[data-start]'),note=$('[data-start-note]');
 start.disabled=!sel;
 if(!sel){note.textContent='だれが あそぶか えらんでね';}
 else{
  const left=sessionsLeft(store,sel,today);
  note.textContent=left>0?`10もん・ポイントが もらえるのは きょう あと ${left}回`:`きょうの ポイントは おしまい。れんしゅうは なんどでも できるよ`;
 }
 const who=sel??'piyokichi',d=dayInfo(store,who,today);
 $('[data-today-who]').textContent=sel?`（${PLAYERS[sel].name}）`:'';
 $('[data-t="sessions"]').textContent=sel?d.sessions:0;
 $('[data-t="best"]').textContent=sel?d.bestCorrect:0;
 $('[data-t="combo"]').textContent=sel?d.bestCombo:0;
 $('[data-t="points"]').textContent=sel?d.points:0;
 const pud=sel?store.players[sel].pudding:null,item=$('[data-item="pudding"]');
 item.classList.toggle('is-locked',!pud?.earned);
 $('[data-item-state]',item).textContent=!sel?'だれかを えらんでね':pud.earned?(pud.displayed?'おうちに かざってるよ':'もってるよ'):'はじめて クリアすると もらえるよ';
 renderCubePanel(sel,today);
}
function renderCubePanel(sel,today){
 cube.reload();   // 別タブでの記録も反映
 const c=sel?cube.snapshot(sel,today):null;
 $('[data-c="period"]').textContent=seasonPeriod();
 $('[data-c="pt"]').textContent=c?c.cubePt:0;
 $('[data-c="plays"]').textContent=c?c.playsToday:0;
 $('[data-c="found"]').textContent=c?c.found:0;
 $('[data-c="coin"]').textContent=!c?'':c.coinToday?'🪙 きょうの コインミッション たっせい！':'🪙 きょう はじめて 10もん クリアすると、コインミッション たっせい';
 $('[data-pix]').innerHTML=pixelChar(sel??'piyokichi');
 $('[data-cube-panel] [data-to-map]').disabled=!sel;
}
function openMap(){if(!store.selected)return;audio.unlock();cubeMap.reset();cube.reload();cubeMap.render();show('map');}

function showNotice(){
 const n=$('[data-notice]');
 const text=status==='recovered'?'きろくが こわれていたので、あたらしく はじめたよ（まえの データは べつに のこしてあるよ）。'
  :status==='unavailable'?'この画面では きろくを 保存できないみたい。あそぶことは できるよ。':'';
 n.textContent=text;n.hidden=!text;
}

// ---------- もんだい ----------
function newSessionId(player){return `${player}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}

function startPlay(){
 const player=store.selected;
 if(!player)return;
 audio.unlock();   // ここが最初のユーザー操作：この中で音を解禁
 clearTimers();particles.clear();
 const fresh=loadStore(storage);if(fresh.status==='ok')store=fresh.store;   // 別タブでの記録も反映
 const dayKey=todayKey();
 cube.reload();const effects=cube.effects(player);
 play={player,dayKey,sessionId:newSessionId(player),practice:sessionsLeft(store,player,dayKey)===0,run:createRun(makeQuestionSet(player,Math.random,undefined,{dayKey,round:dayInfo(store,player,dayKey).sessions,motifs:effects})),input:'',feedback:null,committed:false,award:null,stage:0,token:Symbol('play')};
 $('[data-fever-img]').src=POSE_URLS[DUO.high];
 actor.preload();actor.setIdle(art[player]);
 play.eggUsed=false;play.fx=fxMode;festival.clear();   // その回の演出モードは、はじめた時点のもので固定
 react(play.practice?'きょうは れんしゅう。ポイントは なしだよ':lines.start[player],'');
 const q=$('[data-quit]');q.textContent='やめる';delete q.dataset.confirm;
 $('[data-fever]').hidden=true;
 setHeat(0);
 show('play');
 // 🎵 BGM ごほうび：いつもの曲と BGM プール（bgm-pool.js）からランダム
 audio.startMusic(0,{track:trackElement(pickTrack(effects))});
 renderQuestion();
}

// 10もんの進みぐあい：たまご → 正解は目玉焼き、まちがいは ひびの入ったたまご。いまの問題は ぴょこぴょこ
function renderEggs(){
 const {run}=play,eggs=$$('[data-eggs] i'),now=run.done?-1:run.answers.length;
 eggs.forEach((egg,i)=>{
  const a=run.answers[i],state=a?(a.ok?'is-done':'is-crack'):i===now?'is-now':'';
  if(egg.dataset.state!==state){egg.className=state;egg.dataset.state=state;}
 });
}

function renderQuestion(){
 const {run}=play,question=run.questions[run.answers.length],index=run.answers.length;
 $('[data-qno]').textContent=index+1;
 $('[data-track]').style.width=`${index/run.questions.length*100}%`;renderEggs();
 $('[data-kind]').textContent=question.label;
 const q=$('[data-question]');
 q.replaceChildren(...question.tokens.map(renderToken));
 q.setAttribute('aria-label',question.text);
 q.classList.toggle('is-word',question.kind==='word'||!!question.choices);
 // 3択：テンキーのかわりに選択肢ボタン
 $('[data-pad]').hidden=!!question.choices;
 const ch=$('[data-choices]');ch.hidden=!question.choices;
 ch.replaceChildren(...(question.choices||[]).map(c=>{const b=document.createElement('button');b.type='button';b.dataset.choice=c;b.textContent=c;b.setAttribute('aria-pressed','false');return b;}));
 $('[data-readout]').classList.toggle('is-choice',!!question.choices);
 $('[data-unit]').textContent=question.unit;
 const card=$('[data-card]');
 card.classList.remove('is-ok','is-miss','pop');
 replay(card,'enter');
 $('[data-mark]').className='dq-mark';
 $('[data-pad] [data-key="."]').disabled=!question.decimal;
 // さいごの 1もん：リーチ（音がこもってタメる）
 const last=index===run.questions.length-1;
 document.body.classList.toggle('is-reach',last);
 if(last){audio.reachOn();react(lines.reach,'reach');particles.fadeAll(.4);}   // 画面を片付けて、しずかに
 play.input='';play.feedback=null;
 renderInput();renderChips();
 setSubmit('こたえる');
}

function renderToken(t){
 if(typeof t==='string'){const s=document.createElement('span');s.textContent=t;if(/^[+−×÷=]$/.test(t))s.className='dq-op';return s;}
 if(t.box){const s=document.createElement('span');s.className='dq-box';s.textContent='?';return s;}
 const f=document.createElement('span');f.className='dq-frac';
 const [n,d]=t.frac;
 for(const v of [n,d]){const part=document.createElement('span');if(v==null){part.className='dq-box';part.textContent='?';}else part.textContent=v;f.append(part);}
 return f;
}

function renderInput(){
 $('[data-input]').textContent=play.input;
 $('[data-readout]').classList.toggle('is-empty',!play.input);
 $('[data-submit]').disabled=!play.feedback&&!play.input;
}
function renderChips(){
 $('[data-combo]').textContent=play.run.combo;
 $('[data-earned]').textContent=play.practice?0:play.run.earned;
 $('[data-combo-chip]').classList.toggle('is-hot',play.run.combo>=3);
}
function setSubmit(label){const b=$('[data-submit]');b.textContent=label;b.disabled=!play.feedback&&!play.input;}
function react(line,mood){const p=$('[data-react-line]');p.textContent=line;p.parentElement.dataset.mood=mood;}

function press(key){
 if(!play||play.feedback||play.suspense)return;
 const q=play.run.questions[play.run.answers.length];
 if(q.choices)return;
 const before=play.input;
 if(key==='back')play.input=play.input.slice(0,-1);
 else if(key==='.'){if(q.decimal&&!play.input.includes('.')&&play.input.length<7)play.input=(play.input||'0')+'.';}
 else if(/^\d$/.test(key)&&play.input.length<7)play.input=play.input==='0'?key:play.input+key;
 if(play.input!==before){
  if(key==='back')audio.erase();else audio.key(play.input.length-1+play.run.combo);
  replay($('[data-readout]'),'tick');
 }
 renderInput();
}

// 3択：えらぶ（「こたえる」で確定）
function choose(value){
 if(!play||play.feedback||play.suspense)return;
 const q=play.run.questions[play.run.answers.length];
 if(!q.choices?.includes(value))return;
 play.input=value;
 for(const b of $$('[data-choices] button'))b.setAttribute('aria-pressed',String(b.dataset.choice===value));
 audio.key(play.run.combo);
 replay($('[data-readout]'),'tick');
 renderInput();
}

function submit(){
 if(!play||play.suspense)return;
 if(play.feedback)return next();
 // さいごの1もん：「こたえる」→ ドラムロールのタメ → 発表
 if(play.run.answers.length===play.run.questions.length-1&&play.input){
  play.suspense=true;
  const card=$('[data-card]');replay(card,'is-suspense');
  react('ドキドキ…','reach');
  const b=$('[data-submit]');b.textContent='ドキドキ…';b.disabled=true;
  const ms=reduced?SUSPENSE_MS_REDUCED:SUSPENSE_MS;
  audio.drumroll(ms/1000);
  later(ms,()=>{play.suspense=false;card.classList.remove('is-suspense');judge();});
  return;
 }
 judge();
}
function judge(){
 const index=play.run.answers.length;
 const {run,feedback}=answerRun(play.run,play.input);
 if(!feedback)return;
 play.run=run;play.feedback=feedback;
 // □ に正しい答えを入れて見せる（まちがえたときも、答えの形が目で分かる）
 for(const box of $$('[data-question] .dq-box')){box.textContent=feedback.answer;box.classList.add('is-filled');}
 for(const b of $$('[data-choices] button')){b.disabled=true;b.classList.toggle('is-answer',b.dataset.choice===feedback.answer);}
 $('[data-track]').style.width=`${run.answers.length/run.questions.length*100}%`;renderEggs();
 renderChips();
 if(run.done)finish();   // ポイントはここで1回だけ保存（演出中に更新されても二重にならない）
 setSubmit(run.done?'けっかへ':'つぎへ');
 if(feedback.ok)celebrate(feedback,index,run.done);
 else miss(feedback,run.done);
 $('[data-submit]').focus({preventScroll:true});
}

// 正解：音・キャラ・カード・粒子・+pt を同じ瞬間に
function celebrate(fb,index,done){
 const last=done;
 const stage=last?FEVER:stageFor({combo:fb.combo,index:index+1});
 const fest=play.fx==='festival';
 let v=visuals(last?4:stage,{reduced});   // 最後の正解はフィーバーの前ぶれ（大爆発はフィーバー側で）
 if(fest)v=festival.festivalVisuals(v,{q:index+1,combo:fb.combo,reduced});   // おまつり：ラボ100%の量を上乗せ（ふつうの値は変えない）
 play.stage=stage;
 const card=$('[data-card]'),readout=$('[data-readout]');
 card.classList.add('is-ok');replay(card,'pop');
 const mark=$('[data-mark]');mark.className='dq-mark';void mark.offsetWidth;mark.classList.add('show',`s${Math.min(4,stage)}`);
 audio.correct(Math.min(4,stage),fb.combo);
 // キャラ：絵の切り替え・動き・音・粒子・+pt は同じ瞬間に始める。ときどき（8%・1プレイ1回）目玉焼き
 const egg=!last&&!NO_EGG&&eggRoll({used:play.eggUsed,isLast:last,combo:fb.combo,force:FORCE_EGG});
 if(egg){play.eggUsed=true;play.eggNow=true;actor.egg((POSES[play.player]||POSES.piyokichi).light);audio.egg(EGG_TIMES);}
 else{play.eggNow=false;const plan=last?actorPlan({player:play.player,combo:4}):actorPlan({player:play.player,ok:true,combo:fb.combo});actor.play(plan);if(plan.duo&&!reduced)audio.whoosh();}
 // 答えがいちばんの主役：演出より手前に答えを出して、ケチャップのハートで囲む。粒は答えの外側から
 heroAnswer(readout,fb,last);
 const c=centerOf(readout);
 particles.burst(c.x,c.y,{count:v.particles,kinds:v.kinds,speed:320+stage*90,up:160+stage*30,life:.8+stage*.08,ring:readout.offsetWidth*.4});
 // 大きな目玉焼きはカードの左右の角（問題・答え・コンボ表示にはかけない）
 const cr=card.getBoundingClientRect(),er=Math.min(32,cr.width*.09)*(1+Math.min(4,stage)*.06);
 particles.bigEgg(cr.left+er*.95,cr.top+er*.15,er);
 if(v.bigEggs>1)particles.bigEgg(cr.right-er*.95,cr.top+er*.15,er);
 if(fest){   // おまつり：波紋・飛び上がるキャラ（問題・答え・ボタンは隠さない）
  festival.wave(c.x,c.y,Math.min(cr.width,cr.height)*.55,{reduced});
  if(!last)for(let i=0;i<festival.festivalDancerCount(index+1);i++)later(i*110,()=>festival.dancers(1,{reduced}));
 }
 if(v.hopEggs)later(90,()=>particles.hopEggs(v.hopEggs));
 if(v.rain)later(150,()=>particles.rain({count:v.rain,kinds:['fried','omu','heart'],life:1.6}));
 shake([card,$('.dq-bar')],v.shake);
 flash(v.flash);
 // +pt がポイント表示へ飛ぶ → 届いたら音とポップ
 if(fb.gained>0&&!play.practice){
  const text=fb.comboBonus?`+${fb.gained} pt ボーナス！`:`+${fb.gained} pt`;
  flyText(text,readout,$('.dq-chip.is-pts'),{duration:reduced?300:540,className:fest?'dq-fly is-fest':'dq-fly',onArrive:()=>{audio.point();replay($('.dq-chip.is-pts'),'bump');}});
 }
 const ms=fest?festival.festivalCombo(fb.combo):comboMilestone(fb.combo);   // おまつりは2コンボ以上 毎回
 if(ms&&!last){cutin(ms.text,ms.size);audio.comboUp(ms.size);replay($('[data-combo-chip]'),'burst');}
 react(egg?'わっ、目玉焼き！？':last?'やったー！！':fb.comboBonus?`${fb.combo}れんぞく！ ボーナス +1`:stage>=3?pickLine(lines.hot):pickLine(lines.ok),'ok');
 if(last){later(300,fever);return;}   // 最後の正解を見せてから、フィーバーへ
 setHeat(stage);audio.setStage(stage);
 if(fest){const t=festival.festivalStageText(index+2);if(t)later(350,()=>festival.stageText(t,{reduced}));}
 later(egg?EGG_NEXT_DELAY:nextDelay(stage),next);
}

// まちがい：軽い音・やさしい反応・正しい答え。コンボと盛り上がりは下がる
function miss(fb,done){
 const card=$('[data-card]');card.classList.add('is-miss');
 audio.wrong();
 actor.play(actorPlan({player:play.player,ok:false}));   // 専用の絵で「びくっ」→ 少し沈む
 const unit=fb.unit?` ${fb.unit}`:'';
 react(fb.close?`おしい！ こたえは ${fb.answer}${unit}。`:`だいじょうぶ。こたえは ${fb.answer}${unit} だよ。`,'miss');
 const stage=stageFor({combo:0,index:play.run.answers.length});
 play.stage=stage;
 if(done){document.body.classList.remove('is-reach');audio.setReach(false);later(SOFT_FINISH_MS,()=>{audio.finishSoft();showResult();});return;}
 setHeat(stage);audio.setStage(stage);
 later(WRONG_DELAY,next);
}

// 答えスポットライト：打った答えを、粒・目玉焼きより手前に大きく出して、ケチャップでハートを描く
let HEART_D='';
function heartPath(){
 if(HEART_D)return HEART_D;
 for(let i=0;i<=60;i++){const t=i/60*Math.PI*2,x=16*Math.sin(t)**3/17*18,y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/17*18;HEART_D+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);}
 return HEART_D;
}
function heroAnswer(readout,fb,big){
 for(const old of $$('.dq-hero-ans'))old.remove();
 const r=readout.getBoundingClientRect(),el=document.createElement('div');
 el.className='dq-hero-ans'+(big?' is-big':'')+(play.input.length>4?' is-long':'');el.setAttribute('aria-hidden','true');
 el.style.left=`${r.left+r.width/2}px`;el.style.top=`${r.top+r.height/2}px`;
 const d=heartPath();
 el.innerHTML=`<span class="dq-hero-num"><svg viewBox="-20 -20 40 40"><path class="hk" d="${d}"/><path class="hw" d="${d}"/></svg><b></b></span><small></small>`;
 $('b',el).textContent=play.input;$('small',el).textContent=fb.unit||'';
 document.body.append(el);
 setTimeout(()=>el.remove(),big?1900:HERO_MS);
}

function cutin(text,size){
 const el=$('[data-cutin]');el.textContent=text;el.className='dq-cutin';void el.offsetWidth;el.classList.add('show',`s${size}`);
}
function flash(amount){
 if(!amount||reduced)return;
 $('[data-flash]').animate([{opacity:amount},{opacity:0}],{duration:360,easing:'ease-out'});
}

function next(){
 if(!play?.feedback)return;
 if(play.run.done){
  if(play.inFever)return skipFever();              // フィーバー中：1.2秒たっていればスキップ
  if(play.run.answers.at(-1)?.ok)return;          // フィーバー開始前の一瞬は何もしない
  clearTimers();audio.finishSoft();return showResult();
 }
 clearTimers();
 actor.rest();
 renderQuestion();
}

// 10問そろった時点ですぐ保存（結果画面の前に更新されても、ポイントは1回だけ）
function finish(){
 if(play.committed)return;
 const fresh=loadStore(storage);if(fresh.status==='ok')store=fresh.store;
 const res=commitResult(store,{sessionId:play.sessionId,player:play.player,dayKey:play.dayKey,oks:play.run.answers.map(a=>a.ok)});
 store=res.store;play.award=res.award;play.committed=true;
 persist();
 // ピヨ探検：scoring.js で計算したポイントをキューブpt に入金（同じ回は二度入らない）
 if(!res.duplicate)play.cube=cube.recordSession(play.player,{sessionId:play.sessionId,dayKey:play.dayKey,award:res.award});
}

// ---------- プリンフィーバー ----------
// 順番：最後の正解 →（0.3秒）2人が飛び込む → BGM 解放 → 粒子とフラッシュ → プリン登場 → 「プリン ゲット！」→ 結果
function fever(){
 play.inFever=true;play.feverAt=performance.now();
 const fest=play.fx==='festival';
 document.body.classList.remove('is-reach');
 const perfect=play.award?.perfect,isNew=play.award?.puddingNew;
 const ov=$('[data-fever]');
 ov.classList.remove('go','perfect');ov.hidden=false;void ov.offsetWidth;ov.classList.add('go');ov.classList.toggle('perfect',!!perfect);
 $('[data-fever-caption]').textContent=isNew?'プリン ゲット！':perfect?'パーフェクト！ プリン ぷるるん！':'プリン ぷるるん！';
 $('[data-fever-skip]').hidden=true;
 audio.whoosh?.();
 const W=innerWidth,H=innerHeight,v=visuals(FEVER,{reduced});
 later(350,()=>{   // BGM 解放（ドン！）＋ 粒子とフラッシュ
  setHeat(FEVER);audio.feverIn();
  particles.burst(W/2,H*.45,{count:v.particles,kinds:['star','feather','confetti','pudding','dot'],speed:reduced?300:900,up:300,life:1.4});
  flash(v.flash);
 });
 if(!reduced){
  later(700,()=>particles.rain({count:perfect?60:40,kinds:['pudding','confetti','feather','star'],life:3}));
  later(2300,()=>particles.burst(W/2,H*.62,{count:60,kinds:['star','dot','pudding'],speed:700,up:260,life:1.1}));
 }
 later(1200,()=>audio.fanfare());                                                // プリン登場（CSS：1.15秒から落ちてくる）
 later(1700,()=>{audio.jiggle();replay($('[data-fever-pudding]'),'jiggle');});   // 着地して ぷるん
 later(FEVER_SKIP_AFTER,()=>{$('[data-fever-skip]').hidden=false;});
 if(fest)festival.feverShow({later,particles,reduced});   // おまつり：拍ごとの卵跳ね・飛び回るキャラ
 later(fest?festival.FEST_FEVER_MS:FEVER_MS,endFever);
}
function skipFever(){if(play?.inFever&&performance.now()-play.feverAt>=FEVER_SKIP_AFTER)endFever();}
function endFever(){
 if(!play?.inFever)return;
 clearTimers();play.inFever=false;
 $('[data-fever]').hidden=true;
 showResult();
}

function quit(){
 const b=$('[data-quit]');
 if(!b.dataset.confirm){b.dataset.confirm='1';b.textContent='ほんとに やめる？';setTimeout(()=>{if(b.dataset.confirm){delete b.dataset.confirm;b.textContent='やめる';}},3000);return;}
 leavePlay();renderHome();show('home');
}
function leavePlay(){clearTimers();actor.reset();for(const el of $$('.dq-hero-ans'))el.remove();audio.stopMusic(.3);particles.clear();festival.clear();play=null;setHeat(0);document.body.classList.remove('is-reach');$('[data-fever]').hidden=true;}

// ---------- けっか ----------
function showResult(){
 const {award,player}=play;
 audio.stopMusic(1.6);
 actor.reset();
 particles.clear();   // フィーバーの粒子が結果の文字に重ならないように
 setHeat(0);document.body.classList.remove('is-reach');
 const pud=store.players[player].pudding;
 $('[data-result-img]').src=art[player];
 $('[data-r="correct"]').textContent=award.correct;
 $('[data-r="combo"]').textContent=award.maxCombo;
 $('[data-r="points"]').textContent=award.points;
 $('[data-result-line]').textContent=award.perfect?'パーフェクト！ おうちが ぴかぴかだ！':award.correct>=7?'よく がんばったね！':award.correct>=4?'さいごまで できたね！':'さいごまで やりきったのが えらい！';
 const rows=award.practice?[[`きょうの ポイントは ${DAILY_REWARD_SESSIONS}回 もらったので、こんかいは れんしゅう`,'0']]:[
  [`正解 ${award.correct}もん`,`+${award.questionPoints}`],
  ['3れんぞく ボーナス',`+${award.comboPoints}`],
  award.clearBonusAlready?['クリアボーナス（きょうは もう もらったよ）','—']:['クリアボーナス',`+${award.clearBonus}`],
  ...(award.perfect?[award.perfectBonusAlready?['パーフェクトボーナス（きょうは もう もらったよ）','—']:['パーフェクトボーナス',`+${award.perfectBonus}`]]:[]),
 ];
 $('[data-breakdown]').replaceChildren(...rows.map(([label,value])=>{const li=document.createElement('li');const a=document.createElement('span');a.textContent=label;const b=document.createElement('b');b.textContent=value;li.append(a,b);return li;}));
 const reward=$('[data-reward]');
 reward.classList.toggle('is-new',award.puddingNew);
 $('[data-reward-title]').textContent=award.puddingNew?'プリンを 手に入れた！':'プリン';
 $('[data-reward-note]').textContent=award.puddingNew?'はじめての クリアごほうび。コレクションに 入ったよ':pud.displayed?'おうちに かざってあるよ':'コレクションに あるよ';
 renderDisplayButton();
 renderCubeResult();
 show('result');
 // フィーバーを Enter でとばしたあと、もう一度 Enter を押しても「もういちど」が始まらないよう、見出しにフォーカス
 const h=$('#dq-result-h');h.setAttribute('tabindex','-1');h.focus({preventScroll:true});
}
function renderCubeResult(){
 const c=play.cube,box=$('[data-cube-result]');
 box.hidden=!c;if(!c)return;
 const bal=cube.snapshot(play.player,play.dayKey).cubePt;
 const why={practice:'きょうの ピヨ探検pt は 3回 もらったよ',season:'ピヨ探検の 期間外だよ',limit:'きょうの ピヨ探検pt は 3回 もらったよ',duplicate:''}[c.reason];
 $('[data-cube-line]').textContent=c.reason==='ok'?`🧊 +${c.cubePt} ピヨ探検pt（いま ${bal} pt）`:`🧊 ${why}（いま ${bal} pt）`;
 const coin=$('[data-cube-coin]');coin.hidden=!c.coinNew;
 coin.textContent='🪙 きょうの コインミッション たっせい！（ミッション1つぶん：赤・青コイン）';
}
function renderDisplayButton(){
 const pud=store.players[play.player].pudding,b=$('[data-display]');
 b.hidden=!pud.earned;
 b.disabled=pud.displayed;
 b.textContent=pud.displayed?'かざったよ ✓':'おうちに かざる';
}
function displayPudding(){
 if(!play)return;
 store=setPuddingDisplayed(store,play.player,true);persist();
 renderDisplayButton();
 $('[data-reward-note]').textContent='おうちに かざったよ';
 audio.tap();
}

// ---------- 入力 ----------
function bind(){
 for(const r of $$('input[name="player"]'))r.addEventListener('change',()=>{store=selectPlayer(store,r.value);persist();renderHome();audio.unlock();audio.tap();});
 $('[data-start]').addEventListener('click',startPlay);
 for(const b of $$('[data-fxmode]'))b.addEventListener('click',()=>setFxMode(b.dataset.fxmode));
 for(const b of $$('[data-sound]'))b.addEventListener('click',toggleSound);
 // pointerdown で鳴らすと指を置いた瞬間に音が出る（click は離したとき）。二重にならないよう click 側は判定だけ
 const pad=$('[data-pad]');
 pad.addEventListener('pointerdown',e=>{const k=e.target.closest('[data-key]');if(k&&!k.disabled&&e.button===0){e.preventDefault();k.dataset.downAt=String(performance.now());press(k.dataset.key);replay(k,'hit');}});
 pad.addEventListener('click',e=>{const k=e.target.closest('[data-key]');if(!k||k.disabled)return;if(k.dataset.downAt&&performance.now()-Number(k.dataset.downAt)<800){delete k.dataset.downAt;return;}press(k.dataset.key);replay(k,'hit');});
 $('[data-choices]').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b&&!b.disabled){choose(b.dataset.choice);replay(b,'hit');}});
 $('[data-submit]').addEventListener('click',submit);
 $('[data-quit]').addEventListener('click',quit);
 $('[data-again]').addEventListener('click',startPlay);
 $('[data-display]').addEventListener('click',displayPudding);
 $('[data-to-home]').addEventListener('click',()=>{leavePlay();renderHome();show('home');});
 $('[data-fever]').addEventListener('click',skipFever);
 for(const b of $$('[data-to-map]'))b.addEventListener('click',()=>{if(play)leavePlay();openMap();});
 $('[data-map-back]').addEventListener('click',()=>{audio.tap();renderHome();show('home');});
 cubeMap.bind();
 document.addEventListener('keydown',e=>{
  if(document.body.dataset.view!=='play'||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key;
  const cq=play?.run.questions[play.run.answers.length];
  if(cq?.choices&&/^[1-9]$/.test(k)){const c=cq.choices[Number(k)-1];if(c)choose(c);}
  else if(/^\d$/.test(k)){press(k);const b=$(`[data-pad] [data-key="${k}"]`);if(b)replay(b,'hit');}
  else if(k==='.'||k==='Decimal')press('.');
  else if(k==='Backspace'){e.preventDefault();press('back');}
  else if(k==='Enter'||(k===' '&&play?.inFever)){
   // Enter はいつも「こたえる／つぎへ」。ボタン自体のクリックと二重にならないよう既定動作は止める（「やめる」だけは除く）
   if(e.target.closest?.('[data-quit],[data-sound]'))return;
   e.preventDefault();if(!e.repeat)submit();
  }
  else return;
  if(k!=='Enter')e.preventDefault();
 });
 // 拍に合わせてキャラと背景が脈打つ
 audio.onBeat=(delay,barStart)=>{setTimeout(()=>{if(document.body.dataset.view!=='play')return;actor.beat(barStart);replay($('.dq-bg'),'pulse');},delay);};
 // ページを離れたら音を止める
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.suspend();document.getAnimations?.().forEach(a=>a.pause());}else if(document.body.dataset.view==='play'){audio.resume();document.getAnimations?.().forEach(a=>{if(a.playState==='paused')a.play();});}});
 addEventListener('pagehide',()=>{audio.stopMusic();audio.suspend();});
}

// 共通ナビ（ほかのページと同じ）。PC は右上、スマホは画面下。問題を解いている間は出さない（テンキーと重ねない）
mountSiteNav($('[data-nav]'),'drill',{position:'afterbegin',variant:'floating'});
for(const img of $$('[data-art]'))img.src=art[img.dataset.art];
// 確認用（?debug=1）：残っているタイマー・演出の数を外から確かめる
if(params.get('debug')==='1')window.__drill={cube:()=>cube.snapshotAll(todayKey()),bgm:()=>({trackOn:!!audio.trackOn,src:audio.trackEl?.src??'',paused:audio.trackEl?.paused??null}),timers:()=>timers.size,actorTimers:()=>actor.timers.size,actorBusy:()=>actor.busy,eggs:()=>document.querySelectorAll('.dq-egg').length,flies:()=>document.querySelectorAll('.dq-fly').length,stageImg:()=>actor.img.getAttribute('src')||'',stageKind:()=>actor.stage.dataset.kind,eggUsed:()=>!!play?.eggUsed};
bind();renderSound();renderFxMode();showNotice();renderHome();show('home');setHeat(0);
if(status==='recovered')persist();
