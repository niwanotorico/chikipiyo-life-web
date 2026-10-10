import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {toramanaVisitors} from '../src/world/toramana-visit.js';
import {CUBE_KEY} from '../src/manga/unlocks.js';

const storageWith=data=>({getItem:k=>k===CUBE_KEY&&data!==undefined?JSON.stringify(data):null});
const player=(gates={},rewards={})=>({seasons:{'2026-10':{earned:[{id:'a',day:'2026-10-05',pt:200}],gates,rewards,position:'start'}},coin:{},updatedAt:1});

test('トラマナちゃんが くる子：ゲートか ごほうびに toramana がある子だけ。データが ない・こわれていても こない', ()=>{
 assert.deepEqual(toramanaVisitors(storageWith({version:1,players:{piyomi:player({curry:{on:'2026-10-06',cost:50}})}})),[]);
 assert.deepEqual(toramanaVisitors(storageWith({version:1,players:{piyokichi:player({toramana:{on:'2026-10-08',cost:80}})}})),['piyokichi']);
 assert.deepEqual(toramanaVisitors(storageWith({version:1,players:{piyomi:player({},{toramana:{on:'2026-10-08',house:true}})}})),['piyomi']);
 assert.deepEqual(toramanaVisitors(storageWith(undefined)),[]);
 assert.deepEqual(toramanaVisitors({getItem:()=>'{こわれた'}),[]);
 assert.deepEqual(toramanaVisitors(storageWith({version:2,players:{piyokichi:player({toramana:{on:'2026-10-08',cost:80}})}})),[]);
 assert.deepEqual(toramanaVisitors(null),[]);
});

test('トラマナちゃんの モデルは 来るときだけ 読みこむ（ハウスの さいしょの 読みこみに 入れない）・軽い', ()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(!/toramana\.glb/.test(main),'main.js から 直接 読まない');
 const visit=readFileSync(new URL('../src/world/toramana-visit.js',import.meta.url),'utf8');
 assert.match(visit,/import\('\.\.\/\.\.\/assets\/characters\/toramana\.glb\?url'\)/);
 assert.ok(!/setItem/.test(visit),'ピヨドリルの 保存データには 書かない');
 assert.ok(statSync(new URL('../assets/characters/toramana.glb',import.meta.url)).size<1.6*1024*1024);
});
