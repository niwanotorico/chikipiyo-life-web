// ぴよみの「ハンバーガーをもぐもぐ」10秒を小さな物語に分ける。
// animation（体の演技）と burger-motion（バーガー・ポテト・お皿）が同じ時刻表を読む。
// t は行動開始からの経過秒（c.elapsed）、left は残り秒（c.remaining）。
//
// バーガーは3段階のモデル（human 作）を順に差し替える：
//  burger.glb の Circle033（まるごと）→ burger_bite01.glb（上のパンをひと口）
//  → burger_bite02.glb（手前をがぶっ）→ 最後のひと口で残りをぱくっ（お皿だけ残る）
export const mealBeats={
 hopOn:[0,.8],          // 椅子の横から座面へ、ぴょん（着地でお皿がぽんっ）
 itadakimasu:[.8,1.5],  // 翼をぱちぱち合わせて、いただきます
 grab:[1.5,2.1],        // 両翼でバーガーをはさんで持ち上げる
 bite1:[2.1,3.4],       // かぶりつく → もぐもぐ（bite01 になる）
 bite2:[3.4,4.7],       // もうひと口 → もぐもぐ（bite02 になる）
 fry:[4.7,6.3],         // バーガーをお皿に置いて、ポテトを1本、翼で運んでぱくっ
 bite3:[6.3,7.9],       // もう一度持って、残りをぱくっ → 大きくもぐもぐ（お皿だけ）
 gochiso:[7.9,Infinity],// おなかぽんぽん → 翼を合わせて、ごちそうさま
};
export const mealHopOff=.7;
export const biteNames=['bite1','bite2','bite3'];
// かぶりつき1回の中の区切り（0..1）：近づく → くちばしが触れる → 離す → もぐもぐ
export const biteShape={reach:.28,contact:.3,release:.45};

const clamp01=v=>Math.max(0,Math.min(1,v));
export const smooth=v=>{v=clamp01(v);return v*v*(3-2*v);};
export const span=(t,[a,b])=>clamp01((t-a)/(b-a));

// 最後のひと口（bite3）は持ち直してからなので、区切りを秒で持つ
export const lastBite={reach:[6.3,6.48],lift:[6.45,6.6],lunge:[6.6,6.75],gulp:[6.75,6.92],settle:[6.9,7.1],chew:[6.85,7.9]};
export function biteContact(name){
 if(name==='bite3')return lastBite.lunge[1];
 const [a,b]=mealBeats[name];return a+(b-a)*biteShape.contact;
}
// 目をぱっちり開けてバーガーを見つめる区間（持ち上げ〜最初のひと口）
export const mealLook=[1.45,biteContact('bite1')];

export function mealBeat(t,left=Infinity){
 if(left<mealHopOff)return 'hopOff';
 for(const [name,[a,b]] of Object.entries(mealBeats))if(t>=a&&t<b)return name;
 return 'gochiso';
}
// くちばしが触れた回数（0..3）＝バーガーの段階。0 まるごと / 1 bite01 / 2 bite02 / 3 食べ終わり
export function burgerStage(t){
 let n=0;for(const name of biteNames)if(t>=biteContact(name))n++;return n;
}
// かぶりつきの時刻 → 0..1 のそれぞれの重み（bite1 / bite2）
export function biteCurve(t,name){
 const k=span(t,mealBeats[name]),{reach,contact,release}=biteShape;
 const lunge=k<reach?smooth(k/reach):k<contact?1:k<release?1-smooth((k-contact)/(release-contact)):0;
 const chew=k<release?0:Math.sin(Math.PI*clamp01((k-release)/(1-release)));
 return {k,lunge,chew};
}

// 持ち直し：もぐもぐしながら、食べやすいように両翼で少しだけ持ち替える。
// その結果バーガーがほんの少し回り、かじった所（モデルではぴよみ側）が横へ少しのぞく。
// 見せるための回転ではないので、角度は小さく、ゆっくり、戻さない（そのまま次をかじる）。
export const regrips=[
 {at:[2.8,3.5],turn:-.42}, // 1口目のあと（約24°）
 {at:[4.05,4.65],turn:-.36},// 2口目のあと（合計約45°、そのままお皿へ）
];
export function burgerTurn(t){
 let turn=0;for(const r of regrips)turn+=r.turn*smooth(span(t,r.at));return turn;
}
// 持ち直しの手の動き 0..1..0（前半は本人の右の翼、後半は左の翼が少しゆるめて持ち替える）
export function regripMotion(t){
 for(const r of regrips){const k=span(t,r.at);if(k>0&&k<1)return {k,right:Math.sin(Math.PI*clamp01(k*2)),left:Math.sin(Math.PI*clamp01(k*2-1)),all:Math.sin(Math.PI*k)};}
 return null;
}
