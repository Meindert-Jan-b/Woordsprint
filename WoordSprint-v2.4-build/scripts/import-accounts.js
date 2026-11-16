'use strict';
// One-time local v2.0/v2.1 -> Supabase migration. Never upload accounts.json to GitHub.
const fs=require('node:fs');
const path=require('node:path');
const {createCloudStore}=require('../lib/cloud-state');
(async()=>{
  const file=process.argv[2];
  if(!file||!fs.existsSync(file)){
    console.error('Gebruik: node scripts/import-accounts.js "C:\\pad\\naar\\oude\\data\\accounts.json"');process.exitCode=1;return;
  }
  const existing=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  if(!Array.isArray(existing.users)||!Array.isArray(existing.sessions))throw Error('Dit is geen geldig accounts.json-bestand.');
  if(existing.users.length<1)throw Error('Het bestand bevat geen accounts.');
  const store=createCloudStore();
  const remote=await store.load();
  // Refuse to overwrite live data, including pending redemption requests.
  if(remote&&((remote.users||[]).length>0||(remote.redemptions||[]).length>0))throw Error('STOP: er bestaan al online accounts/aanvragen. Importeren zou live gegevens overschrijven.');
  existing.sessions=[]; // All users log in afresh on the new HTTPS domain.
  existing.redemptions||=[];existing.giftCardsEnabled??=false;
  if(process.argv.includes('--dry-run')){console.log(`Controle geslaagd: ${existing.users.length} accounts. Geen wijzigingen.`);return;}
  await store.save(existing);
  console.log(`Gelukt: ${existing.users.length} accounts inclusief XP, coins en lijsten geïmporteerd. Bewaar het origineel privé.`);
})().catch(e=>{console.error('Migratie mislukt:',e.message);process.exitCode=1;});
