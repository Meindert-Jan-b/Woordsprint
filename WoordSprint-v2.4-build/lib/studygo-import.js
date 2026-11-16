'use strict';
// Import only explicitly supplied, publicly accessible lists. Never use login tokens,
// private StudyGo APIs, or automatically crawl books/collections.
const MAX_WORDS=3000;
const clean = v => String(v??'').replace(/\u00a0/g,' ').replace(/[\u200b\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();
const decode = s => String(s??'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash|eacute|euml|aacute|uuml);/gi,(_all,entity)=> {
  const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',eacute:'é',euml:'ë',aacute:'á',uuml:'ü'};
  if(entity[0]==='#'){const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isInteger(code)&&code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}
  return map[entity.toLowerCase()]??_all;
});
const stripTags = s => clean(decode(String(s??'').replace(/<br\s*\/?>/gi,' ').replace(/<\/(?:div|p|span|td|th|li|a)>/gi,' ').replace(/<[^>]*>/g,' ')));
function pair(front,back){
 const a=clean(front),b=clean(back);
 if(!a||!b||a.length>280||b.length>400||/^(?:woord|woorden|term|begrip|engels|english|nederlands|dutch|frans|french|duits|german|betekenis|vertaling|definition|answer|vraag)$/i.test(a) || /^(?:betekenis|vertaling|translation|definition|answer|nederlands|dutch|english|engels)$/i.test(b))return null;
 if(a.toLowerCase()===b.toLowerCase())return null;
 return {front:a,back:b};
}
function uniquePairs(rows){const result=[],seen=new Set();for(const row of rows){const p=pair(row.front,row.back);if(!p)continue;const k=p.front.toLocaleLowerCase('nl')+'\0'+p.back.toLocaleLowerCase('nl');if(seen.has(k))continue;seen.add(k);result.push(p);if(result.length>=MAX_WORDS)break;}return result;}
function splitDelimited(line,delimiter){let quoted=false,part='',out=[];for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){part+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){out.push(part.trim());part='';}else part+=c;}out.push(part.trim());return out;}
function parsePastedText(content){
 const rows=[];const lines=String(content??'').replace(/^\uFEFF/,'').split(/\r?\n/);
 for(const raw of lines.slice(0,12000)){
  const line=raw.trim();if(!line)continue;
  let fields;
  if(line.includes('\t'))fields=line.split(/\t+/);
  else if(/\s{3,}/.test(raw))fields=raw.trim().split(/\s{3,}/);
  else if(/\s+[=→—–-]\s+/.test(line))fields=line.split(/\s+[=→—–-]\s+/);
  else if(line.includes(';'))fields=splitDelimited(line,';');
  else if(line.includes(',') && /^"[^\"]+",/.test(line))fields=splitDelimited(line,',');
  else continue;
  if(fields.length>=2){const p=pair(fields[0].replace(/^"|"$/g,''),fields.slice(1).join(' / ').replace(/^"|"$/g,''));if(p)rows.push(p);}
 }
 return uniquePairs(rows);
}
function dataText(v){
 if(typeof v==='string'||typeof v==='number')return clean(v);
 if(v&&typeof v==='object'){
   if(Array.isArray(v))return v.length===1?dataText(v[0]):'';
   for(const key of ['text','plainText','value','label','content','name','translation','answer']){
     const candidate=v[key];if(typeof candidate==='string')return clean(candidate);
   }
 }
 return '';
}
function jsonArrayPairs(arr){
 if(!Array.isArray(arr)||arr.length<1)return [];
 const out=[];
 for(const item of arr.slice(0,MAX_WORDS)){
  if(Array.isArray(item)&&item.length===2){out.push({front:dataText(item[0]),back:dataText(item[1])});continue;}
  if(!item||typeof item!=='object')continue;
  for(const [a,b] of [['front','back'],['term','definition'],['question','answer'],['word','translation'],['source','target'],['term','meaning'],['left','right'],['original','translated'],['sourceText','targetText']]){
    if(item[a]!=null&&item[b]!=null){out.push({front:dataText(item[a]),back:dataText(item[b])});break;}
  }
  if(item.sides&&Array.isArray(item.sides)&&item.sides.length===2)out.push({front:dataText(item.sides[0]),back:dataText(item.sides[1])});
 }
 return uniquePairs(out);
}
function getNestedPairs(obj){
 let best=[];let visited=0;
 function walk(v,depth){
  if(!v||depth>12||visited++>6000)return;
  if(Array.isArray(v)){const pairs=jsonArrayPairs(v);if(pairs.length>best.length)best=pairs;for(const child of v.slice(0,150))if(typeof child==='object')walk(child,depth+1);return;}
  if(typeof v==='object')for(const [key,x] of Object.entries(v).slice(0,100))if(typeof x==='object'&&x&&key!=='analytics')walk(x,depth+1);
 }
 walk(obj,0);return best;
}
function parseStudyGoHtml(html){
 const input=String(html??'');let best=[],method='';
 const scripts=[...input.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
 for(const [,attrs,body] of scripts){
  if(!(/type\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attrs)||/id\s*=\s*["']__NEXT_DATA__["']/i.test(attrs)))continue;
  if(body.length>4_000_000)continue;
  try{const rows=getNestedPairs(JSON.parse(decode(body)));if(rows.length>best.length){best=rows;method='ingebedde woordenlijstgegevens';}}catch{}
 }
 const tables=[...input.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];
 for(const [,table] of tables){const rows=[];
  for(const [,tr] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){
   const cells=[...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map(m=>stripTags(m[1]));
   if(cells.length>=2)rows.push({front:cells[0],back:cells.slice(1).join(' / ')});
  }
  const pairs=uniquePairs(rows);if(pairs.length>best.length){best=pairs;method='woordenlijsttabel';}
 }
 const titleMeta=input.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']{1,200})["']/i);
 const titleTag=input.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
 const title=clean(decode(titleMeta?.[1]||stripTags(titleTag?.[1]||''))).replace(/\s*[-|]\s*StudyGo.*$/i,'').slice(0,110);
 return {pairs:best,title:title||'StudyGo woordenlijst',method:method||'geen leesbare gegevens'};
}
const ALLOWED_HOSTS=new Set(['studygo.com','www.studygo.com','app.studygo.com','learn.studygo.com']);
function checkedStudyGoUrl(input){
 let url;try{url=new URL(String(input??'').trim());}catch{throw Error('Plak een volledige StudyGo-link die begint met https://.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!ALLOWED_HOSTS.has(url.hostname.toLowerCase()))throw Error('Alleen openbare HTTPS-links van studygo.com zijn toegestaan.');
 if(url.href.length>2400)throw Error('De link is te lang.');
 return url;
}
async function fetchPublicStudyGo(urlString,client=fetch){
 let url=checkedStudyGoUrl(urlString);
 for(let redirects=0;redirects<4;redirects++){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),10000);
  let response;
  try{response=await client(url.href,{method:'GET',redirect:'manual',signal:ctrl.signal,headers:{'Accept':'text/html,application/xhtml+xml','User-Agent':'WoordSprint personal-list-import/1.7'}});}catch(err){throw Error(err.name==='AbortError'?'StudyGo reageert niet op tijd. Gebruik de PDF- of plakoptie.':'StudyGo kon niet worden bereikt. Probeer een PDF of plak de woordenlijst.');}finally{clearTimeout(timer);}
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');if(!location)break;
   url=checkedStudyGoUrl(new URL(location,url.href).href);continue;
  }
  if([401,403].includes(response.status))throw Error('Deze lijst is afgeschermd. Open StudyGo zelf en gebruik Printen → Opslaan als PDF.');
  if(!response.ok)throw Error(`StudyGo gaf fout ${response.status}. Probeer de PDF- of plakoptie.`);
  if(!(response.headers.get('content-type')||'').toLowerCase().includes('text/html'))throw Error('De link bevat geen StudyGo-woordenlijstpagina.');
  const size=Number(response.headers.get('content-length')||0);if(size>2_500_000)throw Error('StudyGo-pagina is te groot. Probeer PDF-import.');
  const reader=response.body?.getReader();let chunks=[],total=0;
  if(reader){for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>2_500_000){await reader.cancel();throw Error('De StudyGo-pagina is te groot.');}chunks.push(value);} }
  else {const content=await response.text();if(content.length>2_500_000)throw Error('De StudyGo-pagina is te groot.');return {...parseStudyGoHtml(content),source:url.href};}
  const html=new TextDecoder().decode(Buffer.concat(chunks.map(x=>Buffer.from(x))));
  return {...parseStudyGoHtml(html),source:url.href};
 }
 throw Error('De StudyGo-link wordt te vaak doorgestuurd. Gebruik de PDF- of plakoptie.');
}
// Interpret each PDF page by *positions*, not by assumed alternating lines.
// A row with multiple lines or an unclear gap is skipped, never guessed.
function parsePdfPageItems(items){
 const fragments=(items||[]).map(item=>({text:clean(item.str),x:Number(item.transform?.[4]??item.x),y:Number(item.transform?.[5]??item.y),width:Number(item.width||0)})).filter(t=>t.text && Number.isFinite(t.x)&&Number.isFinite(t.y));
 const groups=[];
 for(const item of fragments.sort((a,b)=>b.y-a.y||a.x-b.x)){
  const row=groups.find(row=>Math.abs(row.y-item.y)<3.5);
  if(row)row.items.push(item);else groups.push({y:item.y,items:[item]});
 }
 const candidate=[];
 for(const row of groups){
  const sorted=row.items.sort((a,b)=>a.x-b.x);
  let bestGap=0,bestIndex=-1;
  for(let i=0;i<sorted.length-1;i++){
   const gap=sorted[i+1].x-(sorted[i].x+sorted[i].width);
   if(gap>bestGap){bestGap=gap;bestIndex=i;}
  }
  if(bestGap<16||bestIndex<0)continue;
  const left=clean(sorted.slice(0,bestIndex+1).map(x=>x.text).join(' '));
  const right=clean(sorted.slice(bestIndex+1).map(x=>x.text).join(' '));
  const p=pair(left,right);if(p)candidate.push(p);
 }
 return uniquePairs(candidate);
}
function parsePdfPages(pages){return uniquePairs((pages||[]).flatMap(parsePdfPageItems));}
module.exports={parsePastedText,parseStudyGoHtml,parsePdfPageItems,parsePdfPages,checkedStudyGoUrl,fetchPublicStudyGo,uniquePairs};
