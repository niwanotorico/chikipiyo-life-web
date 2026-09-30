// ピヨドリル：1回（10問）の進行とポイント計算（DOM なし・純粋関数）。
import {checkAnswer,QUESTIONS_PER_SET} from './questions.js';

// ポイント仮仕様
export const POINTS={perCorrect:1,comboEvery:3,comboBonus:1,clear:3,perfect:3};

export function createRun(questions){
 return {questions,answers:[],combo:0,maxCombo:0,correct:0,earned:0,done:questions.length===0};
}

// 1問に答える。同じ問題に二度答えることはできない（連打・Enter 連打対策）。
// 戻り値 {run, feedback}。feedback が null なら何もしなかった。
export function answerRun(run,input){
 if(run.done)return {run,feedback:null};
 const question=run.questions[run.answers.length];
 const check=checkAnswer(question,input);
 if(!check.valid)return {run,feedback:null};
 const combo=check.ok?run.combo+1:0;
 const comboBonus=check.ok&&combo%POINTS.comboEvery===0;
 const gained=check.ok?POINTS.perCorrect+(comboBonus?POINTS.comboBonus:0):0;
 const answers=[...run.answers,{id:question.id,ok:check.ok,given:check.given}];
 const next={...run,answers,combo,maxCombo:Math.max(run.maxCombo,combo),correct:run.correct+(check.ok?1:0),earned:run.earned+gained,done:answers.length>=run.questions.length};
 return {run:next,feedback:{ok:check.ok,close:check.close,answer:question.answer,unit:question.unit,combo,comboBonus,gained}};
}

// 正誤の並びから、ポイントの内訳を計算しなおす（保存時はこれだけを信じる）。
export function scoreAnswers(oks,{clearBonus=true,perfectBonus=true}={}){
 const list=Array.isArray(oks)?oks.slice(0,QUESTIONS_PER_SET).map(Boolean):[];
 let combo=0,maxCombo=0,correct=0,comboPoints=0;
 for(const ok of list){
  if(ok){correct++;combo++;if(combo%POINTS.comboEvery===0)comboPoints+=POINTS.comboBonus;}
  else combo=0;
  maxCombo=Math.max(maxCombo,combo);
 }
 const cleared=list.length===QUESTIONS_PER_SET;
 const perfect=cleared&&correct===QUESTIONS_PER_SET;
 const questionPoints=correct*POINTS.perCorrect;
 const clear=cleared&&clearBonus?POINTS.clear:0;
 const perfectPts=perfect&&perfectBonus?POINTS.perfect:0;
 return {correct,count:list.length,maxCombo,cleared,perfect,questionPoints,comboPoints,clearBonus:clear,perfectBonus:perfectPts,points:questionPoints+comboPoints+clear+perfectPts};
}
