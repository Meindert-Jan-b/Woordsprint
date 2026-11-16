const test=require('node:test');
const assert=require('node:assert/strict');
const {isCorrect,alternatives,normalized}=require('../public/answer-utils');
test('een van meerdere vertalingen is goed, ook zonder spaties om de slash',()=>{
 assert.equal(isCorrect('jurist','jurist/advocaat'),true);
 assert.equal(isCorrect('advocaat','jurist/advocaat'),true);
 assert.equal(isCorrect('onwettig','onwettig/illegaal'),true);
 assert.equal(isCorrect('illegaal','onwettig/illegaal'),true);
 assert.equal(isCorrect('gebouw','onwettig/illegaal'),false);
});
test('hoofdletters, accenten en omliggende interpunctie maken geen verschil',()=>{
 assert.equal(isCorrect('JURIST','jurist/advocaat'),true);
 assert.equal(isCorrect('École','ecole'),true);
 assert.equal(isCorrect('  Advocaat!  ','advocaat'),true);
 assert.equal(isCorrect('','advocaat'),false);
});
test('alternatieven mogen ook met puntkomma of verticale streep',()=>{
 assert.deepEqual(alternatives('jurist | advocaat; raadsman'),['jurist','advocaat','raadsman']);
});

test('tussen haakjes gedrukte woorddelen zijn optioneel',()=>{assert.equal(isCorrect('beoordelen','(be)oordelen'),true);assert.equal(isCorrect('oordelen','(be)oordelen'),true);assert.equal(isCorrect('betwijfelen','(be)twijfelen'),true);});

test('volledige meerkeuzeoptie met twee betekenissen wordt goedgekeurd',()=>{
  assert.equal(isCorrect('advocaat/jurist','advocaat/jurist'),true);
  assert.equal(isCorrect('jurist','advocaat/jurist'),true);
  assert.equal(isCorrect('JURIST','advocaat/jurist'),true);
});
