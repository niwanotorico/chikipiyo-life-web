import {SEASON_IDS,SEASON_LABELS} from './seasons.js';

// 開発者用の季節パネル（?debug=1 のときだけ読み込まれる。通常のお客さんには出ない）
//  - 🌸🌿🍁❄️：その季節で固定（URL に ?season= を書く）
//  - 日付スライダー：その日の渓流を見る（URL に ?date=MM-DD を書く）。季節の移り変わりの確認用
//  - 📅 今日：固定を解除して、いつもの「今日の渓流」に戻す
const MONTH_DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
const fromDay=n=>{let m=0;while(n>=MONTH_DAYS[m]){n-=MONTH_DAYS[m];m++;}return [m+1,n+1];};
const toDay=d=>MONTH_DAYS.slice(0,d.getMonth()).reduce((a,b)=>a+b,0)+d.getDate()-1;

export function mountSeasonDebug(season){
 const box=document.createElement('div');box.className='season-picker';box.setAttribute('role','group');box.setAttribute('aria-label','季節（開発用）');
 const row=document.createElement('div');row.className='season-row';box.appendChild(row);
 const url=(set)=>{const u=new URL(location.href);u.searchParams.delete('season');u.searchParams.delete('date');for(const [k,v] of Object.entries(set))u.searchParams.set(k,v);history.replaceState(null,'',u);};
 const buttons=SEASON_IDS.map(id=>{const b=document.createElement('button');b.type='button';b.dataset.season=id;b.title=SEASON_LABELS[id].label+'で固定';
  b.innerHTML=`<span aria-hidden="true">${SEASON_LABELS[id].icon}</span>${SEASON_LABELS[id].label}`;
  b.addEventListener('click',()=>{season.set(id);url({season:id});});row.appendChild(b);return b;});
 const today=document.createElement('button');today.type='button';today.dataset.season='auto';today.title='今日の日付に戻す';
 today.innerHTML='<span aria-hidden="true">📅</span>今日';today.addEventListener('click',()=>{season.auto();url({});});row.appendChild(today);
 const slider=document.createElement('label');slider.className='season-date';
 slider.innerHTML='<input type="range" min="0" max="364" step="1"><output></output>';box.appendChild(slider);
 const input=slider.querySelector('input'),out=slider.querySelector('output');
 input.addEventListener('input',()=>{const [m,d]=fromDay(+input.value),y=new Date().getFullYear();
  season.setDate(new Date(y,m-1,d,12));url({date:`${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`});});
 function show(){
  const i=season.info(),mode=season.mode;
  for(const b of buttons)b.setAttribute('aria-pressed',String(mode==='fixed'&&b.dataset.season===i.season));
  today.setAttribute('aria-pressed',String(mode==='auto'));
  if(i.date){input.value=toDay(i.date);out.textContent=`${i.date.getMonth()+1}/${i.date.getDate()} ${i.name}${mode==='auto'?'（今日）':''}`;}
  else out.textContent=`${i.name}で固定`;
 }
 for(const el of [...buttons,today,input])el.addEventListener(el===input?'input':'click',show);
 document.body.appendChild(box);show();
 return box;
}
