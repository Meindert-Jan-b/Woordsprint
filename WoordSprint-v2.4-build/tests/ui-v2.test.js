'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function boot(){
 const nodes=new Map(),storage=new Map(),listeners={};const get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},appendChild(){},focus(){},remove(){}});return nodes.get(s);};
 const lists=[{id:'l1',name:'FU 51 The law',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',source:'studygo',words:[{id:'w1',front:'law-abiding',back:'wetsgetrouw / gezagsgetrouw / ordelievend'},{id:'w2',front:'lawsuit',back:'rechtszaak / proces (I ...)'}]}];
 let username=null,xp=0,coins=0;const calls=[];
 const profile=()=>({id:'u1',username,level:1,xp,coins,streak:0,mastered:0,badges:[],inventory:[],equipped:null,privacy:{showGlobal:false},friends:0});
 const fetch=async(url,init={})=>{calls.push([url,init]);const body=init.body?JSON.parse(init.body):{};let data;
  if(url==='/api/auth/me')data={user:username?profile():null};
  else if(url==='/api/auth/register'||url==='/api/auth/login'){username=body.username;data={user:profile()};}
  else if(url==='/api/auth/logout'){username=null;data={ok:true};}
  else if(url==='/api/profile')data=profile();
  else if(url==='/api/state')data={lists,progress:{},activity:[]};
  else if(url==='/api/config')data={qr:'',lanUrl:'http://localhost:3000/#scan'};
  else if(url==='/api/friends')data={friends:[],requests:[]};
  else if(url.startsWith('/api/leaderboard'))data=[{id:'u1',username,level:1,weeklyXp:0}];
  else if(url==='/api/game/start')data={gameId:'mock'};
  else if(url==='/api/game/match')data={correct:true,awardedXp:10,awardedCoins:2,profile:profile(),badges:[]};
  else if(url==='/api/game/reveal')data={ok:true};
  else if(url==='/api/practice'){
   const w=lists[0].words.find(w=>w.id===body.wordId);const expected=body.direction==='reverse'?w.front:w.back;
   const correct=Answers.isCorrect(body.given,expected);if(correct){xp+=10;coins+=2;}
   data={correct,expected,awardedXp:correct?10:0,awardedCoins:correct?2:0,badges:[],profile:profile(),stat:{correct:correct?1:0,wrong:correct?0:1,mastery:correct?1:0},activity:{date:'2026-11-16',correct:correct?1:0,answered:1,xp:correct?10:0}};
  }else data={ok:true};return {ok:true,json:async()=>data};
 };
 const ctx={console,Math,Date,JSON,Map,Set,Number,String,URL,FormData,
  document:{body:{classList:{add(){},remove(){}}},querySelector:get,querySelectorAll:()=>[],addEventListener(n,cb){listeners[n]=cb;},createElement:()=>({textContent:'',className:'',remove(){}})},
  location:{hash:'#dashboard'},window:{addEventListener(n,cb){listeners[n]=cb;}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  fetch,setTimeout:()=>1,setInterval:()=>1,clearTimeout(){},clearInterval(){},confirm:()=>true};
 const Answers=require('../public/answer-utils');vm.createContext(ctx);
 for(const file of ['answer-utils.js','cloze-utils.js','learn-engine.js','context-examples.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),ctx);
 return {ctx,get,calls,profile,lists,run:src=>vm.runInContext(src,ctx),listeners};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('login and register screen followed by personalized dashboard, friends and leaderboard',async()=>{
 const a=boot();await flush();assert.match(a.get('#app').innerHTML,/Registreren/);
 await a.run("handleSubmit({target:{id:'auth-form',elements:{username:{value:'Leerling123'},password:{value:'EenGoedWachtwoord12'}}},preventDefault(){}})");
 await flush();assert.match(a.get('#app').innerHTML,/Woordjes leren/);assert.equal(a.get('#top-avatar').textContent,'L');
 a.run("location.hash='#rewards'");await a.run('refreshAndRenderSocial()');assert.match(a.get('#app').innerHTML,/Woordjes leren/);assert.ok(!a.calls.some(([url])=>url==='/api/rewards'));
 a.run("location.hash='#friends'");await a.run('refreshAndRenderSocial()');assert.match(a.get('#app').innerHTML,/Vriend toevoegen/);
 a.run("location.hash='#leaderboard'");await a.run('refreshAndRenderSocial()');assert.match(a.get('#app').innerHTML,/Deze week/);
 a.run("location.hash='#profile';render()");assert.match(a.get('#app').innerHTML,/Leerling123/);
});
test('Slim leren uses server-validated correct answer and records actual awarded XP (not fake XP)',async()=>{
 const a=boot();await flush();await a.run("handleSubmit({target:{id:'auth-form',elements:{username:{value:'Leraar007'},password:{value:'EenGoedWachtwoord12'}}},preventDefault(){}})");await flush();
 a.run("prefs.random=false;startSession('l1','learn');session.queue[0].stage=1;render();");
 const correctIndex=a.run('session.choiceCorrectIndex');assert.ok(correctIndex>=0);
 const answer=a.run('currentQuestion().answer');
 await a.run(`submitAnswer(${JSON.stringify(answer)},${correctIndex},true)`);
 assert.equal(a.run('session.feedback.correct'),true);
 assert.equal(a.run('session.earnedXp'),10);
 assert.match(a.get('#app').innerHTML,/10 XP/);
 const req=a.calls.filter(c=>c[0]==='/api/practice').pop();assert.equal(JSON.parse(req[1].body).given,answer);assert.equal(JSON.parse(req[1].body).correct,undefined);
});
test('typing one meaning works and flashcards use verified game route',async()=>{
 const a=boot();await flush();await a.run("handleSubmit({target:{id:'auth-form',elements:{username:{value:'Leraar008'},password:{value:'EenGoedWachtwoord12'}}},preventDefault(){}})");await flush();
 a.run("prefs.random=false;startSession('l1','learn');session.queue[0].stage=2;render()");
 await a.run("submitAnswer('GEZAGSGETROUW')");assert.equal(a.run('session.feedback.correct'),true);
 a.run("startSession('l1','flash');session.gameReady=true;session.gameId='mock';session.showAnswer=true;render()");
 await a.run("handleClick({target:{closest:()=>({dataset:{action:'self-grade',correct:'true'}})}})");
 assert.equal(a.run('session.earnedXp'),10);
});

test('Slim leren resumes the saved queue and starts fresh after finishing',async()=>{
 const a=boot();
 await flush();
 await a.run("handleSubmit({target:{id:'auth-form',elements:{username:{value:'Leerling123'},password:{value:'EenGoedWachtwoord12'}}},preventDefault(){}})");
 a.run("prefs.random=false;startSession('l1','learn');nextQuestion();session.learn.errors.set('w1',1);render();");
 const expected=a.run("JSON.stringify({index:session.index,queue:session.queue})");
 a.run("location.hash='#list/l1';render();");
 assert.match(a.get('#app').innerHTML,/Slim leren hervatten/);
 a.run("startSession('l1','learn');");
 assert.equal(a.run("JSON.stringify({index:session.index,queue:session.queue})"),expected);
 assert.equal(a.run("session.learn.errors.get('w1')"),1);
 a.run("session=null;render()");
 assert.equal(a.run('session.index'),1);
 a.run("finishSession();startSession('l1','learn');");
 assert.equal(a.run('session.index'),0);
});

test('book text groups numbered paragraphs into searchable chapters',()=>{
 const a=boot();
 a.run(`bookData=[readBookText('Duits\\n# Hoofdstuk 1\\n## 1.1 Intro\\ndas Buch - het boek\\n## 1.2 School\\ndie Schule - de school\\n# Hoofdstuk 2\\n## 2.1 Reizen\\nder Zug - de trein')].map(book=>({...book,chapters:book.chapters.map(chapter=>({...chapter,wordCount:chapter.words.length}))}))`);
 assert.match(a.run('bookRows()'),/Hoofdstuk 1[\s\S]*1\.1 Intro[\s\S]*1\.2 School[\s\S]*Hoofdstuk 2/);
 a.run("bookSearch='1.2'");
 assert.match(a.run('bookRows()'),/1\.2 School/);
 assert.doesNotMatch(a.run('bookRows()'),/1\.1 Intro|2\.1 Reizen/);
});
