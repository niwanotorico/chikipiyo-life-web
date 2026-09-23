// ぴよきちの「PCでモデリング」14秒を小さな物語に分ける。
// animation.js（体の演技）と modeling-screen.js（画面の中身）が同じ時刻表を読む。
// t は行動開始からの経過秒（c.elapsed）、left は残り秒（c.remaining）。
export const modelingBeats={
 hopOn:[0,.85],      // 椅子の横から座面へ、ぴょん
 headphones:[.85,1.45],// 両翼でヘッドホンをかぶる
 build:[1.45,5.6],   // 点を打ち、線でつなぐ（カタカタ＋トラックパッド）
 think:[5.6,7.5],    // 背をそらして、くちばしに翼を当てて考える
 idea:[7.5,8.0],     // ひらめいて、ぴょこっと跳ねる
 finish:[8.0,11.6],  // 面を張って色をぬる（さっきより速いカタカタ）
 done:[11.6,Infinity],// できた！ ばんざい
};
export const hopOffDuration=.7;
export const clamp01=v=>Math.max(0,Math.min(1,v));
export const smooth=v=>{v=clamp01(v);return v*v*(3-2*v);};
export const span=(t,[a,b])=>clamp01((t-a)/(b-a));

export function modelingBeat(t,left=Infinity){
 if(left<hopOffDuration)return 'hopOff';
 for(const [name,[a,b]] of Object.entries(modelingBeats))if(t>=a&&t<b)return name;
 return 'done';
}

// 画面の制作進行 0..1。0-.3 点、.3-.55 線、.55-.8 面（グレー）、.8-1 色。
export function modelingProgress(t){
 const b=modelingBeats;
 if(t<b.build[0])return 0;
 if(t<b.build[1])return .55*span(t,b.build);
 if(t<b.finish[0])return .55;
 if(t<b.finish[1])return .55+.45*span(t,b.finish);
 return 1;
}

// トラックパッドをなでる指先の軌跡（-1..1）。右の翼とPC画面のカーソルが同じ値で動く。
export function trackpadStroke(t,out=[0,0]){
 out[0]=Math.sin(t*1.9)*.8+Math.sin(t*4.3)*.2;out[1]=Math.sin(t*2.7+.6)*.7;return out;
}
