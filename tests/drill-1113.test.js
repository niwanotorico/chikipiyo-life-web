// 2026-11-13 ちきんの決定：もみじの もり「奥の道」の 最終形（コスト 20・30pt、スクラッチの 再編、クリスマス編 5話、券 2つ）
import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARDS,MOMIJI,CHICKEN_POINTS,DAILY_GIFTS,AUTO_MANGA,emptyCubePlayer,season,sanitizeCubePlayer,nodeById,openGate,cubeBalance,mangaOf,mangaPlan} from '../src/drill/cosmicube.js';
import {parentLabel,openedLabel} from '../src/drill/parent-mode.js';
import {rewardFace,mangaFace} from '../src/drill/cosmicube-ui.js';
import {SERIES,episodeById} from '../src/manga/catalog.js';

const OKU={ // マス → [中身, コスト]
 '01':['manga-42',20],'02':['chicken-momiji-oku-02',20],'03':['manga-44',20],'04':['manga-45',30],'05':['chicken-momiji-oku-05',20],
 '06':['manga-46',30],'07':['momiji-oku-mac',30],'08':['manga-47',30],'09':['chicken-momiji-oku-09',20],'10':['manga-48',30],
 '11':['momiji-oku-cream',30],'12':['manga-49',30],'13':['chicken-momiji-oku-13',20],'14':['chicken-momiji-oku-14',20]};

test('奥の道：中身と コストは ちきんの 表の とおり。大ゴールは 100pt・Switch 2 の まま', ()=>{
 for(const [k,[reward,cost]] of Object.entries(OKU)){
  const n=nodeById(`momiji-oku-${k}`);
  assert.equal(n.reward,reward,k);assert.equal(n.cost,cost,k);assert.ok(REWARDS[reward],reward);
 }
 const goal=nodeById('momiji-goal');assert.equal(goal.cost,100);assert.equal(goal.reward,'switch2');
 // 奥の道より 前の マスは かえていない（合計 840 ＝ 前の 1190 − 奥の道で へった 350）
 assert.equal(MOMIJI.nodes.filter(n=>!n.id.startsWith('momiji-oku-')).reduce((a,n)=>a+n.cost,0),490);
});

test('スクラッチ：oku-02＝5・05＝5・09＝40・13＝10・14＝15。ほかの マスの チキン分は なくなった', ()=>{
 assert.deepEqual(CHICKEN_POINTS,{'momiji-oku-02':5,'momiji-oku-05':5,'momiji-oku-09':40,'momiji-oku-13':10,'momiji-oku-14':15});
 for(const k of ['04','06','07','08','10','11','12'])assert.equal(REWARDS[`chicken-momiji-oku-${k}`],undefined,k);
 assert.equal(REWARDS['manga-43'],undefined,'oku-02 の マンガは なくした');
});

test('券2つ：新しい ごほうびID。開けた子にも 中身が 見え、親モードにも のる', ()=>{
 const cases=[['momiji-oku-mac','マクドナルド ランチ券','マクドナルドで ランチが たべられるよ'],['momiji-oku-cream','シュークリーム券','シュークリームが たべられるよ']];
 for(const [id,name,note] of cases){
  const r=REWARDS[id];
  assert.ok(!r.secret,id);assert.deepEqual(r.effects,[]);assert.ok(!r.house);
  for(const who of ['piyomi','piyokichi']){
   assert.deepEqual({name:rewardFace(id,who,null,openedLabel).name,note:rewardFace(id,who,null,openedLabel).note},{name,note},`${id} ${who}`);
   assert.equal(parentLabel(id,who).name,name,'親モードも 同じ 名前');
  }
 }
 assert.notEqual('momiji-oku-mac','momiji-secret','ひみつの マスの マクドナルド券とは べつの 記録');
});

