// ちきぴよクエスト v0.2：画面の演出（粒子・ポイントの飛行・揺れ・フラッシュ）。
// 粒子は 1 枚の canvas に描く。動いている粒子があるときだけ requestAnimationFrame を回し、上限数を決めて重くしない。
const TAU=Math.PI*2;
const COLORS={star:['#f5c542','#ffdf6e','#f29f3d'],dot:['#f0c552','#ffe08a'],feather:['#fff6d8','#ffe9a8','#fbd66b'],confetti:['#f28b82','#8ccf9f','#7fb8f0','#f5c542','#c8a2e8','#ff9fc4'],pudding:['#f6cf6c']};
const MAX=260;

export function prefersReducedMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}

export class Particles{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.list=[];this.raf=0;this.last=0;
  this.resize();addEventListener('resize',()=>this.resize());
 }
 resize(){
  const dpr=Math.min(2,devicePixelRatio||1);this.dpr=dpr;
  this.w=innerWidth;this.h=innerHeight;
  this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);
 }
 get count(){return this.list.length;}
 clear(){this.list.length=0;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}
 // x,y から放射状に。up は上向きの初速のかさ上げ
 burst(x,y,{count=20,kinds=['star','dot'],speed=420,up=160,life=.9,size=1,gravity=900}={}){
  for(let i=0;i<count&&this.list.length<MAX;i++){
   const kind=kinds[i%kinds.length],a=Math.random()*TAU,sp=speed*(.35+Math.random()*.75);
   this.add({kind,x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-up,life:life*(.7+Math.random()*.6),size:size*(kind==='pudding'?1.4:1),gravity:kind==='feather'?gravity*.18:gravity});
  }
  this.start();
 }
 // 画面上から降らせる（プリンの雨・紙ふぶき）
 rain({count=30,kinds=['confetti'],life=2.4}={}){
  for(let i=0;i<count&&this.list.length<MAX;i++){
   const kind=kinds[i%kinds.length];
   this.add({kind,x:Math.random()*this.w,y:-30-Math.random()*this.h*.5,vx:(Math.random()-.5)*80,vy:120+Math.random()*160,life:life*(.8+Math.random()*.4),size:kind==='pudding'?1.6:1,gravity:kind==='feather'?30:200});
  }
  this.start();
 }
 add(p){
  const palette=COLORS[p.kind]||COLORS.dot;
  this.list.push({...p,age:0,rot:Math.random()*TAU,vr:(Math.random()-.5)*(p.kind==='feather'?4:10),color:palette[Math.floor(Math.random()*palette.length)],sway:Math.random()*TAU});
 }
 start(){if(!this.raf){this.last=performance.now();this.raf=requestAnimationFrame(t=>this.frame(t));}}
 frame(now){
  const dt=Math.min(.05,(now-this.last)/1000);this.last=now;
  const c=this.ctx,dpr=this.dpr;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,this.w,this.h);
  const alive=[];
  for(const p of this.list){
   p.age+=dt;if(p.age>=p.life||p.y>this.h+60)continue;
   const drag=p.kind==='feather'?.9:p.kind==='confetti'?.96:.985;
   p.vx*=drag**(dt*60);p.vy=p.vy*drag**(dt*60)+p.gravity*dt;
   if(p.kind==='feather'||p.kind==='confetti'){p.sway+=dt*5;p.x+=Math.sin(p.sway)*40*dt;}
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
   const k=p.age/p.life,alpha=k<.7?1:1-(k-.7)/.3,scale=p.size*(k<.12?.4+k/.12*.6:1);
   c.save();c.globalAlpha=Math.max(0,alpha);c.translate(p.x,p.y);c.rotate(p.rot);c.scale(scale,scale);
   draw(c,p);c.restore();alive.push(p);
  }
  this.list=alive;
  if(alive.length)this.raf=requestAnimationFrame(t=>this.frame(t));
  else{this.raf=0;c.clearRect(0,0,this.w,this.h);}
 }
}

function draw(c,p){
 c.fillStyle=p.color;
 switch(p.kind){
  case 'star':{c.beginPath();for(let i=0;i<10;i++){const r=i%2?4.2:10,a=i*Math.PI/5-Math.PI/2;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();break;}
  case 'dot':{c.beginPath();c.arc(0,0,5,0,TAU);c.fill();c.fillStyle='#fff8';c.beginPath();c.arc(-1.6,-1.6,1.8,0,TAU);c.fill();break;}
  case 'feather':{ // 羽：しずく形＋羽軸
   c.beginPath();c.moveTo(0,-13);c.bezierCurveTo(8,-7,7,7,0,13);c.bezierCurveTo(-7,7,-8,-7,0,-13);c.fill();
   c.strokeStyle='#e0b24a';c.lineWidth=1.2;c.beginPath();c.moveTo(0,-11);c.lineTo(0,15);c.stroke();break;}
  case 'confetti':{c.fillRect(-5,-3,10,6);break;}
  case 'pudding':{ // 小さなプリン：お皿・カスタード・カラメル
   c.fillStyle='#ffffff';c.beginPath();c.ellipse(0,9,13,3.6,0,0,TAU);c.fill();
   c.fillStyle='#f6cf6c';c.beginPath();c.moveTo(-10,8);c.lineTo(-7,-5);c.quadraticCurveTo(0,-8,7,-5);c.lineTo(10,8);c.closePath();c.fill();
   c.fillStyle='#9a5a22';c.beginPath();c.moveTo(-7,-5);c.quadraticCurveTo(0,-9,7,-5);c.lineTo(6.5,-2);c.quadraticCurveTo(0,0,-6.5,-2);c.closePath();c.fill();
   break;}
 }
}

// DOM 要素の中心
export function centerOf(el){const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}

// 「+1 pt」を from から to へ弧を描いて飛ばす。着いたら onArrive
export function flyText(text,from,to,{className='dq-fly',duration=560,onArrive}={}){
 const el=document.createElement('span');el.className=className;el.textContent=text;el.setAttribute('aria-hidden','true');
 document.body.append(el);
 const a=centerOf(from),b=centerOf(to);
 const mid={x:(a.x+b.x)/2+(b.x>a.x?-40:40),y:Math.min(a.y,b.y)-70};
 const pos=(p,s)=>`translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${s})`;
 const anim=el.animate([
  {transform:pos(a,.6),opacity:0},
  {transform:pos({x:a.x,y:a.y-28},1.25),opacity:1,offset:.18},
  {transform:pos(mid,1),opacity:1,offset:.55},
  {transform:pos(b,.7),opacity:.9},
 ],{duration,easing:'cubic-bezier(.3,.1,.4,1)',fill:'forwards'});
 anim.onfinish=()=>{el.remove();onArrive?.();};
 return anim;
}

// 要素を一瞬ゆらす（テンキーには使わない：押し間違いを防ぐ）
export function shake(els,px){
 if(!px)return;
 const frames=[];for(let i=0;i<6;i++){const k=1-i/6;frames.push({transform:`translate(${(Math.random()*2-1)*px*k}px,${(Math.random()*2-1)*px*k}px)`});}
 frames.push({transform:'translate(0,0)'});
 for(const el of els)el?.animate(frames,{duration:280,easing:'linear'});
}

// クラスを付けなおしてアニメーションを最初から再生
export function replay(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}
