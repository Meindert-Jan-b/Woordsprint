'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('StudyGo importpagina: voorbeeld, preview en opslaan via bestaande API',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',appendChild(){},focus(){},classList:{toggle(){}}});return nodes.get(id);};
 const lists=[];const ctx={console,URL,FormData,Math,Date,JSON,Number,String,Map,Set,
  localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#studygo'},setTimeout:()=>{},setInterval:()=>{},clearInterval:()=>{},clearTimeout:()=>{},
  window:{addEventListener(){}},document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({textContent:'',className:'',remove(){}})},
  fetch:async(url,init={})=>{
   let data,status=200;
   if(url==='/api/state')data={lists,activity:[],progress:{}};
   else if(url==='/api/config')data={lanUrl:'http://localhost:3000',qr:''};
   else if(url==='/api/import/paste')data={pairs:[{front:'lawyer',back:'advocaat/jurist'},{front:'to acquit',back:'vrijspreken'}],title:'The law',method:'gekopieerde woordparen'};
   else if(url==='/api/lists'){
    data={...JSON.parse(init.body),id:'test-id',words:JSON.parse(init.body).words.map((w,i)=>({...w,id:String(i)}))};lists.unshift(data);status=201;
   }else throw Error('Onverwachte URL: '+url);
   return {ok:status<400,status,async json(){return data;}};
  }
 };
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/answer-utils.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/cloze-utils.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),ctx);
 for(let i=0;i<10&&!get('#app').innerHTML.includes('Importeer uit StudyGo');i++)await new Promise(r=>setImmediate(r));
 assert.match(get('#app').innerHTML,/Importeer uit StudyGo/);
 assert.match(get('#app').innerHTML,/PDF/);
 vm.runInContext("studygoDraft.paste='lawyer\\tadvocaat/jurist'",ctx);
 await vm.runInContext("handleClick({target:{closest:()=>({dataset:{action:'studygo-paste'}})}})",ctx);
 assert.match(get('#app').innerHTML,/2 woordparen klaar om te leren/);
 vm.runInContext("studygoDraft.name='Engels The law'",ctx);
 await vm.runInContext("handleClick({target:{closest:()=>({dataset:{action:'studygo-save'}})}})",ctx);
 assert.equal(lists.length,1);assert.equal(lists[0].words.length,2);assert.equal(lists[0].name,'Engels The law');
});
