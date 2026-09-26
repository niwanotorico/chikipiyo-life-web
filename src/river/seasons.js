import * as T from 'three';

// ─────────────────────────────────────────────────────────────
// 渓流の四季。地形・川・岩・木・釣りは 1 つのまま、季節で変わるのは「見た目の数値」だけ。
//  - シェーダーが読む共有 uniform（shared.season）… 草・土・岩・苔・葉・雪・落ち葉・花
//  - シーンの光（太陽・空・霧・露出）と水の映り込みの色
//  - 舞う花びら／落ち葉／雪（river-fall.js）
// 季節を足す・直すときは SEASONS の数値を触るだけ。地形や釣りのコードには季節の分岐を書かない。
// ─────────────────────────────────────────────────────────────

export const SEASON_IDS=['spring','summer','autumn','winter'];
export const SEASON_LABELS={spring:{icon:'🌸',label:'春'},summer:{icon:'🌿',label:'夏'},autumn:{icon:'🍁',label:'秋'},winter:{icon:'❄️',label:'冬'}};

// 現実の日付 → いちばん近い季節の名前（ラベル・テスト用。見た目は下の stateForDate が日単位でなめらかに決める）
export function seasonForDate(date=new Date()){
 const m=date.getMonth()+1;
 return m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter';
}
// ?season= の強制指定（撮影・確認用）。spring|summer|autumn|winter 以外は null＝日付どおり
export function forcedSeason(v){return SEASON_IDS.includes(v)?v:null;}
// ?date=MM-DD または YYYY-MM-DD（確認用に「その日の渓流」を見る）。読めなければ null
export function parseDateParam(v){
 const m=/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec(v||'');if(!m)return null;
 const d=new Date(m[1]?+m[1]:new Date().getFullYear(),+m[2]-1,+m[3],12);
 return Number.isNaN(d.getTime())||d.getMonth()!==+m[2]-1?null:d;
}

// シェーダー用の値（色はリニア）。summer＝今までの渓流（岩と河原の白っぽさだけ落ち着かせた）
export const SEASONS={
 spring:{
  shader:{snow:0,litter:0,flowers:1,grassDark:[.06,.12,.022],grassLight:[.2,.29,.06],bedTint:[.8,.79,.76],rockTint:[.6,.6,.58],moss:[.14,.25,.05],
   leafShift:[1.22,1.2,.72],autumn:0,dry:0,bare:0,blossom:.18,leafKeep:1,needleTint:[1,1.04,.95],grassMul:[1.15,1.22,.8],grassDry:0,grassKeep:1},
  light:{sun:0xfff3e2,sunI:3.1,exposure:.8,fog:0xb8d0cc,fogD:.0046,hemiSky:0xdcecff,hemiGround:0x44552a,turbidity:2.4,rayleigh:1.6},
  water:{canyon:0x223319,deep:0x14857c,shallow:0xa2ecdc},
  fall:{petal:1,leaf:0,snow:0},
 },
 summer:{
  shader:{snow:0,litter:0,flowers:0,grassDark:[.045,.09,.02],grassLight:[.15,.21,.05],bedTint:[.8,.79,.76],rockTint:[.6,.6,.58],moss:[.12,.21,.045],
   leafShift:[1,1,1],autumn:0,dry:0,bare:0,blossom:0,leafKeep:1,needleTint:[1,1,1],grassMul:[1,1,1],grassDry:0,grassKeep:1},
  light:{sun:0xfff0d8,sunI:3.1,exposure:.78,fog:0xaec8cc,fogD:.0048,hemiSky:0xd6e8ff,hemiGround:0x3a4a26,turbidity:2.2,rayleigh:1.7},
  water:{canyon:0x1d2a14,deep:0x13807a,shallow:0x9ee8dc},
  fall:{petal:0,leaf:0,snow:0},
 },
 autumn:{
  shader:{snow:0,litter:1,flowers:0,grassDark:[.07,.075,.025],grassLight:[.2,.18,.06],bedTint:[.78,.75,.7],rockTint:[.64,.63,.6],moss:[.11,.15,.04],
   leafShift:[1,1,1],autumn:1,dry:0,bare:0,blossom:0,leafKeep:.86,needleTint:[.95,.95,.9],grassMul:[1.1,.95,.6],grassDry:.35,grassKeep:.85},
  light:{sun:0xffe2bc,sunI:3,exposure:.8,fog:0xc2c4b4,fogD:.005,hemiSky:0xe6e2d6,hemiGround:0x4a3a22,turbidity:3,rayleigh:1.5},
  water:{canyon:0x33230f,deep:0x117670,shallow:0x98ddd0},
  fall:{petal:0,leaf:1,snow:0},
 },
 winter:{
  shader:{snow:1,litter:0,flowers:0,grassDark:[.07,.065,.045],grassLight:[.15,.13,.09],bedTint:[.86,.86,.86],rockTint:[.62,.63,.66],moss:[.08,.1,.05],
   leafShift:[1,1,1],autumn:0,dry:1,bare:1,blossom:0,leafKeep:.55,needleTint:[.8,.88,.9],grassMul:[1,1,1],grassDry:.85,grassKeep:.28},
  light:{sun:0xeef3ff,sunI:2.5,exposure:.74,fog:0xc9d4da,fogD:.0068,hemiSky:0xe4eeff,hemiGround:0x4a4e50,turbidity:4,rayleigh:1.1},
  water:{canyon:0x252d2c,deep:0x0f6a6a,shallow:0x9cdcd6},
  fall:{petal:0,leaf:0,snow:1},
 },
};

