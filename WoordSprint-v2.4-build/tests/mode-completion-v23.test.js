'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {Accounts}=require('../lib/accounts');
const make=()=>{let now=Date.UTC(2026,10,16,12);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ws23-'));const accounts=new Accounts(path.join(dir,'accounts.json'),{clock:()=>now});return {accounts,now,tick:ms=>now+=ms};};
const list=()=>({id:'a',name:'Test',fromLang:'en-GB',toLang:'nl-NL',words:[
 {id:'w1',front:'cat',back:'kat',context:'The [[cat]] ran.'},
 {id:'w2',front:'dog',back:'hond',context:'The [[dog]] ran.'},
 {id:'w3',front:'apple',back:'appel'}
]});
test('Correct per-word completions are kept per mode and per direction',()=>{
 const {accounts:a}=make(),u=a.register('player','password123'),l=list();
 assert.deepEqual(a.modeCompletion(u,l,'choice'),{count:0,total:3,done:false});
 assert.equal(a.reviewAnswer(u,l,l.words[0],'incorrect','choice').correct,false);
 assert.equal(a.modeCompletion(u,l,'choice').count,0);
 a.reviewAnswer(u,l,l.words[0],'kat','choice');
 a.reviewAnswer(u,l,l.words[1],'hond','choice');
 assert.deepEqual(a.modeCompletion(u,l,'choice'),{count:2,total:3,done:false});
 a.reviewAnswer(u,l,l.words[2],'appel','choice');
 assert.deepEqual(a.modeCompletion(u,l,'choice'),{count:3,total:3,done:true});
 assert.equal(a.modeCompletion(u,l,'type').count,0);
 assert.equal(a.modeCompletion(u,l,'choice','reverse').count,0);
 a.reviewAnswer(u,l,l.words[0],'cat','choice','reverse');
 assert.equal(a.modeCompletion(u,l,'choice','reverse').count,1);
});
test('Another user starts at zero, repetitions and duplicate words do not inflate progress',()=>{
 const {accounts:a}=make(),l=list(),one=a.register('playerone','password123'),two=a.register('playertwo','password123');
 for(let i=0;i<12;i++)a.reviewAnswer(one,l,l.words[0],'kat','type');
 assert.equal(a.modeCompletion(one,l,'type').count,1);
 assert.equal(a.modeCompletion(two,l,'type').count,0);
 const edited={...l,words:[{...l.words[0],back:'poes'},...l.words.slice(1)]};
 assert.equal(a.modeCompletion(one,edited,'type').count,0);
 const withNewWord={...l,words:[...l.words,{id:'w4',front:'bird',back:'vogel'}]};
 assert.equal(a.modeCompletion(one,withNewWord,'type').total,4);
});
test('Slim leren requires final typing stage to mark a word complete',()=>{
 const {accounts:a}=make(),l=list(),u=a.register('typist','password123');
 a.reviewAnswer(u,l,l.words[0],'kat','learn','forward',1);
 a.reviewAnswer(u,l,l.words[0],'kat','learn','forward',2);
 assert.equal(a.modeCompletion(u,l,'learn').count,0);
 a.reviewAnswer(u,l,l.words[0],'kat','learn','forward',3);
 assert.equal(a.modeCompletion(u,l,'learn').count,1);
});
test('Context only counts words with usable sentences',()=>{
 const {accounts:a}=make(),l=list(),u=a.register('context','password123');
 assert.equal(a.modeCompletion(u,l,'context').total,2);
 a.reviewAnswer(u,l,l.words[0],'cat','context');
 a.reviewAnswer(u,l,l.words[1],'dog','context');
 assert.equal(a.modeCompletion(u,l,'context').done,true);
 assert.equal(a.modeCompletion(u,l,'context','reverse').done,true);
});
test('Memory and Koppelspel track all rounds of words and cannot be farmed',()=>{
 const {accounts:a}=make(),l=list(),u=a.register('gamer','password123');
 for(let m of ['memory','match']){
  const gameId=a.startGame(u,l,m,l.words.map(w=>w.id),'reverse').gameId;
  for(const w of l.words)a.finishGamePair(u,l,gameId,w.id,w.id);
  assert.equal(a.modeCompletion(u,l,m).done,true);
  assert.equal(a.modeCompletion(u,l,m,'reverse').done,true);
  assert.equal(a.modeCompletion(u,l,m).count,3);
 }
});
