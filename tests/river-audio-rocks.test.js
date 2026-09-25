import test from 'node:test';
import assert from 'node:assert/strict';
import {loopCrossfade,pickAudioFile} from '../src/river/audio-loop.js';
import {createRocks,rockGroundOk,ROCK_MAX_DRY_SLOPE} from '../src/river/rocks.js';
import {heightAt,WATER_Y} from '../src/river/terrain.js';
import * as T from 'three';

test('loop crossfade makes the loop point continuous and trims encoder padding',()=>{
 const sr=8000,pad=400,body=sr*3,x=new Float32Array(pad+body+pad);
 for(let i=0;i<body;i++)x[pad+i]=.5*Math.sin(i*2*Math.PI*437/sr)+.2*Math.sin(i*.0131);
 const r=loopCrossfade([x],sr,{fade:.5});
 const o=r.channels[0],L=r.length;
 assert.deepEqual(r.trimmed.map(v=>v>=pad-1),[true,true]);
 assert.equal(L,body-Math.floor(.5*sr)+ (pad*2-r.trimmed[0]-r.trimmed[1]));
 const step=Math.abs(o[0]-o[L-1]),typical=2*Math.PI*437/sr*.5+.01;
 assert.ok(step<typical*1.5,`seam jump ${step}`);
});

test('audio file is picked by what the browser can play; none means silence',()=>{
 const files={'../../assets/audio/river-stream.mp3':'/a.mp3','../../assets/audio/river-stream.ogg':'/a.ogg'};
 assert.equal(pickAudioFile(files,()=>true),'/a.ogg');
 assert.equal(pickAudioFile(files,m=>m==='audio/mpeg'),'/a.mp3');
 assert.equal(pickAudioFile({},()=>true),null);
});

test('no rocks on steep dry slopes; river-bed and shore rocks remain',()=>{
 const {group}=createRocks({uTime:{value:0},uSunCol:{value:new T.Color()},uPebble:{value:null}},{mobile:true,clear:[]});
 const m=new T.Matrix4(),p=new T.Vector3();let n=0,wet=0;
 for(const im of group.children)for(let i=0;i<im.count;i++){
  im.getMatrixAt(i,m);p.setFromMatrixPosition(m);n++;
  assert.ok(rockGroundOk(p.x,p.z),`rock on a cliff at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  if(heightAt(p.x,p.z)<=WATER_Y+.4)wet++;
 }
 assert.ok(n>330,'pebbles and boulders still there: '+n);
 assert.ok(wet>n*.5);
 assert.equal(ROCK_MAX_DRY_SLOPE,.7);
});

test('river stream sound ships as a small mono loop (ogg + m4a for Safari)',async()=>{
 const {readFileSync,statSync}=await import('node:fs');
 const ogg=new URL('../assets/audio/river-stream.ogg',import.meta.url),m4a=new URL('../assets/audio/river-stream.m4a',import.meta.url);
 assert.ok(statSync(ogg).size<1.5e6&&statSync(m4a).size<1.5e6);
 const b=readFileSync(ogg),i=b.indexOf(Buffer.from('\x01vorbis','latin1'));
 assert.ok(i>0,'vorbis id header');assert.equal(b[i+11],1,'mono');
});

test('fishing sound effects ship as small mono files and are wired to the fishing events',async()=>{
 const {readFileSync,statSync}=await import('node:fs');
 for(const n of ['se-lure-land','se-fish-lift','se-fish-release']){
  for(const ext of ['ogg','m4a'])assert.ok(statSync(new URL(`../assets/audio/${n}.${ext}`,import.meta.url)).size<100e3,n+ext);
  const b=readFileSync(new URL(`../assets/audio/${n}.ogg`,import.meta.url)),i=b.indexOf(Buffer.from('\x01vorbis','latin1'));assert.equal(b[i+11],1,n+' mono');
 }
 const src=readFileSync(new URL('../src/river/fishing.js',import.meta.url),'utf8');
 for(const t of ['land','lift','release'])assert.match(src,new RegExp(`onEvent\\?\\.\\('${t}'`));
});
