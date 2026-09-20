import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {animatePudding,loadPudding,ownsPudding,releasePudding} from '../src/world/pudding.js';

test('Blender pudding keeps its materials and three jiggle shape keys',async()=>{
 const bytes=readFileSync(new URL('../assets/props/pudding.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new Scene(),table={position:[-3.2,0,-.8],max:[-2.3,.884,-.2]};
 const pudding=await loadPudding(scene,'test',table,{loadAsync:async()=>gltf});
 assert(pudding);assert.equal(pudding.meshes.length,2);
 for(const mesh of pudding.meshes)for(const name of ['Squish','Wobble','Wobble_Y'])assert.notEqual(mesh.morphTargetDictionary[name],undefined);
 assert.deepEqual(new Set(pudding.meshes.map(mesh=>mesh.material.name)),new Set(['Custard','Caramel']));
 const bounds=new Box3().setFromObject(pudding.root);
 // Box3 includes the possible negative Squish morph, so allow that conservative margin.
 assert(bounds.min.y>table.max[1]-.1);assert(bounds.max.y-bounds.min.y>.3);
 assert(ownsPudding(pudding,pudding.meshes[0]));
});

test('moving and releasing the pudding excites the wobble then returns it home',async()=>{
 const bytes=readFileSync(new URL('../assets/props/pudding.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const pudding=await loadPudding(new Scene(),'test',{position:[0,0,0],max:[1,1,1]},{loadAsync:async()=>gltf});
 pudding.root.position.x+=.4;animatePudding(pudding,1/60);
 assert(pudding.meshes.some(mesh=>Math.abs(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Wobble])>.01));
 pudding.dragging=true;assert(releasePudding(pudding));
 for(let frame=0;frame<240;frame++)animatePudding(pudding,1/60);
 assert(pudding.root.position.distanceTo(pudding.home)<1e-3);
 assert(!pudding.returning);assert(pudding.offset.length()<1e-3);
 assert(pudding.home.equals(new Vector3(0,1.005,0)));
});