test('券：開けると その ごほうびIDで 記録が のこる（30pt）', ()=>{
 let p=emptyCubePlayer();
 season(p).earned.push({id:'r',day:'2026-11-10',pt:3000});
 const path=['momiji-01','momiji-02','momiji-morisaku','momiji-usako','momiji-03','momiji-04','momiji-05','momiji-34','momiji-35','momiji-secret','momiji-37','momiji-36','momiji-st2','momiji-st1','momiji-41','momiji-40',
  ...Array.from({length:7},(_,i)=>`momiji-oku-0${i+1}`)];
 p=sanitizeCubePlayer(p);
 for(const id of path){const r=openGate(p,id,'2026-11-14');assert.ok(r.ok,`${id} ${r.reason}`);p=r.player;}
 assert.deepEqual(season(p).rewards['momiji-oku-mac'],{on:'2026-11-14',house:false});
 assert.equal(season(p).gates['momiji-oku-07'].cost,30);
 assert.ok(season(p).rewards['momiji-secret'],'ひみつの マクドナルド券も べつに のこる');
});

test('話数の 帳尻：日常本・マイクラ本は マスの 話の 合計 ＝ カタログの 話数。季節の本は 1話＋クリスマス編 5話', ()=>{
 const count={};
 for(const r of [...Object.values(REWARDS),...AUTO_MANGA,...DAILY_GIFTS])for(const e of r.manga??[]){const s=e.replace(/-\d+$/,'');count[s]=(count[s]??0)+1;}
 const total=id=>SERIES.find(s=>s.id===id).episodes.length;
 assert.equal(count.daily,total('daily'));assert.equal(count.mc,total('mc'));
 assert.equal(count.season,6);
 assert.deepEqual(REWARDS['manga-44'].manga,['daily-35','daily-36'],'oku-03 が 日常本 2話');
 assert.deepEqual([45,46,47,48,49].map(n=>REWARDS[`manga-${n}`].manga[0]),['season-02','season-03','season-04','season-05','season-06']);
});

test('日常本：11/13 から あとに 奥の道を 開けても、35・36話まで とびなく よめる', ()=>{
 const p=emptyCubePlayer();const s=season(p);
 for(let n=1;n<=41;n++)if(REWARDS[`manga-${n}`])s.rewards[`manga-${n}`]={on:'2026-11-10',house:false};
 s.rewards['manga-42']={on:'2026-11-14',house:false};s.rewards['manga-44']={on:'2026-11-15',house:false};
 const plan=mangaPlan(sanitizeCubePlayer(p),'2026-11-15');
 assert.deepEqual(plan.byReward['manga-44'],['daily-35','daily-36']);
 const daily=[...plan.set].filter(e=>e.startsWith('daily-')).length;
 assert.equal(daily,36);
});

test('クリスマス編：話が とどいた（2026-11-24）。開けた マスは catalog の 題名で 出て、そのまま 本だなで よめる。開けた 記録は ごほうびIDだけ', ()=>{
 const TITLES={'manga-45':['season-02','どっちから？'],'manga-46':['season-03','サンタさんへの手紙'],'manga-47':['season-04','ツリーの星'],
  'manga-48':['season-05','ケンタッキー'],'manga-49':['season-06','イブのごちそう']};
 // 話が まだ なかった ころに 開けた 子の 記録（ごほうびIDだけ）でも、話が とどいた いま そのまま よめる
 const p=emptyCubePlayer();for(const id of Object.keys(TITLES))season(p).rewards[id]={on:'2026-11-20',house:false};
 const before=JSON.stringify(p);
 const set=mangaOf(sanitizeCubePlayer(p),'2026-11-24');
 assert.equal(JSON.stringify(p),before,'記録は かきかえない');
 for(const [id,[ep,title]] of Object.entries(TITLES)){
  assert.ok(set.has(ep),`${id} → ${ep}`);
  assert.equal(episodeById(ep).title,title);
  const f=mangaFace(rewardFace(id,'piyomi'),REWARDS[id],undefined);
  assert.equal(f.name,`マンガ「${title}」`,id);assert.doesNotMatch(f.name,/じゅんびちゅう/);
 }
 // まだ とどいていない 話（制作中）の マスは これまでどおり「じゅんびちゅう」
 const pend=mangaFace({icon:'🎄',name:'クリスマスの マンガ',note:''},{name:'クリスマスの マンガ',manga:['season-99'],titleFromCatalog:true},undefined);
 assert.equal(pend.name,'クリスマスの マンガ（じゅんびちゅう）');assert.match(pend.note,/つくっているよ/);
 // これまでの マンガの マスは 名前が かわらない
 const old=rewardFace('manga-42','piyomi');assert.deepEqual(mangaFace(old,REWARDS['manga-42'],undefined),old);
});
