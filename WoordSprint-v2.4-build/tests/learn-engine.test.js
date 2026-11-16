'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),learn=require('../public/learn-engine');
const make=n=>Array.from({length:n},(_,i)=>({id:'w'+i,front:'F'+i,back:'B'+i}));
const build=w=>({wordId:w.id,question:w.front,answer:w.back});
test('interleaves 3 new, 3 choices, 1 new, 3 hints, 2 new, 3 typing',()=>{
 const e=learn.create(make(11)),q=learn.initialTasks(e,build);
 assert.deepEqual(q.slice(0,16).map(t=>t.wordId+':'+t.stage),[
 'w0:0','w1:0','w2:0','w0:1','w1:1','w2:1','w3:0','w0:2','w1:2','w2:2','w4:0','w5:0','w0:3','w1:3','w2:3','w3:1']);
 assert.equal(q.length,44);assert.equal(new Set(q.map(x=>x.wordId)).size,11);
 for(const w of make(11))assert.deepEqual(q.filter(x=>x.wordId===w.id).map(x=>x.stage),[0,1,2,3]);
});
test('few words, mixed introduction and completion',()=>{
 for(const n of [1,2,3,4,5,7,31]){
  const e=learn.create(make(n)),q=learn.initialTasks(e,build);
  assert.equal(q.length,n*4);
  q.forEach((task,i)=>learn.schedule(e,q,i,task,true));
  assert.equal(e.completed.size,n);
 }
});
test('wrong answer must be retried before next phase of the same word',()=>{
 const e=learn.create(make(7)),q=learn.initialTasks(e,build);
 learn.schedule(e,q,0,q[0],false);
 const seen=q.filter((task,i)=>i>0&&task.wordId==='w0').map(task=>task.stage);
 assert.deepEqual(seen,[0,1,2,3]);
 assert.equal(e.errors.get('w0'),1);
});
