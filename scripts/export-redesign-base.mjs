import {writeFile} from 'node:fs/promises';
import {Scene} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createHouse} from '../src/world/house.js';
globalThis.FileReader ??= class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});} readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const scene=new Scene();createHouse(scene).name='Existing house - preserved';
await writeFile(new URL('../model-work/house-preserved.glb',import.meta.url),Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true})));
