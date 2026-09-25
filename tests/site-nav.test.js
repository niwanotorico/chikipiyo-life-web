import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {places,placeHref} from '../src/nav/places.js';

import {renderSiteNav} from '../src/nav/site-nav-markup.js';

test('every place has a page that exists and a unique id',()=>{
 assert.deepEqual(places.map(p=>p.id),['house','river']);
 assert.equal(new Set(places.map(p=>p.id)).size,places.length);
 for(const p of places)assert.ok(existsSync(new URL('../'+p.page,import.meta.url)),p.page);
});

test('links follow the GitHub Pages sub-directory base',()=>{
 const base='/chikipiyo-life-web/';
 assert.equal(placeHref(places[0],base),'/chikipiyo-life-web/');
 assert.equal(placeHref(places[1],base),'/chikipiyo-life-web/river.html');
 assert.equal(placeHref(places[1],'/repo'),'/repo/river.html');
 assert.equal(placeHref(places[1],'/'),'/river.html');
});

test('only the current place is marked',()=>{
 for(const current of ['house','river']){
  const html=renderSiteNav(current,{base:'/r/'});
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.match(html,new RegExp(`aria-current="page" data-place="${current}"`));
  assert.match(html,/href="\/r\/"/);assert.match(html,/href="\/r\/river\.html"/);
  assert.match(html,/🏠/);assert.match(html,/🎣/);assert.match(html,/3DPハウス/);assert.match(html,/おさかな釣り/);
 }
});
