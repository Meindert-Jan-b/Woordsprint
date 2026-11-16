'use strict';
// Send an owner notification via Meta's official WhatsApp Business Platform.
// This does NOT send Robux, cards, payments or messages to students.
function config(env=process.env){
  const token=String(env.WA_ACCESS_TOKEN||'');
  const phoneId=String(env.WA_PHONE_NUMBER_ID||'');
  const recipient=String(env.WA_OWNER_NUMBER||'').replace(/\D/g,'');
  const template=String(env.WA_TEMPLATE_NAME||'woordsprint_aanvraag');
  const language=String(env.WA_TEMPLATE_LANG||'nl');
  const version=String(env.WA_GRAPH_VERSION||'v27.0');
  if(!token||!phoneId||!recipient)return null;
  if(!/^\d{6,25}$/.test(phoneId)||!/^\d{8,15}$/.test(recipient)||!/^\w{1,100}$/.test(template)||!/^\w{2,10}$/.test(language)||!/^v\d+\.\d+$/.test(version))throw Error('WhatsApp omgevingsvariabelen zijn ongeldig.');
  return {token,phoneId,recipient,template,language,version};
}
function payload(request,username,gift,cfg){
  const safe=s=>String(s||'').replace(/[\r\n\t]/g,' ').slice(0,100);
  return {messaging_product:'whatsapp',to:cfg.recipient,type:'template',template:{name:cfg.template,language:{code:cfg.language},components:[{type:'body',parameters:[
    {type:'text',text:safe(username)},
    {type:'text',text:safe(gift)},
    {type:'text',text:safe(request.id)}
  ]}]}};
}
async function sendOwnerMessage(request,username,gift,env=process.env,transport=globalThis.fetch){
  const cfg=config(env);
  if(!cfg)return {status:'not_configured',message:'WhatsApp is nog niet ingesteld op Render.'};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await transport(`https://graph.facebook.com/${cfg.version}/${cfg.phoneId}/messages`,{
      method:'POST',headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json'},body:JSON.stringify(payload(request,username,gift,cfg)),signal:controller.signal
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(`Meta API ${response.status}: ${String(result.error?.message||'verzenden mislukt').slice(0,180)}`);
    return {status:'sent',messageId:result.messages?.[0]?.id||null};
  }catch(e){return {status:'failed',message:String(e.message||e).slice(0,200)};}
  finally{clearTimeout(timer);}
}
module.exports={config,payload,sendOwnerMessage};
