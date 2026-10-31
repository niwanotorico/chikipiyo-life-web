// ピヨドリル：問題と いっしょに 出す 図（SVG の 文字列）。DOM なし・テスト可能。
// 11月教材の「円と球」（コンパス・もよう・ボールの 箱）で つかう。
// 線の 色・太さは drill.css の .dq-fig で きめる（.ln ふつうの 線／.hl 太い 線／.sub うすい 線）。
const r1=n=>Math.round(n*10)/10;
const shuffle=(rng,list)=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const LABELS=['ア','イ','ウ'];
let seq=0;   // clipPath の id が かさならないように

// box：viewBox の 文字列 か [幅, 高さ]
function svg(box,label,body){return `<svg class="dq-fig" viewBox="${Array.isArray(box)?`0 0 ${box[0]} ${box[1]}`:box}" role="img" aria-label="${label}">${body}</svg>`;}
const circle=(x,y,r,cls='ln',extra='')=>`<circle class="${cls}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"${extra}/>`;
const line=(x1,y1,x2,y2,cls='ln')=>`<line class="${cls}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
const text=(x,y,s,cls='tx')=>`<text class="${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="middle" dominant-baseline="central">${s}</text>`;
// 点と 名前。名前は 点から (dx,dy) の 向きに はなして おく
const point=(x,y,name,dx,dy)=>`<circle class="pt" cx="${r1(x)}" cy="${r1(y)}" r="4"/>${text(x+dx,y+dy,name,'lb')}`;
// 点 (x,y) から 中心 (cx,cy) と 反対の 向きへ d だけ はなれた ところ（名前を 外がわに 書く）
const away=(x,y,cx,cy,d)=>{const vx=x-cx,vy=y-cy,n=Math.hypot(vx,vy)||1;return [vx/n*d,vy/n*d];};

// 円の 中心は どれ？（ア・イ・ウ の どれかが 中心、1つは 円の 上、1つは 円の 中の 中心でない 所）
export function centerFigure(rng){
 const cx=100,cy=78,R=60,a=rng()*Math.PI*2,b=a+Math.PI*(.6+rng()*.8);
 const pts=[
  {x:cx,y:cy,center:true},
  {x:cx+R*Math.cos(a),y:cy+R*Math.sin(a)},
  {x:cx+R*.5*Math.cos(b),y:cy+R*.5*Math.sin(b)},
 ];
 const names=shuffle(rng,LABELS);
 let body=circle(cx,cy,R);
 pts.forEach((p,i)=>{const [dx,dy]=p.center?[0,-17]:away(p.x,p.y,cx,cy,18);body+=point(p.x,p.y,names[i],dx,dy);});
 return {svg:svg('16 -6 168 168','円と 3つの 点',body),answer:names[0]};
}

// 花びらの もよう：大きな 円の まわりの 6つの 点を 中心にして、同じ 半径で 円の 一部を かく。
// 太い 線の 花びらを かいたときに はりを さした 点は どれ？（答え：その 円の 中心＝まわりの 点）
export function flowerFigure(rng){
 const cx=100,cy=100,R=58,k=Math.floor(rng()*6),id=`fc${++seq}`;
 const P=i=>{const t=Math.PI/180*(60*i-90);return {x:cx+R*Math.cos(t),y:cy+R*Math.sin(t)};};
 let body=`<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>`;
 body+=circle(cx,cy,R);
 body+=`<g clip-path="url(#${id})">`;
 for(let i=0;i<6;i++){const p=P(i);body+=circle(p.x,p.y,R,i===k?'hl':'sub');}
 body+='</g>';
 // ア・イ・ウ：花びらを かいた 中心（答え）／大きな 円の 中心（線が 通るだけ）／反対がわの 点
 const pts=[{...P(k),answer:true},{x:cx,y:cy,inner:true},P(k+3)];
 const names=shuffle(rng,LABELS);
 pts.forEach((p,i)=>{const [dx,dy]=p.inner?[15,-13]:away(p.x,p.y,cx,cy,18);body+=point(p.x,p.y,names[i],dx,dy);});
 return {svg:svg('16 16 168 168','コンパスで かいた 花びらの もよう',body),answer:names[0]};
}

