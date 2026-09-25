import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {fbm3,noise,rng,smooth} from './noise.js';
import {heightAt,bankDistance,riverCenter} from './terrain.js';
import {patchWind,patchFoliage} from './materials.js';

// ─────────────────────────────────────────────────────────────
// 渓流の植生：セミスタイライズの木（絵本っぽいけれど自然）。
//  - 幹：曲がり・テーパー・根張り・枝分かれ（TubeGeometry を半径だけ手で整形）
//  - 葉：大小の「葉房」を枝先に配置し、樹冠の中心から外向きの“球状法線”で柔らかく陰影
//  - 樹種：丸い広葉樹 / 縦長の広葉樹 / 川へ張り出す広葉樹 / 杉（縦長の針葉樹）/ モミ / 若木 / 低木
//  - すべて InstancedMesh。近景＝高精細、遠景＝低ポリの 2 段 LOD をカメラ位置で振り分け
// ─────────────────────────────────────────────────────────────

const lerp=(a,b,t)=>a+(b-a)*t;
const mix3=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];

// palette (linear)。インスタンス色は白に近い乗算だけにして、色味はここで決める
const BARK=[.13,.095,.066],BARK_DARK=[.05,.042,.033],BARK_MOSS=[.05,.08,.026];
const LEAF={ // [陰, 中間, 日向]
 fresh:[[.022,.058,.018],[.06,.135,.024],[.13,.205,.04]],
 green:[[.015,.048,.022],[.042,.108,.026],[.1,.178,.04]],
 deep:[[.01,.036,.024],[.03,.085,.034],[.072,.14,.05]],
 needle:[[.008,.028,.02],[.021,.066,.034],[.055,.118,.046]],
};
const tone=(pal,t)=>(t=Math.min(Math.max(t,0),1))<.5?mix3(pal[0],pal[1],t*2):mix3(pal[1],pal[2],(t-.5)*2);

function keepAttrs(g,col,normals){
 g.setAttribute('color',new T.Float32BufferAttribute(col,3));
 if(normals)g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal'&&k!=='color')g.deleteAttribute(k);
 return g;
}

// 幹・枝：中心線に沿ったチューブ。根元は3つの根張りで広げる
function limb(pts,r0,r1,{radial=6,flare=0,seed=0,moss=0}={}){
 const curve=new T.CatmullRomCurve3(pts,false,'centripetal'),len=curve.getLength();
 const seg=Math.max(2,Math.min(9,Math.round(len/.55)));
 const g=new T.TubeGeometry(curve,seg,1,radial,false);
 const p=g.attributes.position,col=[],P=new T.Vector3(),v=new T.Vector3();
 for(let i=0;i<=seg;i++){
  const t=i/seg,y=t*len;curve.getPointAt(t,P);
  const r=lerp(r0,r1,Math.pow(t,.8)),fl=flare*Math.pow(Math.max(0,1-y/1.05),2.2);
  for(let j=0;j<=radial;j++){
   const k=i*(radial+1)+j,a=j/radial*Math.PI*2;
   const rr=r*(1+.07*Math.sin(a*3+i*1.3+seed))*(1+fl*(1+.6*Math.cos(a*3+seed)));
   v.fromBufferAttribute(p,k).sub(P).multiplyScalar(rr).add(P);p.setXYZ(k,v.x,v.y,v.z);
   const streak=.84+.3*Math.abs(Math.sin(a*2.5+i*.8+seed));
   let c=mix3(BARK_DARK,BARK,smooth(.2+t*1.6));
   if(moss)c=mix3(c,BARK_MOSS,moss*(1-smooth(y/1.5))*(.45+.55*Math.max(0,Math.cos(a-seed))));
   col.push(c[0]*streak,c[1]*streak,c[2]*streak);
  }
 }
 return keepAttrs(g,col);
}

