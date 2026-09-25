import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DOLLHOUSE_WIDTH,DOLLHOUSE_FILE,DOLLHOUSE_EXCLUDE_PARTS,MODEL_VIEWER_SOURCES,modelViewerAttributes} from '../src/ar/dollhouse-config.js';

const url=new URL(`../${DOLLHOUSE_FILE}`,import.meta.url);
const bytes=readFileSync(url);
const load=async()=>(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const json=()=>{const len=bytes.readUInt32LE(12);return JSON.parse(bytes.subarray(20,20+len).toString('utf8'));};

test('AR dollhouse GLB is light enough for phones',()=>{
 const mb=statSync(url).size/1048576;
 assert.ok(mb<6,`GLB ${mb.toFixed(2)} MB`);
 const room=statSync(new URL('../assets/room/human-room.glb',import.meta.url)).size/1048576;
 assert.ok(mb<room/4,'much lighter than the room GLB');
});

test('AR dollhouse is table-sized (about 40cm wide), standing on its origin',async()=>{
 const scene=await load();const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3());
 assert.ok(Math.abs(size.x-DOLLHOUSE_WIDTH)<.005,'width '+size.x);
 assert.ok(size.x>=.3&&size.x<=.5&&size.z<size.x&&size.y<size.x,'size '+size.toArray());
 assert.ok(Math.abs(box.min.y)<1e-4,'sits on the floor '+box.min.y);
 const c=box.getCenter(new T.Vector3());assert.ok(Math.abs(c.x)<1e-3&&Math.abs(c.z)<1e-3,'centered '+c.toArray());
});

test('AR dollhouse keeps the house and residents, drops hidden parts and transmission',async()=>{
 const scene=await load();const names=new Set();let tris=0;
 scene.traverse(o=>{names.add(o.name);if(o.isMesh)tris+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;});
 for(const id of ['chiki','piyo','piyomi'])assert.ok(names.has(`Character_${id}`),id);
 for(const n of ['bed','Hotend','edp_house','Plane.006'])assert.ok([...names].some(x=>x===n||x===n.replace('.','')),n);
 for(const n of DOLLHOUSE_EXCLUDE_PARTS)assert.ok(![...names].some(x=>x===n||x.startsWith(n)),n);
 assert.ok(tris<250000,'triangles '+tris);
 const used=json().extensionsUsed||[];
 assert.ok(!used.includes('KHR_materials_transmission'),'no transmission: '+used);
 assert.equal(json().extensionsRequired,undefined);
});

test('model-viewer attributes: Scene Viewer + Quick Look, floor placement, pinch scaling',()=>{
 const a=modelViewerAttributes('https://example.com/x.glb');
 assert.equal(a.src,'https://example.com/x.glb');
 assert.deepEqual(a['ar-modes'].split(' '),['scene-viewer','quick-look']);
 assert.equal(a['ar-scale'],'auto');assert.equal(a['ar-placement'],'floor');
 assert.ok('ar' in a&&'camera-controls' in a);
 assert.ok(MODEL_VIEWER_SOURCES.length>=2&&MODEL_VIEWER_SOURCES.every(u=>u.startsWith('https://')&&u.endsWith('model-viewer.min.js')));
});