// 正方形の もよう：4つの かどを 中心にして、正方形の 1辺を 半径に した 円の 一部を かく。
// 太い 線を かいたときに はりを さした かどは どれ？（まちがい：線の はしの かど／正方形の まん中）
export function squareArcFigure(rng){
 const x0=34,y0=26,S=132,k=Math.floor(rng()*4),id=`sq${++seq}`;
 const C=[[x0,y0],[x0+S,y0],[x0+S,y0+S],[x0,y0+S]];
 let body=`<defs><clipPath id="${id}"><rect x="${x0}" y="${y0}" width="${S}" height="${S}"/></clipPath></defs>`;
 body+=`<rect class="ln" x="${x0}" y="${y0}" width="${S}" height="${S}"/>`;
 body+=`<g clip-path="url(#${id})">`;
 C.forEach(([x,y],i)=>{body+=circle(x,y,S,i===k?'hl':'sub');});
 body+='</g>';
 const mx=x0+S/2,my=y0+S/2,end=C[(k+1)%4];
 const pts=[{x:C[k][0],y:C[k][1],answer:true},{x:end[0],y:end[1]},{x:mx,y:my,inner:true}];
 const names=shuffle(rng,LABELS);
 pts.forEach((p,i)=>{const [dx,dy]=p.inner?[0,-17]:away(p.x,p.y,mx,my,18);body+=point(p.x,p.y,names[i],dx,dy);});
 return {svg:svg('12 4 176 176','正方形と コンパスで かいた 線',body),answer:names[0]};
}

// 同じ 大きさの 円が n こ、ぴったり ならぶ（はしから はしまでの 長さを きく）
export function circlesRowFigure(n,radiusLabel){
 const r=26,x0=12,y=44,w=x0*2+n*r*2;
 let body='';
 for(let i=0;i<n;i++){const cx=x0+r+i*r*2;body+=circle(cx,y,r)+`<circle class="pt" cx="${cx}" cy="${y}" r="2.5"/>`;}
 body+=line(x0+r,y,x0+r*2,y,'hl')+text(x0+r*1.5,y-10,radiusLabel,'sm');
 body+=line(x0,y+r+14,w-x0,y+r+14,'ln')+line(x0,y+r+8,x0,y+r+20)+line(w-x0,y+r+8,w-x0,y+r+20)+text(w/2,y+r+28,'横 ？','sm');
 return svg([w,y+r+40],`円が ${n}こ ならんだ 図`,body);
}

// 長方形の 中に 同じ 大きさの 円が 3こ、となりの 円の 中心を 通るように かさなって ならぶ
export function circlesOverlapFigure(heightLabel){
 const r=26,x0=52,y0=14,w=x0+r*4+12;
 let body=`<rect class="ln" x="${x0}" y="${y0}" width="${r*4}" height="${r*2}"/>`;
 for(let i=0;i<3;i++){const cx=x0+r+i*r;body+=circle(cx,y0+r,r)+`<circle class="pt" cx="${cx}" cy="${y0+r}" r="2.5"/>`;}
 body+=text(x0-22,y0+r,heightLabel,'sm');
 body+=text(x0+r*2,y0+r*2+16,'横 ？','sm');
 return svg([w,y0+r*2+30],'長方形の 中に 円が 3こ かさなって ならんだ 図',body);
}

// ボールが たて rows こ・横 cols こ、ぴったり 入った 箱を 真上から 見た 図
export function ballsBoxFigure(rows,cols,radiusLabel){
 const r=18,x0=44,y0=24,w=x0+cols*r*2+14,h=y0+rows*r*2+30;
 let body=`<rect class="ln" x="${x0}" y="${y0}" width="${cols*r*2}" height="${rows*r*2}"/>`;
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const cx=x0+r+j*r*2,cy=y0+r+i*r*2;body+=circle(cx,cy,r,'ball')+`<circle class="pt" cx="${cx}" cy="${cy}" r="2"/>`;}
 body+=line(x0+r,y0+r,x0+r*2,y0+r,'hl')+text(x0+r*1.5,y0-11,`半径 ${radiusLabel}`,'sm');   // 半径の 名前は 箱の 上（ボールに かさねない）
 body+=text(x0-20,y0+rows*r,'たて','sm')+text(x0+cols*r,y0+rows*r*2+16,'横','sm');
 return svg([w,h],'ボールが 箱に 入った 図（真上から）',body);
}