// 葉房：ノイズで崩した低ポリ球。法線は「樹冠中心からの向き」と混ぜて柔らかくまとめる
function clump(c,r,{detail=1,seed=0,pal,center,span,squash=.94,shade=1}){
 let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);
 const p=g.attributes.position,nor=new Float32Array(p.count*3),col=[],v=new T.Vector3(),w=new T.Vector3(),o=new T.Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);
  const k=1+.34*fbm3(v.x*2.3+seed*3.1,v.y*2.3,v.z*2.3+seed,2);
  w.set(v.x*k*r,(v.y<0?v.y*.74:v.y)*k*r*squash,v.z*k*r).add(c);p.setXYZ(i,w.x,w.y,w.z);
  o.subVectors(w,center).divide(span);const dn=o.length();
  o.normalize().multiplyScalar(.5).addScaledVector(v,.5).normalize();nor.set([o.x,o.y,o.z],i*3);
  const hy=T.MathUtils.clamp((w.y-center.y)/span.y*.5+.5,0,1);
  const t=.12+.5*hy+.28*Math.max(v.y,0)+.12*fbm3(w.x*1.3,w.y*1.3,w.z*1.3,2);
  const ao=(.55+.45*smooth(dn*1.1))*(.72+.28*(v.y*.5+.5))*shade,cc=tone(pal,t);
  col.push(cc[0]*ao,cc[1]*ao,cc[2]*ao);
 }
 return keepAttrs(g,col,nor);
}
function canopy(specs,{detail,pal,seed,shadeVar=.18,R}){
 const box=new T.Box3();for(const s of specs)box.expandByPoint(s.c);
 const center=box.getCenter(new T.Vector3()),span=box.getSize(new T.Vector3()).multiplyScalar(.5).addScalar(.9);
 return specs.map((s,i)=>clump(s.c,s.r,{detail,seed:seed*13+i,pal:s.pal||pal,center,span,shade:1-shadeVar*.5+R()*shadeVar}));
}

// ── 広葉樹（丸い / 縦長 / 川へ張り出す / 若木）
const BROAD={
 round:{H:3,r:.2,nb:4,bl:[1.3,2],by:[.55,.85],up:.75,cr:[.78,1.12],top:3,fill:3,sat:1,pal:'green'},
 tall:{H:4.6,r:.21,nb:5,bl:[.85,1.35],by:[.4,.88],up:1.3,cr:[.66,.95],top:3,fill:3,sat:1,pal:'deep'},
 spread:{H:2.5,r:.23,nb:4,bl:[1.8,2.6],by:[.6,.9],up:.42,cr:[.74,1.05],top:2,fill:3,sat:1,pal:'fresh'},
 sapling:{H:1.5,r:.07,nb:2,bl:[.45,.75],by:[.55,.8],up:.8,cr:[.36,.52],top:2,fill:0,sat:1,pal:'fresh'},
};
function broadleaf(shape,seed,lod){
 const S=BROAD[shape],R=rng(seed*977+13),hi=lod===0;
 const H=S.H*(.9+R()*.22),bend=(.14+R()*.26)*(shape==='spread'?1.8:1),ba=R()*6.28,bx=Math.cos(ba),bz=Math.sin(ba);
 const tp=[];for(let i=0;i<=4;i++){const t=i/4,s=Math.sin(t*Math.PI*1.05)*bend*t;tp.push(new T.Vector3(bx*s+(R()-.5)*.08*t,-.5+(H+.5)*t,bz*s+(R()-.5)*.08*t));}
 const parts=[limb(tp,S.r,S.r*.42,{radial:hi?7:4,flare:hi?.95:.55,seed,moss:shape==='sapling'?0:.85})];
 const trunk=new T.CatmullRomCurve3(tp,false,'centripetal'),specs=[],top=trunk.getPointAt(1);
 const lift=new T.Vector3();
 for(let b=0;b<S.nb;b++){
  const t=lerp(S.by[0],S.by[1],S.nb>1?b/(S.nb-1):.5)+(R()-.5)*.06,start=trunk.getPointAt(t);
  const a=b/S.nb*6.28+ba+R()*.9,L=lerp(S.bl[0],S.bl[1],R()),dir=new T.Vector3(Math.cos(a),0,Math.sin(a));
  const mid=start.clone().addScaledVector(dir,L*.45).add(lift.set(0,L*S.up*.35,0));
  const tip=start.clone().addScaledVector(dir,L).add(lift.set((R()-.5)*.2,L*S.up,(R()-.5)*.2));
  const br=Math.max(.035,S.r*.55*(1-t*.35));
  if(hi)parts.push(limb([start,mid,tip],br,br*.3,{radial:4,seed:seed+b}));
  const r=lerp(S.cr[0],S.cr[1],R());specs.push({c:tip.clone().add(lift.set(0,r*.2,0)),r,key:true});
  for(let s=0;s<S.sat;s++){const sa=a+(R()-.5)*2.2,sr=r*(.55+R()*.25);
   specs.push({c:tip.clone().add(lift.set(Math.cos(sa)*r*.85,(R()-.3)*r*.7,Math.sin(sa)*r*.85)),r:sr,key:false});}
 }
 for(let i=0;i<S.top;i++){const a=R()*6.28,d=R()*.55;
  specs.push({c:top.clone().add(lift.set(Math.cos(a)*d,.35+R()*.55,Math.sin(a)*d)),r:lerp(S.cr[0],S.cr[1],R())*1.02,key:true});}
 const box=new T.Box3();for(const s of specs)box.expandByPoint(s.c);const cc=box.getCenter(new T.Vector3()),hs=box.getSize(new T.Vector3()).multiplyScalar(.5);
 for(let i=0;i<S.fill;i++)specs.push({c:cc.clone().add(lift.set((R()-.5)*hs.x*.9,(R()-.5)*hs.y*.7,(R()-.5)*hs.z*.9)),r:lerp(S.cr[0],S.cr[1],R())*1.12,key:true});
 // 遠景は小さな葉房を省き、残りを少し膨らませてシルエットを保つ
 for(const s of specs)if(R()<.22)s.pal=R()<.5?LEAF.fresh:LEAF.deep;
 const use=hi?specs:specs.filter(s=>s.key).map(s=>({...s,r:s.r*1.18})),pal=LEAF[S.pal];
 parts.push(...canopy(use,{detail:hi?1:0,pal,seed,R}));
 return mergeGeometries(parts);
}

