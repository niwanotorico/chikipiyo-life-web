import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BoxGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,Raycaster,Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {animatePudding,loadPudding,ownsPudding,releasePudding} from '../src/world/pudding.js';

test('Blender pudding keeps its materials and three jiggle shape keys',async()=>{
 const bytes=readFileSync(new URL('../assets/props/pudding.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=new Scene(),group=new Group(),plate=new Mesh(new BoxGeometry(.66,.02,.66),new MeshBasicMaterial({side:DoubleSide})),table={position:[-3.2,0,-.8],max:[-2.3,.884,-.2],puddingAnchor:[-2.6353131532669067,-.5302828773856163],group};
 plate.name='14_Dessert_|_Circle002';plate.position.set(-2.6353131532669067,.931655,-.5302828773856163);group.add(plate);scene.add(group);
 plate.updateWorldMatrix(true,false);
 const pudding=await loadPudding(scene,'test',table,{loadAsync:async()=>gltf});
 assert(pudding);assert.equal(pudding.meshes.length,2);
 for(const mesh of pudding.meshes)for(const name of ['Squish','Wobble','Wobble_Y'])assert.notEqual(mesh.morphTargetDictionary[name],undefined);
 assert.deepEqual(new Set(pudding.meshes.map(mesh=>mesh.material.name)),new Set(['Custard','Caramel']));
 const body=pudding.meshes.find(mesh=>mesh.name==='Pudding_LowPoly'&&mesh.material.name==='Custard');
 assert.equal(pudding.root.scale.x,2.3);
 assert.deepEqual(pudding.root.position.toArray().slice(0,1).concat(pudding.root.position.z),table.puddingAnchor);
 const hit=new Raycaster(new Vector3(table.puddingAnchor[0],10,table.puddingAnchor[1]),new Vector3(0,-1,0),0,20).intersectObject(plate,true)[0];
 body.geometry.computeBoundingBox();const bodyCenter=body.geometry.boundingBox.getCenter(new Vector3());body.localToWorld(bodyCenter);
 const bodyHit=new Raycaster(new Vector3(bodyCenter.x,-10,bodyCenter.z),new Vector3(0,1,0),0,20).intersectObject(body,true)[0];
 assert(bodyHit);
 assert(Math.abs(bodyHit.point.y-(hit.point.y-.003))<1e-6);
 const localWidth=pudding.meshes[0].geometry.boundingBox.getSize(new Vector3()).x;
 const adjustedWidth=localWidth*pudding.root.scale.x;
 assert(adjustedWidth>.446);assert(adjustedWidth<localWidth*2.6);
 // Box3 includes the possible negative Squish morph, so allow that conservative margin.
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
