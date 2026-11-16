'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parsePastedText,parseStudyGoHtml,parsePdfPageItems,parsePdfPages,checkedStudyGoUrl,fetchPublicStudyGo}=require('../lib/studygo-import');
test('StudyGo/plakken: twee vertalingen blijven één woordpaar',()=>{
 assert.deepEqual(parsePastedText('lawyer\tjurist/advocaat\nillegal = onwettig/illegaal\nevident / obvious / apparent\tduidelijk'),[
  {front:'lawyer',back:'jurist/advocaat'}, {front:'illegal',back:'onwettig/illegaal'},{front:'evident / obvious / apparent',back:'duidelijk'}]);
});
test('Plakken: tabellen, ; met quotes en duplicaten',()=>{
 const rows=parsePastedText('English\tNederlands\n"the accused/the defendant";"de beklaagde"\n\n"the accused/the defendant";"de beklaagde"\njudge\trechter');
 assert.equal(rows.length,2);assert.equal(rows[0].back,'de beklaagde');
});
test('Plakken: een onduidelijke losse regel koppelt nooit het volgende woord',()=>{
 assert.deepEqual(parsePastedText('court\trechtbank\nlos woord zonder betekenis\ntruth\twaarheid'),[{front:'court',back:'rechtbank'},{front:'truth',back:'waarheid'}]);
});
test('HTML: StudyGo openbare tabel',()=>{
 const html='<title>The law | StudyGo</title><table><thead><tr><th>Engels</th><th>Nederlands</th></tr></thead><tbody><tr><td>to acquit</td><td>vrijspreken</td></tr><tr><td>lawyer</td><td>jurist / advocaat</td></tr></tbody></table>';
 const parsed=parseStudyGoHtml(html);assert.equal(parsed.title,'The law');assert.equal(parsed.pairs.length,2);assert.equal(parsed.pairs[1].back,'jurist / advocaat');
});
test('HTML: JSON-data met term en definition',()=>{
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{cards:[{term:'trial',definition:'proces/strafzaak'},{term:{text:'to defend'},definition:{text:'verdedigen'}}]}}})+'</script>';
 assert.deepEqual(parseStudyGoHtml(html).pairs,[{front:'trial',back:'proces/strafzaak'},{front:'to defend',back:'verdedigen'}]);
});
test('HTML: geen woorden = lege lijst, niet verzinnen',()=>{
 assert.deepEqual(parseStudyGoHtml('<html><title>StudyGo</title><div id="root"></div></html>').pairs,[]);
});
test('Beveiliging: StudyGo host strikt gecontroleerd',()=>{
 assert.equal(checkedStudyGoUrl('https://studygo.com/nl/learn/lijst').hostname,'studygo.com');
 for(const url of ['http://studygo.com/a','https://studygo.com.evil.example/a','https://127.0.0.1:3000/api/state','https://studygo.com@evil.example/a','file:///etc/passwd']){
  assert.throws(()=>checkedStudyGoUrl(url));
 }
});
test('Linkimport: openbaar HTML met inlined JSON',async()=>{
 const mock=async(url,options)=>{assert.equal(options.redirect,'manual');assert.equal(url,'https://studygo.com/nl/learn/demo');return new Response('<table><tr><td>premises</td><td>pand/terrein</td></tr></table>',{headers:{'content-type':'text/html'}});};
 const r=await fetchPublicStudyGo('https://studygo.com/nl/learn/demo',mock);assert.equal(r.pairs.length,1);
});
test('Linkimport: omleiding naar lokale server wordt geweigerd',async()=>{
 const mock=async()=>new Response('',{status:302,headers:{location:'http://localhost:3000/api/state'}});
 await assert.rejects(()=>fetchPublicStudyGo('https://studygo.com/nl/learn/demo',mock));
});
test('PDF: verticale regels, ongebruikelijke volgorde en tussenkop negeren',()=>{
 const parts=[
  {str:'jurist / advocaat',transform:[0,0,0,0,330,700],width:100},
  {str:'lawyer',transform:[0,0,0,0,60,700],width:60},
  {str:'illegal',transform:[0,0,0,0,60,680],width:52},
  {str:'onwettig/illegaal',transform:[0,0,0,0,330,680],width:95},
  {str:'The law (1)',transform:[0,0,0,0,60,760],width:80},
 ];
 assert.deepEqual(parsePdfPageItems(parts),[{front:'lawyer',back:'jurist / advocaat'},{front:'illegal',back:'onwettig/illegaal'}]);
 assert.equal(parsePdfPages([parts]).length,2);
});
