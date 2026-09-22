import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadActionProps} from '../src/world/action-props.js';

const names=['vacuum','headphones','music-keyboard','burger','potato-single','vr-gear'];
export async function loadHumanActionProps(scene,furniture){
 const parsed={};
 for(const name of names){
  const bytes=readFileSync(new URL(`../assets/props/${name}.glb`,import.meta.url));
  parsed[name]=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 }
 return loadActionProps(scene,furniture,Object.fromEntries(names.map(name=>[name,name])),{loadAsync:async url=>parsed[url]});
}
