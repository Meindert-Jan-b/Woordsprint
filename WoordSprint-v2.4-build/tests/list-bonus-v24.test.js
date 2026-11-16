'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Accounts,BONUS_MODES,BONUS_COINS_PER_WORD,GIFT_CARDS}=require('../lib/accounts');
const make=()=>{let time=Date.UTC(2026,10,16,12);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ws24-'));
 return {a:new Accounts(path.join(dir,'accounts.json'),{clock:()=>time}),dir};};
const list=(n,id='list')=>({id,name:'Engelse woorden',fromLang:'en-GB',toLang:'nl-NL',words:Array.from({length:n},(_,i)=>({id:'w'+i,front:'word'+i,back:'woord'+i}))});
const finish=(a,u,l,omit='')=>{for(const mode of BONUS_MODES.filter(x=>x!=='context'&&x!==omit))
 for(const w of l.words)a.markModeCompletedWord(u,l,w,mode,'forward');};

test('40 coins per canonical pair: 10, 25, 40 words scale to 400, 1000, 1600',()=>{
 for(const [size,coins] of [[10,400],[25,1000],[40,1600]]){
  const {a}=make(),u=a.register('user_'+size,'password123'),l=list(size);
  assert.equal(a.listBonusStatus(u,l).wordCount,size);
  assert.equal(a.listBonusStatus(u,l).possibleCoins,coins);
  finish(a,u,l);
  assert.equal(a.listBonusStatus(u,l).totalModes,12); // context has no examples
  const r=a.claimListBonus(u,l);
  assert.equal(r.coins,coins);
  assert.equal(u.rewards.coins,coins);
  assert.equal(a.claimListBonus(u,l).coins,0);
  assert.equal(u.rewards.coins,coins);
 }
 assert.equal(BONUS_COINS_PER_WORD,40);
 assert.equal(GIFT_CARDS.find(i=>i.id==='gift5').price,5000);
 assert.equal(GIFT_CARDS.find(i=>i.id==='gift10').price,10000);
});
test('All modes required; an uncompleted mode never pays list bonus',()=>{
 const {a}=make(),u=a.register('person','password123'),l=list(25);
 finish(a,u,l,'sprint');
 const s=a.listBonusStatus(u,l);
 assert.equal(s.completedModes,11);assert.equal(s.allDone,false);
 assert.throws(()=>a.claimListBonus(u,l),/alle beschikbare/i);
 assert.equal(u.rewards.coins,0);
 for(const w of l.words)a.markModeCompletedWord(u,l,w,'sprint','forward');
 assert.equal(a.claimListBonus(u,l).coins,1000);
});
test('Context counts only if a usable example sentence exists',()=>{
 const {a}=make(),u=a.register('sentences','password123'),l=list(3);
 l.words[0].context='I [[word0]] every day.';
 finish(a,u,l);
 assert.equal(a.listBonusStatus(u,l).totalModes,13);
 assert.equal(a.listBonusStatus(u,l).allDone,false);
 a.markModeCompletedWord(u,l,l.words[0],'context','forward');
 assert.equal(a.claimListBonus(u,l).coins,120);
});
test('Copies, reordering and reverse direction cannot pay again; partially overlapping lists pay only new words',()=>{
 const {a}=make(),u=a.register('duplicater','password123'),l=list(25);
 finish(a,u,l);assert.equal(a.claimListBonus(u,l).coins,1000);
 const copy={...l,id:'duplicate',name:'Nieuwe naam',words:l.words.map(w=>({...w,id:'copy_'+w.id})).reverse()};
 finish(a,u,copy);assert.equal(a.claimListBonus(u,copy).coins,0);
 // Reverse all the directional modes: still no extra list coins.
 for(const m of BONUS_MODES.filter(x=>!['context'].includes(x)))for(const w of copy.words)a.markModeCompletedWord(u,copy,w,m,'reverse');
 assert.equal(a.claimListBonus(u,copy,'reverse').coins,0);
 const extended={...l,id:'new',words:[...l.words,...list(5).words.map((w,i)=>({...w,id:'fresh'+i,front:'extra'+i,back:'extraVertaling'+i}))]};
 finish(a,u,extended);
 assert.equal(a.listBonusStatus(u,extended).possibleCoins,200);
 assert.equal(a.claimListBonus(u,extended).coins,200);
 assert.equal(u.rewards.coins,1200);
 const other=a.register('separate','password123');
 finish(a,other,l);assert.equal(a.claimListBonus(other,l).coins,1000);
});
test('Completing the final word of the final mode automatically pays once, even after server reload',()=>{
 const {a,dir}=make(),u=a.register('auto_user','password123'),l=list(25);
 u.state.lists.push(l);
 finish(a,u,l,'sprint');
 for(const w of l.words.slice(0,-1))a.markModeCompletedWord(u,l,w,'sprint','forward');
 const r=a.reviewAnswer(u,l,l.words.at(-1),l.words.at(-1).back,'sprint');
 assert.equal(r.listBonusCoins,1000);
 assert.equal(r.awardedCoins,1002); // also 2 learning coins
 assert.equal(u.rewards.coins>=1002,true);
 assert.equal(a.reviewAnswer(u,l,l.words.at(-1),l.words.at(-1).back,'sprint').listBonusCoins,undefined);
 a.persist();const b=new Accounts(path.join(dir,'accounts.json'));
 const reloaded=b.data.users.find(x=>x.username==='auto_user');
 assert.equal(b.claimListBonus(reloaded,reloaded.state.lists[0]).coins,0);
});
