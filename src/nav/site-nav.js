import './site-nav.css';
import {renderSiteNav} from './site-nav-markup.js';

export {renderSiteNav};

// 既存要素の前後・内側に差し込む。返り値は挿入した <nav>。
export function mountSiteNav(anchor,current,{position='afterend',...opts}={}){
 if(!anchor)return null;
 anchor.insertAdjacentHTML(position,renderSiteNav(current,opts));
 const nav=position==='afterend'?anchor.nextElementSibling:position==='beforebegin'?anchor.previousElementSibling:position==='afterbegin'?anchor.firstElementChild:anchor.lastElementChild;
 // 同じ場所をもう一度押しても再読み込みしない（3D を作り直さない）
 nav?.querySelector('[aria-current="page"]')?.addEventListener('click',e=>e.preventDefault());
 return nav;
}
