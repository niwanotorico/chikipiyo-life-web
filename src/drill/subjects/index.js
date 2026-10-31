// ピヨドリル：4教科シャッフルに使う問題プールの一覧（プレイヤーごと）。
// ここに登録されているプレイヤーだけ、毎日の10問が「国語・算数・理科・社会」のシャッフルになる。
// 登録のないプレイヤー（いまは ぴよきち）は、これまでどおり算数だけ。
//
// 1人分の形：{grade, weeks:[{from:'YYYY-MM-DD', banks}], review:{banks}}
//   weeks ：今月の教材。教材の じゅんばんに 週ごとに 分ける。from の日から その週が「いまの週」になる（いちばん はじめの週は from より前の日も つかう）
//   review：先月までの教材（ふくしゅう用）
// その日の問題は「いまの週」を いちばん多く、前の週と 先月の分を すこし まぜて 出す（WEEK_WEIGHTS）。
//
// 5年の教材がそろったら：
//   1) subjects/piyokichi-g5.js を piyomi-g3-nov.js と同じ形で作る（国語・理科・社会の weeks）
//   2) 下に piyokichi:{grade:5, weeks:…, review:{banks:{}}} を1行足す
//   3) 算数の単元を足すなら questions.js の MIX_MATH_POOLS.piyokichi に書く
import piyomiG3 from './piyomi-g3.js';          // 10月（ふくしゅう）
import piyomiG3Nov from './piyomi-g3-nov.js';   // 11月（週ごとに すすむ）

export const SUBJECT_BANKS={
 piyomi:{grade:3,weeks:piyomiG3Nov.weeks,review:{banks:piyomiG3.banks}},
};

// まぜる わりあい：いまの週 6・前の週ぜんぶで 3・先月 1
export const WEEK_WEIGHTS={current:6,earlier:3,review:1};

// dayKey（'YYYY-MM-DD'）の日が 何週め か（0 から）。はじめの週より前の日は 0
export function weekIndex(weeks,dayKey){
 let i=0;
 weeks.forEach((w,k)=>{if(dayKey&&w.from<=dayKey)i=k;});
 return i;
}

// その日に つかう 問題の山：[{id, weight, banks}]（weight が 大きいほど 先に 出やすい）
export function bankGroups(bank,dayKey){
 const now=weekIndex(bank.weeks,dayKey);
 const groups=[{id:`w${now+1}`,weight:WEEK_WEIGHTS.current,banks:bank.weeks[now].banks}];
 const earlier=bank.weeks.slice(0,now);
 earlier.forEach((w,k)=>groups.push({id:`w${k+1}`,weight:WEEK_WEIGHTS.earlier/earlier.length,banks:w.banks}));
 if(bank.review)groups.push({id:'review',weight:WEEK_WEIGHTS.review,banks:bank.review.banks});
 return groups;
}
