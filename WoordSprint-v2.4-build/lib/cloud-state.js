'use strict';
// Server-only Supabase Data API adapter. Never send the secret key to the browser.
// For a small single-instance hobby app: one durable JSONB snapshot, serialized writes.
// Do NOT run multiple web instances with this storage adapter.
const KEY='global';
function createCloudStore(env=process.env, transport=globalThis.fetch){
  const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  const secret=String(env.SUPABASE_SECRET_KEY||'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base))throw Error('SUPABASE_URL moet de https://...supabase.co project-URL zijn.');
  if(!secret)throw Error('SUPABASE_SECRET_KEY ontbreekt.');
  const url=base+'/rest/v1/woordsprint_state';
  const headers={'apikey':secret,'Content-Type':'application/json'};
  // Current sb_secret_ keys belong only in apikey, not Authorization Bearer.
  // Legacy service_role is also accepted via apikey.
  async function call(suffix,init={}){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const r=await transport(url+suffix,{...init,headers:{...headers,...init.headers},signal:controller.signal});
      const body=await r.text();
      if(!r.ok)throw Error(`Supabase HTTP ${r.status}: ${body.slice(0,250)}`);
      return body?JSON.parse(body):null;
    }finally{clearTimeout(timeout);}
  }
  return {
    async load(){
      const rows=await call('?id=eq.'+KEY+'&select=payload',{method:'GET'});
      if(!Array.isArray(rows))throw Error('Supabase gaf geen tabelgegevens terug.');
      return rows[0]?.payload||null;
    },
    async save(payload){
      // No upsert before a successful initial load. App starts accepting users only after load.
      await call('?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:KEY,payload})});
    }
  };
}
function createWriteQueue(store){
  let queue=Promise.resolve();
  return {
    enqueue(data){
      // Freeze a snapshot at the exact persist() call, not after later mutations.
      const payload=structuredClone(data);
      queue=queue.catch(()=>{}).then(()=>store.save(payload));
      return queue;
    },
    flush(){return queue;}
  };
}
module.exports={createCloudStore,createWriteQueue};
