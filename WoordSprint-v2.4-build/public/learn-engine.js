'use strict';
(function(root){
  const STAGES=['flash','choice','hint','type'];
  const NAMES=['Bekijken','Meerkeuze','Hints','Zelf typen'];
  // Interleaved learning. Three new cards, then their choices; one fresh card,
  // then the first three hints; two new cards, then the first three typed tests.
  // Subsequent waves build on cards that have already been introduced.
  function create(words){
    if(!Array.isArray(words)||!words.length)throw Error('Geen woorden voor Slim leren.');
    return {words:[...words],introduced:0,completed:new Set(),errors:new Map(),groups:[],groupIndex:0};
  }
  function initialTasks(engine,build){
    const waves=[];let next=0,ready=[];
    const add=(n)=>{const result=engine.words.slice(next,next+n);next+=result.length;waves.push(...result.map(w=>({...build(w),stage:0})));ready.push(...result);};
    add(3);
    while(ready.length){
      const active=ready.splice(0,3);
      waves.push(...active.map(w=>({...build(w),stage:1})));
      if(next<engine.words.length)add(1);
      waves.push(...active.map(w=>({...build(w),stage:2})));
      if(next<engine.words.length)add(2);
      waves.push(...active.map(w=>({...build(w),stage:3})));
    }
    engine.introduced=next;
    return waves;
  }
  function schedule(engine,queue,index,q,correct){
    if(!q||!Number.isInteger(q.stage)||q.stage<0||q.stage>3)throw Error('Ongeldige leerfase.');
    if(correct){if(q.stage===3)engine.completed.add(q.wordId);return;}
    engine.errors.set(q.wordId,(engine.errors.get(q.wordId)||0)+1);
    // Retry before allowing this word to progress to its next phase. Other words
    // remain in between; one bad card never freezes the whole exercise.
    const pending=[];
    for(let i=queue.length-1;i>index;i--)if(queue[i].wordId===q.wordId){pending.unshift(...queue.splice(i,1));}
    const pos=Math.min(queue.length,index+3);
    queue.splice(pos,0,{...q},...pending);
  }
  function advance(){return null;} // kept for compatibility with older frontends
  const api={STAGES,NAMES,create,initialTasks,schedule,advance};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WoordLearn=api;
})(typeof globalThis!=='undefined'?globalThis:this);
