import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {SERIES,allEpisodes,episodeById,episodePages,readableEpisodes,MANGA_PLAYERS} from '../src/manga/catalog.js';
import {MANGA_PAGES} from '../src/manga/pages.js';
import {readUnlocks,readShelf,writeShelf,defaultPlayer,CUBE_KEY,QUEST_KEY,SHELF_KEY} from '../src/manga/unlocks.js';
import {withPages,clampPosition,stepPosition,pageAt,createPageWindow} from '../src/manga/reading.js';
import {REWARDS,MAP,SEASON,costOf,nodeById,openableNodes,emptyCubePlayer,recordSession,openGate,mergeCubePlayer,mangaOf,season,cubeBalance,effectsOf,sanitizeCubePlayer,completion,AUTO_MANGA,foundCount,UPDATE_FROM,nodeState,mapView,GIFT_FROM,DAILY_GIFTS,giftsOf,giftOn,giftAvailable} from '../src/drill/cosmicube.js';
import {CubeStore,memoryCubeAdapter,CUBE_KEY as DRILL_CUBE_KEY} from '../src/drill/cosmicube-store.js';
import {STORE_KEY} from '../src/drill/storage.js';
import {PLAYERS} from '../src/drill/questions.js';

const D='2026-10-07';   // マンガ・ハロウィンが はじまる日（UPDATE_FROM）
const D6='2026-10-06';
const award=points=>({points,cleared:true,practice:false});
// 読み書きを記録する localStorage のかわり
function fakeStorage(init={}){
 const data=new Map(Object.entries(init).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
 const writes=[];
 return {writes,data,getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){writes.push(k);data.set(k,String(v));}};
}
function playerWith(rewards){
 const p=emptyCubePlayer();
 p.seasons[SEASON.id].rewards=Object.fromEntries(rewards.map(id=>[id,{on:D,house:false}]));
 return p;
}

test('本だな：キーとプレイヤーは ピヨドリルと同じ', ()=>{
 assert.equal(CUBE_KEY,DRILL_CUBE_KEY);
 assert.equal(QUEST_KEY,STORE_KEY);
 assert.notEqual(SHELF_KEY,CUBE_KEY);assert.notEqual(SHELF_KEY,QUEST_KEY);
 assert.deepEqual(MANGA_PLAYERS.map(p=>[p.id,p.name]),Object.values(PLAYERS).map(p=>[p.id,p.name]));
});

test('本だな：本はシリーズごとに1冊（マイクラ本・まったり日常本・季節の本）', ()=>{
 assert.deepEqual(SERIES.map(s=>s.title),['マイクラ本','まったり日常本','季節の本']);
 assert.deepEqual(SERIES[2].episodes.map(e=>e.title),['ハロウィン攻略法']);
 assert.deepEqual(SERIES[0].episodes.map(e=>e.title),['自動化の沼','寝る場所','宝さがし','おともだち','近道','人気者','いいながめ','ねこの指定席']);
 assert.deepEqual(SERIES[1].episodes.map(e=>e.title),['葉っぱの行き先','かげのせいくらべ','くものおやつ','いしのひなた','かたつむりのかさ','みずたまりのそら','おなかのおへんじ','かぜのかくれんぼ','くものいす']);
 const ids=allEpisodes().map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
});

test('ごほうび：マンガの話は どれか1つの ごほうび（ゲート・自動解放・毎日の ごほうび）にだけ入る。話IDは catalog にある', ()=>{
 const seen=new Map();
 for(const [id,r] of [...Object.entries(REWARDS),...AUTO_MANGA.map(a=>[a.id,a]),...DAILY_GIFTS.map(g=>[g.id,g])])for(const ep of r.manga??[]){
  assert.ok(episodeById(ep),`${id} → ${ep}`);
  assert.ok(!seen.has(ep),`${ep} が ${seen.get(ep)} と ${id} の両方にある`);seen.set(ep,id);
 }
 assert.equal(seen.size,allEpisodes().length);
 // マンガは ドリルの問題には 効かない・3DPハウス来訪フラグもつけない
 for(const [id,r] of Object.entries(REWARDS))if(r.manga){assert.deepEqual(r.effects,[],id);assert.ok(!r.house,id);assert.ok(!r.secret,id);}
});

