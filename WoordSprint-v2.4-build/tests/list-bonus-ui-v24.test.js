'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('list progress shows completed modes without currency or a claim action',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const start=src.indexOf('function listBonusPanel(');
 const end=src.indexOf('function listOrigin(',start);
 assert.ok(start>=0 && end>start);
 const ctx={modeDoneSummary:()=> '11/12 oefenstanden afgerond',esc:String};
 vm.createContext(ctx);
 vm.runInContext(src.slice(start,end),ctx);
 const panel=ctx.listBonusPanel({});
 assert.match(panel,/11\/12 oefenstanden afgerond/);
 assert.doesNotMatch(panel,/coins|claim-list-bonus/);
});
