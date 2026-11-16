'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function setup(){
 const nodes=new Map();
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',appendChild(){},focus(){},classList:{toggle(){}},remove(){}});return nodes.get(selector);};
 const words=[['lawyer','advocaat/jurist'],['illegal','onwettig/illegaal'],['witness','getuige'],['trial','proces/strafzaak'],['court','rechtbank'],['judge','rechter']].map(([front,back],i)=>({id:'w'+i,front,back}));
 const lists=[{id:'l1',name:'The law',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',source:'studygo',words},{id:'l2',name:'Mijn Frans',subject:'Frans',fromLang:'fr-FR',toLang:'nl-NL',source:'manual',words:[{id:'f',front:'bonjour',back:'hallo'}]}];
 const ctx={console,URL,FormData,Math,Date,JSON,Number,String,Map,Set,
  localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#lists'},setTimeout:()=>1,setInterval:()=>1,clearInterval:()=>{},clearTimeout:()=>{},
  window:{addEventListener(){}},document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({textContent:'',className:'',remove(){}})},
  fetch:async(url,init={})=>({ok:true,async json(){if(url==='/api/state')return {lists,progress:{},activity:[]};if(url==='/api/config')return {qr:'',lanUrl:'http://localhost:3000'};if(url==='/api/practice')return {};throw Error(url);}})
 };
 vm.createContext(ctx);
 for(const file of ['answer-utils.js','cloze-utils.js','learn-engine.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),ctx);
 return {ctx,nodes,get,lists};
}
const run=(ctx,code)=>vm.runInContext(code,ctx);
const button=(ctx,action,extra={})=>run(ctx,`handleClick({target:{closest:()=>({dataset:${JSON.stringify({action,...extra})}})}})`);
test('Alle lijsten en filter tonen alleen geïmporteerde lijsten',async()=>{
 const {ctx,get}=setup();await new Promise(r=>setImmediate(r));
 assert.match(get('#app').innerHTML,/The law/);assert.match(get('#app').innerHTML,/Mijn Frans/);
 await button(ctx,'lists-filter',{filter:'imported'});
 assert.match(get('#app').innerHTML,/The law/);assert.doesNotMatch(get('#app').innerHTML,/Mijn Frans/);
});
test('Slim leren: juiste meerkeuze leidt naar volgende vraag en doorloopt vier fases',async()=>{
 const {ctx,get}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','learn')");
 assert.match(get('#app').innerHTML,/Set 1\/2/);
 const phases=new Set();let n=0;
 for(;n<100;n++){
  if(run(ctx,'session.done'))break;
  const stage=run(ctx,'currentQuestion().stage');phases.add(stage);
  if(stage===0){
   await button(ctx,'flip-card');await button(ctx,'self-grade',{correct:'true'});
  }else if(stage===1){
   const index=run(ctx,'session.choiceOptions.indexOf(currentQuestion().answer)');
   assert.ok(index>=0,'correct option always displayed');
   await button(ctx,'choose-answer',{answerIndex:String(index)});
   assert.equal(run(ctx,'session.feedback.correct'),true);
   assert.equal(run(ctx,'currentQuestion().stage'),1,'phase must remain during feedback');
   assert.match(get('#app').innerHTML,/choice-correct/);
   await button(ctx,'next-question');
  }else{
   if(stage===2)assert.match(get('#app').innerHTML,/Extra hint/,'hints displayed during step 3');
   const answer=run(ctx,'currentQuestion().answer.split("/")[0]');
   run(ctx,`submitAnswer(${JSON.stringify(answer)})`);
   assert.equal(run(ctx,'session.feedback.correct'),true);
   await button(ctx,'next-question');
  }
 }
 assert.ok(n<100);assert.equal(run(ctx,'session.learn.completed.size'),6);
 assert.equal(Array.from(phases).sort().join(','),'0,1,2,3');
 assert.match(get('#app').innerHTML,/RONDE AFGEROND/);
});
test('Foute meerkeuze wordt later opnieuw aangeboden, goede spelling is hoofdletterongevoelig',async()=>{
 const {ctx}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','choice')");
 const good=run(ctx,'currentQuestion().answer');const wrong=run(ctx,'session.choiceOptions.find(x=>x!==currentQuestion().answer)');
 assert.ok(wrong);
 run(ctx,`submitAnswer(${JSON.stringify(wrong)})`);assert.equal(run(ctx,'session.feedback.correct'),false);
 await button(ctx,'next-question');
 run(ctx,`submitAnswer(${JSON.stringify(good.toUpperCase())})`); // next q may differ; test case folding separately below
 assert.equal(run(ctx,'WoordAnswers.isCorrect("JURIST","advocaat/jurist")'),true);
 // Learning errors should reschedule, not replace the next word
 run(ctx,"startSession('l1','learn');session.queue=[{...session.queue[0],stage:1},...session.queue.slice(1)];session.choiceOptions=null;render() ");
 const expected=run(ctx,'currentQuestion().wordId');
 run(ctx,"submitAnswer('__definitely_wrong__')");
 assert.equal(run(ctx,'session.feedback.correct'),false);
 assert.equal(run(ctx,'session.queue[1].wordId')!==expected,true);
 assert.equal(run(ctx,'session.queue[3].wordId'),expected);
});
