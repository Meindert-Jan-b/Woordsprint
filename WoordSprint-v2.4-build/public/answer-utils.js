'use strict';
(function(root){
  // The same answer rules are used by Slim leren, Hints, Zelf typen and Toets.
  function normalized(s){
    return String(s??'').normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g,'').toLocaleLowerCase('nl-NL')
      .replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]/gu,' ').replace(/\s+/g,' ').trim();
  }
  function alternatives(expected){
    return String(expected??'').replace(/[／⁄∕]/g,'/').replace(/[；¦]/g,';')
      .split(/\s*[/|;]\s*|\s+,\s+/).map(s=>s.trim()).filter(Boolean);
  }
  function acceptedForms(option){
    // Parenthesized word parts: (be)oordelen -> both beoordelen and oordelen.
    // Imported explanations: proces (I ...) -> also accept just 'proces'.
    // Do not accept arbitrary individual words of a multi-word translation.
    const forms=[option];
    const optional=option.match(/\(([^()]*)\)/);
    if(optional&&optional[1].length<=40){
      forms.push(option.replace(optional[0],''));
      forms.push(option.replace(optional[0],optional[1]));
    }
    const note=option.match(/^(.+?)\s+\([^)]*(?:\)|$)/);
    if(note&&note[1].trim())forms.push(note[1].trim());
    // A partial OCR annotation or PDF line fragment can omit its closing bracket.
    const unfinished=option.match(/^(.+?)\s+[([][^)\]]*$/);
    if(unfinished&&unfinished[1].trim())forms.push(unfinished[1].trim());
    return [...new Set(forms.map(f=>f.trim()).filter(Boolean))];
  }
  function acceptedAnswers(expected){
    const all=[String(expected??''),...alternatives(expected).flatMap(acceptedForms)];
    return [...new Set(all.map(a=>normalized(a)).filter(Boolean))];
  }
  function isCorrect(given,expected){
    const candidate=normalized(given);
    return !!candidate&&acceptedAnswers(expected).includes(candidate);
  }
  const api={normalized,alternatives,acceptedForms,acceptedAnswers,isCorrect};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WoordAnswers=api;
})(typeof globalThis!=='undefined'?globalThis:this);
