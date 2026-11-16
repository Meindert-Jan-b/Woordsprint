'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function boot(){
 const nodes=new Map(),listeners={};const get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},appendChild(){},focus(){},remove(){}});return nodes.get(s);};
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
  else if(url==='/api/rewards')data={profile:profile(),catalog:[{id:'first',title:'Eerste woord',icon:'🌱',description:'1 woord',xp:20,coins:15}],shop:[{id:'neon',title:'Neon thema',description:'Kleur',icon:'🎨',price:250}],quests:[{id:'new3',title:'Leer 3 woorden',progress:0,target:3,reward:20,done:false}],audit:[]};
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
  location:{hash:'#dashboard'},window:{addEventListener(n,cb){listeners[n]=cb;}},localStorage:{getItem(){return null},setItem(){}},
  fetch,setTimeout:()=>1,setInterval:()=>1,clearTimeout(){},clearInterval(){},confirm:()=>true};
 const Answers=require('../public/answer-utils');vm.createContext(ctx);
 for(const file of ['answer-utils.js','cloze-utils.js','learn-engine.js','context-examples.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),ctx);
 return {ctx,get,calls,profile,lists,run:src=>vm.runInContext(src,ctx),listeners};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('login and register screen followed by personalized dashboard, shop, friends and leaderboard',async()=>{
 const a=boot();await flush();assert.match(a.get('#app').innerHTML,/Registreren/);
 await a.run("handleSubmit({target:{id:'auth-form',elements:{username:{value:'Leerling123'},password:{value:'EenGoedWachtwoord12'}}},preventDefault(){}})");
 await flush();assert.match(a.get('#app').innerHTML,/Woordjes leren/);assert.equal(a.get('#top-avatar').textContent,'L');
 a.run("location.hash='#rewards'");await a.run('refreshAndRenderSocial()');assert.match(a.get('#app').innerHTML,/Officiële Roblox-cadeaubonnen/);assert.match(a.get('#app').innerHTML,/Neon thema/);
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
