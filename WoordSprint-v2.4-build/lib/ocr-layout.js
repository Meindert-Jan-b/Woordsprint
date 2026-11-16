'use strict';

// The book prints one vocabulary entry per aligned row, but long entries wrap.
// We retain physical positions so a missed OCR line NEVER shifts the remaining
// translations (which is what index-by-index pairing did in older versions).
const hasLetters = s => /\p{L}/u.test(String(s || ''));
const median = a => a.length ? [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)] : 0;
function validLabel(s) {
  const t=String(s||'').trim();
  return t.length>=2 && t.length<=180 && hasLetters(t) &&
    !/^(?:page|pagina|chapter|hoofdstuk|unit)\s+\d+/i.test(t);
}
function clean(s){return String(s||'').replace(/^\s*[!|•]+\s*/,'').replace(/\s+([,;:.!?/])/g,'$1').replace(/([(/])\s+/g,'$1').replace(/\s+/g,' ').trim();}
function parseTsv(tsv) {
  if(typeof tsv!=='string'||!tsv.trim())return [];
  const rows=tsv.trim().split(/\r?\n/);
  const cols=rows.shift()?.split('\t')||[];
  const idx=Object.fromEntries(['level','block_num','par_num','line_num','left','top','width','height','conf','text'].map(k=>[k,cols.indexOf(k)]));
  if(Object.values(idx).some(n=>n<0))return [];
  const words=[];
  for(const row of rows){
    const c=row.split('\t');
    if(+c[idx.level]!==5)continue;
    const t=c.slice(idx.text).join('\t').trim();
    const x=+c[idx.left],y=+c[idx.top],width=+c[idx.width],height=+c[idx.height],conf=+c[idx.conf];
    if(!t||!hasLetters(t)||!Number.isFinite(x+y+width+height+conf)||width<3||height<4||conf<6)continue;
    // Very small low-confidence single letters near the page edge are shadows/noise.
    if(t.length===1&&conf<55)continue;
    words.push({text:t,x,y,width,height,conf,key:[c[idx.block_num],c[idx.par_num],c[idx.line_num]].join('.')});
  }
  return words;
}
function makeLines(words){
  const groups=new Map();
  for(const w of words){if(!groups.has(w.key))groups.set(w.key,[]);groups.get(w.key).push(w);}
  return [...groups.values()].map(g=>{
    g.sort((a,b)=>a.x-b.x);
    const text=clean(g.map(w=>w.text).join(' '));
    const y=median(g.map(w=>w.y+w.height/2));
    return {text,y,x:Math.min(...g.map(w=>w.x)),end:Math.max(...g.map(w=>w.x+w.width)),height:median(g.map(w=>w.height)),confidence:Math.round(g.reduce((s,w)=>s+w.conf*Math.min(w.text.length,20),0)/g.reduce((s,w)=>s+Math.min(w.text.length,20),0))};
  }).filter(l=>validLabel(l.text)).sort((a,b)=>a.y-b.y);
}
function tsvLines(tsv){return makeLines(parseTsv(tsv));}
function splitTsvColumns(tsv,imageWidth,divider=.47){
  if(!tsv)return {left:[],right:[]};
  const words=parseTsv(tsv);
  const boundary=imageWidth*divider;
  return {left:makeLines(words.filter(w=>w.x<boundary)),right:makeLines(words.filter(w=>w.x>=boundary))};
}
function combine(prev,part){
  const a=String(prev).trimEnd(),b=String(part).trim();
  return clean(a+(a.endsWith('/')||a.endsWith('-')||a.endsWith('(')?'':' ')+b);
}
function shouldContinue(prev,next,typicalStep,baseX,rightLines){
  const spacing=next.y-prev.y;
  if(spacing<=0||spacing>typicalStep*1.6)return false;
  // The strong indicator is the slash/hyphen after the previous printed row.
  if(/[/\-(]$/.test(prev.text))return true;
  // Indentation alone is NOT evidence: exclamation marks before printed
  // words can indent a normal entry ("! lawyer" in the sample photo). A wrong
  // merge is worse than showing one extra entry for manual correction.
  return false;
}
function groupLeftEntries(lines,rightLines=[]){
  const rows=lines.filter(l=>validLabel(l.text)).sort((a,b)=>a.y-b.y);
  const steps=rows.slice(1).map((r,i)=>r.y-rows[i].y).filter(s=>s>8&&s<130);
  const step=median(steps)||50;
  const minX=rows.length?Math.min(...rows.map(r=>r.x??0)):0;
  const out=[];
  for(const row of rows){
    const prev=out[out.length-1];
    if(prev&&shouldContinue(prev.lastLine,row,step,minX,rightLines)){
      prev.text=combine(prev.text,row.text);
      prev.endY=row.y;prev.lastLine=row;
      prev.confidence=Math.min(prev.confidence,row.confidence??70);
    }else{
      out.push({text:row.text,y:row.y,endY:row.y,lastLine:row,confidence:row.confidence??75});
    }
  }
  return {entries:out,step};
}
function pairAligned(leftInput,rightInput){
  const right=rightInput.filter(r=>validLabel(r.text)).sort((a,b)=>a.y-b.y);
  const {entries,step}=groupLeftEntries(leftInput,right);
  if(!entries.length||!right.length)return {pairs:[],unmatchedLeft:entries.map(r=>r.text),unmatchedRight:right.length,details:[]};
  // Account for a slight, approximately constant vertical offset between columns
  // from camera perspective or Tesseract box positioning.
  const possible=right.map(r=>{
    const closest=entries.reduce((p,l)=>Math.abs(l.y-r.y)<Math.abs(p.y-r.y)?l:p,entries[0]);
    return r.y-closest.y;
  }).filter(d=>Math.abs(d)<step*.32);
  const offset=median(possible);
  const tolerance=Math.min(36,Math.max(12,step*.39));
  const assigned=new Map();const unmatched=[];
  for(const r of right){
    // Base pair only on the FIRST printed English line, never on a continuation.
    let candidate=-1,dist=Infinity;
    for(let i=0;i<entries.length;i++){
      const d=Math.abs(r.y-(entries[i].y+offset));
      if(d<dist){dist=d;candidate=i;}
    }
    if(candidate>=0&&dist<=tolerance){
      // Keep best candidate only. An additional OCR line must never overwrite
      // or concatenate a translation from the following vocabulary entry.
      if(!assigned.has(candidate)||dist<assigned.get(candidate).dist){
        if(assigned.has(candidate))unmatched.push(assigned.get(candidate).line);
        assigned.set(candidate,{line:r,dist});
      }else unmatched.push(r);
    }else unmatched.push(r);
  }
  // Explicit translation continuations, allowed only for a slash/hyphen or
  // clearly indented line within the original English entry's vertical extent.
  for(const r of [...unmatched]){
    for(const [i,rec] of assigned){
      const entry=entries[i];
      const nextStart=entries[i+1]?.y??Infinity;
      if(r.y<=rec.line.y||r.y>=Math.min(nextStart-step*.3,rec.line.y+step*1.6))continue;
      const rightContinuation=/[/\-(]$/.test(rec.line.text)||
        (r.x!==undefined&&rec.line.x!==undefined&&r.x-rec.line.x>Math.max(16,rec.line.height*.6));
      if(rightContinuation){rec.line={...rec.line,text:combine(rec.line.text,r.text),confidence:Math.min(rec.line.confidence||75,r.confidence||75)};unmatched.splice(unmatched.indexOf(r),1);break;}
    }
  }
  const pairs=[],details=[];
  for(let i=0;i<entries.length;i++){
    const match=assigned.get(i);if(!match)continue;
    const front=clean(entries[i].text),back=clean(match.line.text);
    if(!validLabel(front)||!validLabel(back))continue;
    const confidence=Math.round(Math.min(entries[i].confidence,match.line.confidence??75));
    const needsReview=confidence<50||match.dist>tolerance*.75;
    pairs.push({front,back,...(needsReview?{needsReview:true}:{})});
    details.push({front,back,dist:match.dist,confidence});
  }
  return {pairs,details,unmatchedLeft:entries.filter((e,i)=>!assigned.has(i)).map(e=>e.text),unmatchedRight:unmatched.length,anchors:entries.length};
}
function cropFromPercents(input){
  let crop;try{crop=typeof input==='string'?JSON.parse(input):input;}catch{return null;}
  if(!crop||['x','y','w','h'].some(k=>!Number.isFinite(Number(crop[k]))))return null;
  const {x,y,w,h}=Object.fromEntries(['x','y','w','h'].map(k=>[k,Number(crop[k])]));
  if(x<0||y<0||w<.06||h<.06||x+w>1.001||y+h>1.001)return null;
  return {x,y,w,h};
}
// Kept for manual pasted text only, never for an automatic scan.
// Positional info is mandatory for safe automatic matching.
function pairTextColumns(a,b){
  const left=String(a||'').split(/\r?\n/).map(clean).filter(validLabel),right=String(b||'').split(/\r?\n/).map(clean).filter(validLabel);
  if(!left.length||left.length!==right.length)return [];
  return left.map((front,i)=>({front,back:right[i],needsReview:true}));
}
module.exports={tsvLines,splitTsvColumns,pairAligned,cropFromPercents,pairTextColumns,groupLeftEntries};
