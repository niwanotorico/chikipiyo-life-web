import * as T from 'three';
import {box,ball,cylinder} from './primitives.js';
export const furnitureDefinitions=[
 {id:'bed',name:'ベッド',icon:'☾',action:'sleep',label:'寝る',position:[-3.7,0,2],spot:[-3.5,0,3.45],face:Math.PI,footprint:[2.3,2.5]},
 {id:'sofa',name:'ソファ',icon:'▱',action:'relax',label:'くつろぐ',position:[0,0,.2],spot:[.6,0,1.25],face:0,footprint:[2.7,1.35]},
 {id:'table',name:'テーブル',icon:'◷',action:'eat',label:'食べる',position:[-3,0,-.8],spot:[-3,0,.45],face:Math.PI,footprint:[1.9,1.4]},
 {id:'kitchen',name:'キッチン',icon:'♨',action:'cook',label:'料理する',position:[-2.7,0,-3.2],spot:[-3.05,0,-2],face:Math.PI,footprint:[2.8,1.25]},
 {id:'fridge',name:'冷蔵庫',icon:'▥',action:'snack',label:'おやつを探す',position:[-4.65,0,-3.1],spot:[-4.85,0,-1.9],face:Math.PI,footprint:[1,1.25]},
 {id:'vr',name:'VRヘッドセット',icon:'∞',action:'vr',label:'VRで遊ぶ',position:[0,0,2.7],spot:[-.7,0,1.65],face:0,footprint:[1.55,.85]},
 {id:'desk',name:'小さな作業机',icon:'▤',action:'read',label:'読書する',position:[3.1,0,-2.6],spot:[3.1,0,-1.45],face:Math.PI,footprint:[3.8,1.6]},
];
export function createFurniture(scene){return furnitureDefinitions.map(d=>{const g=new T.Group();g.position.set(...d.position);g.userData.furnitureId=d.id;scene.add(g);const wood=0xb99570,white=0xf7f3e8,mint=0x8ab6a2;
 if(d.id==='bed'){box(g,[2,.35,2.2],[0,.24,0],wood);box(g,[1.95,.28,2.12],[0,.52,0],white,.14);box(g,[2,.85,.15],[0,.55,-1.04],mint);box(g,[1.96,.18,1.38],[0,.7,.36],0xc2ccda);box(g,[1.3,.22,.48],[0,.75,-.67],white,.1);}
 if(d.id==='sofa'){box(g,[2.5,.38,1.1],[0,.4,0],mint,.16);box(g,[2.5,.8,.26],[0,.78,-.47],mint,.12);for(const x of [-1.1,1.1])box(g,[.28,.55,1.1],[x,.68,0],mint,.12);for(const x of [-.5,.5])box(g,[.87,.16,.79],[x,.66,.08],0xb1d0ba,.07);box(g,[.5,.46,.22],[.65,.98,-.17],0xf2d29a,.1);}
 if(['table','desk'].includes(d.id)){const w=d.id==='table'?1.7:1.65;box(g,[w,.13,1.05],[0,.93,0],0xe6cba3);for(const x of [-.65,.65])for(const z of [-.36,.36])box(g,[.1,.85,.1],[x,.46,z],wood,.03);if(d.id==='table'){cylinder(g,.23,.035,[0,1.025,0],white);ball(g,[.1,.075,.1],[0,1.09,0],0xe69b59);}else{box(g,[.48,.065,.35],[-.3,1.03,0],0x668e85);cylinder(g,.11,.15,[.45,1.07,0],0xf3bd71);}}
 if(d.id==='kitchen'){box(g,[2.65,.88,1.04],[0,.46,0],mint);box(g,[2.8,.13,1.18],[0,.97,0],white);for(const x of [-.85,0,.85]){box(g,[.025,.68,.02],[x,.47,.531],0x608d7b);box(g,[.28,.045,.055],[x+.25,.75,.56],wood);}box(g,[.9,.025,.75],[-.6,1.05,0],0x4c625b);cylinder(g,.24,.18,[-.6,1.16,0],0x899a91);box(g,[.7,.04,.58],[.73,1.05,0],0xadbfc0);cylinder(g,.035,.35,[.73,1.23,-.33],0x829b94);}
 if(d.id==='fridge'){box(g,[.88,1.93,1.03],[0,.97,0],white,.13);box(g,[.78,.025,.02],[0,1.3,.524],0xc6d2c7);box(g,[.055,.35,.055],[-.28,.96,.56],mint);}
 if(d.id==='vr'){box(g,[1.55,.13,.85],[0,.48,0],0xe6cba3,.12);for(const x of [-.58,.58])box(g,[.12,.4,.6],[x,.23,0],wood,.04);box(g,[.58,.24,.3],[0,.67,0],0x444e59,.09);box(g,[.45,.13,.035],[0,.68,.16],0xa7d8cd,.05);}
 if(d.id==='desk'){
  // Build plate shares the desk obstacle and click target; no new action or UI item.
  box(g,[1.65,.16,1.5],[1.05,1.03,0],0x596660,.04);
  for(const x of [.35,1.75])for(const z of [-.6,.6])cylinder(g,.075,.88,[x,.48,z],0x6c8677);
  for(let x=.35;x<1.8;x+=.2)box(g,[.009,.008,1.35],[x,1.115,0],0xa6b8ab,.002);
  for(let z=-.6;z<=.6;z+=.2)box(g,[1.5,.008,.009],[1.05,1.115,z],0xa6b8ab,.002);
  box(g,[.48,.4,.48],[1.05,1.32,0],0xffcc36,.02);
  const roof=box(g,[.4,.08,.6],[.91,1.58,0],0xffd951,.01);roof.rotation.z=.65;
  const roof2=box(g,[.4,.08,.6],[1.19,1.58,0],0xffd951,.01);roof2.rotation.z=-.65;
  box(g,[.12,.23,.025],[1.05,1.23,.25],0xeaaa24,.01);
 }
 g.traverse(o=>{o.userData.furnitureId=d.id;});return {...d,group:g};});}

