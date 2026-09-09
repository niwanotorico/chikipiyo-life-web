import * as T from 'three';
import {ball,box,mat} from '../world/primitives.js';
export function createCharacter(def){const root=new T.Group(),rig=new T.Group();root.add(rig);root.position.set(...def.start);
 const chicken=def.variant==='chicken';
 const body=ball(rig,chicken?[.33,.39,.27]:[.255,.28,.235],[0,chicken?.52:.41,0],def.color);
 const head=new T.Group();head.position.y=chicken?1.01:.78;rig.add(head);
 ball(head,chicken?[.43,.39,.34]:[.345,.31,.30],[0,0,0],def.color);
 if(chicken){
  // Rounded hood opening and a continuous curved fringe with a straight lower edge.
  ball(head,[.322,.30,.08],[0,-.02,.278],0xe8e1d6);
  ball(head,[.296,.275,.075],[0,-.025,.302],0xfae3d2);
  const fringe=new T.Shape();fringe.moveTo(-.285,.085);fringe.quadraticCurveTo(-.25,.28,0,.265);fringe.quadraticCurveTo(.25,.28,.285,.085);
  fringe.lineTo(.15,.085);fringe.lineTo(.125,.17);fringe.lineTo(.115,.082);fringe.lineTo(-.10,.082);fringe.lineTo(-.115,.16);fringe.lineTo(-.14,.085);fringe.closePath();
  const hair=new T.Mesh(new T.ExtrudeGeometry(fringe,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:3,steps:1}),mat(0x352d29));hair.position.z=.346;head.add(hair);
  for(const x of [-.13,.13])ball(head,[.057,.009,.013],[x,-.035,.373],0x352d29);
  ball(head,[.085,.12,.095],[0,.385,-.045],0xf05c35);
  for(let i=0;i<3;i++)ball(head,[.075,.105,.08],[0,.29-i*.11,-.25-i*.033],0xf05c35);
 }else{
  for(const x of [-.115,.115])ball(head,[.023,.036,.02],[x,.015,.279],0x39453b);
  ball(head,[.045,.029,.052],[0,-.06,.298],def.accent);
  ball(head,[.033,.02,.039],[0,-.088,.295],def.accent);
  // One tapered swept crest, visible from front and side, rather than round beads.
  const crest=new T.Shape();crest.moveTo(-.027,0);crest.bezierCurveTo(-.075,.09,-.065,.16,.045,.21);crest.bezierCurveTo(.019,.14,.015,.105,.038,.075);crest.quadraticCurveTo(.025,.03,.027,0);crest.closePath();
  const tuft=new T.Mesh(new T.ExtrudeGeometry(crest,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,steps:1}),mat(def.color));tuft.position.set(0,.285,-.025);tuft.rotation.x=-.55;head.add(tuft);
 }
 const tail=ball(rig,chicken?[.12,.15,.06]:[.07,.105,.045],[0,chicken?.42:.35,chicken?-.265:-.232],def.color);tail.rotation.x=-.55;
 const arms=[];for(const s of [-1,1]){const pivot=new T.Group();pivot.position.set(s*(chicken?.29:.235),chicken?.67:.53,0);rig.add(pivot);ball(pivot,chicken?[.105,.22,.12]:[.075,.145,.085],[s*.035,chicken?-.12:-.07,0],def.color);arms.push(pivot);}
 const legs=[];for(const s of [-1,1]){const pivot=new T.Group();pivot.position.set(s*(chicken?.14:.11),.25,0);rig.add(pivot);ball(pivot,[.028,.085,.032],[0,-.10,0],def.feet);for(const toe of [-1,0,1])ball(pivot,[.021,.035,chicken?.075:.057],[toe*.032,-.205,.05],def.feet);legs.push(pivot);}
 const props=new T.Group();rig.add(props);const book=box(props,[.42,.29,.07],[0,.66,.39],0x769d94);const food=ball(props,[.11,.09,.11],[.24,.7,.37],0xdb9760);const vr=box(head,[.65,.22,.17],[0,.025,chicken?.34:.30],0x455851);if(!chicken)vr.scale.setScalar(.85);const broom=new T.Group();props.add(broom);box(broom,[.045,.85,.045],[.4,.53,.3],0xa67b52);box(broom,[.32,.17,.12],[.4,.1,.3],0xe5c882);
 return {...def,root,rig,body,head,arms,legs,props,book,food,vr,broom};}
