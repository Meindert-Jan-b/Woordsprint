'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=src.indexOf('function modeCompletionStatus(');
const end=src.indexOf('function listOrigin(',start);
assert.ok(start>=0&&end>start);
const context={
 prefs:{direction:'forward'},
 db:{modeStatus:{list1:{choice:{forward:{count:2,total:3,done:false},reverse:{count:3,total:3,done:true}},match:{forward:{count:3,total:3,done:true},reverse:{count:3,total:3,done:true}}}}},
 WoordCloze:{questionFor:()=>null},contextExamples:{},
 esc:x=>String(x),modes:[{id:'choice',name:'Meerkeuze',icon:'○',text:'Kies'}],games:[{id:'match',name:'Koppelspel',icon:'✓',text:'Koppel'}]
};vm.createContext(context);vm.runInContext(src.slice(start,end),context);
const l={id:'list1',words:[{id:'1'},{id:'2'},{id:'3'}]};
test('Mode chips display server progress and a checkmark only on full verified completion',()=>{
 assert.match(context.modeCard(l,context.modes[0]),/2 \/ 3 woorden/);
 assert.doesNotMatch(context.modeCard(l,context.modes[0]),/✓ Voltooid/);
 assert.match(context.modeCard(l,context.games[0]),/✓ Voltooid/);
 context.prefs.direction='reverse';
 assert.match(context.modeCard(l,context.modes[0]),/✓ Voltooid/);
});
test('Context mode with no available examples displays unavailable status',()=>{
 assert.match(context.modeCard(l,{id:'context',name:'Context',icon:'✍',text:'Zinnen'}),/Geen oefenzinnen/);
});