// ── 針葉樹：星形に垂れる段を重ねる（杉＝縦長、モミ＝裾広がり）
const CONIFER={
 cedar:{H:9.6,base:1.6,r0:1.5,tiers:9,spk:7,rt:.2},
 fir:{H:6.8,base:1.1,r0:2.15,tiers:7,spk:8,rt:.22},
};
function tier(y,r,h,spk,rot,hi,R,axisY){
 const pos=[],col=[],idx=[],pal=LEAF.needle;
 const add=(x,yy,z,t)=>{pos.push(x,yy,z);const c=tone(pal,t);col.push(...c);return pos.length/3-1;};
 const apex=add(0,y+h,0,.62),n=spk*2;
 const ring=(rad,yy,alt,t,dr)=>Array.from({length:n},(_,j)=>{const a=rot+j/n*Math.PI*2,o=j%2===0,rr=rad*(o?1:alt)*(1+(R()-.5)*.14);
  return add(Math.cos(a)*rr,yy-(o?dr:0),Math.sin(a)*rr,o?t:t-.25);});
 const rim=ring(r,y,.6,.78,r*.2),under=add(0,y+h*.2,0,.02);
 const rings=hi?[[apex],ring(r*.55,y+h*.5,.72,.55,r*.05),rim]:[[apex],rim];
 const P=i=>new T.Vector3(pos[i*3],pos[i*3+1],pos[i*3+2]);
 const tri=(a,b,c,ref)=>{const A=P(a),B=P(b),C=P(c),nrm=B.clone().sub(A).cross(C.clone().sub(A)),cen=A.add(B).add(C).divideScalar(3);
  if(nrm.dot(cen.sub(ref))<0)idx.push(a,c,b);else idx.push(a,b,c);};
 const refUp=new T.Vector3(0,y-h,0),refDown=new T.Vector3(0,y+h*1.5,0);
 for(let L=1;L<rings.length;L++){const A=rings[L-1],B=rings[L];
  for(let j=0;j<n;j++){const j1=(j+1)%n;
   if(A.length===1)tri(A[0],B[j],B[j1],refUp);else{tri(A[j],B[j],B[j1],refUp);tri(A[j],B[j1],A[j1],refUp);}}}
 for(let j=0;j<n;j++)tri(rim[j],under,rim[(j+1)%n],refDown);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 const nm=g.attributes.normal,v=new T.Vector3(),o=new T.Vector3();
 for(let i=0;i<nm.count;i++){v.fromBufferAttribute(nm,i);o.set(pos[i*3],(pos[i*3+1]-axisY)*.35+.25,pos[i*3+2]).normalize();v.lerp(o,.55).normalize();nm.setXYZ(i,v.x,v.y,v.z);}
 return keepAttrs(g,col);
}
function conifer(shape,seed,lod){
 const S=CONIFER[shape],R=rng(seed*631+7),hi=lod===0,H=S.H*(.88+R()*.24);
 const lean=(R()-.5)*.25,la=R()*6.28;
 const tp=[new T.Vector3(0,-.5,0),new T.Vector3(Math.cos(la)*lean*.3,H*.5,Math.sin(la)*lean*.3),new T.Vector3(Math.cos(la)*lean,H,Math.sin(la)*lean)];
 const parts=[limb(tp,S.rt,.05,{radial:hi?6:4,flare:hi?.8:.45,seed,moss:.5})];
 const trunk=new T.CatmullRomCurve3(tp),n=hi?S.tiers:Math.ceil(S.tiers*.6);
 for(let i=0;i<n;i++){
  const f=i/(n-1),y=S.base+(H-S.base-1.1)*Math.pow(f,.92),r=S.r0*(1-f*.84)*(.9+R()*.2)*(hi?1:1.08);
  const h=lerp(1.7,1.05,f)*(H/9)*(hi?1:1.25),c=trunk.getPointAt(Math.min(1,(y+.5)/(H+.5)));
  const g=tier(0,r,h,hi?S.spk:5,R()*6.28,hi,R,(H*.5-y));
  g.translate(c.x,y,c.z);parts.push(g);
 }
 return mergeGeometries(parts);
}

