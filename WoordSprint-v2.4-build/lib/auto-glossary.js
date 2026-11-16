'use strict';

// Detect the two narrow columns of a printed glossary in a FULL book photograph.
// Does not depend on the glossary being on the right or on any particular page.
// The sentence column is normally long, irregular text; the glossary consists
// of two repeatedly left-aligned, short, parallel text columns.
const {tsvLines}=require('./ocr-layout');
const median=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]:0;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

function findBands(lines,width,height){
  const radius=Math.max(18,width*.023);
  const lineCandidates=lines.filter(l=>{
    const t=l.text||'';
    return t.length>=2&&t.length<=43&&l.x>width*.035&&l.x<width*.92&&
      l.y>height*.045&&l.y<height*.9&&l.height>=height*.006&&l.height<height*.036&&
      !/^[^a-zA-ZÀ-ÿ]*$/.test(t);
  });
  // Each band's x coordinate can drift slightly due to book-page perspective.
  const votes=lineCandidates.map(l=>({x:l.x,n:lineCandidates.filter(v=>Math.abs(v.x-l.x)<radius).length}))
    .sort((a,b)=>b.n-a.n);
  const peaks=[];
  for(const vote of votes){
    if(vote.n<7)break;
    if(peaks.some(p=>Math.abs(p.x-vote.x)<radius*1.65))continue;
    const members=lineCandidates.filter(l=>Math.abs(l.x-vote.x)<radius*1.6);
    const x=median(members.map(l=>l.x));
    const unique=[];
    for(const l of members.sort((a,b)=>a.y-b.y)){
      if(unique.length&&Math.abs(unique[unique.length-1].y-l.y)<height*.004){
        if(Math.abs(l.x-x)<Math.abs(unique[unique.length-1].x-x))unique[unique.length-1]=l;
      }else unique.push(l);
    }
    if(unique.length>=7)peaks.push({x,lines:unique,count:unique.length});
  }
  return peaks.sort((a,b)=>a.x-b.x);
}
function closestMatch(a,b,threshold){
  const arr=[];
  for(const l of a){
    const r=b.reduce((best,v)=>!best||Math.abs(v.y-l.y)<Math.abs(best.y-l.y)?v:best,null);
    if(r&&Math.abs(r.y-l.y)<threshold)arr.push({left:l,right:r,delta:Math.abs(r.y-l.y)});
  }
  return arr;
}
function mainRun(lines,height){
  const ordered=[...lines].sort((a,b)=>a.y-b.y);
  if(ordered.length<7)return [];
  const gaps=ordered.slice(1).map((l,i)=>l.y-ordered[i].y).filter(g=>g>height*.003&&g<height*.06);
  const step=median(gaps)||height*.022;
  const segments=[];let current=[];
  for(const l of ordered){
    if(current.length&&l.y-current[current.length-1].y>Math.max(step*3,height*.055)){
      if(current.length>=6)segments.push(current);
      current=[];
    }
    current.push(l);
  }
  if(current.length>=6)segments.push(current);
  return segments.sort((a,b)=>b.length-a.length)[0]||[];
}
function discoverGlossary(lines,width,height){
  if(typeof lines==='string')lines=tsvLines(lines);
  if(!Array.isArray(lines)||lines.length<16)return null;
  const bands=findBands(lines,width,height);
  let best=null;
  for(const left of bands){
    for(const right of bands){
      const dx=right.x-left.x;
      if(dx<width*.095||dx>width*.31)continue;
      const a=mainRun(left.lines,height),b=mainRun(right.lines,height);
      const pairs=closestMatch(a,b,height*.014);
      if(pairs.length<7)continue;
      const ratio=pairs.length/Math.max(a.length,b.length);
      const avgLeftLength=median(a.map(l=>l.text.length));
      const avgRightLength=median(b.map(l=>l.text.length));
      const periodRate=a.filter(l=>/[.!?]$/.test(l.text)).length/Math.max(1,a.length);
      // Two short, stable parallel bands are vocabulary. Sentences and sidebars
      // have poor vertical agreement and are less consistently short.
      const score=pairs.length*(.7+.3*ratio) - Math.max(0,avgLeftLength-24)*.5 -
        Math.max(0,avgRightLength-29)*.4 - periodRate*15;
      if(!best||score>best.score){
        const ys=pairs.map(p=>p.left.y);
        const begin=Math.min(...ys),end=Math.max(...ys);
        best={left,right,score,pairs:pairs.length,begin,end,bandLeft:a,bandRight:b};
      }
    }
  }
  if(!best||best.pairs<8)return null;
  const {left,right,begin,end}=best;
  const upper=clamp(Math.floor(begin-height*.022),0,height-1);
  const lower=clamp(Math.ceil(end+height*.035),upper+1,height);
  const leftX=clamp(Math.floor(left.x-width*.027),0,width-1);
  // English words may extend across most of the space between columns.
  // Keep the Dutch start well away from the English OCR crop.
  const boundary=clamp(Math.round(right.x-width*.018),leftX+30,width-1);
  const others=best.bandRight.map(v=>v.end).filter(Number.isFinite);
  const desiredRightEnd=Math.max(...others,right.x+width*.10);
  const rightX=clamp(Math.ceil(Math.min(right.x+width*.155,desiredRightEnd+width*.02)),boundary+40,width);
  return {
    leftX,rightX,top:upper,bottom:lower,boundary,
    crop:{left:leftX,top:upper,width:rightX-leftX,height:lower-upper},
    divider:(boundary-leftX)/(rightX-leftX),
    diagnostics:{foundEnglish:best.bandLeft.length,foundDutch:best.bandRight.length,parallelRows:best.pairs,score:Math.round(best.score)},
  };
}
module.exports={discoverGlossary,findBands,mainRun};
