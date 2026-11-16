'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {isCorrect,alternatives}=require('../public/answer-utils');

test('alle losse betekenissen bij de screenshot, ook met een OCR-opmerking',()=>{
 const examples=[
  'rechtszaak / proces (I ...)',
  'rechtszaak/proces (I ...)',
  'rechtszaak ／ proces (I ...)',
  'rechtszaak / proces (I ...',
  'rechtszaak; proces (I ...)',
  'rechtszaak / proces (in de rechtbank)'
 ];
 for(const meaning of examples){
  for(const answer of ['RECHTSZAAK','rechtszaak','Proces','proces'])assert.equal(isCorrect(answer,meaning),true,`${answer} bij ${meaning}`);
  assert.equal(isCorrect('procesje',meaning),false);
 }
 assert.equal(isCorrect('zaak','rechtszaak / proces (I ...)'),false);
 assert.equal(isCorrect('','rechtszaak / proces (I ...)'),false);
 assert.equal(isCorrect('zorg','rechtszaak / proces (I ...)'),false);
});
test('ook andere meervoudige vertalingen en (be)oordelen blijven werken',()=>{
 assert.equal(isCorrect('wetsgetrouw','wetsgetrouw / gezagsgetrouw / ordelievend'),true);
 assert.equal(isCorrect('GEZAGSGETROUW','wetsgetrouw / gezagsgetrouw / ordelievend'),true);
 assert.equal(isCorrect('ordelievend','wetsgetrouw / gezagsgetrouw / ordelievend'),true);
 assert.equal(isCorrect('oordelen','(be)oordelen'),true);
 assert.equal(isCorrect('beoordelen','(be)oordelen'),true);
 assert.equal(isCorrect('proces','proces (l ...'),true);
 assert.equal(isCorrect('wet','wettelijk'),false);
});
function setup(){
 const nodes=new Map();
 function get(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'',focus(){},appendChild(){},classList:{toggle(){}},remove(){}});return nodes.get(selector);}
 const words=[
 {id:'w1',front:'lawsuit',back:'rechtszaak / proces (I ...)'},
 {id:'w2',front:'lawyer',back:'jurist/advocaat'},
 {id:'w3',front:'court',back:'rechtbank'},
 {id:'w4',front:'illegal',back:'onwettig/illegaal'},
 {id:'w5',front:'trial',back:'proces/strafzaak'}
 ];
 const lists=[{id:'l1',name:'FU 51',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',source:'studygo',words}];
 const ctx={console,URL,FormData,Math,Date,JSON,Number,String,Map,Set,
 localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#lists'},setTimeout:()=>99,setInterval:()=>1,clearInterval(){},clearTimeout(){},
 window:{addEventListener(){}},document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({textContent:'',className:'',remove(){}})},
 fetch:async url=>({ok:true,async json(){if(url==='/api/state')return {lists,progress:{},activity:[]};if(url==='/api/config')return {qr:'',lanUrl:'http://localhost:3000'};if(url==='/api/practice')return {};throw Error(url);}})};
 vm.createContext(ctx);
 for(const file of ['answer-utils.js','cloze-utils.js','learn-engine.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),ctx);
 return {ctx,get};
}
const run=(ctx,s)=>vm.runInContext(s,ctx);
test('Slim leren hints: proces is goed bij rechtszaak / proces (I ...), en eigen invoer blijft zichtbaar',async()=>{
 const {ctx,get}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','learn');session.queue[0].stage=2;render()");
 assert.match(get('#app').innerHTML,/andere juiste betekenis mag ook/i);
 get('#answer-input').value='proces';
 await run(ctx,"handleSubmit({target:{id:'answer-form'},preventDefault(){}})");
 assert.equal(run(ctx,'session.feedback.correct'),true);
 assert.match(get('#app').innerHTML,/Jij typte:/);
 assert.match(get('#app').innerHTML,/value="proces"/);
 assert.match(get('#app').innerHTML,/Goed gedaan!/);
});
test('Slim leren Zelf typen: andere juiste betekenis en hoofdletters ook goed',async()=>{
 const {ctx,get}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','learn');session.queue[0].stage=3;render()");
 get('#answer-input').value='PROCES';
 await run(ctx,"handleSubmit({target:{id:'answer-form'},preventDefault(){}})");
 assert.equal(run(ctx,'session.feedback.correct'),true);
 assert.equal(run(ctx,'session.learn.completed.size'),1);
 assert.match(get('#app').innerHTML,/value="PROCES"/);
});
test('leeg antwoord is geen fout en houdt input op dezelfde vraag',async()=>{
 const {ctx,get}=setup();await new Promise(r=>setImmediate(r));
 run(ctx,"prefs.random=false;startSession('l1','learn');session.queue[0].stage=2;render()");
 get('#answer-input').value='  ';
 await run(ctx,"handleSubmit({target:{id:'answer-form'},preventDefault(){}})");
 assert.equal(run(ctx,'session.feedback'),null);
 assert.equal(run(ctx,'session.answered'),0);
});
