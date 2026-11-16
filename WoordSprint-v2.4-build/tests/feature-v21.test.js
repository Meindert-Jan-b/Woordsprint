'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {Accounts,canonicalKey}=require('../lib/accounts');
const {questionFor}=require('../public/cloze-utils');
const make=()=>{let time=Date.UTC(2026,10,16,10,0,0);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ws21-'));const a=new Accounts(path.join(dir,'accounts.json'),{clock:()=>time});return {a,dir,tick:ms=>time+=ms};};
const list=(id='l',wId='w')=>({id,name:'Engels',fromLang:'en-GB',toLang:'nl-NL',words:[{id:wId,front:'evident/obvious/apparent',back:'duidelijk',context:'It was [[obvious]] that he left.'}]});
test('Context accepts both synonyms and does not confuse tense',()=>{
 const l=list(),w=l.words[0],q=questionFor(w,l);
 assert.deepEqual(q.accepted.split(' / '),['obvious','evident','apparent']);
 const {a}=make(),u=a.register('contextlearner','password123!');
 assert.equal(a.reviewAnswer(u,l,w,'EVIDENT','context').correct,true);
 const irregular={id:'ate',front:'to eat',back:'eten',context:'Yesterday I [[ate]] an apple.'};
 assert.equal(questionFor(irregular,l).accepted,'ate');
 assert.equal(a.reviewAnswer(u,{...l,words:[irregular]},irregular,'eat','context').correct,false);
 assert.equal(a.reviewAnswer(u,{...l,words:[irregular]},irregular,'ate','context').correct,true);
});
test('all modes earn same 10 XP per new pair, no replay farming',()=>{
 const l=list();
 for(const mode of ['type','choice','hint','test','dictation','context','scramble','sprint']){
  const {a}=make(),u=a.register('fresh_'+mode,'secret12345');
  const r=a.reviewAnswer(u,l,l.words[0],mode==='context'?'apparent':'duidelijk',mode);
  assert.equal(r.awardedXp,10,mode);
  for(let i=0;i<8;i++)assert.equal(a.reviewAnswer(u,l,l.words[0],mode==='context'?'evident':'duidelijk',mode).awardedXp,0,mode);
 }
});
test('Slim leren only rewards final step; E→N vs N→E rewards 10 then 5',()=>{
 const {a}=make(),u=a.register('bothways','secret12345'),l=list(),w=l.words[0];
 for(let step=1;step<=2;step++)assert.equal(a.reviewAnswer(u,l,w,'duidelijk','learn','forward',step).awardedXp,0);
 assert.equal(a.reviewAnswer(u,l,w,'duidelijk','learn','forward',3).awardedXp,10);
 assert.equal(a.reviewAnswer(u,l,w,'duidelijk','learn','reverse',1).awardedXp,0);
 assert.equal(a.reviewAnswer(u,l,w,'obvious','learn','reverse',3).awardedXp,5);
 assert.equal(a.reviewAnswer(u,l,w,'apparent','learn','reverse',3).awardedXp,0);
 const duplicate=list('another','anotherWord');assert.equal(a.reviewAnswer(u,duplicate,duplicate.words[0],'duidelijk','type').awardedXp,0);
 assert.equal(a.profile(u).mastered,1);
});
test('4 rounds of 8-game pairs are individually validated and capped',()=>{
 const {a}=make(),u=a.register('player','secret12345');
 const l={...list(),words:Array.from({length:31},(_,i)=>({id:'p'+i,front:'english'+i,back:'nederlands'+i}))};
 const {gameId}=a.startGame(u,l,'match',l.words.map(w=>w.id),'reverse');
 let total=0;for(const w of l.words){const r=a.finishGamePair(u,l,gameId,w.id,w.id);total+=r.awardedXp;}
 assert.equal(total,310);
 assert.throws(()=>a.finishGamePair(u,l,gameId,l.words[0].id,l.words[0].id),/Geen nieuw/);
 // Matching has no quiz direction: switching visual buttons cannot exploit reversed XP.
 const {gameId:other}=a.startGame(u,l,'memory',l.words.map(w=>w.id),'forward');
 assert.equal(a.finishGamePair(u,l,other,l.words[0].id,l.words[0].id).awardedXp,0);
 assert.throws(()=>a.finishGamePair(u,l,other,l.words[0].id,l.words[1].id),/geen|Geen/);
});
test('flashcards award same XP after a revealed, viewed card',()=>{
 const {a,tick}=make(),u=a.register('flashlearner','password123'),l=list();
 const {gameId}=a.startGame(u,l,'flash',[l.words[0].id],'forward');
 assert.throws(()=>a.finishGamePair(u,l,gameId,'w','w',true),/Bekijk/);
 a.revealSelf(u,gameId,'w');tick(1500);
 assert.equal(a.finishGamePair(u,l,gameId,'w','w',true).awardedXp,10);
});
test('owner-only gift-card request: reserve, reject refund, deliver; no automatic Robux trade',()=>{
 const {a,dir}=make(),owner=a.register('beheerder','password123'),user=a.register('leerling','password123');
 assert.throws(()=>a.ownerEnable(user,true),/Alleen de beheerder/);
 assert.throws(()=>a.requestGift(user,'gift5'),/nog niet beschikbaar/);
 const code=fs.readFileSync(path.join(dir,'BEHEERDER-CODE-PRIVE.txt'),'utf8').match(/[a-f0-9]{32}/)[0];
 a.ownerClaim(owner,code);a.ownerEnable(owner,true);user.rewards.coins=11000;
 const {request}=a.requestGift(user,'gift5');assert.equal(user.rewards.coins,6000);
 assert.throws(()=>a.requestGift(user,'gift5'),/in behandeling/);
 assert.throws(()=>a.ownerReview(user,request.id,'rejected'),/Alleen/);
 a.ownerReview(owner,request.id,'rejected');assert.equal(user.rewards.coins,11000);
 const next=a.requestGift(user,'gift5');a.ownerReview(owner,next.request.id,'delivered');assert.equal(user.rewards.coins,6000);
 assert.equal(a.profile(user).redemptions[0].status,'delivered');
});
