import * as T from 'three';
import {ball,box} from '../world/primitives.js';
export function createCharacter(def){const root=new T.Group(),rig=new T.Group();root.add(rig);root.position.set(...def.start);
 const body=ball(rig,[.32,.38,.27],[0,.51,0],def.color);
 const head=new T.Group();head.position.y=1.01;rig.add(head);ball(head,[.4,.36,.34],[0,0,0],def.color);
 for(const x of [-.135,.135]){ball(head,[.034,.048,.025],[x,.025,.317],0x39453b);ball(head,[.064,.029,.018],[x*1.65,-.075,.283],def.cheek);}
 ball(head,[.07,.045,.07],[0,-.065,.34],def.accent);
 for(let i=0;i<3;i++)ball(head,[.075,.13,.08],[(i-1)*.1,.32+(i===1?.045:0),0],def.accent);
 const arms=[];for(const s of [-1,1]){const pivot=new T.Group();pivot.position.set(s*.29,.67,0);rig.add(pivot);ball(pivot,[.105,.23,.13],[s*.045,-.12,0],def.color);arms.push(pivot);}
 const legs=[];for(const s of [-1,1]){const pivot=new T.Group();pivot.position.set(s*.14,.25,0);rig.add(pivot);ball(pivot,[.115,.12,.17],[0,-.12,.065],def.accent);legs.push(pivot);}
 const props=new T.Group();rig.add(props);const book=box(props,[.42,.29,.07],[0,.66,.39],0x769d94);const food=ball(props,[.11,.09,.11],[.24,.7,.37],0xdb9760);const vr=box(head,[.65,.22,.17],[0,.025,.34],0x455851);const broom=new T.Group();props.add(broom);box(broom,[.045,.85,.045],[.4,.53,.3],0xa67b52);box(broom,[.32,.17,.12],[.4,.1,.3],0xe5c882);
 return {...def,root,rig,body,head,arms,legs,props,book,food,vr,broom};}