const V3=['grassDark','grassLight','bedTint','rockTint','moss','leafShift','needleTint','grassMul'];
const F1=['snow','litter','flowers','autumn','dry','bare','blossom','leafKeep','grassDry','grassKeep'];
const uname=k=>'uS'+k[0].toUpperCase()+k.slice(1);

// シェーダーが読む uniform のひと組。値は夏で初期化（テストなど季節を使わない場所でも同じ見た目）
export function createSeasonUniforms(id='summer'){
 const s=SEASONS[id].shader,u={};
 for(const k of V3)u[uname(k)]={value:new T.Vector3(...s[k])};
 for(const k of F1)u[uname(k)]={value:s[k]};
 return u;
}
export function seasonUniforms(shared){return shared.season||(shared.season=createSeasonUniforms());}
// GLSL の宣言（materials.js が各シェーダーの先頭に差し込む）
export const seasonGLSL=V3.map(k=>`uniform vec3 ${uname(k)};`).join('')+F1.map(k=>`uniform float ${uname(k)};`).join('')+'\n';

// ─────────────────────────────────────────────────────────────
// 季節の「状態」＝上の数値を全部数字の配列にしたもの。2 つの状態は数値の補間でつながる
// ─────────────────────────────────────────────────────────────
const hex=h=>{const c=new T.Color(h);return [c.r,c.g,c.b];};
function toState(p){
 const L=p.light,W=p.water;
 return {shader:structuredClone(p.shader),
  light:{sun:hex(L.sun),sunI:L.sunI,exposure:L.exposure,fog:hex(L.fog),fogD:L.fogD,hemiSky:hex(L.hemiSky),hemiGround:hex(L.hemiGround),turbidity:L.turbidity,rayleigh:L.rayleigh},
  water:{canyon:hex(W.canyon),deep:hex(W.deep),shallow:hex(W.shallow)},fall:{...p.fall}};
}
export function blendState(a,b,t){
 if(Array.isArray(a))return a.map((v,i)=>v+(b[i]-v)*t);
 if(typeof a==='number')return a+(b-a)*t;
 const o={};for(const k in a)o[k]=blendState(a[k],b[k],t);return o;
}
function withShader(st,over,fall){return {...st,shader:{...st.shader,...over},fall:{...st.fall,...fall}};}
export const PRESET_STATES=Object.fromEntries(SEASON_IDS.map(id=>[id,toState(SEASONS[id])]));
const P=PRESET_STATES;

