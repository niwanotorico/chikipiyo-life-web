import test from 'node:test';
import assert from 'node:assert/strict';
import {VOLUME_KEY,DEFAULT_VOLUME,volumeToGain,loadVolume,saveVolume,createMasterVolume} from '../src/river/river-volume.js';

const mem=(init={})=>{const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};
function fakeListener(){
 const node=()=>({gain:{value:1,setTargetAtTime(v){this.value=v;}},out:[],connect(n){this.out.push(n);},disconnect(){this.out=[];}});
 const destination={};const ctx={currentTime:0,destination,createGain:node};
 const gain=node();gain.connect(destination);
 return {context:ctx,gain};
}

test('first visit starts at a gentle default, later visits restore the saved volume',()=>{
 assert.equal(loadVolume(mem()),DEFAULT_VOLUME);
 assert.ok(DEFAULT_VOLUME>0&&DEFAULT_VOLUME<=.7);
 const s=mem();saveVolume(.3,s);assert.equal(s.m.get(VOLUME_KEY),'0.3');assert.equal(loadVolume(s),.3);
 assert.equal(loadVolume(mem({[VOLUME_KEY]:'abc'})),DEFAULT_VOLUME);
 assert.equal(loadVolume(mem({[VOLUME_KEY]:'7'})),1);
 assert.equal(loadVolume({getItem(){throw new Error('blocked');}}),DEFAULT_VOLUME,'private mode etc.');
 assert.equal(loadVolume(null),DEFAULT_VOLUME);
});

test('volume curve: 0 is silent, 1 is the original level, and it rises smoothly',()=>{
 assert.equal(volumeToGain(0),0);assert.equal(volumeToGain(1),1);
 let prev=0;for(let i=1;i<=100;i++){const g=volumeToGain(i/100);assert.ok(g>prev);prev=g;}
 assert.ok(volumeToGain(DEFAULT_VOLUME)<.6,'default is quieter than before');
});

test('one master gain sits between the shared listener and the speakers',()=>{
 const L=fakeListener(),s=mem({[VOLUME_KEY]:'0.3'});
 const v=createMasterVolume(L,{storage:s});
 assert.deepEqual(L.gain.out,[v.node],'every sound through the listener now passes the master');
 assert.deepEqual(v.node.out,[L.context.destination]);
 assert.equal(v.value,.3);assert.ok(Math.abs(v.node.gain.value-volumeToGain(.3))<1e-9);
 const seen=[];v.onChange(x=>seen.push(x));
 v.set(0);assert.equal(v.muted,true);assert.equal(v.node.gain.value,0);assert.equal(s.m.get(VOLUME_KEY),'0');
 v.toggleMute();assert.equal(v.value,.3,'unmute returns to the last level');
 v.set(1.4);assert.equal(v.value,1);
 assert.deepEqual(seen,[0,.3,1]);
});
