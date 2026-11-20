'use strict';

// Detect the two narrow columns of a printed glossary in a FULL book photograph.
// Does not depend on the glossary being on the right or on any particular page.
// The sentence column is normally long, irregular text; the glossary consists
// of two repeatedly left-aligned, short, parallel text columns.
const {tsvLines}=require('./ocr-layout');
const median=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]:0;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

function findBands(lines,width,height){
  const fontHeight=median(lines.map(line=>line.height))||height*.015;
  const radius=Math.max(fontHeight,width*.012);
  const lineCandidates=lines.filter(l=>{
    const t=l.text||'';
    return t.length>=2&&t.length<=43&&l.x>=0&&l.x<width*.97&&
      l.y>=0&&l.y<height&&l.height>=Math.max(4,fontHeight*.55)&&l.height<=fontHeight*1.8&&
      !/^[^a-zA-ZÀ-ÿ]*$/.test(t);
  });
  // Each band's x coordinate can drift slightly due to book-page perspective.
  const votes=lineCandidates.map(l=>({x:l.x,n:lineCandidates.filter(v=>Math.abs(v.x-l.x)<radius).length}))
    .sort((a,b)=>b.n-a.n);
  const peaks=[];
  for(const vote of votes){
    if(vote.n<3)break;
    if(peaks.some(p=>Math.abs(p.x-vote.x)<radius*1.65))continue;
    const members=lineCandidates.filter(l=>Math.abs(l.x-vote.x)<radius*1.6);
    const x=median(members.map(l=>l.x));
    const unique=[];
    for(const l of members.sort((a,b)=>a.y-b.y)){
      if(unique.length&&Math.abs(unique[unique.length-1].y-l.y)<height*.004){
        if(Math.abs(l.x-x)<Math.abs(unique[unique.length-1].x-x))unique[unique.length-1]=l;
      }else unique.push(l);
    }
    if(unique.length>=3)peaks.push({x,lines:unique,count:unique.length});
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
  if(ordered.length<3)return [];
  const gaps=ordered.slice(1).map((l,i)=>l.y-ordered[i].y).filter(g=>g>height*.003&&g<height*.06);
  const step=median(gaps)||height*.022;
  const segments=[];let current=[];
  for(const l of ordered){
    if(current.length&&l.y-current[current.length-1].y>Math.max(step*3,height*.055)){
      if(current.length>=3)segments.push(current);
      current=[];
    }
    current.push(l);
  }
  if(current.length>=3)segments.push(current);
  return segments.sort((a,b)=>b.length-a.length)[0]||[];
}
function discoverGlossary(lines,width,height){
  if(typeof lines==='string')lines=tsvLines(lines);
  if(!Array.isArray(lines)||lines.length<6)return null;
  const bands=findBands(lines,width,height);
  let best=null;
  for(const left of bands){
    for(const right of bands){
      const dx=right.x-left.x;
      const fontHeight=median(left.lines.map(line=>line.height));
      if(dx<fontHeight*3||dx>width*.85)continue;
      const a=mainRun(left.lines,height),b=mainRun(right.lines,height);
      if(a.length<3||b.length<3)continue;
      const pairs=closestMatch(a,b,Math.min(height*.025,fontHeight*1.25));
      if(pairs.length<3)continue;
      const ratio=pairs.length/Math.max(a.length,b.length);
      const avgLeftLength=median(a.map(l=>l.text.length));
      const avgRightLength=median(b.map(l=>l.text.length));
      const periodRate=(a.filter(l=>/[.!?]$/.test(l.text)).length+b.filter(l=>/[.!?]$/.test(l.text)).length)/(a.length+b.length);
      // Two short, stable parallel bands are vocabulary. Sentences and sidebars
      // have poor vertical agreement and are less consistently short.
      const intervening = bands.filter(band => band.x > left.x && band.x < right.x)
        .filter(band => band.lines.filter(line => line.y >= a[0].y && line.y <= a.at(-1).y &&
          line.text.length <= 26 && !/[.!?]$/.test(line.text)).length >= pairs.length*.65);
      const score=pairs.length*(.7+.3*ratio) - Math.max(0,avgLeftLength-24)*.5 -
        Math.max(0,avgRightLength-29)*.4 - periodRate*15 - intervening.length*pairs.length*.25;
      if(score>0&&(!best||score>best.score)){
        const ys=pairs.map(p=>p.left.y);
        const begin=Math.min(...ys),end=Math.max(...ys);
        best={left,right,score,pairs:pairs.length,begin,end,bandLeft:a,bandRight:b};
      }
    }
  }
  if(!best)return null;
  const {left,right,begin,end}=best;
  const upper=clamp(Math.floor(begin-height*.022),0,height-1);
  const lower=clamp(Math.ceil(end+height*.035),upper+1,height);
  const leftX=clamp(Math.floor(left.x-width*.027),0,width-1);
  // English words may extend across most of the space between columns.
  // Keep the Dutch start well away from the English OCR crop.
  const boundary=clamp(Math.round(right.x-width*.018),leftX+30,width-1);
  const others=best.bandRight.map(v=>v.end).filter(Number.isFinite);
  const desiredRightEnd=Math.max(...others,right.x+width*.10);
  const nextBand = bands.find(band => band.x > right.x);
  const rightLimit = nextBand ? Math.min(width, nextBand.x-width*.018) : width;
  const rightX=clamp(Math.ceil(Math.min(desiredRightEnd+width*.02,rightLimit)),boundary+40,width);
  return {
    leftX,rightX,top:upper,bottom:lower,boundary,
    crop:{left:leftX,top:upper,width:rightX-leftX,height:lower-upper},
    divider:(boundary-leftX)/(rightX-leftX),
    diagnostics:{foundEnglish:best.bandLeft.length,foundDutch:best.bandRight.length,parallelRows:best.pairs,score:Math.round(best.score)},
  };
}
module.exports={discoverGlossary,findBands,mainRun};
