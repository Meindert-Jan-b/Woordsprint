'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {Accounts,canonicalKey}=require('../lib/accounts');
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'woordsprint-test-'));let time=Date.now();return {a:new Accounts(path.join(dir,'accounts.json'),{clock:()=>time}),tick:ms=>time+=ms,dir};}
const list=(id='list1',wordId='w1')=>({id,name:'English',fromLang:'en-GB',toLang:'nl-NL',words:[{id:wordId,front:'law-abiding',back:'wetsgetrouw / gezagsgetrouw / ordelievend'}]});
test('accounts: unique usernames, hashed passwords, persistent sessions and per-user isolation',()=>{
 const {a,dir}=setup();const u=a.register('Leerling1','MijnUniekeWachtwoord9');const v=a.register('Leerling2','WachtwoordAnders9');
 assert.notEqual(u.pass,'MijnUniekeWachtwoord9');assert.throws(()=>a.register('leerling1','opnieuwWachtwoord'),/bezet/);
 assert.equal(a.login('leerling1','MijnUniekeWachtwoord9').id,u.id);assert.throws(()=>a.login('leerling1','verkeerd'),/klopt niet/);
 u.state.lists.push(list());a.persist();assert.deepEqual(v.state.lists,[]);
 const token=a.createSession(u);assert.equal(a.fromSession(token).id,u.id);assert.equal(new Accounts(path.join(dir,'accounts.json')).fromSession(token).id,u.id);
 a.endSession(token);assert.equal(a.fromSession(token),null);
});
test('WoordSprint v2.1: per pair/direction XP, independent of exercise mode',()=>{
 const {a}=setup(),u=a.register('woordfan','Superveilig123!'),l=list(),w=l.words[0];
 assert.equal(a.reviewAnswer(u,l,w,'wetsgetrouw','learn','forward',1).awardedXp,0);
 assert.equal(a.reviewAnswer(u,l,w,'gezagsgetrouw','learn','forward',3).awardedXp,10);
 const duplicate=list('another','newId');assert.equal(a.reviewAnswer(u,duplicate,duplicate.words[0],'wetsgetrouw','type').awardedXp,0);
 assert.equal(a.reviewAnswer(u,l,w,'law-abiding','type','reverse').awardedXp,5);
 assert.equal(a.profile(u).mastered,1);
});
test('Wrong answers never award XP and correct clicks only award once',()=>{
 const {a}=setup(),u=a.register('learner4','Superveilig123!'),l=list(),w=l.words[0];
 assert.equal(a.reviewAnswer(u,l,w,'onzin','type').awardedXp,0);
 assert.equal(a.reviewAnswer(u,l,w,'wetsgetrouw','choice').awardedXp,10);
 for(let i=0;i<15;i++)assert.equal(a.reviewAnswer(u,l,w,'wetsgetrouw','choice').awardedXp,0);
 assert.equal(a.quests(u).find(q=>q.id==='correct10').progress,1);
});
test('shop costs coins, cannot double-buy or spend more than balance',()=>{
 const {a}=setup();const u=a.register('learner6','Superveilig123!');assert.throws(()=>a.shopBuy(u,'gold'),/genoeg coins/);
 u.rewards.coins=500;const p=a.shopBuy(u,'gold');assert.equal(p.coins,0);assert.deepEqual(p.inventory,['gold']);
 assert.throws(()=>a.shopBuy(u,'gold'),/al/);assert.equal(a.equip(u,'gold').equipped,'gold');
});
test('friend requests, rejection, friends leaderboard and privacy opt-in',()=>{
 const {a}=setup();const x=a.register('alice_1','Superveilig123!'),y=a.register('bob_1','Superveilig123!');
 a.friendRequest(x,'bob_1');assert.equal(a.friendsView(y).requests[0].username,'alice_1');
 a.acceptFriend(y,x.id,true);assert.equal(a.friendsView(x).friends[0].username,'bob_1');
 assert.equal(a.leaderboard(x,'friends').length,2);
 const z=a.register('carol_1','Superveilig123!');assert.equal(a.leaderboard(x,'global').some(i=>i.id===z.id),false);
 z.privacy.showGlobal=true;assert.equal(a.leaderboard(x,'global').some(i=>i.id===z.id),true);
 a.removeFriend(x,y.id);assert.equal(a.friendsView(y).friends.length,0);
});
test('legacy migration uses one-time terminal code and keeps old lists separate',()=>{
 const {a,dir}=setup(); // instantiate new with legacy, so create legacy before it
 const oldPath=path.join(dir,'woordsprint.json');fs.writeFileSync(oldPath,JSON.stringify({lists:[list()],progress:{},activity:[{date:'2026-01-01',xp:800,answered:1}]}));
 const b=new Accounts(path.join(dir,'new-accounts.json'),{legacyPath:oldPath});const user=b.register('migrator','Superveilig123!');
 assert.throws(()=>b.claimLegacy(user,'wrong'),/klopt niet/);
 const code=fs.readFileSync(b.claimCodeFile,'utf8').match(/[a-f0-9]{28}/)[0];
 assert.equal(b.claimLegacy(user,code),1);assert.equal(user.state.activity[0].xp,0);
 assert.throws(()=>b.claimLegacy(user,code),/geen oude lijsten/i);
});

test('reversed study direction and reordered meanings cannot give second first-time XP',()=>{
 const a=list(),b={...a,id:'l2',fromLang:'nl-NL',toLang:'en-GB',words:[{id:'w2',front:'ordelievend / wetsgetrouw / gezagsgetrouw',back:'law-abiding'}]};
 assert.equal(canonicalKey(a,a.words[0]),canonicalKey(b,b.words[0]));
});

test('scramble letter puzzle is still a supported answer mode',()=>{
 const {a}=setup(),u=a.register('scrambler','Superveilig123!'),l=list();
 assert.equal(a.reviewAnswer(u,l,l.words[0],'wetsgetrouw','scramble').correct,true);
});
