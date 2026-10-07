// 「おまつり」モード：保存・演出量の表・ふつうとの分離（得点や保存ロジックに触れていないこと）を確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FXMODE_KEY,loadFxMode,saveFxMode,festivalVisuals,festivalDancerCount,festivalCombo,festivalStageText,FEST_FEVER_MS} from '../src/drill/festival.js';
import {visuals,comboMilestone,FEVER_MS} from '../src/drill/hype.js';

const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};

test('モード保存：初回は ふつう／おまつりを選ぶと次も おまつり／こわれた値は ふつう／専用キーだけ',()=>{
 const st=mem();
 assert.equal(loadFxMode(st),'normal');
 assert.equal(saveFxMode(st,'festival'),true);
 assert.equal(loadFxMode(st),'festival');
 saveFxMode(st,'normal');assert.equal(loadFxMode(st),'normal');
 st.setItem(FXMODE_KEY,'???');assert.equal(loadFxMode(st),'normal');
 assert.deepEqual([...st.m.keys()],[FXMODE_KEY],'ほかのキーは触らない');
 assert.equal(loadFxMode(null),'normal');
 assert.equal(saveFxMode({setItem(){throw new Error('x');}},'festival'),false,'保存できなくても落ちない');
});

test('おまつりの演出量：ふつうを下回らず、4問目から卵と右の目玉焼き、7問目からフラッシュと雨',()=>{
 for(let stage=0;stage<=5;stage++)for(const q of [1,4,7,10]){
  const base=visuals(stage),f=festivalVisuals(base,{q,combo:q});
  for(const k of ['particles','bigEggs','hopEggs','rain','shake','flash'])assert.ok(f[k]>=base[k],`${k} stage${stage} q${q}`);
 }
 const b=visuals(0);
 assert.equal(festivalVisuals(b,{q:1,combo:1}).hopEggs,0);
 assert.equal(festivalVisuals(b,{q:4,combo:1}).hopEggs,6);
 assert.equal(festivalVisuals(b,{q:4,combo:1}).bigEggs,2);
 assert.equal(festivalVisuals(b,{q:7,combo:1}).rain,10);
 assert.ok(festivalVisuals(b,{q:7,combo:1}).flash>0);
 assert.ok(festivalVisuals(b,{q:9,combo:9}).shake<=12);
 assert.deepEqual(festivalVisuals(b,{q:9,combo:9,reduced:true}),b,'動きを減らす設定では何も足さない');
});

test('飛び上がるキャラの数・コンボ表示・段階の文字',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(festivalDancerCount),[0,0,0,1,1,1,2,3,4,0]);
 assert.equal(festivalCombo(1),null);
 assert.deepEqual([2,3,4,5,8,10].map(c=>festivalCombo(c).size),[1,2,2,3,4,4]);
 assert.equal(festivalCombo(4).text,'4れんぞく！');
 assert.equal(comboMilestone(4),null,'ふつうは 4れんぞく では出ない（変えていない）');
 assert.deepEqual([3,4,5,7,10].map(festivalStageText),[null,'ノってきた!!',null,'アツアツ!!','ラスト1もん!!']);
 assert.ok(FEST_FEVER_MS>FEVER_MS);
});

test('分離：festival.js は得点・保存・問題のモジュールを読まない／main.js は play.fx==="festival" のときだけ呼ぶ',()=>{
 const f=readFileSync(new URL('../src/drill/festival.js',import.meta.url),'utf8');
 const imports=[...f.matchAll(/^import .* from '(.+)';/gm)].map(m=>m[1]);
 assert.deepEqual(imports,['./actor.js']);
 assert.ok(!/localStorage|answerRun|commitResult|cubePt|recordSession/.test(f.replace(/\/\/.*$/gm,'')),'得点・保存に触れない');
 const m=readFileSync(new URL('../src/drill/main.js',import.meta.url),'utf8');
 const lines=m.split('\n');
 lines.forEach((ln,i)=>{if(/festival\.(wave|dancers|stageText|feverShow)\(/.test(ln))assert.ok(/fest/.test(lines.slice(Math.max(0,i-2),i+1).join('\n')),`ふつうでも呼ばれるかも: ${ln.trim()}`);});
});