test('マップ：マンガは もとの空き枠と、大きいゲートの手前の 小さいマス（1話ずつ）。道の合計 pt は もとのまま', ()=>{
 const expect={curry:[50,['start']],bgm:[20,['step-bgm-2']],toramana:[40,['step-tora-2']],deep:[80,['step-deep-2']]};
 for(const [id,[cost,req]] of Object.entries(expect)){const n=nodeById(id);assert.equal(n.reward,id);assert.equal(n.cost,cost);assert.deepEqual(n.requires,req);}
 const manga=MAP.nodes.filter(n=>REWARDS[n.reward]?.manga);
 assert.deepEqual(manga.filter(n=>!n.small).map(n=>n.id),['slot-left','slot-a','slot-b','slot-c']);
 assert.deepEqual(manga.filter(n=>n.small).map(n=>[n.id,n.before,REWARDS[n.reward].manga.length]),[['step-bgm-1','bgm',1],['step-bgm-2','bgm',1],['step-tora-1','toramana',1],['step-tora-2','toramana',1],['step-deep-1','deep',1],['step-deep-2','deep',1]]);
 // 道の合計：テーマソングまで 60・カレーから トラマナちゃんまで 80・最奥まで 120（もとと同じ）
 const path=id=>MAP.nodes.filter(n=>n.before===id).reduce((a,n)=>a+n.cost,nodeById(id).cost);
 assert.deepEqual([path('bgm'),path('toramana'),path('deep')],[60,80,120]);
 assert.ok(manga.every(n=>n.cost===20));
 // 合計：マンガ込み 390pt（うさこ 40pt を slot-d に足すと 430pt）
 assert.equal(openableNodes().reduce((a,n)=>a+n.cost,0),390);
 // slot-d は うさこ（10月後半）用に空けておく
 assert.equal(nodeById('slot-d').reward,null);
 assert.ok(MAP.nodes.every(n=>n.reward!=='usako'));
});

test('既存の記録はそのまま：マンガのゲートを開けても カレー・入金・コインは残り、残高は コストぶんだけ へる', ()=>{
 let p=emptyCubePlayer();
 p=recordSession(p,{sessionId:'s1',dayKey:'2026-10-05',award:award(60)}).player;
 p=recordSession(p,{sessionId:'s2',dayKey:D,award:award(60)}).player;
 p=openGate(p,'curry','2026-10-05').player;
 const before=JSON.parse(JSON.stringify(p));
 const r=openGate(p,'slot-left',D);
 assert.equal(r.ok,true);assert.equal(r.reward,'manga-1');
 const s=season(r.player);
 assert.deepEqual(season(before).earned,s.earned);
 assert.deepEqual(before.coin,r.player.coin);
 assert.deepEqual(s.rewards.curry,season(before).rewards.curry);
 assert.equal(cubeBalance(s),cubeBalance(season(before))-20);
 assert.deepEqual([...mangaOf(r.player,D)].sort(),['daily-01','mc-01']);
 assert.deepEqual([...effectsOf(r.player)],['curry']);
 // 2台の記録を合わせても マンガは消えない
 const merged=mergeCubePlayer(r.player,before);
 assert.deepEqual([...mangaOf(merged,D)].sort(),['daily-01','mc-01']);
 // slot-a は slot-left のあと
 assert.equal(openGate(before,'slot-a',D).reason,'locked');
 assert.equal(openGate(r.player,'slot-a',D).reason,'ok');   // 残高 120−50−20=50 で 20pt のマンガ2 が開く
});

test('ゲートを開ける前のデータ（マンガなし）は、そのまま読める', ()=>{
 const old={seasons:{'2026-10':{earned:[{id:'a',day:'2026-10-03',pt:40}],gates:{bgm:{on:'2026-10-04',cost:60}},rewards:{bgm:{on:'2026-10-04',house:false}},position:'bgm'}},coin:{'2026-10-03':'a'},updatedAt:5};
 const p=sanitizeCubePlayer(old);
 assert.deepEqual(season(p).rewards,old.seasons['2026-10'].rewards);
 assert.equal(mangaOf(p,D).size,0);
});

