import * as T from 'three';
import {ball,box,mat} from '../world/primitives.js';

// Inflate a drawn outline in depth, keeping the broad front almost flat.
// Unlike stacked spheres this preserves the sheet's cheeks, hem and wing contours.
function puff(parent,outline,size,pos,color){
 const contour=outline.getSpacedPoints(64).slice(0,-1),n=contour.length,rings=16;
 const vertices=[],indices=[];
 for(let j=0;j<=rings;j++){
  const angle=Math.PI*j/rings,r=Math.sin(angle),z=Math.sign(Math.cos(angle))*Math.sqrt(Math.max(0,1-r**4));
  for(const p of contour)vertices.push(p.x*r,p.y*r,z);
 }
 for(let j=0;j<rings;j++)for(let i=0;i<n;i++){
  const a=j*n+i,b=j*n+(i+1)%n,c=b+n,d=a+n;indices.push(a,d,b,b,d,c);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,mat(color));mesh.scale.set(...size);mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function plate(parent,shape,pos,color,depth=.018,bevel=.008){
 const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:24,steps:1}),mat(color));
 mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function roundHead(){
 const s=new T.Shape();s.moveTo(0,1);s.bezierCurveTo(-.64,1,-1,.58,-1,-.06);s.bezierCurveTo(-1,-.8,-.66,-1,0,-1);s.bezierCurveTo(.66,-1,1,-.8,1,-.06);s.bezierCurveTo(1,.58,.64,1,0,1);return s;
}
function suitBody(){
 const s=new T.Shape();s.moveTo(0,1);s.bezierCurveTo(-.48,1,-.7,.55,-.85,-.05);s.bezierCurveTo(-1.12,-.78,-.75,-1.08,-.34,-.91);s.quadraticCurveTo(0,-1.12,.34,-.91);s.bezierCurveTo(.75,-1.08,1.12,-.78,.85,-.05);s.bezierCurveTo(.7,.55,.48,1,0,1);return s;
}
export function createCharacter(def){
 const root=new T.Group(),rig=new T.Group();root.add(rig);root.position.set(...def.start);
 const chicken=def.variant==='chicken';
 const body=puff(rig,suitBody(),chicken?[.30,.30,.29]:[.185,.21,.25],[0,chicken?.47:.37,0],def.color);
 const head=new T.Group();head.position.y=chicken?1.01:.69;rig.add(head);
 if(chicken){
  // A hood with a real opening: the face sits behind its white lip, not on a beak-like bulge.
  puff(head,roundHead(),[.465,.42,.27],[0,0,-.035],def.color);
  // Sweep the white rim into the hood, avoiding an applied face-plate edge in profile.
  const edge=roundHead().getSpacedPoints(64).slice(0,-1),verts=[],faces=[],steps=8;
  for(let j=0;j<=steps;j++)for(const p of edge){
   const t=j/steps,angle=Math.atan2(p.y,p.x);
   verts.push(T.MathUtils.lerp(p.x*.465,Math.cos(angle)*.335,t),T.MathUtils.lerp(p.y*.42,Math.sin(angle)*.325-.035,t),-.035+.335*Math.sin(t*Math.PI/2));
  }
  for(let j=0;j<steps;j++)for(let i=0;i<edge.length;i++){const a=j*edge.length+i,b=j*edge.length+(i+1)%edge.length,d=a+edge.length,c=b+edge.length;faces.push(a,b,d,b,c,d);}
  const rimGeometry=new T.BufferGeometry();rimGeometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));rimGeometry.setIndex(faces);rimGeometry.computeVertexNormals();const rim=new T.Mesh(rimGeometry,mat(def.color));rim.castShadow=true;head.add(rim);
  ball(head,[.337,.327,.023],[0,-.035,.267],0xffe8d5);
  const fringe=new T.Shape();fringe.moveTo(-.321,.065);fringe.bezierCurveTo(-.28,.245,-.14,.292,0,.292);fringe.bezierCurveTo(.14,.292,.28,.245,.321,.065);
  fringe.lineTo(.165,.065);fringe.lineTo(.115,.238);fringe.lineTo(.125,.062);fringe.lineTo(-.125,.062);fringe.lineTo(-.115,.238);fringe.lineTo(-.165,.065);fringe.closePath();
  plate(head,fringe,[0,0,.292],0x302e30,.009,.003);
  for(const x of [-.18,.18])box(head,[.145,.013,.009],[x,-.065,.292],0x302e30,.005);
  // One red strip running over the hood and down its back, scalloped in side view.
  const comb=new T.Shape();comb.moveTo(-.10,.32);comb.quadraticCurveTo(-.13,.56,-.24,.49);comb.quadraticCurveTo(-.29,.47,-.28,.39);comb.quadraticCurveTo(-.45,.47,-.46,.30);comb.quadraticCurveTo(-.46,.24,-.41,.20);comb.quadraticCurveTo(-.52,.10,-.41,.04);comb.lineTo(-.29,.13);comb.lineTo(-.10,.32);
  const red=plate(head,comb,[-.038,0,0],0xf05c35,.076,.028);red.rotation.y=-Math.PI/2;
 }else{
  puff(head,roundHead(),[.36,.285,.275],[0,0,0],def.color);
  for(const x of [-.13,.13])ball(head,[.016,.027,.006],[x,-.015,.274],0x262b28);
  const beak=new T.Shape();beak.moveTo(0,.025);beak.lineTo(-.037,-.013);beak.lineTo(.037,-.013);beak.closePath();
  plate(head,beak,[0,-.055,.278],def.accent,.008,.003);
  const lower=new T.Shape();lower.moveTo(-.03,-.018);lower.lineTo(0,-.055);lower.lineTo(.03,-.018);lower.closePath();plate(head,lower,[0,-.055,.278],def.accent,.008,.003);
  const crest=new T.Shape();crest.moveTo(-.035,0);crest.bezierCurveTo(-.10,.065,-.055,.145,.058,.165);crest.quadraticCurveTo(.068,.16,.005,.10);crest.quadraticCurveTo(.085,.13,.068,.095);crest.quadraticCurveTo(.017,.048,.018,0);crest.closePath();
  plate(head,crest,[0,.267,-.025],def.color,.035,.006);
 }
 const tailShape=new T.Shape();tailShape.moveTo(-.055,0);tailShape.quadraticCurveTo(-.12,.15,-.02,.19);tailShape.quadraticCurveTo(.06,.16,.13,.15);tailShape.lineTo(.055,.07);tailShape.quadraticCurveTo(.19,-.005,.065,-.01);tailShape.closePath();
 const tail=plate(rig,tailShape,[0,chicken?.32:.245,chicken?-.275:-.20],def.color,.025,.012);tail.rotation.y=Math.PI;tail.rotation.x=-.4;if(!chicken)tail.scale.setScalar(.65);
 const arms=[];for(const side of [-1,1]){
  const pivot=new T.Group();pivot.position.set(side*(chicken?.30:.195),chicken?.67:.45,0);rig.add(pivot);
  const wing=new T.Shape();wing.moveTo(-.025,.025);wing.bezierCurveTo(.06,-.03,.15,-.17,.17,-.23);wing.quadraticCurveTo(.17,-.30,.09,-.26);wing.quadraticCurveTo(-.035,-.19,-.025,.025);
  const mesh=plate(pivot,wing,[0,0,0],def.color,.045,.015);mesh.scale.x=side;if(!chicken)mesh.scale.multiplyScalar(.62);arms.push(pivot);
 }
 const legs=[];for(const side of [-1,1]){
  const pivot=new T.Group();pivot.position.set(side*(chicken?.14:.11),.25,0);rig.add(pivot);
  // A flat zigzag glyph, including one simple foot rather than anatomical toes.
  const leg=new T.Shape();leg.moveTo(-.014,-.035);leg.lineTo(.016,-.039);leg.lineTo(-.015,-.10);leg.lineTo(.042,-.155);leg.lineTo(.018,-.202);leg.lineTo(.09,-.209);leg.lineTo(.09,-.24);leg.lineTo(-.018,-.24);leg.lineTo(-.033,-.21);leg.lineTo(.005,-.161);leg.lineTo(-.048,-.108);leg.closePath();
  const mesh=plate(pivot,leg,[0,0,.02],def.feet,.026,0);mesh.scale.x=side;legs.push(pivot);
 }
 const props=new T.Group();rig.add(props);const book=box(props,[.42,.29,.07],[0,.66,.39],0x769d94);const food=ball(props,[.11,.09,.11],[.24,.7,.37],0xdb9760);const vr=new T.Group();vr.position.set(0,.025,chicken?.34:.30);if(!chicken)vr.scale.setScalar(.85);head.add(vr);const vrFallback=box(vr,[.65,.22,.17],[0,0,0],0x455851);const broom=new T.Group();props.add(broom);box(broom,[.045,.85,.045],[.4,.53,.3],0xa67b52);box(broom,[.32,.17,.12],[.4,.1,.3],0xe5c882);
 return {...def,root,rig,body,head,arms,legs,props,book,food,vr,vrFallback,broom};}
