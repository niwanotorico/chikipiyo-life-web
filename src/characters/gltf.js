import {Group,Matrix4} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const characterAssetPaths={chicken:'../assets/characters/chicken.glb',chick:'../assets/characters/piyokichi.glb',piyomi:'../assets/characters/piyomi.glb'};
const partNames=['Body','Head','Wing_L','Wing_R','Leg_L','Leg_R'];

// Imported rigid parts reuse the existing animation pivots; behavior never sees a new rig.
export function installCharacterVisual(c,scene){
 const parts=partNames.map(name=>{
  const matches=[];scene.traverse(o=>{if(o.name===name)matches.push(o);});
  if(matches.length!==1)throw new Error(`GLB requires exactly one ${name}`);
  return matches[0];
 });
 scene.traverse(o=>{
  if(o.isSkinnedMesh)throw new Error('Use rigid mesh parts, not a skinned armature');
  if(o.isMesh&&!parts.some(p=>{let n=o;while(n){if(n===p)return true;n=n.parent;}return false;}))throw new Error('All meshes must belong to a named part');
 });
 for(const part of parts){
  let parent=part.parent;while(parent){if(parts.includes(parent))throw new Error('Named parts must not contain each other');parent=parent.parent;}
  let meshes=0;part.traverse(o=>{if(o.isMesh)meshes++;});if(!meshes)throw new Error(`Empty part: ${part.name}`);
 }
 scene.updateMatrixWorld(true);
 const pivots=[c.rig,c.head,...c.arms,...c.legs];
 const replacements=parts.map((part,i)=>{
  const group=new Group();group.name=`GLB_${part.name}`;
  // Bind in neutral rig coordinates, even if loading finishes during sleep/walking.
  const p=i===0?{x:0,y:0,z:0}:pivots[i].position;
  const matrix=new Matrix4().makeTranslation(-p.x,-p.y,-p.z).multiply(part.matrixWorld);
  matrix.decompose(group.position,group.quaternion,group.scale);
  return group;
 });
 const keep=new Set([c.head,...c.arms,...c.legs,c.props]);
 const fallback=[...c.rig.children.filter(o=>!keep.has(o)),...c.head.children.filter(o=>o!==c.vr),...c.arms.flatMap(p=>p.children),...c.legs.flatMap(p=>p.children)];
 parts.forEach((part,i)=>{
  part.removeFromParent();part.position.set(0,0,0);part.rotation.set(0,0,0);part.scale.set(1,1,1);part.updateMatrix();
  replacements[i].add(part);pivots[i].add(replacements[i]);
 });
 fallback.forEach(o=>{o.visible=false;});
 c.visualSource='glb';
}

export async function loadCharacterVisual(c,url,loader=new GLTFLoader()){
 if(c.visualSource==='glb')return true;
 if(!url){c.visualSource='procedural';return false;}
 try{
  const gltf=await loader.loadAsync(url);
  installCharacterVisual(c,gltf.scene);
  return true;
 }catch(error){
  c.visualSource='procedural';
  c.visualLoadError=error instanceof Error?error.message:String(error);
  return false;
 }
}