test('ハロウィン：トラマナちゃんと BGM の両方で、pt なし・ゲートなしで 季節の本に ふえる。最奥はそのまま', ()=>{
 assert.deepEqual(AUTO_MANGA,[{id:'halloween',requires:['toramana','bgm'],manga:['season-01'],from:'2026-10-07'}]);
 const has=p=>mangaOf(p,D).has('season-01');
 let p=emptyCubePlayer();
 for(let i=0;i<20;i++)p=recordSession(p,{sessionId:'s'+i,dayKey:`2026-10-${String(3+Math.floor(i/3)).padStart(2,'0')}`,award:award(19)}).player;
 for(const id of ['curry','step-tora-1','step-tora-2','toramana','step-bgm-1','step-bgm-2'])p=openGate(p,id,D).player;
 assert.equal(has(p),false);   // 片方だけでは ふえない
 const before=cubeBalance(season(p));
 const r=openGate(p,'bgm',D);p=r.player;
 assert.equal(has(p),true);
 assert.equal(cubeBalance(season(p)),before-20);   // BGM のぶんだけ。ハロウィンに pt はかからない
 assert.ok(!('halloween' in season(p).rewards)&&!('season-01' in season(p).rewards),'保存はしない');
 assert.equal(completion(season(p)).total,14);     // ハロウィンは コンプ率の母数に 入れない
 // 最奥は 手前の 小さいマス2つの あとで 開けられる
 assert.equal(nodeById('deep').reward,'deep');
 for(const id of ['step-deep-1','step-deep-2'])p=openGate(p,id,D).player;
 assert.equal(openGate(p,'deep',D).ok,true);
});

test('ハロウィン：変更前から 両方を持っている子（保存データに季節の本の記録なし）にも効く', ()=>{
 const old={seasons:{'2026-10':{earned:[{id:'m',day:'2026-10-03',pt:200}],gates:{curry:{on:'2026-10-03',cost:50},toramana:{on:'2026-10-05',cost:80},bgm:{on:'2026-10-06',cost:60}},rewards:{curry:{on:'2026-10-03',house:false},toramana:{on:'2026-10-05',house:true},bgm:{on:'2026-10-06',house:false}},position:'bgm'}},coin:{},updatedAt:3};
 assert.deepEqual([...mangaOf(sanitizeCubePlayer(old),D)],['season-01']);
 const u=readUnlocks(fakeStorage({[CUBE_KEY]:{version:1,players:{piyomi:old}}}),D);
 assert.deepEqual([...u.piyomi],['season-01']);assert.equal(u.piyokichi.size,0);
 assert.deepEqual(readableEpisodes('season',u.piyomi).map(e=>e.title),['ハロウィン攻略法']);
});

test('古いページ（マンガを知らない）が保存して rewards から manga-* が消えても、ひらいたゲートから よめる', ()=>{
 let p=emptyCubePlayer();
 p=recordSession(p,{sessionId:'s1',dayKey:D,award:award(19)}).player;
 p=recordSession(p,{sessionId:'s2',dayKey:D,award:award(19)}).player;
 p=openGate(p,'slot-left',D).player;
 const old=JSON.parse(JSON.stringify(p));delete old.seasons[SEASON.id].rewards['manga-1'];   // 古いコードの sanitize と同じ結果
 assert.deepEqual([...mangaOf(old,D)].sort(),['daily-01','mc-01']);
 assert.equal(openGate(old,'slot-left',D).reason,'open');   // 二重に pt を払うこともない
});

