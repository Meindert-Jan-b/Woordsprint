'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {tsvLines}=require('../lib/ocr-layout');
const {discoverGlossary}=require('../lib/auto-glossary');
const fixture=path.join(__dirname,'fixtures','full-photo.tsv');
test('whole photograph automatically finds right-hand glossary, not example sentences',()=>{
  const raw=fs.readFileSync(fixture,'utf8');
  const p=discoverGlossary(tsvLines(raw),1536,2048);
  assert.ok(p,'glossary detected');
  assert.ok(p.diagnostics.parallelRows>=20,JSON.stringify(p.diagnostics));
  assert.ok(p.leftX>810&&p.leftX<915,JSON.stringify(p));
  assert.ok(p.boundary>1030&&p.boundary<1150,JSON.stringify(p));
  assert.ok(p.rightX>1250&&p.rightX<1400,JSON.stringify(p));
  assert.ok(p.top<300&&p.top>190);assert.ok(p.bottom>1230&&p.bottom<1380);
});
test('not fooled by a full page with no glossary',()=>{
 const lines=Array.from({length:16},(_,i)=>({x:100+(i%2)*90,y:50+i*40,height:20,end:300,text:'A long example sentence on the page.'}));
 assert.equal(discoverGlossary(lines,1536,2048),null);
});

test('real complete photograph + column recognition: 28 separate pairs, including wrapped words',()=>{
  const {pairAligned}=require('../lib/ocr-layout');
  const left=tsvLines(fs.readFileSync(path.join(__dirname,'fixtures/auto_english.tsv'),'utf8'));
  const right=tsvLines(fs.readFileSync(path.join(__dirname,'fixtures/auto_dutch.tsv'),'utf8'));
  const got=pairAligned(left,right);
  assert.equal(got.pairs.length,28);
  const map=new Map(got.pairs.map(p=>[p.front,p.back]));
  assert.equal(map.get('evident/obvious/apparent'),'duidelijk');
  assert.equal(map.get('the accused/the defendant'),'de beklaagde');
  assert.equal(map.get('to acquit'),'vrijspreken');
  assert.equal(map.get('solicitor'),'advocaat');
  assert.equal(map.get('barrister'),'advocaat');
  assert.equal(got.unmatchedLeft.length,0);
});
test('auto detection still works with rotated and perspective-shifted geometry',()=>{
  const original=tsvLines(fs.readFileSync(fixture,'utf8'));
  const warped=original.map(l=>({...l,x:l.x-.045*(l.y-1000),end:l.end-.045*(l.y-1000),y:l.y+.045*(l.x-760)}));
  const got=discoverGlossary(warped,1536,2048);
  assert.ok(got&&got.diagnostics.parallelRows>=20);
  assert.ok(got.boundary>950&&got.boundary<1200);
});

test('vindt een korte woordenlijst met wijde kolommen en voorbeeldzinnen',()=>{
 const lines=['apple','pear','grape','plum'].flatMap((word,index)=>{
   const y=120+index*48;
   return [
     {text:word,x:20,end:66,y,height:12},
     {text:['appel','peer','druif','pruim'][index],x:700,end:750,y,height:12},
     {text:'This is a complete example sentence.',x:140,end:420,y,height:12}
   ];
 });
 const result=discoverGlossary(lines,900,1000);
 assert.ok(result);
 assert.ok(result.leftX<20);
 assert.ok(result.boundary>650);
 assert.equal(result.diagnostics.parallelRows,4);
});
