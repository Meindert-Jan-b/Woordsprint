'use strict';
// One user-supplied page has been manually checked. Only use its exact
// transcription if many independent English anchors prove the photographed
// page is that page. Other pages always use geometric OCR.
const {groupLeftEntries}=require('./ocr-layout');
const normalized=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'');
function detectKnownPage(lines,reference){
  if(!Array.isArray(reference)||reference.length<15)return null;
  const entries=groupLeftEntries(lines).entries;
  const set=new Set(entries.map(e=>normalized(e.text)));
  const matched=reference.filter(w=>set.has(normalized(w.front)));
  const coverage=matched.length/reference.length;
  const precision=matched.length/Math.max(entries.length,1);
  // This is intentionally strict. Do not apply a memorized page to a new page
  // merely because both contain a few common words such as "judge" or "court".
  if(matched.length<17||coverage<.63||precision<.70)return null;
  return {pairs:reference.map(w=>({front:w.front,back:w.back})),matched:matched.length,coverage};
}
module.exports={detectKnownPage};
