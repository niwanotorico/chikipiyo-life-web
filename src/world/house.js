import * as T from 'three';
import {box,cylinder} from './primitives.js';
export function createHouse(scene){const g=new T.Group();scene.add(g);
 box(g,[11,.36,8.5],[0,-.25,0],0xf6f1e8,.16);
 for(let i=0;i<19;i++)box(g,[.55,.07,8.1],[-5.04+i*.56,-.025,0],i%3===0?0xd5b58d:0xe0c39f,.015);
 box(g,[10.7,2.8,.22],[0,1.35,-4.05],0xf8f6ef);
 box(g,[.22,1.65,8.1],[-5.3,.8,0],0xf8f6ef);
 // Printed wall layers and an open printer gantry, leaving the front unobstructed.
 for(let y=.15;y<2.7;y+=.14)box(g,[10.5,.015,.025],[0,y,-3.926],0xe4e7dc,.005);
 for(const x of [-5.4,5.4])for(const z of [-4.15,4.15]){box(g,[.23,3.85,.23],[x,1.65,z],0x82b5a4);box(g,[.5,.17,.5],[x,-.03,z],0x568b7b);}
 for(const x of [-5.4,5.4])box(g,[.26,.25,8.55],[x,3.56,0],0x9bcbba);
 for(const z of [-4.15,4.15])box(g,[11,.25,.26],[0,3.56,z],0x9bcbba);
 box(g,[.14,.14,8.1],[2.2,3.5,0],0xd7e5df);box(g,[.68,.36,.55],[2.2,3.3,-2.8],0x548e7c);cylinder(g,.12,.24,[2.2,3.04,-2.8],0xd2b47c);
 // A broad picture window.
 box(g,[2.6,1.4,.12],[.5,1.9,-3.88],0xadcfc9);box(g,[2.36,1.15,.14],[.5,1.9,-3.8],0xe1efe9);box(g,[.07,1.2,.16],[.5,1.9,-3.7],0xfafbf3);
 box(g,[3.3,.045,2.4],[-2.3,.04,1.6],0xb5c9b5,.02);
 const lamp=new T.PointLight(0xffd6a0,16,8,2);lamp.position.set(-3,2.5,-2);g.add(lamp);
 return g;}
