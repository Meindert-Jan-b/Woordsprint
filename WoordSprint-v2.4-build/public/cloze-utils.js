(function(root){
'use strict';
function readCloze(sentence){
 const raw=String(sentence||'').trim();const matches=[...raw.matchAll(/\[\[([^\[\]\r\n]+)\]\]/g)];
 if(matches.length!==1)return null;const hit=matches[0],answer=hit[1].trim();
 if(!answer||answer.length>100)return null;
 const before=raw.slice(0,hit.index),after=raw.slice(hit.index+hit[0].length);
 if(/\[\[|\]\]/.test(before+after))return null;
 return {before,after,answer,filled:before+answer+after};
}
function contextAnswers(word,list,parts){
 const fromDutch=/^nl(?:-|$)/i.test(list.fromLang||'');
 const en=String(fromDutch?word.back:word.front||'').trim();
 const alts=en.split(/\s*[/|;]\s*/).map(s=>s.trim()).filter(Boolean);
 const answer=parts.answer;
 const canon=s=>String(s||'').toLocaleLowerCase('en').replace(/^(?:to |the |an |a )/,'').replace(/[^a-z\s-]/g,'').trim();
 const isArticleBefore=/\b(?:the|a|an)\s*$/i.test(parts.before);
 let formOfWord=alts.some(a=>canon(a)===canon(answer));
 const valid=[answer];
 // If the gap uses an uninflected synonym from a slash-separated English
 // heading, the other synonyms can also be accepted. Never accept base forms
 // for an inflected gap (ate != eat, defended != defend).
 if(formOfWord){for(let alt of alts){
   alt=alt.replace(/^to\s+/i,'');
   if(isArticleBefore)alt=alt.replace(/^(?:the|a|an)\s+/i,'');
   if(alt && !valid.some(x=>canon(x)===canon(alt)))valid.push(alt);
 }}
 for(const x of String(word.contextForms||'').split(/\s*[/|;]\s*/).map(x=>x.trim()).filter(Boolean))if(!valid.includes(x))valid.push(x);
 return valid;
}
function questionFor(word,list,examples={}){
 const fromDutch=/^nl(?:-|$)/i.test(list.fromLang||'');
 const toDutch=/^nl(?:-|$)/i.test(list.toLang||'');
 if(fromDutch===toDutch)return null;
 const target=String(fromDutch?word.back:word.front||'').trim();
 const cue=String(fromDutch?word.front:word.back||'').trim();
 const sentence=String(word.context||'').trim()||examples[target.toLowerCase()]||'';
 const parts=readCloze(sentence);if(!parts)return null;
 const accepted=contextAnswers(word,list,parts);
 return {wordId:word.id,question:cue,answer:parts.answer,accepted:accepted.join(' / '),
   context:sentence,contextFilled:parts.filled,contextBefore:parts.before,contextAfter:parts.after,
   qLang:'nl-NL',aLang:fromDutch?list.toLang:list.fromLang};
}
const api={readCloze,questionFor,contextAnswers};
if(typeof module==='object'&&module.exports)module.exports=api;
root.WoordCloze=api;
})(typeof globalThis!=='undefined'?globalThis:this);
