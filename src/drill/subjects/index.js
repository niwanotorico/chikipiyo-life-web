// ピヨドリル：4教科シャッフルに使う問題プールの一覧（プレイヤーごと）。
// ここに登録されているプレイヤーだけ、毎日の10問が「国語・算数・理科・社会」のシャッフルになる。
// 登録のないプレイヤー（いまは ぴよきち）は、これまでどおり算数だけ。
//
// 5年の教材がそろったら：
//   1) subjects/piyokichi-g5.js を piyomi-g3.js と同じ形で作る（国語・理科・社会の banks）
//   2) 下に piyokichi: piyokichiG5 を1行足す
//   3) 算数の10月単元を足すなら questions.js の MIX_MATH_POOLS.piyokichi に書く
import piyomiG3 from './piyomi-g3.js';

export const SUBJECT_BANKS={
 piyomi:piyomiG3,
};
