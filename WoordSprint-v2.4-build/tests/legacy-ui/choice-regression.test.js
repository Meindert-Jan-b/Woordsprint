'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function setup(){
 const nodes=new Map();const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',appendChild(){},focus(){},classList:{toggle(){}},remove(){}});return nodes.get(selector);};
 const words=[['law-abiding / law abiding','wetsgetrouw / gezagsgetrouw / ordelievend'],['premises','pand / terrein'],['to release','vrijlaten'],['lawyer','jurist / advocaat'],['judge','rechter']].map(([front,back],i)=>({id:'w'+i,front,back}));
 const lists=[{id:'l1',name:'FU 51',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',source:'studygo',words}];
 const ctx={console,URL,FormData,Math,Date,JSON,Number,String,Map,Set,
  localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#lists'},setTimeout:()=>99,setInterval:()=>1,clearInterval:()=>{},clearTimeout:()=>{},
  window:{addEventListener(){}},document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({textContent:'',className:'',remove(){}})},
  fetch:async url=>({ok:true,async json(){if(url==='/api/state')return {lists,progress:{},activity:[]};if(url==='/api/config')return {qr:'',lanUrl:'http://localhost:3000'};if(url==='/api/practice')return {};throw Error(url);}})};
 vm.createContext(ctx);
 for(const file of ['answer-utils.js','cloze-utils.js','learn-engine.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),ctx);
 return {ctx,get};
}
function ev(ctx,action,props){return vm.runInContext(`handleClick({target:{closest:()=>({dataset:${JSON.stringify({action,...props})}})}})`,ctx);}
const run=(ctx,s)=>vm.runInContext(s,ctx);
test('foto-voorbeeld: klik op exact getoonde 3-betekenissen-knop is altijd goed',async()=>{
 const {ctx,get}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','choice')");
 assert.equal(run(ctx,'currentQuestion().question'),'law-abiding / law abiding');
 const answer=run(ctx,'currentQuestion().answer');assert.equal(answer,'wetsgetrouw / gezagsgetrouw / ordelievend');
 const i=run(ctx,'session.choiceCorrectIndex');assert.ok(i>=0);
 assert.equal(run(ctx,`session.choiceOptions[${i}]`),answer);
 await ev(ctx,'choose-answer',{answerIndex:String(i),questionKey:'0'});
 assert.equal(run(ctx,'session.feedback.correct'),true);
 assert.match(get('#app').innerHTML,/choice-correct/);
 assert.match(get('#app').innerHTML,/Goed gedaan/);
 assert.match(get('#app').innerHTML,/Je koos:/);
});
test('één juiste vertaling bij typen: elke betekenis, ongeacht hoofdletters',async()=>{
 const {ctx}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','type')");
 for(const answer of ['wetsgetrouw','GEZAGSGETROUW','ordelievend'])assert.equal(run(ctx,`isCorrect(${JSON.stringify(answer)},currentQuestion().answer)`),true);
 run(ctx,"submitAnswer('GEZAGSGETROUW')");assert.equal(run(ctx,'session.feedback.correct'),true);
});
test('een achtergebleven knop van vorige vraag kan geen fout registreren',async()=>{
 const {ctx}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','choice')");
 const i=run(ctx,'session.choiceCorrectIndex');await ev(ctx,'choose-answer',{answerIndex:String(i),questionKey:'0'});
 await ev(ctx,'next-question',{});
 assert.equal(run(ctx,'session.questionNonce'),1);
 const before=run(ctx,'session.answered');
 await ev(ctx,'choose-answer',{answerIndex:String(i),questionKey:'0'});
 assert.equal(run(ctx,'session.answered'),before);
 assert.equal(run(ctx,'session.feedback'),null);
});
test('Slim leren keurt dezelfde keuze in tweede fase goed, en niet de volgende vraag',async()=>{
 const {ctx}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','learn');session.queue[0].stage=1;render()");
 const i=run(ctx,'session.choiceCorrectIndex');assert.ok(i>=0);
 await ev(ctx,'choose-answer',{answerIndex:String(i),questionKey:'0'});
 assert.equal(run(ctx,'session.feedback.correct'),true);
 assert.equal(run(ctx,'session.learn.errors.size'),0);
 assert.equal(run(ctx,'session.correct'),1);
});