test('解放状況：プレイヤーごとに読む。こわれたデータ・別バージョン・知らない ごほうびは 空', ()=>{
 const cube={version:1,device:'x',players:{piyokichi:playerWith(['curry','manga-1','manga-3']),piyomi:playerWith(['manga-2','nope'])}};
 const u=readUnlocks(fakeStorage({[CUBE_KEY]:cube}),D);
 assert.deepEqual([...u.piyokichi].sort(),['daily-01','daily-03','mc-01','mc-03']);
 assert.deepEqual([...u.piyomi].sort(),['daily-02','mc-02']);
 assert.deepEqual(readableEpisodes('mc',u.piyokichi).map(e=>e.title),['自動化の沼','宝さがし']);   // catalog の順
 for(const broken of [null,'{oops',JSON.stringify({version:2,players:cube.players}),JSON.stringify([])]){
  const s=fakeStorage(broken==null?{}:{[CUBE_KEY]:broken});
  const r=readUnlocks(s);assert.equal(r.piyokichi.size,0);assert.equal(r.piyomi.size,0);
 }
 assert.equal(readUnlocks(null).piyomi.size,0);
 const throwing={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 assert.equal(readUnlocks(throwing).piyokichi.size,0);
 assert.equal(writeShelf(throwing,{player:null,last:{}}),false);
});

test('本だなは ピヨドリルの保存データに書かない', ()=>{
 const s=fakeStorage({[CUBE_KEY]:{version:1,players:{piyomi:playerWith(['manga-1'])}},[QUEST_KEY]:{version:1,selected:'piyomi'}});
 readUnlocks(s);defaultPlayer(s);
 writeShelf(s,{player:'piyomi',last:{piyomi:{mc:{episode:'mc-01',page:0}}}});
 assert.deepEqual(s.writes,[SHELF_KEY]);
 // 本だなのソースにも ドリルのキーへの setItem がない
 for(const f of ['unlocks.js','reader.js','reading.js','shelf-entry.js','catalog.js']){
  const src=readFileSync(new URL(`../src/manga/${f}`,import.meta.url),'utf8');
  assert.ok(!/setItem\((CUBE_KEY|QUEST_KEY|'chikipiyo-(cosmicube|quest))/.test(src),f);
 }
});

test('ひらいたときの人：ドリルで えらばれている人 → 本だなで さいごに えらんだ人 → なし', ()=>{
 assert.equal(defaultPlayer(fakeStorage({[QUEST_KEY]:{selected:'piyomi'},[SHELF_KEY]:{player:'piyokichi'}})),'piyomi');
 assert.equal(defaultPlayer(fakeStorage({[QUEST_KEY]:{selected:null},[SHELF_KEY]:{player:'piyokichi'}})),'piyokichi');
 assert.equal(defaultPlayer(fakeStorage({})),null);
 assert.equal(defaultPlayer(fakeStorage({[QUEST_KEY]:{selected:'someone'}})),null);
 const shelf=readShelf(fakeStorage({[SHELF_KEY]:{player:'x',last:{piyomi:{mc:{episode:'mc-02',page:-3},zzz:{episode:'a'}},ghost:{}}}}));
 assert.deepEqual(shelf,{player:null,last:{piyomi:{mc:{episode:'mc-02',page:0}}}});
});

test('読む順番：画像のない話は とばす。話のおわりで つぎの話へ。はしでは止まる', ()=>{
 const pages={a:[{src:'a1'},{src:'a2'}],b:[],c:[{src:'c1'}]};
 const eps=withPages([{id:'a'},{id:'b'},{id:'c'}],id=>pages[id]);
 assert.deepEqual(eps.map(e=>e.id),['a','c']);
 let pos=clampPosition(eps,null);assert.deepEqual(pos,{episode:'a',page:0});
 assert.deepEqual(clampPosition(eps,{episode:'a',page:9}),{episode:'a',page:1});
 assert.deepEqual(clampPosition(eps,{episode:'b',page:0}),{episode:'a',page:0});
 assert.equal(clampPosition([],{episode:'a',page:0}),null);
 assert.equal(stepPosition(eps,pos,-1),null);
 pos=stepPosition(eps,pos,1);assert.deepEqual(pos,{episode:'a',page:1});
 pos=stepPosition(eps,pos,1);assert.deepEqual(pos,{episode:'c',page:0});
 assert.equal(pageAt(eps,pos).src,'c1');
 assert.equal(stepPosition(eps,pos,1),null);
 assert.deepEqual(stepPosition(eps,pos,-1),{episode:'a',page:1});
});

test('画像の窓：先読みは いつも1枚まで。閉じたら手ばなす。失敗→もういちど。古い読みこみは無視', ()=>{
 const created=[];
 const img={removeAttribute(n){if(n==='src')delete this.src;}};
 const states=[];
 const w=createPageWindow(img,{createImage:()=>{const o={removeAttribute(n){if(n==='src')this.src='';}};created.push(o);return o;},onState:s=>states.push(s)});
 w.show({src:'/p1.webp',w:10,h:20});
 assert.equal(img.src,'/p1.webp');assert.equal(img.width,10);assert.equal(states.at(-1),'loading');
 w.prefetch({src:'/p2.webp'});w.prefetch({src:'/p3.webp'});
 assert.equal(created.length,2);assert.equal(created[0].src,'');assert.equal(w.preloading,'/p3.webp');
 const staleLoad=img.onload;
 img.onerror();assert.equal(states.at(-1),'error');
 w.retry();assert.equal(img.src,'/p1.webp?r=1');
 w.show({src:'/p2.webp',w:1,h:1});staleLoad();assert.equal(states.at(-1),'loading');   // 前のページの onload は効かない
 img.onload();assert.equal(states.at(-1),'ready');
 w.clear();assert.equal(img.src,undefined);assert.equal(w.preloading,null);assert.equal(created[1].src,'');
});

test('配信用 WebP：pages.js のファイルがある・軽い。元PNGは リポジトリに入れない', ()=>{
 const root=new URL('../public/',import.meta.url);
 for(const e of allEpisodes())assert.ok(MANGA_PAGES[e.id]?.length,`${e.id} の画像がない（npm run manga）`);
 for(const [id,list] of Object.entries(MANGA_PAGES)){
  assert.ok(episodeById(id),id);
  for(const p of list){
   assert.match(p.src,/^manga\/[a-z]+\/\d{2}\/p\d{2}\.webp$/);
   const file=new URL(p.src,root);assert.ok(existsSync(file),p.src);
   assert.ok(statSync(file).size<600*1024,`${p.src} が大きすぎる`);
   assert.ok(p.w>0&&p.h>0);
  }
 }
 assert.ok(episodePages('mc-01','/base/')[0].src.startsWith('/base/manga/mc/01/'));
 const files=readdirSync(new URL('../public/manga/',import.meta.url),{recursive:true}).map(String).filter(f=>/\.\w+$/.test(f));
 assert.ok(files.length&&files.every(f=>f.endsWith('.webp')),files.join(','));
});

test('おうちの初期表示を重くしない：リーダーは import()。ハウス側はドリルの問題データを読まない', ()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(!/from '\.\/manga\/reader\.js'/.test(main));
 const entry=readFileSync(new URL('../src/manga/shelf-entry.js',import.meta.url),'utf8');
 assert.match(entry,/import\('\.\/reader\.js'\)/);
 for(const f of ['catalog.js','unlocks.js','shelf-entry.js','reading.js']){
  const src=readFileSync(new URL(`../src/manga/${f}`,import.meta.url),'utf8');
  assert.ok(!/^import .*(questions|cosmicube-store|storage)\.js/m.test(src),f);
 }
 const cube=readFileSync(new URL('../src/drill/cosmicube.js',import.meta.url),'utf8');
 assert.ok(!/^import /m.test(cube),'cosmicube.js は何も import しない（ハウスから読んでも軽い）');
});

test('CubeStore 経由でも：マンガを開くと snapshot の rewards に入る', ()=>{
 const cube=new CubeStore({adapter:memoryCubeAdapter()});
 cube.recordSession('piyomi',{sessionId:'s1',dayKey:D,award:award(19)});
 cube.recordSession('piyomi',{sessionId:'s2',dayKey:D,award:award(19)});
 assert.equal(cube.openGate('piyomi','slot-left',D).ok,true);
 assert.deepEqual(cube.snapshot('piyomi',D).rewards,['manga-1']);
 assert.deepEqual(cube.snapshot('piyokichi',D).rewards,[]);
});

test('本だなの3D：もとからある オレンジの本3冊を 左から マイクラ・まったり・季節に 色分け。本ごとに えらべて、本以外は「本だな」', async ()=>{
 const T=await import('three');
 const {installBookshelf,shelfBooks}=await import('../src/world/bookshelf.js');
 const room=new T.Group();
 const unit=new T.Mesh(new T.BoxGeometry(1.5,1.94,.05));unit.name='Plane086';unit.position.set(.25,.97,-3.4);room.add(unit);   // 本物の戸棚は 中が空いているので、背板だけで代用
 const orange=new T.MeshStandardMaterial({color:0xf78819});orange.name='Material.001';
 const pages=new T.MeshStandardMaterial({color:0xdfdfdf});pages.name='Material.014';
 shelfBooks.forEach((name,i)=>{
  const g=new T.Group();g.name=name;g.position.set(.59+i*.104,1.6,-3.1);
  g.add(new T.Mesh(new T.BoxGeometry(.1,.41,.3),orange),new T.Mesh(new T.BoxGeometry(.09,.4,.29),pages));
  room.add(g);
 });
 const shelf=installBookshelf(room,{createCanvas:()=>null});
 assert.deepEqual(shelf.books.map(b=>b.series),SERIES.map(s=>s.id));
 assert.deepEqual(shelf.books.map(b=>b.mesh.name),['book007','book006','book005']);
 assert.deepEqual(shelf.books.map(b=>'#'+b.face.color.getHexString()),SERIES.map(s=>s.color));
 assert.equal(orange.color.getHex(),0xf78819,'もとの素材は かえない（本ごとに複製）');
 assert.equal(room.children.length,4,'新しい本は足さない');
 // 正面から1冊ずつ ねらうと その本。本のない ところは 本だな（series:null）
 for(const b of shelf.books){
  const c=b.box.getCenter(new T.Vector3());
  assert.equal(shelf.hit(new T.Raycaster(new T.Vector3(c.x,c.y,2),new T.Vector3(0,0,-1))).series,b.series);
 }
 assert.equal(shelf.hit(new T.Raycaster(new T.Vector3(-.3,.5,2),new T.Vector3(0,0,-1))).series,null);
 shelf.highlight('daily');assert.ok(shelf.books[1].face.emissiveIntensity>0);assert.equal(shelf.books[0].face.emissiveIntensity,0);
 shelf.highlight(null);assert.ok(shelf.books.every(b=>b.face.emissiveIntensity===0));
 // ラベルの位置は 天板の上（本より上）
 assert.ok(shelf.entryAnchor().y>Math.max(...shelf.books.map(b=>b.box.max.y)));
});

test('みつけた ごほうび：中身のあるゲートを ひらいた数。マンガのゲートも1つで1こ。ハロウィン（おまけ）は数えない', ()=>{
 let p=emptyCubePlayer();
 for(let i=0;i<24;i++)p=recordSession(p,{sessionId:'s'+i,dayKey:`2026-10-${String(3+Math.floor(i/3)).padStart(2,'0')}`,award:award(19)}).player;
 assert.equal(foundCount(season(p)),0);
 for(const id of ['slot-left','curry','step-tora-1','step-tora-2','toramana'])p=openGate(p,id,D).player;
 assert.equal(foundCount(season(p)),5);           // マンガ（2話ぶん）でも 1こ。小さいマスも 1こ
 for(const id of ['step-bgm-1','step-bgm-2','bgm'])p=openGate(p,id,D).player;
 assert.ok(mangaOf(p,D).has('season-01'));
 assert.equal(foundCount(season(p)),8);           // ハロウィンは ふえても 数えない
 // 古いページが rewards を消しても、ゲートから数える
 const old=JSON.parse(JSON.stringify(p));delete old.seasons[SEASON.id].rewards['manga-1'];
 assert.equal(foundCount(season(old)),8);
});

test('10/7 から切りかえ：6日までは マンガのゲートは ❓じゅんびちゅうで ひらけず、ハロウィンも まだ。7日になると そのまま反映', ()=>{
 assert.equal(UPDATE_FROM,'2026-10-07');
 let p=emptyCubePlayer();
 for(let i=0;i<12;i++)p=recordSession(p,{sessionId:'s'+i,dayKey:`2026-10-0${3+Math.floor(i/3)}`,award:award(19)}).player;   // 10/3〜10/6
 // 6日までに開けた（そのころの公開版の 記録の形。カレー50・トラマナちゃん80・BGM60）
 p=sanitizeCubePlayer({...p,seasons:{[SEASON.id]:{...season(p),gates:{curry:{on:D6,cost:50},toramana:{on:D6,cost:80},bgm:{on:D6,cost:60}},rewards:{curry:{on:D6},toramana:{on:D6,house:true},bgm:{on:D6}},position:'bgm'}}});
 const bal=cubeBalance(season(p));
 // 6日：見た目も動きも いままでどおり
 assert.equal(nodeState(season(p),nodeById('slot-left'),D6),'soon');
 assert.equal(openGate(p,'slot-left',D6).reason,'empty');
 assert.equal(mangaOf(p,D6).size,0);
 assert.ok(mapView(season(p),{dayKey:D6}).filter(v=>REWARDS[v.node.reward]?.manga&&!v.node.small).every(v=>v.state==='soon'||v.state==='fog'));
 // 7日：記録は そのまま（再計算しない）で、マンガとハロウィンが使えるようになる
 assert.equal(cubeBalance(season(p)),bal);
 assert.equal(nodeState(season(p),nodeById('slot-left'),D),'ready');
 assert.deepEqual([...mangaOf(p,D)],['season-01']);
 const r=openGate(p,'slot-left',D);assert.equal(r.ok,true);assert.equal(cubeBalance(season(r.player)),bal-20);
 // 6日に はじめた1回を 7日に終えても、6日ぶんとして入る（ポイントの日は はじめた日。いままでどおり）
 const late=recordSession(p,{sessionId:'late',dayKey:D6,award:award(19)});
 assert.equal(late.reason,'limit');   // 6日は もう3回
 // 3回まで・4回目は 0pt（いままでどおり）
 let q=p;for(let i=0;i<3;i++){const x=recordSession(q,{sessionId:'d7-'+i,dayKey:D,award:award(15)});assert.equal(x.cubePt,15);q=x.player;}
 const fourth=recordSession(q,{sessionId:'d7-3',dayKey:D,award:award(15)});assert.equal(fourth.cubePt,0);assert.equal(fourth.reason,'limit');
});

test('ドリルの画面：コンプ率（%）ではなく「みつけた ごほうび ○こ」。総数は出さない', ()=>{
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.ok(!html.includes('コンプ'));assert.ok(!html.includes('data-map-comp-bar'));
 assert.match(html,/みつけた ごほうび<\/dt><dd><b data-c="found">0<\/b>こ/);
 assert.match(html,/<span>みつけた ごほうび<\/span><b data-map-found>0こ<\/b>/);
 const ui=readFileSync(new URL('../src/drill/cosmicube-ui.js',import.meta.url),'utf8');
 assert.match(ui,/\$\('\[data-map-found\]'\)\.textContent=`\$\{foundN\}こ`/);
 assert.ok(!/percent/.test(ui));
});

// ---------- 毎日の ごほうび（10/9 から） ----------
const coinDays=(...days)=>{const p=emptyCubePlayer();for(const d of days)p.coin[d]='s-'+d;return p;};

test('毎日の ごほうび：10/9 から、その日はじめて 10もん クリアした日に リストの じゅんばんで 1こ。8日までの分は 数えない', ()=>{
 assert.equal(GIFT_FROM,'2026-10-09');
 const p=coinDays('2026-10-07','2026-10-08','2026-10-09','2026-10-11','2026-10-12');
 assert.deepEqual(giftsOf(p).map(g=>[g.day,g.id]),[['2026-10-09',DAILY_GIFTS[0].id],['2026-10-11',DAILY_GIFTS[1].id],['2026-10-12',DAILY_GIFTS[2].id]]);
 assert.equal(giftOn(p,'2026-10-10'),null);   // あそばなかった日は なし（あとで まとめて もらえない）
 assert.equal(giftOn(p,'2026-10-12').name,'マンガ「近道」');
 assert.deepEqual([...mangaOf(p,'2026-10-12')],['mc-05']);   // マンガの ごほうびは 本だなへ
 assert.equal(giftAvailable(p,'2026-10-13'),true);
 assert.equal(giftAvailable(p,'2026-10-12'),false);           // きょうは もう もらった
 assert.equal(giftAvailable(p,'2026-10-08'),false);           // 9日より前は なし
 assert.equal(giftAvailable(p,'2026-11-01'),false);           // 期間のあと
});

test('毎日の ごほうび：保存データは ふやさない。クリアの記録（コインの日）だけから きまるので、古いページが保存しても 消えない', ()=>{
 let p=emptyCubePlayer();
 const r=recordSession(p,{sessionId:'a',dayKey:'2026-10-09',award:award(5)});
 assert.equal(r.coinNew,true);
 assert.deepEqual(Object.keys(r.player).sort(),['coin','seasons','updatedAt']);
 assert.equal(giftOn(r.player,'2026-10-09').id,DAILY_GIFTS[0].id);
 // 2回目・れんしゅう（4回目）では ふえない
 const r2=recordSession(r.player,{sessionId:'b',dayKey:'2026-10-09',award:{...award(5),practice:true}});
 assert.equal(giftsOf(r2.player).length,1);
 // 点数に 関係なし（0pt の回でも クリアすれば とどく）
 const r3=recordSession(r2.player,{sessionId:'c',dayKey:'2026-10-10',award:award(0)});
 assert.equal(giftsOf(r3.player).length,2);
 assert.equal(giftsOf(sanitizeCubePlayer(JSON.parse(JSON.stringify(r3.player)))).length,2);
});

test('毎日の ごほうび：リストの さいごまで とどいたら それ以上は なし。シールの絵は ぜんぶ ある', async ()=>{
 const days=[];for(let d=9;d<=31;d++)days.push(`2026-10-${String(d).padStart(2,'0')}`);
 const p=coinDays(...days);
 assert.equal(giftsOf(p).length,DAILY_GIFTS.length);
 assert.equal(giftAvailable(p,'2026-10-31'),false);
 assert.equal(new Set(DAILY_GIFTS.map(g=>g.id)).size,DAILY_GIFTS.length);
 assert.ok(DAILY_GIFTS.every(g=>g.sticker||g.manga?.length));
 const {STICKER_ART}=await import('../src/drill/cosmicube-ui.js');
 for(const g of DAILY_GIFTS.filter(g=>g.sticker)){
  assert.ok(STICKER_ART[g.sticker],g.sticker);
  assert.ok(existsSync(new URL(STICKER_ART[g.sticker])),g.sticker);
 }
});

test('ドリルの画面：ホームに「🎁 きょうの ごほうび」、結果に とどいたもの、マップに シールちょう', ()=>{
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.match(html,/data-c="gift"/);assert.match(html,/data-cube-gift hidden/);assert.match(html,/data-stickers hidden/);assert.match(html,/シールちょう/);
 const main=readFileSync(new URL('../src/drill/main.js',import.meta.url),'utf8');
 assert.match(main,/giftOn\(cube\.player\(play\.player\),play\.dayKey\)/,'ごほうびの日は その回を はじめた日');
});

test('まいにちの みち：マップの下に 帯。ひらいた マス＋つぎの 1マスだけ（ぜんぶの数は 出さない）。ひらく演出は 1日1回', ()=>{
 const html=readFileSync(new URL('../drill.html',import.meta.url),'utf8');
 assert.match(html,/<section class="dq-daily" data-daily hidden[^>]*><h3[^>]*>まいにちの みち<\/h3><ol class="dq-daily-path" data-daily-path><\/ol>/);
 assert.ok(html.indexOf('data-daily ')>html.indexOf('data-map-space'),'星空マップの すぐ下');
 const ui=readFileSync(new URL('../src/drill/cosmicube-ui.js',import.meta.url),'utf8');
 assert.match(ui,/renderDaily\(player,p,dayKey\)/);
 assert.match(ui,/if\(avail\)items\.push\(step\('is-next','❓','10もんで ひらく'\)\)/);
 assert.match(ui,/todayGift&&!dailySeen\.has\(key\)/);
 assert.ok(!/localStorage/.test(ui),'演出を見せたかどうかは 保存しない');
});

test('小さいマス：ぴよみ（カレーまで・のこり43pt）は トラマナちゃんの手前の 2マスを すぐ ひらける。そのあと トラマナちゃんは あと37pt', ()=>{
 let p=sanitizeCubePlayer({seasons:{[SEASON.id]:{earned:[{id:'a',day:'2026-10-05',pt:50},{id:'b',day:'2026-10-08',pt:43}],gates:{curry:{on:'2026-10-06',cost:50}},rewards:{curry:{on:'2026-10-06'}},position:'curry'}}});
 assert.equal(cubeBalance(season(p)),43);
 for(const id of ['step-tora-1','step-tora-2']){const r=openGate(p,id,'2026-10-09');assert.equal(r.ok,true,id);p=r.player;}
 assert.equal(cubeBalance(season(p)),3);
 assert.equal(openGate(p,'toramana','2026-10-09').reason,'short');
 assert.equal(nodeById('toramana').cost-cubeBalance(season(p)),37);
 assert.ok(mangaOf(p,'2026-10-09').has('mc-07')&&mangaOf(p,'2026-10-09').has('daily-08'));
});

test('小さいマス：その先の 大きいゲートを もう ひらいている子は、手前の マスを 0pt で ひらける（もう とおった道）', ()=>{
 let p=sanitizeCubePlayer({seasons:{[SEASON.id]:{earned:[{id:'a',day:'2026-10-05',pt:60}],gates:{bgm:{on:'2026-10-06',cost:60}},rewards:{bgm:{on:'2026-10-06'}},position:'bgm'}}});
 assert.equal(cubeBalance(season(p)),0);
 assert.equal(costOf(season(p),nodeById('step-bgm-1')),0);
 assert.equal(costOf(season(p),nodeById('step-tora-1')),20);
 for(const id of ['step-bgm-1','step-bgm-2']){const r=openGate(p,id,'2026-10-09');assert.equal(r.ok,true,id);p=r.player;}
 assert.deepEqual(season(p).gates['step-bgm-1'],{on:'2026-10-09',cost:0});
 assert.equal(cubeBalance(season(p)),0);
 assert.ok(mangaOf(p,'2026-10-09').has('mc-06')&&mangaOf(p,'2026-10-09').has('daily-07'));
 // まだ ひらいていない ゲートの手前は ふつうの pt（カレーが まだなので とおれない）
 assert.equal(openGate(p,'step-tora-1','2026-10-09').reason,'locked');
});
