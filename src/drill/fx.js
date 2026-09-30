// ピヨドリル v0.2：画面の演出（粒子・ポイントの飛行・揺れ・フラッシュ）。
// 粒子は 1 枚の canvas に描く。動いている粒子があるときだけ requestAnimationFrame を回し、上限数を決めて重くしない。
const TAU=Math.PI*2;
const LINE='#c08a64',YOLK='#ffc94d',KETCH='#ee7462',WHITE='#fffefa',OMELET='#ffdf80',CHEEK='#ffd3c8';
const COLORS={fried:[WHITE],drop:[KETCH],omu:[OMELET],heart:[KETCH,'#f59a8b'],star:['#f5c542','#ffdf6e','#f29f3d'],dot:['#f0c552','#ffe08a'],feather:['#fff6d8','#ffe9a8','#fbd66b'],confetti:['#f28b82','#8ccf9f','#7fb8f0','#f5c542','#c8a2e8','#ff9fc4'],pudding:['#f6cf6c']};
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
 // ring：中心から少し離れたところから出す（答えの上に粒を重ねない）
 burst(x,y,{count=20,kinds=['star','dot'],speed=420,up=160,life=.9,size=1,gravity=900,ring=0}={}){
  for(let i=0;i<count&&this.list.length<MAX;i++){
   const kind=kinds[i%kinds.length],a=Math.random()*TAU,sp=speed*(.35+Math.random()*.75);
   this.add({kind,x:x+Math.cos(a)*ring,y:y+Math.sin(a)*ring*.6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-up,life:life*(.7+Math.random()*.6),size:size*(kind==='pudding'?1.4:1),gravity:kind==='feather'?gravity*.18:gravity});
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
 // 大きな目玉焼き：その場で ぽんっと出て、黄身が ぷるぷるして消える
 bigEgg(x,y,r=40,life=1.2){if(this.list.length<MAX){this.list.push({kind:'bigegg',x,y,r,age:0,life,vx:0,vy:0,gravity:0,rot:(Math.random()-.5)*.4,vr:0,size:1,sway:Math.random()*TAU});this.start();}}
 // 画面の下から ほっぺ付きのたまごが ぽこぽこ跳ねる（テンキーの上を一瞬通るだけ）
 hopEggs(n=5,{life=.7}={}){
  const bw=this.w/n;
  for(let i=0;i<n&&this.list.length<MAX;i++)this.list.push({kind:'hopegg',x:bw*(i+.5),y:this.h,w:Math.min(bw*.3,44),h:this.h*(.08+Math.random()*.16),age:-i*.03,life,vx:0,vy:0,gravity:0,rot:0,vr:0,size:1,crack:Math.random()<.3,sway:Math.random()*TAU});
  this.start();
 }
 // すべての粒を すっと消す（さいごの1もんの前に画面を片付ける）
 fadeAll(sec=.35){for(const p of this.list){p.life=Math.min(p.life,p.age+sec);}}
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
   p.age+=dt;if(p.age>=p.life||p.y>this.h+80)continue;
   if(p.kind==='bigegg'||p.kind==='hopegg'){if(p.age>=0){c.save();special(c,p);c.restore();}alive.push(p);continue;}
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

// ---- 卵料理 ----
function blob(c,r,ph){c.beginPath();for(let i=0;i<=24;i++){const a=i/24*TAU,rr=r*(1+Math.sin(a*5+ph)*.08+Math.sin(a*3+ph*2)*.06);c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();}
function fried(c,r,ph,jig){
 c.lineWidth=Math.max(1.5,r*.09);c.strokeStyle=LINE;blob(c,r,ph);c.fillStyle=WHITE;c.fill();c.stroke();
 const j=1+Math.sin(jig)*.08;c.save();c.translate(r*.08,-r*.05);c.scale(j,2-j);
 c.beginPath();c.arc(0,0,r*.42,0,TAU);c.fillStyle=YOLK;c.fill();c.stroke();
 c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.ellipse(-r*.14,-r*.14,r*.12,r*.07,-.6,0,TAU);c.fill();c.restore();
}
function hopEgg(c,w,h,crack){
 c.lineWidth=2.5;c.strokeStyle=LINE;c.fillStyle=WHITE;
 c.beginPath();c.moveTo(0,-h);c.bezierCurveTo(w,-h,w,h*.9,0,h*.9);c.bezierCurveTo(-w,h*.9,-w,-h,0,-h);c.fill();c.stroke();
 if(crack){c.beginPath();c.moveTo(-w*.7,-h*.1);for(let i=1;i<=6;i++)c.lineTo(-w*.7+i*w*.23,-h*.1+(i%2?-h*.18:0));c.stroke();}
 c.fillStyle=CHEEK;c.beginPath();c.ellipse(-w*.45,h*.25,w*.16,h*.08,0,0,TAU);c.ellipse(w*.45,h*.25,w*.16,h*.08,0,0,TAU);c.fill();
}
function special(c,p){
 const k=p.age/p.life;
 if(p.kind==='bigegg'){
  const sc=k<.14?k/.14*1.1:1+Math.sin(k*30)*.04*(1-k),a=k<.75?1:1-(k-.75)/.25;
  c.globalAlpha=Math.max(0,a);c.translate(p.x,p.y);c.scale(sc,sc);c.rotate(p.rot+Math.sin(p.age*4)*.12);fried(c,p.r,p.sway,p.age*18);return;
 }
 const up=Math.sin(Math.PI*Math.min(1,k));   // hopegg：跳ねて もどる
 c.translate(p.x,p.y+p.w*1.3-(p.h+p.w*1.5)*up);c.rotate(Math.sin(k*9+p.x)*.2);hopEgg(c,p.w,p.w*1.25,p.crack);
}

function draw(c,p){
 c.fillStyle=p.color;
 switch(p.kind){
  case 'fried':{fried(c,17,p.sway,p.age*12);break;}
  case 'drop':{ // ケチャップのしずく
   c.fillStyle=KETCH;c.beginPath();c.moveTo(0,-12);c.bezierCurveTo(8.5,-1,8.5,8.5,0,8.5);c.bezierCurveTo(-8.5,8.5,-8.5,-1,0,-12);c.fill();
   c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.ellipse(-2.4,1.8,1.2,2.2,0,0,TAU);c.fill();break;}
  case 'omu':{ // ミニオムライス：お皿＋たまご＋ケチャップのジグザグ
   const r=15;c.lineWidth=1.6;c.strokeStyle=LINE;
   c.fillStyle=WHITE;c.beginPath();c.ellipse(0,r*.45,r*1.15,r*.35,0,0,TAU);c.fill();c.stroke();
   c.fillStyle=OMELET;c.beginPath();c.moveTo(-r,r*.45);c.bezierCurveTo(-r,-r*.8,r,-r*.8,r,r*.45);c.closePath();c.fill();c.stroke();
   c.strokeStyle=KETCH;c.lineWidth=2.6;c.lineCap='round';c.beginPath();
   for(let i=0;i<=6;i++){const x=-r*.6+i*r*.2,y=-r*.15+(i%2?-r*.18:r*.1);i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();break;}
  case 'heart':{const r=14;c.beginPath();c.moveTo(0,r*.35);c.bezierCurveTo(r*1.1,-r*.4,r*.45,-r*1.1,0,-r*.45);c.bezierCurveTo(-r*.45,-r*1.1,-r*1.1,-r*.4,0,r*.35);c.closePath();c.fill();break;}
  case 'star':{c.beginPath();for(let i=0;i<10;i++){const r=i%2?6:14,a=i*Math.PI/5-Math.PI/2;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();break;}
  case 'dot':{c.beginPath();c.arc(0,0,5,0,TAU);c.fill();c.fillStyle='#fff8';c.beginPath();c.arc(-1.6,-1.6,1.8,0,TAU);c.fill();break;}
  case 'feather':{ // 羽：しずく形＋羽軸
   c.beginPath();c.moveTo(0,-13);c.bezierCurveTo(8,-7,7,7,0,13);c.bezierCurveTo(-7,7,-8,-7,0,-13);c.fill();
   c.strokeStyle='#e0b24a';c.lineWidth=1.2;c.beginPath();c.moveTo(0,-11);c.lineTo(0,15);c.stroke();break;}
  case 'confetti':{c.fillRect(-5,-3,10,6);break;}
  case 'pudding':{ // 小さなプリン：お皿・カスタード・カラメル
   c.scale(1.4,1.4);
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
