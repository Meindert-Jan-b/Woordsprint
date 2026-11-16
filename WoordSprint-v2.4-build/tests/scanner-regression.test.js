'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {tsvLines,pairAligned}=require('../lib/ocr-layout');
const {detectKnownPage}=require('../lib/known-page');
const english=tsvLines(fs.readFileSync(path.join(__dirname,'fixtures/boek51_english.tsv'),'utf8'));
const dutch=tsvLines(fs.readFileSync(path.join(__dirname,'fixtures/boek51_dutch.tsv'),'utf8'));
const references=fs.readFileSync(path.join(__dirname,'../voorbeeld-the-law-1.tsv'),'utf8').trim().split(/\r?\n/).map(row=>{
  const [front,back]=row.split('\t');return {front,back};
});
test('echte boekfoto: twee-regelige synoniemen koppelen aan eigen vertaling',()=>{
  const result=pairAligned(english,dutch);
  const map=new Map(result.pairs.map(p=>[p.front,p.back]));
  assert.equal(map.get('evident/obvious/apparent'),'duidelijk');
  assert.equal(map.get('the accused/the defendant'),'de beklaagde');
  assert.equal(map.get('to release'),'vrijlaten');
  assert.equal(map.get('to acquit'),'vrijspreken');
  assert.equal(map.get('lawyer'),'jurist/Advocaat');
  assert.equal(map.get('premises'),'paid/tew'); // OCR error remains for human review
  assert.equal(result.unmatchedLeft.includes('trial'),true); // Never steal 'lawsuit' translation.
  assert.equal(map.get('lawsuit'),'rechtszaak');
});
test('als het middelste woord Nederlands onleesbaar is, verschuiven alle latere paren niet',()=>{
  const l=[{text:'one',y:50,height:25},{text:'two',y:100,height:25},{text:'three',y:150,height:25}];
  const r=[{text:'een',y:52,height:25},{text:'drie',y:151,height:25}];
  assert.deepEqual(pairAligned(l,r).pairs,[{front:'one',back:'een'},{front:'three',back:'drie'}]);
});
test('drie synoniemen over twee regels vormen precies één woordpaar',()=>{
  const l=[{text:'first/second/',y:40,x:8,height:22},{text:'third',y:70,x:36,height:22},{text:'another',y:100,x:8,height:22}];
  const r=[{text:'betekenis',y:41,x:0,height:22},{text:'ander',y:101,x:0,height:22}];
  assert.deepEqual(pairAligned(l,r).pairs,[{front:'first/second/third',back:'betekenis'},{front:'another',back:'ander'}]);
});
test('een ontbrekende Engelse OCR-regel maakt geen onjuiste vertaling',()=>{
  const l=[{text:'red',y:10,height:22},{text:'blue',y:110,height:22}];
  const r=[{text:'rood',y:11,height:22},{text:'groen',y:60,height:22},{text:'blauw',y:112,height:22}];
  assert.deepEqual(pairAligned(l,r).pairs,[{front:'red',back:'rood'},{front:'blue',back:'blauw'}]);
});
test('herken alleen de bekende boekpagina bij sterke overeenkomst',()=>{
  const recognized=detectKnownPage(english,references);
  assert.equal(recognized.pairs.length,28);
  assert.ok(recognized.matched>=20);
  assert.deepEqual(recognized.pairs[14],{front:'evident/obvious/apparent',back:'duidelijk'});
  assert.equal(detectKnownPage(english.slice(0,8),references),null);
  assert.equal(detectKnownPage([{text:'trial',y:50,height:22},{text:'judge',y:100,height:22}],references),null);
});
