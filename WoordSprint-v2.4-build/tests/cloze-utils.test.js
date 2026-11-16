'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readCloze,questionFor}=require('../public/cloze-utils');
const {isCorrect}=require('../public/answer-utils');
const enToNl={fromLang:'en-GB',toLang:'nl-NL'};
const nlToEn={fromLang:'nl-NL',toLang:'en-GB'};
const builtins={'to eat':'Yesterday I [[ate]] an apple.','illegal':'It is [[illegal]] to steal.'};
test('verleden tijd: hint in Nederlands, Engelse invulzin en alleen juiste vorm',()=>{
  const q=questionFor({id:'1',front:'to eat',back:'eten'},enToNl,builtins);
  assert.equal(q.question,'eten');
  assert.equal(q.contextBefore,'Yesterday I ');
  assert.equal(q.contextAfter,' an apple.');
  assert.equal(q.answer,'ate');
  assert.equal(q.contextFilled,'Yesterday I ate an apple.');
  assert.equal(isCorrect('ate',q.accepted),true);
  assert.equal(isCorrect('ATE',q.accepted),true);
  assert.equal(isCorrect('eat',q.accepted),false);
});
test('herkent ook wanneer Nederlands links en Engels rechts staat',()=>{
  const q=questionFor({id:'2',front:'eten',back:'to eat',context:'Last week we [[ate]] together.'},nlToEn);
  assert.equal(q.question,'eten');
  assert.equal(q.answer,'ate');
  assert.equal(q.aLang,'en-GB');
});
test('een zinsvorm mag afwijken van het Engelse woordenboekwoord',()=>{
  const q=questionFor({id:'3',front:'to defend',back:'verdedigen',context:'The lawyer [[defended]] the accused yesterday.'},enToNl);
  assert.equal(q.answer,'defended');
  assert.equal(isCorrect('defend',q.accepted),false);
});
test('alternatieve grammaticaal juiste vormen kunnen expliciet worden opgegeven',()=>{
  const q=questionFor({id:'4',front:'witness',back:'getuige',context:'She saw a [[witness]] nearby.',contextForms:'eyewitness'},enToNl);
  assert.equal(isCorrect('eyewitness',q.accepted),true);
  assert.equal(isCorrect('WITNESS',q.accepted),true);
});
test('de invoer mag geen tweede antwoord of lege haken bevatten',()=>{
 assert.equal(readCloze('I [[eat]] and [[drink]].'),null);
 assert.equal(readCloze('I [[ ]] an apple.'),null);
 assert.equal(readCloze('Nothing to hide.'),null);
 assert.equal(questionFor({id:'5',front:'legal',back:'juridisch'},enToNl),null);
 assert.equal(questionFor({id:'6',front:'legal',back:'juridisch',context:'A [[legal]] [[trial]]'},enToNl),null);
});
test('oude contextAnswer (oude vertaling) mag geen goed antwoord meer worden',()=>{
 const q=questionFor({id:'7',front:'to eat',back:'eten',context:'Yesterday I [[ate]] an apple.',contextAnswer:'eten'},enToNl);
 assert.equal(isCorrect('eten',q.accepted),false);
});
test('accenten en hoofdletters maken geen verschil binnen een zin',()=>{
 const q=questionFor({id:'8',front:'manger',back:'eten',context:'Je [[mange]] une pomme.'},{fromLang:'fr-FR',toLang:'nl-NL'});
 assert.equal(isCorrect('MANGE',q.accepted),true);
 assert.equal(isCorrect('manger',q.accepted),false);
});
