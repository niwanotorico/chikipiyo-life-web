import test from 'node:test';
import assert from 'node:assert/strict';
import {characterDefinitions} from '../src/characters/config.js';
import {resolveInteraction} from '../src/simulation/interactions.js';
import {visibleFurnitureActions} from '../src/ui.js';
import {roomFurniture} from '../src/world/room-layout.js';

const simulation={getTarget(character,id){return resolveInteraction(roomFurniture.find(item=>item.id===id),character);}};
const actionsFor=id=>visibleFurnitureActions(roomFurniture,characterDefinitions.find(character=>character.id===id),simulation);

test('action list follows the selected character and keeps display labels separate from action keys',()=>{
 const ids=id=>actionsFor(id).map(item=>item.id);
 assert.deepEqual(ids('piyo'),['bed','sofa','table','vr','vacuum','desk','printer']);
 assert.deepEqual(ids('piyomi'),['bed','sofa','table','vr','vacuum','piano','printer']);
 assert.deepEqual(ids('chiki'),['bed','sofa','table','vr','vacuum','printer']);
 assert(!ids('piyo').includes('piano'),'ぴよきちにピアノを表示しない');
 assert(!ids('piyomi').includes('desk'),'ぴよみにモデリングを表示しない');
 assert.equal(actionsFor('piyo').find(item=>item.id==='table').seats.piyo.label,'プリンを食べる');
 assert.equal(actionsFor('piyomi').find(item=>item.id==='table').seats.piyomi.label,'ハンバーガーを食べる');
 assert.equal(actionsFor('piyo').find(item=>item.id==='desk').action,'model','display label does not replace the execution key');
});
