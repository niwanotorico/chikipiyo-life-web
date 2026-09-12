import {findPath} from './navigation.js';
import {actions} from './actions.js';
import {resolveInteraction,occupiedPosition,personalRadius} from './interactions.js';
export class LifeSimulation{
 constructor(characters,furniture,onEvent=()=>{}){
  Object.assign(this,{characters,furniture,obstacles:furniture.obstacles??furniture,onEvent,paused:false,time:0});
  for(const c of characters)Object.assign(c,{action:'idle',phase:'acting',remaining:1+Math.random()*2,path:[],target:null,elapsed:0,blockedTime:0,stuckTime:0,avoidTimer:0,avoidSide:1});
 }
 getTarget(c,id){return resolveInteraction(this.furniture.find(f=>f.id===id),c);}
 available(c,target){return target&&!this.characters.some(o=>o!==c&&o.target?.reservationKey===target.reservationKey);}
 command(c,id){
  let target=this.getTarget(c,id);if(c.dragging||!this.available(c,target)||!actions[target.action])return false;
  if(id==='vacuum'){
   let spot=null;
   for(let i=0;i<80;i++){const x=-4.5+Math.random()*9,z=-3.3+Math.random()*6.6;
    if(this.clearFloor(x,z,.85)&&this.clearPeople(c,x,z)&&findPath(c.root.position.toArray(),[x,0,z],this.obstacles).length){spot=[x,0,z];break;}}
   if(!spot)return false;target={...target,spot,face:Math.atan2(-spot[0],-spot[2])};
  }
  const path=findPath(c.root.position.toArray(),target.spot,this.obstacles);if(!path.length)return false;
  Object.assign(c,{target,path,phase:'walking',action:target.action,elapsed:0,blockedTime:0,stuckTime:0});
  this.onEvent(c.name+'が'+target.name+'へ向かいます');return true;
 }
 choose(c){
  const candidates=this.furniture.filter(f=>actions[f.action]&&this.available(c,this.getTarget(c,f.id))).sort(()=>Math.random()-.5);
  for(const target of candidates)if(this.command(c,target.id))return;
  Object.assign(c,{target:null,action:'idle',phase:'acting',remaining:2,elapsed:0});
 }
 clearFloor(x,z,margin=.20){return x>=-5.1+margin&&x<=5.1-margin&&z>=-3.9+margin&&z<=3.9-margin&&!this.obstacles.some(o=>Math.abs(x-o.position[0])<o.footprint[0]/2+margin&&Math.abs(z-o.position[2])<o.footprint[1]/2+margin);}
 clearPeople(c,x,z){return !this.characters.some(o=>{if(o===c)return false;const p=occupiedPosition(o);return Math.hypot(x-p[0],z-p[2])<personalRadius(c)+personalRadius(o);});}
 beginDrag(c){
  c.dragOrigin=c.root.position.clone();
  Object.assign(c,{dragging:true,target:null,path:[],action:'idle',phase:'acting',elapsed:0,remaining:1});
 }
 dragTo(c,point){
  if(!c.dragging||!this.clearFloor(point[0],point[2],personalRadius(c))||!this.clearPeople(c,point[0],point[2]))return false;
  c.root.position.set(point[0],0,point[2]);return true;
 }
 endDrag(c,cancel=false){
  if(!c.dragging)return;
  if(cancel)c.root.position.copy(c.dragOrigin);
  c.dragging=false;c.remaining=.8;c.dragOrigin=null;
  this.onEvent(c.name+'を床におろしました');
 }
 // クリック移動：床の一点へ歩き、着いたら通常の自律行動へ戻る。
 moveTo(c,point){
  const spot=[point[0],0,point[2]];
  if(!this.clearFloor(spot[0],spot[2]))return false;
  const path=findPath(c.root.position.toArray(),spot,this.obstacles);
  if(!path.length)return false;
  const target={id:'floor',name:'そこ',action:'idle',label:'移動する',activityLabel:'ここでひとやすみ',spot,
   face:Math.atan2(spot[0]-c.root.position.x,spot[2]-c.root.position.z),reservationKey:`floor:${c.id}`};
  Object.assign(c,{target,path,phase:'walking',action:'idle',elapsed:0,blockedTime:0,stuckTime:0,avoidTimer:0});
  this.onEvent(c.name+'がそこへ向かいます');return true;
 }
 // 前に人がいたら、左右どちらかへ一定時間だけ寄ってすれ違う（正面で止まり続けない）。
 avoidance(c,forward,dt){
  c.avoidTimer=Math.max(0,c.avoidTimer-dt);
  let near=null;
  for(const other of this.characters){
   if(other===c)continue;
   const q=occupiedPosition(other),ox=q[0]-c.root.position.x,oz=q[2]-c.root.position.z,dist=Math.hypot(ox,oz)||1e-6;
   if(dist<1.35&&(ox*forward[0]+oz*forward[1])/dist>.25&&(!near||dist<near.dist))near={ox,oz,dist};
  }
  if(!near)return [0,0];
  if(!c.avoidTimer){
   // ほぼ正面（cross≈0）なら全員が同じ体側へ寄るので必ずすれ違える。
   const cross=forward[0]*near.oz-forward[1]*near.ox;
   c.avoidSide=cross<-.15?-1:1;c.avoidTimer=1.4;
  }
  const strength=Math.max(0,Math.min(.18,(.9-near.dist)*.3));
  return [forward[1]*c.avoidSide*strength,-forward[0]*c.avoidSide*strength];
 }
 walk(c,dt){
  const p=c.path[0];
  if(!p){c.phase='acting';c.remaining=actions[c.action].duration;c.elapsed=0;this.onEvent(c.name+'：'+(c.target?.activityLabel??actions[c.action].label));return;}
  const dx=p[0]-c.root.position.x,dz=p[2]-c.root.position.z,d=Math.hypot(dx,dz);
  if(d<.055){c.path.shift();return;}
  const forward=[dx/d,dz/d],side=this.avoidance(c,forward,dt);
  const steer=[forward[0]+side[0],forward[1]+side[1]];
  // 斜め移動が家具の角をかすめたときは、目的地方向の縦横だけの移動で角をまわり込む。
  const slide=[[Math.sign(dx),0],[0,Math.sign(dz)]].filter(v=>v[0]||v[1]);
  const speed=Math.min(d,dt*.9);
  const directions=(side[0]||side[1])
   ?[steer,forward,...slide,[-forward[1],forward[0]],[forward[1],-forward[0]]]
   :[forward,...slide];
  let advanced=false;
  for(const [index,v] of directions.entries()){const length=Math.hypot(...v);if(!length)continue;
   const x=c.root.position.x+v[0]/length*speed,z=c.root.position.z+v[1]/length*speed;
   if(this.clearFloor(x,z)){c.root.position.x=x;c.root.position.z=z;this.turn(c,Math.atan2(forward[0],forward[1]),dt);advanced=index<=(side[0]||side[1]?1:0);break;}
  }
  // 角まわり込みや回避だけで進めていない間は、詰まり扱いにして経路を引き直す。
  c.blockedTime=advanced?0:c.blockedTime+dt;
  c.stuckTime=advanced?0:c.stuckTime+dt;
  // 引き直しても進めないまま長引いたら、止まり続けずに別の行動へ切り替える。
  if(c.stuckTime>5){c.stuckTime=0;c.blockedTime=0;c.target=null;c.path=[];this.onEvent(c.name+'は回り道をやめて、ほかのことにしました');this.choose(c);return;}
  if(c.blockedTime>.6){
   const path=findPath(c.root.position.toArray(),c.target.spot,this.obstacles);
   if(path.length)c.path=path;c.blockedTime=0;
  }
 }
 update(dt){if(this.paused)return;this.time+=dt;for(const c of this.characters){if(c.dragging)continue;c.elapsed+=dt;if(c.phase==='walking')this.walk(c,dt);else{if(c.target)this.turn(c,c.target.face,dt);c.remaining-=dt;if(c.remaining<=0){c.target=null;this.choose(c);}}}}
 turn(c,angle,dt){const delta=Math.atan2(Math.sin(angle-c.root.rotation.y),Math.cos(angle-c.root.rotation.y));c.root.rotation.y+=delta*Math.min(1,dt*9);}
}
