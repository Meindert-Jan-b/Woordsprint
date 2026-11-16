'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(){
 const elements={};const get=s=>elements[s]||=( {innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},focus(){},appendChild(){},remove(){}});
 const list={id:'l1',name:'Engels 31',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',words:Array.from({length:31},(_,i)=>({id:'w'+i,front:'English'+i,back:'Nederlands'+i}))};
 const user={id:'u',username:'tester',xp:0,coins:0,badges:[],inventory:[]};
 const fetch=async(url)=>({ok:true,json:async()=>url==='/api/auth/me'?{user}:url==='/api/state'?{lists:[list],progress:{},activity:[]}:url==='/api/profile'?user:url==='/api/game/start'?{gameId:'game'}:{ok:true}});
 const ctx={console,Date,Math,Map,Set,JSON,Number,String,URL,FormData,
   document:{body:{classList:{add(){},remove(){}}},querySelector:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({})},
   window:{addEventListener(){}},location:{hash:'#list/l1'},localStorage:{getItem(){return null},setItem(){}},
   fetch,clearTimeout(){},setTimeout:()=>1,clearInterval(){},setInterval:()=>1,confirm:()=>true};
 vm.createContext(ctx);
 for(const f of ['answer-utils.js','cloze-utils.js','learn-engine.js','context-examples.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',f),'utf8'),ctx);
 return {run:s=>vm.runInContext(s,ctx),get};
}
test('31 words occupy 4 Koppelspel rounds, including final 7',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.run('prefs.random=false;startSession("l1","match")');
 assert.equal(f.run('session.fullGameWords.length'),31);
 assert.equal(f.run('session.words.length'),8);
 for(let i=1;i<4;i++){f.run('session.roundIndex++;beginGameRound(session)');assert.equal(f.run('session.words.length'),i===3?7:8);}
});
test('31 words occupy 6 Memory rounds, including last 1',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.run('prefs.random=false;startSession("l1","memory")');
 assert.equal(f.run('session.words.length'),6);
 f.run('session.roundIndex=5;beginGameRound(session)');
 assert.equal(f.run('session.words.length'),1);
});
test('switch direction is easy and restarts Smart learning',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));
 f.run('prefs.random=false;startSession("l1","learn")');
 assert.equal(f.run('session.queue[0].stage'),0);
 assert.equal(f.run('session.queue[6].stage'),0);
 assert.equal(f.run('session.queue[7].stage'),2);
 const html=f.get('#app').innerHTML;
 assert.match(html,/E → N/);assert.match(html,/N → E/);
});
