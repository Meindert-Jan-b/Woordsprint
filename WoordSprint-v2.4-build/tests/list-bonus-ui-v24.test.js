'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=src.indexOf('function listBonusStatus('),end=src.indexOf('function listOrigin(',start);
assert.ok(start>=0 && end>start);
const ctx={db:{listBonuses:{l:{forward:{wordCount:25,completedModes:11,totalModes:12,allDone:false,possibleCoins:1000},reverse:{wordCount:25,completedModes:12,totalModes:12,allDone:true,possibleCoins:1000}}}},prefs:{direction:'forward'},modes:Array(9).fill({}),games:Array(4).fill({}),fmt:n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.'),esc:x=>String(x)};
vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
const l={id:'l',words:Array(25).fill({})};
test('list status shows the number of completed modes and shows claim button only once all are done',()=>{
 const partial=ctx.listBonusPanel(l);
 assert.match(partial,/11\/12 oefenstanden klaar/);
 assert.doesNotMatch(partial,/claim-list-bonus/);
 ctx.prefs.direction='reverse';const done=ctx.listBonusPanel(l);
 assert.match(done,/1.000 bonuscoins klaar/);
 assert.match(done,/claim-list-bonus/);
 ctx.db.listBonuses.l.reverse.possibleCoins=0;
 assert.match(ctx.listBonusPanel(l),/al beloond/);
 assert.doesNotMatch(ctx.listBonusPanel(l),/claim-list-bonus/);
});