// 1 年の流れ（東京あたりの渓流のつもり）。点と点の間は日単位でゆっくり補間する。
// 木ごと・葉房ごとに色づく順番、雪の積もり具合はシェーダー側で「進み具合」として効くので、途中の日付もまだらに自然に混ざる
export const YEAR=[
 {md:[1,15],name:'冬',state:P.winter},
 {md:[2,20],name:'冬のおわり',state:P.winter},
 {md:[3,20],name:'芽吹き',state:withShader(blendState(P.winter,P.spring,.55),{snow:0,blossom:.03,bare:.55,dry:.45,leafKeep:.72,grassKeep:.6},{petal:.08,leaf:0,snow:0})},
 {md:[4,5],name:'桜',state:P.spring},
 {md:[4,28],name:'葉桜',state:withShader(blendState(P.spring,P.summer,.4),{blossom:.05},{petal:.35,leaf:0,snow:0})},
 {md:[5,31],name:'夏',state:P.summer},
 {md:[8,25],name:'夏',state:P.summer},
 {md:[9,28],name:'秋のはじまり',state:withShader(blendState(P.summer,P.autumn,.2),{autumn:.24,litter:.03,leafKeep:1},{petal:0,leaf:.07,snow:0})},
 {md:[10,28],name:'色づき',state:withShader(blendState(P.summer,P.autumn,.65),{autumn:.6,litter:.4,leafKeep:.96},{petal:0,leaf:.4,snow:0})},
 {md:[11,22],name:'紅葉',state:P.autumn},
 {md:[12,18],name:'晩秋',state:withShader(blendState(P.autumn,P.winter,.5),{autumn:1,snow:.12,litter:.8},{petal:0,leaf:.5,snow:.25})},
];
const DAY=864e5;
const dayOfYear=d=>Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(d.getFullYear(),0,1))/DAY)+(d.getHours()+d.getMinutes()/60)/24;
const mdDay=([m,d])=>Math.round((Date.UTC(2025,m-1,d)-Date.UTC(2025,0,1))/DAY); // うるう年は気にしない（1 日ずれるだけ）
const ease=t=>t*t*(3-2*t);
// 日付 → {state, name, from, to, t}。name は「今どのあたりか」（開発パネルの表示用）
export function stateForDate(date=new Date()){
 const x=dayOfYear(date),n=YEAR.length;
 for(let i=0;i<n;i++){
  const a=YEAR[i],b=YEAR[(i+1)%n];let da=mdDay(a.md),db=mdDay(b.md),xx=x;
  if(db<=da)db+=365;if(xx<da)xx+=365;
  if(xx>=da&&xx<db){const t=(xx-da)/(db-da);return {state:blendState(a.state,b.state,ease(t)),name:t<.5?a.name:b.name,from:a.name,to:b.name,t};}
 }
 return {state:YEAR[0].state,name:YEAR[0].name,from:YEAR[0].name,to:YEAR[0].name,t:0};
}

