import * as T from 'three';
import {box,cylinder,mat} from './primitives.js';
export function createHouse(scene){const g=new T.Group();scene.add(g);
 const mint=0x91c5ae,yellow=0xffcb32;
 box(g,[11,.36,8.5],[0,-.25,0],mint,.16);
 for(let i=0;i<19;i++)box(g,[.55,.07,8.1],[-5.04+i*.56,-.025,0],i%3===0?0xd5b58d:0xe0c39f,.015);
 box(g,[10.7,2.8,.22],[0,1.35,-4.05],0xf4dec0);
 box(g,[.22,1.65,8.1],[-5.3,.8,0],0xf4dec0);
 for(let y=.15;y<2.7;y+=.14)box(g,[10.5,.015,.025],[0,y,-3.926],0xe4cfb0,.005);
 // Chunky open mint printer enclosure; all supports stay outside the walk grid.
 for(const x of [-5.4,5.4])for(const z of [-4.15,4.15]){
  box(g,[.48,4.15,.48],[x,1.75,z],mint,.2);
  box(g,[.65,.18,.65],[x,-.36,z],0x505951);
 }
 for(const x of [-5.4,5.4])box(g,[.48,.46,8.7],[x,3.65,0],mint,.18);
 for(const z of [-4.15,4.15])box(g,[11,.46,.48],[0,3.65,z],mint,.18);
 // X gantry and stationary print head, above the right-hand build surface.
 for(const z of [-2.95,-2.4]){const rail=cylinder(g,.065,10.4,[0,3.5,z],0x7f918d);rail.rotation.z=Math.PI/2;}
 for(const x of [-5.05,5.05])box(g,[.55,.5,1.05],[x,3.5,-2.67],mint);
 box(g,[.86,.78,.8],[4.15,3.22,-2.6],0x79af99,.1);
 box(g,[.57,.46,.045],[4.15,3.22,-2.185],mint,.04);
 box(g,[.37,.2,.36],[4.15,2.75,-2.6],0xe99631);
 const nozzle=new T.Mesh(new T.ConeGeometry(.12,.22,16),mat(0xf4b83c));nozzle.rotation.x=Math.PI;nozzle.position.set(4.15,2.55,-2.6);g.add(nozzle);
 cylinder(g,.13,.16,[4.15,3.69,-2.6],0x46534c);
 // The reel axis runs left/right; narrow yellow rings read as wound filament.
 const reel=new T.Group();reel.position.set(-6.15,2,-2.6);g.add(reel);
 const axle=cylinder(reel,.19,1.7,[0,0,0],0x6b7971);axle.rotation.z=Math.PI/2;
 const core=cylinder(reel,1.63,.75,[0,0,0],yellow);core.rotation.z=Math.PI/2;
 for(const x of [-.48,.48]){const flange=cylinder(reel,1.85,.12,[x,0,0],0x555953);flange.rotation.z=Math.PI/2;}
 for(let x=-.35;x<=.36;x+=.09){const ring=new T.Mesh(new T.TorusGeometry(1.63,.042,8,64),mat(0xffdc58));ring.rotation.y=Math.PI/2;ring.position.x=x;reel.add(ring);}
 const curve=new T.CatmullRomCurve3([new T.Vector3(-6.15,3.55,-2.6),new T.Vector3(-4.8,4.1,-2.6),new T.Vector3(0,4.65,-2.6),new T.Vector3(3.45,4.3,-2.6),new T.Vector3(4.15,3.76,-2.6)]);
 g.add(new T.Mesh(new T.TubeGeometry(curve,64,.055,10,false),mat(yellow)));
 for(const x of [-.2,3]){
  box(g,[2.55,1.5,.12],[x,1.85,-3.88],0xc29e72);
  box(g,[2.32,1.27,.14],[x,1.85,-3.8],0xe9efe0);
  box(g,[.07,1.3,.16],[x,1.85,-3.7],0xfff5df);
  box(g,[2.34,.07,.16],[x,1.85,-3.7],0xfff5df);
 }
 // Thin rugs cannot obstruct navigation or change the furniture anchors.
 box(g,[3,.018,2.6],[0,.025,1.35],0xf4dda3,.01);
 for(const x of [-1.3,1.3])box(g,[.16,.006,2.55],[x,.038,1.35],yellow,.003);
 const lamp=new T.PointLight(0xffd6a0,16,8,2);lamp.position.set(-3,2.5,-2);g.add(lamp);
 return g;}


