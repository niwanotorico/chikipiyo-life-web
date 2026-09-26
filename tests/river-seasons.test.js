import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SEASONS,SEASON_IDS,seasonForDate,forcedSeason,parseDateParam,stateForDate,YEAR,createSeasonUniforms,createSeasonSystem,seasonGLSL} from '../src/river/seasons.js';
import {treeGeometry,TREE_KINDS} from '../src/river/vegetation.js';
import {createRiverFall} from '../src/river/river-fall.js';

test('real dates map to the Japanese meteorological seasons',()=>{
 const m=k=>seasonForDate(new Date(2026,k-1,15));
 assert.deepEqual([1,2,3,4,5,6,7,8,9,10,11,12].map(m),['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter']);
 assert.equal(forcedSeason('autumn'),'autumn');
 assert.equal(forcedSeason('auto'),null,'no param / auto = follow the real date');
 assert.equal(forcedSeason(null),null);
 const d=parseDateParam('10-25');assert.equal(d.getMonth(),9);assert.equal(d.getDate(),25);
 assert.equal(parseDateParam('2027-02-03').getFullYear(),2027);
 for(const bad of ['13-01','02-31','x',null])assert.equal(parseDateParam(bad),null,String(bad));
});

test('every season defines every shader value, and only winter has snow',()=>{
 const keys=Object.keys(SEASONS.summer.shader).sort();
 for(const id of SEASON_IDS){
  assert.deepEqual(Object.keys(SEASONS[id].shader).sort(),keys,id);
  for(const k of keys)assert.ok(seasonGLSL.includes('uS'+k[0].toUpperCase()+k.slice(1)),k);
 }
 for(const id of ['spring','summer','autumn'])assert.equal(SEASONS[id].shader.snow,0,id);
 assert.equal(SEASONS.winter.shader.snow,1);
 assert.deepEqual(SEASON_IDS.map(id=>SEASONS[id].fall),[{petal:1,leaf:0,snow:0},{petal:0,leaf:0,snow:0},{petal:0,leaf:1,snow:0},{petal:0,leaf:0,snow:1}]);
});

const at=(m,d)=>stateForDate(new Date(2026,m-1,d,12)).state;
test('the year flows day by day: autumn colours creep in through Sep–Nov, then winter, then spring',()=>{
 // 紅葉の進み具合は 9 月 → 10 月 → 11 月で単調に増える
 const au=[[9,1],[9,20],[10,10],[10,28],[11,15],[11,22]].map(([m,d])=>at(m,d).shader.autumn);
 for(let i=1;i<au.length;i++)assert.ok(au[i]>=au[i-1],`autumn ${au}`);
 assert.ok(au[0]<.05&&au[1]>0&&au[1]<.3,'September is still mostly green');
 assert.equal(at(11,22).shader.autumn,1,'peak in late November');
 assert.ok(at(12,20).shader.bare>0&&at(12,20).shader.bare<1,'December leans into winter');
 assert.equal(at(1,20).shader.snow,1);assert.equal(at(7,20).shader.snow,0);assert.ok(Math.abs(at(4,5).shader.blossom-SEASONS.spring.shader.blossom)<.01);
 assert.equal(at(8,1).shader.autumn,0);
 // どの 2 日の間も大きく跳ばない（毎日少しずつ）
 let prev=at(1,1);
 for(let n=1;n<=365;n++){const st=stateForDate(new Date(2026,0,1+n,12)).state;
  for(const k of ['snow','autumn','blossom','leafKeep','bare','litter'])assert.ok(Math.abs(st.shader[k]-prev.shader[k])<.08,`day ${n} ${k}`);prev=st;}
 assert.ok(YEAR.length>=8);
});

