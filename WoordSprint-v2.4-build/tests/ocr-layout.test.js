const test=require('node:test');
const assert=require('node:assert/strict');
const {pairAligned,cropFromPercents,splitTsvColumns}=require('../lib/ocr-layout');
test('woorden in twee gedrukte kolommen worden op regelniveau gekoppeld',()=>{
 const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
 const make=(line,number,left,top,word)=>[5,1,1,1,line,number,left,top,90,22,93,word].join('\t');
 const rows=[make(1,1,20,50,'illegal'),make(1,2,275,50,'onwettig/illegaal'),make(2,1,20,100,'lawyer'),make(2,2,275,100,'jurist/advocaat'),make(3,1,20,150,'evident/obvious/'),make(3,2,275,150,'duidelijk'),make(4,1,20,177,'apparent')];
 const cols=splitTsvColumns([header,...rows].join('\n'),500,.48);
 const pairs=pairAligned(cols.left,cols.right).pairs;
 assert.deepEqual(pairs,[{front:'illegal',back:'onwettig/illegaal'},{front:'lawyer',back:'jurist/advocaat'},{front:'evident/obvious/apparent',back:'duidelijk'}]);
});
test('instelbaar scanvlak valideert maten',()=>{
 assert.deepEqual(cropFromPercents('{"x":0.57,"y":0.13,"w":0.34,"h":0.5}'),{x:.57,y:.13,w:.34,h:.5});
 assert.equal(cropFromPercents('{"x":0.9,"y":0.13,"w":0.34,"h":0.5}'),null);
});

test('zonder woordposities gokken we niet bij ongelijke aantallen tekstregels',()=>{
 const {pairTextColumns}=require('../lib/ocr-layout');
 // De vierde Engelse uitdrukking neemt twee regels in; het veiligste is geen
 // automatische koppeling op regelnummers wanneer de kolommen niet gelijk lopen.
 const pairs=pairTextColumns('law-abiding\nlegal\nillegal\nevident/obvious/\napparent\nlawyer', 'wetsgetrouw\njuridisch\nonwettig/illegaal\nduidelijk\njurist/advocaat');
 assert.deepEqual(pairs,[]);
});
test('fallback: scanner verzint geen woordparen uit slechts één kolom',()=>{
 const {pairTextColumns}=require('../lib/ocr-layout');
 assert.equal(pairTextColumns('lawyer\nlegal','').length,0);
});
test('ontbrekende TSV levert lege regels op zonder servercrash',()=>{
 const {tsvLines,splitTsvColumns}=require('../lib/ocr-layout');
 assert.deepEqual(tsvLines(''),[]);
 assert.deepEqual(splitTsvColumns('',450),{left:[],right:[]});
});
