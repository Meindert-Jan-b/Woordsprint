const test=require('node:test');
const assert=require('node:assert/strict');
const {parseInline,buildWords}=require('../server');
test('regels met tab, streepje en puntkomma herkend',()=>{
  assert.deepEqual(parseInline('bonjour\thallo\nmerci - bedankt\nchien;hond'),[
    {front:'bonjour',back:'hallo'}, {front:'merci',back:'bedankt'}, {front:'chien',back:'hond'}]);
});
test('dubbele en lege woorden worden verwijderd',()=>{
  assert.equal(buildWords([{front:'hi',back:'hoi'},{front:'hi',back:'hoi'},{front:'',back:'leeg'}]).length,1);
});
