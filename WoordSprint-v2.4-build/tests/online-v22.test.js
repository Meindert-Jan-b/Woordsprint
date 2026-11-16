'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCloudStore,createWriteQueue}=require('../lib/cloud-state');
const {config,payload,sendOwnerMessage}=require('../lib/whatsapp');
const env={SUPABASE_URL:'https://example-project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_dummy'};
test('Cloud backend sends secret as apikey only, round trips JSON',async()=>{
 let saved=null,headers=[];
 const transport=async(url,options)=>{
   headers.push(options.headers);
   assert.match(url,/https:\/\/example-project.supabase.co\/rest\/v1\/woordsprint_state/);
   if(options.method==='POST'){saved=JSON.parse(options.body).payload;return {ok:true,text:async()=>''};}
   return {ok:true,text:async()=>JSON.stringify(saved?[{payload:saved}]:[])};
 };
 const db=createCloudStore(env,transport);
 assert.equal(await db.load(),null);
 await db.save({users:[{id:'a',username:'test'}],sessions:[]});
 assert.deepEqual((await db.load()).users,[{id:'a',username:'test'}]);
 assert.ok(headers.every(h=>h.apikey==='sb_secret_dummy'&&!('Authorization' in h)));
});
test('Remote writes serialized and snapshots taken at mutation time',async()=>{
 const states=[];
 const store={save:async x=>{await new Promise(r=>setTimeout(r,2));states.push(x);}};
 const queue=createWriteQueue(store);const data={users:[]};
 data.users.push({name:'A'});queue.enqueue(data);
 data.users.push({name:'B'});queue.enqueue(data);
 await queue.flush();
 assert.deepEqual(states.map(s=>s.users.length),[1,2]);
});
test('WhatsApp is optional and does not send without owner config',async()=>{
 let invoked=false;
 assert.equal(config({}),null);
 const result=await sendOwnerMessage({id:'abc'},'Pieter','cadeaubon',{},async()=>{invoked=true;});
 assert.equal(result.status,'not_configured');assert.equal(invoked,false);
});
test('WhatsApp only notifies configured owner with approved template',async()=>{
 const wa={WA_ACCESS_TOKEN:'token',WA_PHONE_NUMBER_ID:'123456789',WA_OWNER_NUMBER:'+31612345678',WA_TEMPLATE_NAME:'woordsprint_aanvraag',WA_TEMPLATE_LANG:'nl',WA_GRAPH_VERSION:'v27.0'};
 const request={id:'123'};
 let seen;
 const result=await sendOwnerMessage(request,'Student','Roblox-cadeaubon €5',wa,async(url,init)=>{
  seen={url,init};return {ok:true,json:async()=>({messages:[{id:'wamid.123'}]})};
 });
 assert.equal(result.status,'sent');assert.equal(result.messageId,'wamid.123');
 assert.equal(seen.url,'https://graph.facebook.com/v27.0/123456789/messages');
 assert.equal(JSON.parse(seen.init.body).to,'31612345678');
 assert.equal(JSON.parse(seen.init.body).template.components[0].parameters[0].text,'Student');
 assert.ok(!JSON.stringify(seen.init.body).includes('token'));
});
test('Bad Meta response is a visible failure, never marked sent',async()=>{
 const wa={WA_ACCESS_TOKEN:'token',WA_PHONE_NUMBER_ID:'123456789',WA_OWNER_NUMBER:'31612345678'};
 const result=await sendOwnerMessage({id:'abc'},'Student','€5',wa,async()=>({ok:false,status:400,json:async()=>({error:{message:'Template not approved'}})}));
 assert.equal(result.status,'failed');assert.match(result.message,/Template not approved/);
});