// ── 低木：地面に寄り添う葉房のかたまり
function shrub(seed,lod){
 const R=rng(seed*211+3),hi=lod===0,specs=[],n=hi?4+Math.floor(R()*3):3;
 for(let i=0;i<n;i++){const a=i/n*6.28+R(),d=i?.35+R()*.45:0;specs.push({c:new T.Vector3(Math.cos(a)*d,.32+R()*.35,Math.sin(a)*d),r:(.42+R()*.3)*(hi?1:1.25)});}
 for(const s of specs)if(R()<.3)s.pal=LEAF.fresh;
 return mergeGeometries(canopy(specs,{detail:hi?1:0,pal:LEAF.green,seed,R,shadeVar:.25}));
}

// 1 種類ぶんの [近景, 遠景] ジオメトリ
export function treeGeometry(kind,seed,lod=0){
 if(BROAD[kind])return broadleaf(kind,seed,lod);
 if(CONIFER[kind])return conifer(kind,seed,lod);
 if(kind==='bush')return shrub(seed,lod);
 throw new Error('unknown tree kind '+kind);
}
export const TREE_KINDS=[...Object.keys(BROAD),...Object.keys(CONIFER),'bush'];

function grassTuft(){
 const R=rng(5),pos=[],col=[],nor=[],idx=[];
 for(let b=0;b<6;b++){
  const a=R()*Math.PI,h=.28+R()*.4,w=.035+R()*.02,lean=(R()-.5)*.5,ox=(R()-.5)*.18,oz=(R()-.5)*.18,ca=Math.cos(a),sa=Math.sin(a);
  const base=pos.length/3;
  for(let s=0;s<=3;s++){const t=s/3,ww=w*(1-t),y=h*t,bend=lean*t*t*h;
   for(const side of [-1,1]){pos.push(ox+ca*ww*side+sa*bend,y,oz+sa*ww*side-ca*bend);nor.push(0,1,0);col.push(.07+.3*t,.13+.33*t,.03+.1*t);}}
  for(let s=0;s<3;s++){const i=base+s*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);
 return g;
}

// 近景/遠景の 2 段 LOD。インスタンスの行列と色を保持し、カメラ位置で振り分け直す
function lodPair(name,hiGeo,loGeo,mat,items){
 const n=items.length,M=new Float32Array(n*16),C=new Float32Array(n*3),X=new Float32Array(n*2),near=new Uint8Array(n);
 items.forEach((it,i)=>{M.set(it.m.elements,i*16);C.set(it.c,i*3);X[i*2]=it.x;X[i*2+1]=it.z;});
 const mk=(geo,suffix)=>{const im=new T.InstancedMesh(geo,mat,Math.max(n,1));im.name=name+suffix;
  im.instanceMatrix.setUsage(T.DynamicDrawUsage);im.instanceColor=new T.InstancedBufferAttribute(new Float32Array(Math.max(n,1)*3),3);im.instanceColor.setUsage(T.DynamicDrawUsage);
  im.castShadow=true;im.receiveShadow=true;im.count=0;return im;};
 const hi=mk(hiGeo,'-near'),lo=mk(loGeo,'-far');
 function assign(cx,cz,rIn,rOut){
  let a=0,b=0;const ri=rIn*rIn,ro=rOut*rOut;
  for(let i=0;i<n;i++){const dx=X[i*2]-cx,dz=X[i*2+1]-cz,d2=dx*dx+dz*dz,isNear=near[i]?d2<ro:d2<ri;near[i]=isNear?1:0;
   const dst=isNear?hi:lo,j=isNear?a++:b++;dst.instanceMatrix.array.set(M.subarray(i*16,i*16+16),j*16);dst.instanceColor.array.set(C.subarray(i*3,i*3+3),j*3);}
  hi.count=a;lo.count=b;
  for(const im of [hi,lo]){im.instanceMatrix.needsUpdate=true;im.instanceColor.needsUpdate=true;im.boundingSphere=null;if(im.count)im.computeBoundingSphere();im.visible=im.count>0;}
 }
 return {hi,lo,assign,count:n};
}

const PROFILES={
 desktop:{scale:1,near:38,variants:{round:2,tall:1,spread:1,sapling:1,cedar:2,fir:1,bush:2}},
 mobile:{scale:.55,near:28,variants:{round:1,tall:1,spread:1,sapling:1,cedar:1,fir:1,bush:1}},
};
const COUNTS={round:520,tall:250,spread:130,sapling:300,cedar:470,fir:250,bush:560};

export function createVegetation(shared,{mobile=false,clear=[],focus=null,viewer=null}={}){
 const prof=mobile?PROFILES.mobile:PROFILES.desktop;
 const blocked=(x,z,pad=0)=>clear.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+pad);
 const fx=focus?focus.x:riverCenter(66),fz=focus?focus.z:66;
 const group=new T.Group();group.name='RiverVegetation';const R=rng(99);
 const leafMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0});patchFoliage(leafMat,shared,{amp:.016,base:1.6});
 const grassMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0,side:T.DoubleSide});patchWind(grassMat,shared,{amp:.12,base:.05,key:'grass'});
 const m=new T.Matrix4(),q=new T.Quaternion(),ql=new T.Quaternion(),s=new T.Vector3(),p=new T.Vector3(),c=new T.Color(),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
 const slope=(x,z)=>Math.abs(heightAt(x+1,z)-heightAt(x-1,z))/2+Math.abs(heightAt(x,z+1)-heightAt(x,z-1))/2;
 const tint=()=>{const v=.88+R()*.24,h=(R()-.5)*.16;c.setRGB(v*(1+h),v,v*(1-h*1.3),T.LinearSRGBColorSpace);return [c.r,c.g,c.b];};
 // 樹種ごとの生える場所（岸からの距離 d、標高 alt、群落ノイズ、釣り場からの距離 near）
 const dens={
  round:(d,alt,gr)=>smooth((d-2.2)/3)*gr*(1-.7*alt),
  tall:(d,alt,gr)=>smooth((d-4)/4)*(1-gr*.6)*(1-.5*alt),
  spread:(d)=>smooth((d-1.9)/1.2)*(1-smooth((d-6)/3))*.9,
  sapling:(d,alt,gr,nr)=>smooth((d-1.3)/1.5)*(1-smooth((d-10)/8))*(.25+.75*nr),
  cedar:(d,alt,gr)=>smooth((d-3)/3)*(.12+.88*alt)*(.45+.55*(1-gr)),
  fir:(d,alt)=>smooth((d-4)/4)*smooth((alt-.25)/.5)*.8,
  bush:(d,alt,gr,nr)=>smooth((d-.5)/.8)*(1-smooth((d-9)/6))*(.3+.7*nr),
 };
 const scaleOf={round:[.8,1.25],tall:[.85,1.2],spread:[.85,1.2],sapling:[.7,1.2],cedar:[.85,1.3],fir:[.8,1.2],bush:[.5,1.1]};
 const lods=[];
 for(const kind of Object.keys(COUNTS)){
  const nv=prof.variants[kind],target=Math.round(COUNTS[kind]*prof.scale),small=kind==='bush'||kind==='sapling';
  const items=Array.from({length:nv},()=>[]);let k=0,guard=0;
  while(k<target&&guard++<target*120){
   const x=(R()*2-1)*88,z=(R()*2-1)*148,d=bankDistance(x,z);
   if(d<(small?.6:1.9)||blocked(x,z,small?.8:2.5))continue;
   const h=heightAt(x,z);if(slope(x,z)>(small?1.2:1.3))continue;
   const alt=smooth((h-3)/7),gr=.5+.5*noise(x*.045+3.1,z*.045),nr=1-smooth((Math.hypot(x-fx,z-fz)-25)/45);
   if(R()>dens[kind](d,alt,gr,nr))continue;
   const [s0,s1]=scaleOf[kind],sc=lerp(s0,s1,R()),toRiver=Math.sign(riverCenter(z)-x);
   const lean=kind==='spread'?.22+R()*.2:kind==='bush'?0:smooth(1-(d-2.2)/6)*(kind==='cedar'||kind==='fir'?.05:.18);
   q.setFromAxisAngle(Y,R()*6.28);ql.setFromAxisAngle(Z,-toRiver*lean);q.premultiply(ql);
   p.set(x,h-(small?.1:.25),z);s.set(sc,sc*(.9+R()*.25),sc);m.compose(p,q,s);
   items[k%nv].push({m:m.clone(),c:tint(),x,z});k++;
  }
  items.forEach((list,vi)=>{
   const seed=({round:1,tall:4,spread:6,sapling:8,cedar:3,fir:9,bush:11})[kind]+vi*17;
   const pair=lodPair(`${kind}${vi}`,treeGeometry(kind,seed,0),treeGeometry(kind,seed,1),leafMat,list);
   group.add(pair.hi,pair.lo);lods.push(pair);
  });
 }
 // 草むら（釣り場まわりに集中）
 const gn=mobile?6000:14000,grass=new T.InstancedMesh(grassTuft(),grassMat,gn);let k=0,guard=0;
 const e=new T.Euler();
 while(k<gn&&guard++<200000){const z=5+R()*125,x=riverCenter(z)+(R()*2-1)*34,d=bankDistance(x,z);if(d<.5||blocked(x,z,-1))continue;const h=heightAt(x,z);if(h<.3||slope(x,z)>1.2)continue;
  const sc=.7+R()*.9;p.set(x,h-.02,z);e.set(0,R()*6.28,0);q.setFromEuler(e);s.set(sc,sc*(.7+R()*.6),sc);m.compose(p,q,s);grass.setMatrixAt(k,m);c.setHSL(.2+R()*.08,.5,.45+R()*.25);grass.setColorAt(k,c);k++;}
 grass.count=k;grass.receiveShadow=true;grass.computeBoundingSphere();group.add(grass);

 // LOD の振り分け：視点が数 m 動いたときだけ並べ直す（毎フレームは何もしない）
 let lx=Infinity,lz=Infinity;
 function update(pos,force=false){
  const dx=pos.x-lx,dz=pos.z-lz;if(!force&&dx*dx+dz*dz<9)return false;
  lx=pos.x;lz=pos.z;for(const l of lods)l.assign(lx,lz,prof.near,prof.near+5);return true;
 }
 update(viewer||{x:fx,z:fz},true);
 group.userData.update=update;group.userData.lods=lods;group.userData.nearRadius=prof.near;
 return group;
}
