import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Box3,Scene} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFurniture} from '../src/world/furniture.js';

// GLTFExporter uses FileReader even for texture-free binary exports in Node.
globalThis.FileReader ??= class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
 readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const output=new URL('../assets/furniture/',import.meta.url);
await mkdir(output,{recursive:true});
const scene=new Scene(),furniture=createFurniture(scene),manifest=[];
function meshCount(root){let count=0;root.traverse(o=>{if(o.isMesh)count++;});return count;}
async function save(name,root){
 root.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(root);
 const data=await new GLTFExporter().parseAsync(root,{binary:true});
 const restored=await new GLTFLoader().parseAsync(data,'');
 const actual=new Box3().setFromObject(restored.scene);
 assert.equal(meshCount(restored.scene),meshCount(root),name+' mesh count');
 assert.ok(actual.min.distanceTo(bounds.min)<1e-5,name+' minimum bounds');
 assert.ok(actual.max.distanceTo(bounds.max)<1e-5,name+' maximum bounds');
 await writeFile(new URL(name+'.glb',output),Buffer.from(data));
 console.log(`${name}.glb: ${data.byteLength} bytes, ${meshCount(root)} editable meshes; round-trip OK`);
}
for(const item of furniture){
 item.group.name=item.id;
 item.group.children.forEach((mesh,i)=>{mesh.name=`${item.id}_part_${String(i+1).padStart(2,'0')}`;});
 const local=item.group.clone(true);local.position.set(0,0,0);
 await save(item.id,local);
 manifest.push({id:item.id,name:item.name,file:item.id+'.glb',worldPosition:item.position,interactionSpot:item.spot,facingRadians:item.face,footprint:item.footprint,meshes:meshCount(local)});
}
await save('furniture-layout',scene);
await writeFile(new URL('layout.json',output),JSON.stringify(manifest,null,2)+'\n');
