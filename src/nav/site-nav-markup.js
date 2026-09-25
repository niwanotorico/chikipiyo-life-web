import {places,placeHref,siteBase} from './places.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 共通ナビの HTML。current は places の id。variant は置き場所ごとの見た目（'header' | 'floating'）。
export function renderSiteNav(current,{base=siteBase(),variant='header',list=places}={}){
 const items=list.map(p=>{
  const here=p.id===current;
  return `<li><a class="site-nav__link" href="${esc(placeHref(p,base))}"${here?' aria-current="page"':''} data-place="${esc(p.id)}">`+
   `<span class="site-nav__icon" aria-hidden="true">${esc(p.icon)}</span>`+
   `<span class="site-nav__label site-nav__label--full">${esc(p.label)}</span>`+
   `<span class="site-nav__label site-nav__label--short" aria-hidden="true">${esc(p.short??p.label)}</span>`+
   `</a></li>`;
 }).join('');
 return `<nav class="site-nav site-nav--${esc(variant)}" aria-label="ちきぴよ暮らしの場所"><ul class="site-nav__list" style="--site-nav-count:${list.length}">${items}</ul></nav>`;
}