// ─────────────────────────────────────────────────────────────
// 季節システム。通常は「今日の日付」で決まり、ページを開いている間も 1 分ごとに日付を見直す（日をまたいでも静かに進む）。
// ?season=… / ?date=… / 開発パネルからの指定は固定表示（auto に戻すまで日付では動かない）
// ─────────────────────────────────────────────────────────────
export function createSeasonSystem({shared,scene,renderer,sun,hemi,sky,water,fall,initial=null,now=()=>new Date(),onChange}={}){
 const U=seasonUniforms(shared);
 const tv=new T.Vector3(),tc=new T.Color();
 let from=null,to=null,blend=1,mode='auto',label='',info=null,recheck=0;
 const cur=()=>{
  const light=sun?{sun:[sun.color.r,sun.color.g,sun.color.b],sunI:sun.intensity}:{sun:[1,1,1],sunI:3.1};
  return {
   shader:Object.fromEntries([...V3.map(k=>[k,U[uname(k)].value.toArray()]),...F1.map(k=>[k,U[uname(k)].value])]),
   light:{...light,exposure:renderer?renderer.toneMappingExposure:.78,fog:scene&&scene.fog?scene.fog.color.toArray():[0,0,0],fogD:scene&&scene.fog?scene.fog.density:0,
    hemiSky:hemi?hemi.color.toArray():[0,0,0],hemiGround:hemi?hemi.groundColor.toArray():[0,0,0],
    turbidity:sky?sky.material.uniforms.turbidity.value:0,rayleigh:sky?sky.material.uniforms.rayleigh.value:0},
   water:water?{canyon:water.material.uniforms.uCanyon.value.toArray(),deep:water.material.uniforms.uDeep.value.toArray(),shallow:water.material.uniforms.uShallow.value.toArray()}:{canyon:[0,0,0],deep:[0,0,0],shallow:[0,0,0]},
  };
 };
 function apply(st){
  const S=st.shader;
  for(const k of V3)U[uname(k)].value.fromArray(S[k]);
  for(const k of F1)U[uname(k)].value=S[k];
  const L=st.light,Wt=st.water;
  if(sun){sun.color.fromArray(L.sun);sun.intensity=L.sunI;
   // 水・水中の光（コースティクス）は太陽の色を使う
   if(shared.uSunCol)shared.uSunCol.value.copy(sun.color).multiplyScalar(2.3*sun.intensity/3.1);}
  if(renderer)renderer.toneMappingExposure=L.exposure;
  if(scene&&scene.fog){scene.fog.color.fromArray(L.fog);scene.fog.density=L.fogD;}
  if(hemi){hemi.color.fromArray(L.hemiSky);hemi.groundColor.fromArray(L.hemiGround);}
  if(sky){sky.material.uniforms.turbidity.value=L.turbidity;sky.material.uniforms.rayleigh.value=L.rayleigh;}
  if(water){const w=water.material.uniforms;w.uCanyon.value.fromArray(Wt.canyon);w.uDeep.value.fromArray(Wt.deep);w.uShallow.value.fromArray(Wt.shallow);
   if(shared.uSunCol&&w.uSunCol)w.uSunCol.value.copy(shared.uSunCol.value);}
 }
 function go(state,{instant=false}={}){
  from=instant?null:{...cur(),fall:to?to.fall:state.fall};to=state;blend=instant?1:0;
  if(instant)apply(state);
  if(fall)fall.setMix(state.fall,{instant});
 }
 const emit=()=>{if(typeof document!=='undefined'&&document.body)document.body.dataset.season=info.season;onChange?.(info);};
 // 季節を固定（?season= / 開発パネル）
 function set(id,{instant=false}={}){
  if(!SEASONS[id])throw new Error('unknown season '+id);
  mode='fixed';info={mode,season:id,name:SEASON_LABELS[id].label};go(PRESET_STATES[id],{instant});emit();return id;
 }
 // ある日付の渓流で固定（?date= / 開発パネルのスライダー）
 function setDate(date,{instant=false}={}){
  const r=stateForDate(date);mode='date';info={mode,season:seasonForDate(date),name:r.name,date};go(r.state,{instant});emit();return r;
 }
 // 通常：今日の日付で決まり、そのまま時間とともに進む
 function auto({instant=false}={}){
  const d=now(),r=stateForDate(d);mode='auto';recheck=0;info={mode,season:seasonForDate(d),name:r.name,date:d};go(r.state,{instant});emit();return r;
 }
 function update(dt){
  if(blend<1){blend=Math.min(1,blend+dt/1.1);apply(blendState(from,{...to},ease(blend)));}
  if(mode==='auto'&&(recheck+=dt)>60){recheck=0;const d=now(),r=stateForDate(d);to=r.state;from=cur();blend=0;fall?.setMix(r.state.fall);
   if(r.name!==info.name||seasonForDate(d)!==info.season){info={mode,season:seasonForDate(d),name:r.name,date:d};emit();}}
 }
 if(initial&&SEASONS[initial])set(initial,{instant:true});else auto({instant:true});
 return {set,setDate,auto,update,get:()=>info.season,info:()=>info,get mode(){return mode;},uniforms:U};
}
