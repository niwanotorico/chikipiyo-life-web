// 掃除機がけのリズム（キャラの動きと掃除機のノズルで共有する）。
// ノズルは体の前で左右に弧を描き（sweep）、同時に少し前後にも押し引きする（stroke）。
// キャラはその場に立ったまま（root も rig も平行移動しない、足は床に固定）。
// 動かすのは右の翼（ワンドを持つ腕）と、上半身のわずかな前傾だけ。
export const cleanSweepAmplitude=.42,cleanStrokeAmplitude=.13,cleanArmFollow=.5,cleanLeanAmplitude=.05;
export function cleanSweep(t){
 const sweep=cleanSweepAmplitude*Math.sin(t*1.5);
 const stroke=cleanStrokeAmplitude*Math.sin(t*3.0+.6);
 // arm：右の翼を左右へ振る量（弧の半分）／lean：押すときに少し前へ傾く量（足元を支点に数cmだけ）
 return {sweep,stroke,arm:sweep*cleanArmFollow,lean:cleanLeanAmplitude*(.5+.5*stroke/cleanStrokeAmplitude)};
}