test('the season system follows today by default, and ?season / ?date pin it',()=>{
 const shared={uTime:{value:0},uSunCol:{value:new T.Color()}};
 const scene=new T.Scene();scene.fog=new T.FogExp2(0xaec8cc,.0048);
 const sun=new T.DirectionalLight(0xffffff,3.1),hemi=new T.HemisphereLight();
 const mixes=[];const fall={setMix:m=>mixes.push(m)};
 let today=new Date(2026,6,20,12);
 const s=createSeasonSystem({shared,scene,sun,hemi,fall,now:()=>today});
 const U=shared.season;assert.equal(s.mode,'auto');assert.equal(s.get(),'summer');assert.equal(U.uSSnow.value,0);
 // 開いている間に日付が進むと、1 分ごとの見直しで静かに移る
 today=new Date(2027,0,20,12);for(let i=0;i<70;i++)s.update(1);
 assert.equal(s.get(),'winter');assert.ok(U.uSSnow.value>.99);
 s.set('spring',{instant:true});assert.equal(s.mode,'fixed');assert.equal(U.uSSnow.value,0);assert.ok(U.uSBlossom.value>0);
 today=new Date(2027,6,1);for(let i=0;i<70;i++)s.update(1);assert.equal(s.get(),'spring','fixed does not follow the clock');
 s.setDate(new Date(2026,10,22),{instant:true});assert.equal(s.mode,'date');assert.equal(U.uSAutumn.value,1);
 s.set('winter');for(let i=0;i<5;i++)s.update(.1);assert.ok(U.uSSnow.value>0&&U.uSSnow.value<1,'blending');
 assert.ok(mixes.length>=3);
 assert.throws(()=>s.set('monsoon'));
 assert.equal(createSeasonUniforms().uSLeafKeep.value,1);
 const pinned=createSeasonSystem({shared:{uTime:{value:0}},initial:'autumn'});assert.equal(pinned.mode,'fixed');assert.equal(pinned.get(),'autumn');
});

test('tree geometry marks each leaf clump (for autumn colours and winter bare branches)',()=>{
 for(const kind of TREE_KINDS)for(const lod of [0,1]){
  const g=treeGeometry(kind,1,lod),leaf=g.attributes.aLeaf,cen=g.attributes.aCenter;
  assert.ok(leaf&&cen,`${kind} attrs`);
  const ids=new Set();let bark=0;
  for(let i=0;i<leaf.count;i++){const v=leaf.getX(i);if(v===0)bark++;else{assert.ok(v>0&&v<=1);ids.add(v);}}
  assert.ok(ids.size>=2,`${kind} lod${lod} has several clumps`);
  if(kind!=='bush')assert.ok(bark>0,`${kind} has a trunk`);
 }
});

test('falling petals / leaves / snow are one small draw with a light count on mobile',()=>{
 const f=createRiverFall({shared:{uTime:{value:0}},mobile:true});
 assert.ok(f.counts.snow<=300&&f.counts.leaf<=120&&f.counts.petal<=120);
 f.setMix({leaf:1},{instant:true});assert.equal(f.mesh.visible,true);assert.equal(f.mesh.geometry.instanceCount,f.counts.leaf);
 f.setMix({leaf:.3,snow:.1});assert.equal(f.level,.3,'fewer leaves early in autumn');
 f.setMix({petal:0,leaf:0,snow:0});for(let i=0;i<10;i++)f.update(.1,{x:0,y:0,z:0});
 assert.equal(f.mesh.visible,false,'summer has nothing falling');
});

test('cherry blossom is gone once spring turns to summer, and late September is only a hint of autumn',()=>{
 for(const [m,d] of [[6,5],[7,20],[8,31],[9,27],[10,20],[11,22],[12,25],[1,20],[2,15]])
  assert.equal(stateForDate(new Date(2026,m-1,d,12)).state.shader.blossom,0,`${m}/${d} has no blossom`);
 const sep=stateForDate(new Date(2026,8,27,12)).state;
 assert.ok(sep.shader.autumn<.3,'trees mostly still green');
 assert.ok(sep.fall.leaf>0&&sep.fall.leaf<.1,'only a few leaves falling');
 assert.ok(sep.shader.litter<.05);
});

test('shader: a tree whose hash is exactly 0 must not turn pink when blossom is 0',async()=>{
 const src=(await import('node:fs')).readFileSync(new URL('../src/river/materials.js',import.meta.url),'utf8');
 assert.ok(!src.includes('step(vInstH,uSBlossom)'));
 assert.ok(src.includes('vInstH<uSBlossom'));
});
