// ピヨドリル：10もんの あとの「さっきの もんだいに もういちど！」（DOM なし・テスト可能）。
//   ・得点・コンボ・パーフェクト・1日3回・ピヨ探検pt・ごほうびには いっさい さわらない（scoring.js / storage.js / cosmicube*.js を呼ばない）
//   ・記録は 専用キー（REVIEW_KEY）だけ。「はじめは まちがい → ふくしゅうで できた」を 1問ずつ のこす
export const REVIEW_MAX=3;
export const REVIEW_KEY='chikipiyo-quest-review:v1';
const LOG_LIMIT=60;

// まちがえた問題から 最大3もん。出題順（＝やさしい順）に、教科が かぶらないように えらぶ → 足りなければ 出題順で うめる
export function pickReview(run,max=REVIEW_MAX){
 const wrong=(run?.answers??[]).map((a,i)=>({a,i,q:run.questions[i]})).filter(x=>x.q&&x.a&&!x.a.ok);
 const picked=[],subjects=new Set();
 for(const x of wrong){const s=x.q.subject||'算数';if(picked.length<max&&!subjects.has(s)){picked.push(x);subjects.add(s);}}
 for(const x of wrong){if(picked.length>=max)break;if(!picked.includes(x))picked.push(x);}
 return picked.sort((p,q)=>p.i-q.i).map(x=>({index:x.i,question:x.q,given:x.a.given??null}));
}

// ふくしゅう用に 1もん コピー。3択は 選択肢の 並びを 入れかえる（場所で おぼえないように）
export function reviewQuestion(q,rng=Math.random){
 const out={...q,id:`${q.id}-r`};
 if(Array.isArray(q.choices)&&q.choices.length>1){
  let c=q.choices;
  for(let t=0;t<12;t++){c=[...q.choices];for(let i=c.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[c[i],c[j]]=[c[j],c[i]];}if(c.join('\u0001')!==q.choices.join('\u0001'))break;}
  out.choices=c;
 }
 return out;
}

// ---------- 記録（端末内） ----------
// {version:1, entries:[{id(sessionId), player, day, practice, status:'offered'|'skipped'|'started'|'done',
//   items:[{qid, subject, text, answer, first(はじめの答え), retry:null|true|false, given(ふくしゅうの答え)}]}]}
function emptyLog(){return {version:1,entries:[]};}
const str=(v,n=120)=>typeof v==='string'?v.slice(0,n):v==null?null:String(v).slice(0,n);
function sanitizeEntry(e){
 if(!e||typeof e!=='object'||typeof e.id!=='string')return null;
 const status=['offered','skipped','started','done'].includes(e.status)?e.status:'offered';
 const items=(Array.isArray(e.items)?e.items:[]).slice(0,REVIEW_MAX).map(it=>({qid:str(it?.qid,40),subject:str(it?.subject,8),text:str(it?.text),answer:str(it?.answer,40),first:str(it?.first,40),retry:it?.retry===true?true:it?.retry===false?false:null,given:str(it?.given,40)}));
 return {id:e.id.slice(0,80),player:str(e.player,20),day:str(e.day,10),practice:e.practice===true,status,items};
}
export function loadReviewLog(storage){
 try{const raw=JSON.parse(storage?.getItem(REVIEW_KEY)??'null');if(!raw||raw.version!==1||!Array.isArray(raw.entries))return emptyLog();
  return {version:1,entries:raw.entries.map(sanitizeEntry).filter(Boolean).slice(-LOG_LIMIT)};}
 catch{return emptyLog();}
}
function saveLog(storage,log){try{storage?.setItem(REVIEW_KEY,JSON.stringify(log));return true;}catch{return false;}}
function update(storage,id,fn){
 const log=loadReviewLog(storage);
 const i=log.entries.findIndex(e=>e.id===id);
 const cur=i>=0?log.entries[i]:null,next=sanitizeEntry(fn(cur));
 if(!next)return null;
 if(i>=0)log.entries[i]=next;else log.entries.push(next);
 log.entries=log.entries.slice(-LOG_LIMIT);
 saveLog(storage,log);return next;
}
// 結果画面で さそったとき（まちがいの 記録として のこる。スキップしても 消えない）
export function offerReview(storage,{sessionId,player,dayKey,practice,picks}){
 return update(storage,sessionId,cur=>cur??{id:sessionId,player,day:dayKey,practice:!!practice,status:'offered',
  items:picks.map(p=>({qid:p.question.id,subject:p.question.subject||'算数',text:p.question.text,answer:p.question.answer,first:p.given,retry:null,given:null}))});
}
export function setReviewStatus(storage,sessionId,status){return update(storage,sessionId,cur=>cur&&{...cur,status});}
export function recordReviewAnswer(storage,sessionId,index,{ok,given}){
 return update(storage,sessionId,cur=>{
  if(!cur||!cur.items[index]||cur.items[index].retry!==null)return cur;   // 1もん 1回だけ（やりなおしは しない）
  const items=cur.items.map((it,i)=>i===index?{...it,retry:!!ok,given:given??null}:it);
  return {...cur,items,status:items.every(it=>it.retry!==null)?'done':'started'};
 });
}
