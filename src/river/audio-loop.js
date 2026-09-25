// ループ素材の継ぎ目を消す（純粋関数。テスト可能にするため WebAudio に依存しない）
//  1) 先頭・末尾のほぼ無音（mp3/aac のエンコーダが足すパディング）を最大 0.25 秒まで削る
//  2) 末尾の fade 秒を先頭に等パワーでクロスフェードして、ループ点を連続にする
export function loopCrossfade(channels,sampleRate,{fade=1.2,trimThreshold=1e-4,maxTrim=.25}={}){
 const L=channels[0].length,maxT=Math.floor(maxTrim*sampleRate);
 const quiet=i=>channels.every(c=>Math.abs(c[i])<trimThreshold);
 let s=0,e=L;
 while(s<maxT&&s<L-2&&quiet(s))s++;
 while(L-e<maxT&&e>s+2&&quiet(e-1))e--;
 const n=e-s,F=Math.max(0,Math.min(Math.floor(fade*sampleRate),Math.floor(n/3))),len=n-F;
 const out=channels.map(c=>{
  const o=new Float32Array(len);
  for(let i=0;i<len;i++)o[i]=c[s+i];
  for(let i=0;i<F;i++){const t=(i+.5)/F;o[i]=c[s+i]*Math.sin(t*Math.PI/2)+c[s+len+i]*Math.cos(t*Math.PI/2);}
  return o;
 });
 return {channels:out,length:len,trimmed:[s,L-e],fade:F};
}

// AudioBuffer → 継ぎ目のない AudioBuffer
export function seamlessBuffer(ctx,buf,opts){
 const ch=Array.from({length:buf.numberOfChannels},(_,i)=>buf.getChannelData(i));
 const r=loopCrossfade(ch,buf.sampleRate,opts);
 const out=ctx.createBuffer(ch.length,r.length,buf.sampleRate);
 r.channels.forEach((c,i)=>out.copyToChannel(c,i));
 return out;
}

// 置かれている音源の中から、このブラウザで再生できる形式を選ぶ（ogg → m4a → mp3 → wav の順）
const TYPES=[['ogg','audio/ogg; codecs="vorbis"'],['ogg','audio/ogg; codecs="opus"'],['m4a','audio/mp4; codecs="mp4a.40.2"'],['mp3','audio/mpeg'],['wav','audio/wav']];
export function pickAudioFile(files,canPlay){
 const byExt={};for(const [path,url] of Object.entries(files||{})){const m=path.match(/\.(\w+)$/);if(m)byExt[m[1].toLowerCase()]=url;}
 for(const [ext,mime] of TYPES)if(byExt[ext]&&canPlay(mime))return byExt[ext];
 return null;
}
