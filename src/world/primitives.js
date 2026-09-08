import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const mat = (color, roughness=.72) => new T.MeshStandardMaterial({color,roughness});
export function box(parent,size,pos,color,r=.08){const m=new T.Mesh(new RoundedBoxGeometry(...size,3,r),typeof color==='object'?color:mat(color));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function ball(parent,size,pos,color){const m=new T.Mesh(new T.SphereGeometry(1,24,16),typeof color==='object'?color:mat(color));m.scale.set(...size);m.position.set(...pos);m.castShadow=true;parent.add(m);return m;}
export function cylinder(parent,r,h,pos,color){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,24),mat(color));m.position.set(...pos);m.castShadow=true;parent.add(m);return m;}
