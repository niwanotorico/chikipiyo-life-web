// ぴよみ起こし：Godot で作ったゲーム（public/games/piyomi-okoshi）を iframe で置くページ。
// ゲーム本体の更新は godot-opus で Web 書き出し → public/games/piyomi-okoshi に上書きするだけ。
import {mountSiteNav} from '../nav/site-nav.js';
mountSiteNav(document.querySelector('[data-nav]'),'okoshi',{position:'afterbegin',variant:'floating'});
