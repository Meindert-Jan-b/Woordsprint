'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Answers = require('../public/answer-utils');
const {questionFor} = require('../public/cloze-utils');
const exampleContexts = require('../public/context-examples');
const SHOP = Object.freeze([
  {id:'neon',title:'Neon thema',description:'Een paarse gloed op je profiel',price:250,icon:'🎨'},
  {id:'gold',title:'Gouden naam',description:'Een gouden profielnaam',price:500,icon:'👑'},
  {id:'frame',title:'Sterrenframe',description:'Een sterrenrand om je avatar',price:350,icon:'🌟'},
  {id:'banner',title:'Galaxy achtergrond',description:'Een sterrenachtergrond op je profiel',price:400,icon:'🌌'}
]);
const QUESTS = Object.freeze([
  {id:'new3',title:'Leer drie nieuwe woorden',kind:'new',target:3,reward:20},
  {id:'correct10',title:'Leer of herhaal tien unieke woorden',kind:'correct',target:10,reward:15},
  {id:'repeat3',title:'Herhaal drie woorden op tijd',kind:'review',target:3,reward:20}
]);
const BADGES = Object.freeze([
  {id:'first',title:'Eerste woord',icon:'🌱',description:'Beheers je eerste unieke woord',xp:20,coins:15,kind:'mastered',target:1},
  {id:'ten',title:'Woordenkenner',icon:'🧠',description:'Beheers tien unieke woorden',xp:40,coins:30,kind:'mastered',target:10},
  {id:'hundred',title:'Woordenmeester',icon:'🏆',description:'Beheers honderd unieke woorden',xp:150,coins:100,kind:'mastered',target:100},
  {id:'streak3',title:'Drie dagen leren',icon:'🔥',description:'Leer drie dagen achter elkaar',xp:30,coins:25,kind:'streak',target:3},
  {id:'streak7',title:'Een hele week',icon:'💎',description:'Leer zeven dagen achter elkaar',xp:80,coins:65,kind:'streak',target:7}
]);
const GIFT_CARDS=Object.freeze([{id:'gift5',title:'Roblox-cadeaubon €5 (indien verkrijgbaar)',price:5000,description:'Handmatige aanvraag en alleen als de beheerder deze officiële waarde kan leveren'},{id:'gift10',title:'Roblox-cadeaubon €10',price:10000,description:'Handmatige aanvraag, officiële cadeaubon; geen directe Robux-uitbetaling'}]);
// Alle beschikbare oefenstanden: Context telt alleen mee als de lijst voorbeeldzinnen heeft.
const BONUS_MODES=Object.freeze(['learn','type','flash','choice','dictation','hint','test','think','context','memory','match','scramble','sprint']);
const BONUS_COINS_PER_WORD=40; // 25 unieke woordparen -> 1000 coins
const uniqueId=()=>crypto.randomUUID();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateMs = d => Date.parse(d+'T12:00:00Z');
const clean=s=>String(s??'').trim();
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
  return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
}
function verifyPassword(password,digest){const [salt,hex]=String(digest||'').split(':');if(!salt||!/^[a-f0-9]{128}$/.test(hex||''))return false;const a=crypto.scryptSync(password,salt,64),b=Buffer.from(hex,'hex');return crypto.timingSafeEqual(a,b);}
function publicUser(u){return {id:u.id,username:u.username,level:1+Math.floor(Math.sqrt(u.rewards.xp/70)),xp:u.rewards.xp,coins:u.rewards.coins,badges:u.rewards.badges.map(b=>b.id),equipped:u.rewards.equipped||null};}
function defaultState(){return {lists:[],progress:{},modeProgress:{},activity:[],settings:{createdAt:new Date().toISOString()}};}
function makeUser(username,password){return {id:uniqueId(),username,pass:hashPassword(password),createdAt:new Date().toISOString(),state:defaultState(),rewards:{xp:0,coins:0,wordLedger:{},badges:[],inventory:[],equipped:null,daily:{},weeklyXp:{},lastActive:null,listBonusWordKeys:{},listBonusClaims:[]},friends:[],friendRequests:[],privacy:{showGlobal:false},audit:[]};}
function canonicalKey(list,word){
  // The identity of a learning pair does not depend on list ID, word ID, or list name.
  // Normalize alternative translations in stable order: advocaat/jurist == jurist/advocaat.
  const norm=x=>Answers.normalized(x);
  const field=x=>Answers.alternatives(x).map(norm).filter(Boolean).sort().join('|');
  const sides=[[list.fromLang||'',field(word.front)],[list.toLang||'',field(word.back)]];
  sides.sort((a,b)=>(a[0]+'\u0000'+a[1]).localeCompare(b[0]+'\u0000'+b[1]));
  return crypto.createHash('sha256').update(sides.map(s=>s.join('\u0000')).join('\u0001')).digest('hex');
}
function daysStreak(activity){const days = new Set((activity||[]).filter(a=>a.xp>0).map(a=>a.date));let date=today();if(!days.has(date)){date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(dateMs(date)-86400000));}let n=0;while(days.has(date)){n++;date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(dateMs(date)-86400000));}return n;}
class Accounts{
  constructor(file,opts={}){
    this.file=file;this.clock=opts.clock||(()=>Date.now());this.legacyPath=opts.legacyPath;this.ownerSetupCode=opts.ownerSetupCode||null;
    fs.mkdirSync(path.dirname(file),{recursive:true});
    try{this.data=JSON.parse(fs.readFileSync(file,'utf8'));}catch{this.data={version:2,users:[],sessions:[],migrationClaimed:false};this.persist();}
    this.data.users ||= [];this.data.sessions||=[];this.data.redemptions||=[];this.data.giftCardsEnabled??=false;this.gameSessions=new Map();
    this.ownerCodeFile=path.join(path.dirname(file),'BEHEERDER-CODE-PRIVE.txt');
    if(!this.ownerSetupCode&&!this.data.ownerId&&!fs.existsSync(this.ownerCodeFile))fs.writeFileSync(this.ownerCodeFile,'Eenmalige eigenaarcode voor WoordSprint. Houd geheim!\n'+crypto.randomBytes(16).toString('hex')+'\n',{mode:0o600});
    this.attempts=new Map();
    this.claimCodeFile=path.join(path.dirname(file),'MIGRATIE-CODE-ALLEEN-VOOR-JOU.txt');
    if(this.hasLegacy()&&!this.data.migrationClaimed&&!fs.existsSync(this.claimCodeFile)){
      fs.writeFileSync(this.claimCodeFile,'WoordSprint 2.0: gebruik deze eenmalige code in Profiel > Oude lijsten overzetten.\n'+crypto.randomBytes(14).toString('hex')+'\n',{mode:0o600});
    }
  }
  persist(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.data,null,2));fs.renameSync(tmp,this.file);}
  hasLegacy(){if(!this.legacyPath||this.data.migrationClaimed)return false;try {const legacy=JSON.parse(fs.readFileSync(this.legacyPath,'utf8'));return Array.isArray(legacy.lists)&&legacy.lists.length>0;}catch{return false;}}
  profile(u){return {...publicUser(u),owner:this.data.ownerId===u.id,redemptions:(this.data.redemptions||[]).filter(r=>r.userId===u.id).slice(-10).reverse().map(({id,itemId,price,status,createdAt})=>({id,itemId,price,status,createdAt})),friends:u.friends.length,streak:daysStreak(u.state.activity),mastered:Object.values(u.rewards.wordLedger).filter(x=>x.masteredAt).length,inventory:u.rewards.inventory,privacy:u.privacy,shop:SHOP,quests:this.quests(u),badgeCatalog:BADGES};}
  register(username,password){username=clean(username);if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))throw Error('Gebruikersnaam: 3–20 letters, cijfers of underscores.');if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Wachtwoord moet 8–128 tekens hebben.');if(this.data.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))throw Error('Deze gebruikersnaam is al bezet.');const u=makeUser(username,password);this.data.users.push(u);this.persist();return u;}
  login(username,password,ip='unknown'){
    const key=String(ip).slice(0,80);const t=this.clock(),attempt=(this.attempts.get(key)||[]).filter(x=>x>t-15*60_000);
    if(attempt.length>=12)throw Error('Te veel pogingen. Probeer het over 15 minuten opnieuw.');
    const u=this.data.users.find(x=>x.username.toLowerCase()===clean(username).toLowerCase());
    if(!u || !verifyPassword(String(password||''),u.pass)){attempt.push(t);this.attempts.set(key,attempt);throw Error('Gebruikersnaam of wachtwoord klopt niet.');}
    this.attempts.delete(key);return u;
  }
  createSession(u){const token=crypto.randomBytes(32).toString('hex');const hash=crypto.createHash('sha256').update(token).digest('hex');this.data.sessions=this.data.sessions.filter(s=>s.expiresAt>this.clock());this.data.sessions.push({hash,userId:u.id,expiresAt:this.clock()+7*86400_000});this.persist();return token;}
  fromSession(token){if(!/^[a-f0-9]{64}$/.test(token||''))return null;const hash=crypto.createHash('sha256').update(token).digest('hex');const s=this.data.sessions.find(x=>x.hash===hash&&x.expiresAt>this.clock());return s?this.data.users.find(u=>u.id===s.userId)||null:null;}
  endSession(token){const hash=crypto.createHash('sha256').update(String(token||'')).digest('hex');this.data.sessions=this.data.sessions.filter(x=>x.hash!==hash);this.persist();}
  claimLegacy(u,code){if(!this.hasLegacy())throw Error('Er zijn geen oude lijsten meer om over te zetten.');const expected=(fs.readFileSync(this.claimCodeFile,'utf8').match(/[a-f0-9]{28}/)||[])[0];if(!expected||!crypto.timingSafeEqual(Buffer.from(String(code).trim().padEnd(28,'!').slice(0,28)),Buffer.from(expected)))throw Error('De migratiecode klopt niet.');const source=JSON.parse(fs.readFileSync(this.legacyPath,'utf8'));u.state={lists:source.lists,progress:source.progress||{},activity:source.activity||[],settings:source.settings||{}};for(const a of u.state.activity){a.xp=0;}this.data.migrationClaimed=true;this.persist();fs.renameSync(this.claimCodeFile,this.claimCodeFile+'.gebruikt');return u.state.lists.length;}
  reward(u,type,amount,reason){if(!Number.isInteger(amount)||amount<0)throw Error('Ongeldige beloning');u.rewards[type]+=amount;u.audit.push({at:new Date(this.clock()).toISOString(),type,amount,reason});u.audit=u.audit.slice(-150);}
  quests(u){const d=today(),row=u.rewards.daily[d]||{new:0,correct:0,review:0,claimed:[]};return QUESTS.map(q=>({...q,progress:Math.min(q.target,row[q.kind]||0),done:row.claimed.includes(q.id)}));}
  updateQuest(u,kind,amount=1){const d=today(),r=u.rewards.daily[d]||{new:0,correct:0,review:0,claimed:[]};r[kind]=(r[kind]||0)+amount;u.rewards.daily[d]=r;for(const q of QUESTS)if(!r.claimed.includes(q.id)&&r[q.kind]>=q.target){r.claimed.push(q.id);this.reward(u,'coins',q.reward,'Dagmissie: '+q.title);}
    const oldest=Object.keys(u.rewards.daily).sort().slice(0,-20);oldest.forEach(k=>delete u.rewards.daily[k]);
  }
  updateBadges(u){let gained=[];const count=Object.values(u.rewards.wordLedger).filter(w=>w.masteredAt).length,streak=daysStreak(u.state.activity);for(const b of BADGES){if(u.rewards.badges.some(x=>x.id===b.id))continue;if((b.kind==='mastered'?count:streak)>=b.target){u.rewards.badges.push({id:b.id,earnedAt:new Date(this.clock()).toISOString()});this.reward(u,'xp',b.xp,'Badge '+b.title);this.reward(u,'coins',b.coins,'Badge '+b.title);gained.push(b);}}return gained;}
  // The same canonical pair + direction gives the same XP in *every* mode.
  // Switching game modes or duplicating/importing a list cannot reset rewards.
  grantMastery(u,list,word,direction,source){
    const day=today(),t=this.clock(),key=canonicalKey(list,word);
    let ledger=u.rewards.wordLedger[key];
    if(!ledger){ledger={firstAt:t,lastAt:0,correct:0,typed:false,modes:[],masteredAt:0,reviews:0,directions:{}};u.rewards.wordLedger[key]=ledger;}
    ledger.directions||={};
    // Earlier v2.0 records already paid the first-time 10 XP. Never pay twice.
    if(ledger.masteredAt&&!Object.keys(ledger.directions).length)ledger.directions.forward=ledger.masteredAt;
    const side=direction==='reverse'?'reverse':'forward';
    const daily=u.rewards.daily[day]||{new:0,correct:0,review:0,claimed:[]};
    if(!ledger.directions[side]){
      if((daily.new||0)>=60)return {awardedXp:0,awardedCoins:0,rewardReason:'Daglimiet bereikt; kom morgen terug'};
      const isSecond=!!(ledger.directions.forward||ledger.directions.reverse);
      ledger.directions[side]=t;
      ledger.masteredAt||=t;
      ledger.correct++;ledger.modes=Array.from(new Set([...(ledger.modes||[]),source]));
      const xp=isSecond?5:10,coins=isSecond?1:2;
      this.reward(u,'xp',xp,'Nieuwe richting: '+word.front+' / '+side);
      this.reward(u,'coins',coins,'Leren: '+word.front);
      if(!isSecond)this.updateQuest(u,'new');
      const d=u.rewards.daily[day]||{new:0,correct:0,review:0,claimed:[]};d.correctKeys||=[];
      if(!d.correctKeys.includes(key)){d.correctKeys.push(key);this.updateQuest(u,'correct');}
      u.rewards.weeklyXp[this.weekKey(day)]=(u.rewards.weeklyXp[this.weekKey(day)]||0)+xp;
      return {awardedXp:xp,awardedCoins:coins,rewardReason:isSecond?'Omgekeerde leerrichting':'Nieuw geleerd woord'};
    }
    if(t-(ledger.lastRewardReview||ledger.directions[side])>=20*3600_000 && (daily.review||0)<30){
      ledger.reviews++;ledger.lastRewardReview=t;this.updateQuest(u,'review');
      this.reward(u,'xp',2,'Herhaling: '+word.front);this.reward(u,'coins',1,'Herhaling: '+word.front);
      u.rewards.weeklyXp[this.weekKey(day)]=(u.rewards.weeklyXp[this.weekKey(day)]||0)+2;
      return {awardedXp:2,awardedCoins:1,rewardReason:'Herhaling op tijd'};
    }
    return {awardedXp:0,awardedCoins:0,rewardReason:'Dit woord is in deze richting al beloond'};
  }
  // Per-account, per-list mode completion is based on server-validated correct
  // answers, not on client-submitted percentages or simply opening a game.
  // Store canonical word identities so editing a word invalidates stale checks.
  markModeCompletedWord(u,list,word,mode,direction){
    if(!['learn','type','flash','choice','dictation','hint','test','think','context','memory','match','scramble','sprint'].includes(mode))return;
    const side=['memory','match','context'].includes(mode)?'forward':direction==='reverse'?'reverse':'forward';
    const all=u.state.modeProgress ||= {};
    const perList=all[list.id] ||= {};
    const perMode=perList[mode] ||= {};
    const visited=perMode[side] ||= [];
    const key=canonicalKey(list,word);
    if(!visited.includes(key))visited.push(key);
  }
  modeCompletion(u,list,mode,direction='forward'){
    const side=['memory','match','context'].includes(mode)?'forward':direction==='reverse'?'reverse':'forward';
    const eligible=mode==='context'?list.words.filter(w=>!!this.contextAnswer(w,list)):list.words;
    const required=new Set(eligible.map(w=>canonicalKey(list,w)));
    const visited=new Set(u.state.modeProgress?.[list.id]?.[mode]?.[side]||[]);
    const count=[...required].filter(key=>visited.has(key)).length;
    return {count,total:required.size,done:required.size>0&&count===required.size};
  }
  // Eenmaal 40 coins per canoniek woordpaar als ALLE beschikbare modes zijn afgerond.
  // Kopiëren, hernoemen, herimporteren, een andere leerrichting kiezen of
  // hetzelfde woord in een tweede lijst opnemen betaalt het woord nooit opnieuw.
  listBonusStatus(u,list,direction='forward'){
    const modeResults=BONUS_MODES.map(mode=>({mode,...this.modeCompletion(u,list,mode,direction)}));
    const eligible=modeResults.filter(m=>m.total>0);
    const completed=eligible.filter(m=>m.done).length;
    const keys=[...new Set((list.words||[]).map(w=>canonicalKey(list,w)))];
    const already=u.rewards.listBonusWordKeys||{};
    const newKeys=keys.filter(k=>!already[k]);
    return {wordCount:keys.length,completedModes:completed,totalModes:eligible.length,
      allDone:eligible.length>0&&completed===eligible.length,
      newWords:newKeys.length,possibleCoins:newKeys.length*BONUS_COINS_PER_WORD,
      rate:BONUS_COINS_PER_WORD};
  }
  claimListBonus(u,list,direction='forward'){
    const status=this.listBonusStatus(u,list,direction);
    if(!status.allDone)throw Error('Rond eerst alle beschikbare oefenstanden af.');
    if(!status.possibleCoins)return {coins:0,words:0,alreadyClaimed:true,profile:this.profile(u)};
    const paid=u.rewards.listBonusWordKeys ||= {};
    const keys=[...new Set(list.words.map(w=>canonicalKey(list,w)))].filter(k=>!paid[k]);
    const coins=keys.length*BONUS_COINS_PER_WORD;
    const timestamp=new Date(this.clock()).toISOString();
    keys.forEach(k=>{paid[k]=timestamp;});
    const claim={id:uniqueId(),listId:list.id,at:timestamp,words:keys.length,coins};
    (u.rewards.listBonusClaims||=[]).push(claim);
    u.rewards.listBonusClaims=u.rewards.listBonusClaims.slice(-200);
    this.reward(u,'coins',coins,`Alle oefenstanden afgerond: ${keys.length} nieuwe woordparen`);
    this.persist();
    return {coins,words:keys.length,alreadyClaimed:false,profile:this.profile(u)};
  }
  tryAwardListBonus(u,list,direction){
    const status=this.listBonusStatus(u,list,direction);
    return status.allDone&&status.possibleCoins>0?this.claimListBonus(u,list,direction):null;
  }
  recordCorrect(u,list,word,correct,mode,direction,qualifies){
    const t=this.clock(),day=today(),key=canonicalKey(list,word);
    // v2.4 hotfix: new/demo and legacy accounts may not yet have modeProgress.
    // Initialize before every answer, even wrong answers and intermediate learning stages.
    u.state.modeProgress ||= {};
    const progress=((u.state.progress ||= {})[list.id]||={});
    const stat=progress[word.id]||={correct:0,wrong:0,streak:0,mastery:0,lastAt:null};
    const activity=u.state.activity.find(x=>x.date===day)||(()=>{const x={date:day,answered:0,correct:0,xp:0};u.state.activity.push(x);return x;})();
    activity.answered++;
    if(correct){activity.correct++;stat.correct++;stat.streak++;stat.mastery=Math.min(5,stat.mastery+1);}
    else{stat.wrong++;stat.streak=0;stat.mastery=Math.max(0,stat.mastery-1);}
    stat.lastAt=new Date(t).toISOString();
    let earned={awardedXp:0,awardedCoins:0};
    if(correct&&qualifies){
      earned=this.grantMastery(u,list,word,direction,mode);
      this.markModeCompletedWord(u,list,word,mode,direction);
      const bonus=this.tryAwardListBonus(u,list,direction);
      if(bonus?.coins){earned.awardedCoins=(earned.awardedCoins||0)+bonus.coins;earned.listBonusCoins=bonus.coins;earned.listBonusWords=bonus.words;}
    }
    activity.xp+=(earned.awardedXp||0);
    const badges=correct?this.updateBadges(u):[];
    u.state.activity=u.state.activity.slice(-120);this.persist();
    return {...earned,stat,activity,modeProgress:u.state.modeProgress[list.id]||{},profile:this.profile(u),badges:badges.map(b=>b.title)};
  }
  reviewAnswer(u,list,word,answer,mode,direction='forward',stage){
    const allowed=new Set(['choice','type','hint','test','dictation','context','learn','sprint','scramble']);
    if(!allowed.has(mode))throw Error('Onbekende oefenmodus.');
    const effective=mode==='learn'?['flash','choice','hint','type'][Number(stage)]:mode;
    if(!effective||effective==='flash')throw Error('Ongeldige oefenvorm.');
    const expected=mode==='context'?this.contextAnswer(word,list):direction==='reverse'?word.front:word.back;
    if(!expected)throw Error('Geen geldig antwoord beschikbaar voor deze vraag.');
    const correct=Answers.isCorrect(String(answer||''),expected);
    // Only the final step of Slim leren earns its word reward. The other
    // activities all pay the same reward for a verified correct word.
    const details=this.recordCorrect(u,list,word,correct,mode,direction,mode!=='learn'||Number(stage)===3);
    return {correct,expected,...details};
  }
  contextAnswer(word,list){return questionFor(word,list,exampleContexts)?.accepted||null;}
  startGame(u,list,mode,wordIds,direction){
    if(!['memory','match','flash','think'].includes(mode))throw Error('Onbekende spelmodus');
    const ids=new Set(Array.isArray(wordIds)?wordIds.slice(0,3000):[]);
    const allowed=new Set(list.words.map(w=>w.id));
    if(!ids.size||[...ids].some(id=>!allowed.has(id)))throw Error('Ongeldige woorden voor dit spel');
    for(const [k,x] of this.gameSessions)if(x.expiresAt<this.clock()||x.userId===u.id)this.gameSessions.delete(k);
    const gameId=uniqueId();this.gameSessions.set(gameId,{userId:u.id,listId:list.id,mode,wordIds:ids,done:new Set(),direction:['memory','match'].includes(mode)?'forward':direction==='reverse'?'reverse':'forward',expiresAt:this.clock()+45*60_000,createdAt:this.clock(),revealed:new Map()});
    return {gameId};
  }
  revealSelf(u,gameId,wordId){const g=this.gameSessions.get(gameId);if(!g||g.userId!==u.id||!['flash','think'].includes(g.mode)||!g.wordIds.has(wordId)||g.expiresAt<this.clock())throw Error('Ongeldige oefensessie');g.revealed.set(wordId,this.clock());return {ok:true};}
  finishGamePair(u,list,gameId,frontId,backId,known=false){
    const g=this.gameSessions.get(gameId),t=this.clock();
    if(!g||g.userId!==u.id||g.listId!==list.id||g.expiresAt<t)throw Error('Deze spelronde is verlopen. Start opnieuw.');
    if(!g.wordIds.has(frontId)||frontId!==backId||g.done.has(frontId))throw Error('Geen nieuw correct woordpaar.');
    if(['flash','think'].includes(g.mode)){
      if(known!==true||!g.revealed.has(frontId)||t-g.revealed.get(frontId)<1200)throw Error('Bekijk eerst de kaart voordat je hem afvinkt.');
    }else if(!['memory','match'].includes(g.mode))throw Error('Onbekende oefenmodus');
    const word=list.words.find(w=>w.id===frontId);if(!word)throw Error('Woord bestaat niet');
    g.done.add(frontId);
    return {correct:true,...this.recordCorrect(u,list,word,true,g.mode,g.direction,true)};
  }
  ownerClaim(u,code){
    if(this.data.ownerId)throw Error('Er is al een beheerder ingesteld.');
    const fromEnv=!!this.ownerSetupCode;
    if(!fromEnv&&!fs.existsSync(this.ownerCodeFile))throw Error('Beheerdercode ontbreekt.');
    const expected=fromEnv?this.ownerSetupCode:(fs.readFileSync(this.ownerCodeFile,'utf8').match(/[a-f0-9]{32}/)||[])[0];
    const given=String(code||'').trim();
    if(!expected||given.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(given)))throw Error('Beheerdercode klopt niet.');
    this.data.ownerId=u.id;this.persist();if(!fromEnv)fs.renameSync(this.ownerCodeFile,this.ownerCodeFile+'.gebruikt');return this.profile(u);
  }
  ownerCheck(u){if(this.data.ownerId!==u.id)throw Error('Alleen de beheerder kan dit doen.');}
  ownerView(u){this.ownerCheck(u);return {enabled:this.data.giftCardsEnabled,catalog:GIFT_CARDS,requests:this.data.redemptions.map(r=>({...r,username:this.data.users.find(x=>x.id===r.userId)?.username||'Gebruiker'})).slice(-150).reverse()};}
  ownerEnable(u,enabled){this.ownerCheck(u);this.data.giftCardsEnabled=enabled===true;this.persist();return this.ownerView(u);}
  giftCatalog(){return {enabled:this.data.giftCardsEnabled&&!!this.data.ownerId,catalog:GIFT_CARDS};}
  requestGift(u,itemId){
    const item=GIFT_CARDS.find(i=>i.id===itemId);
    if(!item)throw Error('Onbekende cadeaubon.');
    if(!this.data.giftCardsEnabled||!this.data.ownerId)throw Error('De beheerder heeft cadeaubonnen nog niet beschikbaar gesteld.');
    if(this.data.redemptions.some(r=>r.userId===u.id&&r.status==='pending'))throw Error('Je hebt al een aanvraag in behandeling.');
    if(u.rewards.coins<item.price)throw Error('Niet genoeg coins.');
    u.rewards.coins-=item.price;
    const request={id:uniqueId(),userId:u.id,itemId:item.id,price:item.price,status:'pending',notificationStatus:'not_configured',createdAt:new Date(this.clock()).toISOString()};
    this.data.redemptions.push(request);this.persist();return {request:{id:request.id,status:request.status},profile:this.profile(u)};
  }
  ownerReview(u,requestId,status){
    this.ownerCheck(u);const r=this.data.redemptions.find(r=>r.id===requestId);
    if(!r)throw Error('Aanvraag niet gevonden.');
    if(!['rejected','delivered'].includes(status)||r.status!=='pending')throw Error('Deze aanvraag is al afgehandeld.');
    r.status=status;r.reviewedAt=new Date(this.clock()).toISOString();
    if(status==='rejected'){const customer=this.data.users.find(x=>x.id===r.userId);if(customer)customer.rewards.coins+=r.price;}
    this.persist();return this.ownerView(u);
  }
  weekKey(day=today()){const d=new Date(dateMs(day));const dow=(d.getUTCDay()+6)%7;return new Date(d.getTime()-dow*86400_000).toISOString().slice(0,10);}
  shopBuy(u,itemId){const item=SHOP.find(x=>x.id===itemId);if(!item)throw Error('Onbekende beloning.');if(u.rewards.inventory.includes(itemId))throw Error('Deze beloning heb je al.');if(u.rewards.coins<item.price)throw Error('Je hebt nog niet genoeg coins.');u.rewards.coins-=item.price;u.rewards.inventory.push(itemId);u.rewards.equipped=itemId;this.persist();return this.profile(u);}
  equip(u,itemId){if(!u.rewards.inventory.includes(itemId))throw Error('Je hebt deze beloning nog niet.');u.rewards.equipped=itemId;this.persist();return this.profile(u);}
  friendRequest(u,targetName){const t=this.data.users.find(x=>x.username.toLowerCase()===clean(targetName).toLowerCase());if(!t||t.id===u.id)throw Error('Gebruiker niet gevonden.');if(u.friends.includes(t.id))throw Error('Jullie zijn al vrienden.');if(t.friendRequests.includes(u.id))throw Error('Verzoek is al verstuurd.');if(t.friendRequests.length>=20)throw Error('Deze gebruiker heeft te veel openstaande verzoeken.');u.sentRequests||={};if(u.sentRequests[t.id]&&this.clock()-u.sentRequests[t.id]<86400000)throw Error('Je kunt deze gebruiker morgen opnieuw uitnodigen.');u.sentRequests[t.id]=this.clock();t.friendRequests.push(u.id);this.persist();return true;}
  acceptFriend(u,senderId,accept){const sender=this.data.users.find(x=>x.id===senderId);if(!sender||!u.friendRequests.includes(sender.id))throw Error('Vriendschapsverzoek niet gevonden.');u.friendRequests=u.friendRequests.filter(x=>x!==senderId);if(accept){u.friends.push(senderId);sender.friends.push(u.id);}this.persist();return true;}
  removeFriend(u,targetId){const target=this.data.users.find(x=>x.id===targetId);if(!u.friends.includes(targetId))throw Error('Geen vriend.');u.friends=u.friends.filter(x=>x!==targetId);if(target)target.friends=target.friends.filter(x=>x!==u.id);this.persist();}
  friendsView(u){return {friends:u.friends.map(id=>this.data.users.find(x=>x.id===id)).filter(Boolean).map(publicUser),requests:u.friendRequests.map(id=>this.data.users.find(x=>x.id===id)).filter(Boolean).map(publicUser)};}
  leaderboard(u,scope='friends'){const key=this.weekKey();const visible=this.data.users.filter(x=>x.id===u.id||scope==='friends'&&u.friends.includes(x.id)||scope==='global'&&x.privacy.showGlobal);
    return visible.map(x=>({...publicUser(x),weeklyXp:x.rewards.weeklyXp[key]||0})).sort((a,b)=>b.weeklyXp-a.weeklyXp||a.username.localeCompare(b.username)).slice(0,40);
  }
}
module.exports={Accounts,SHOP,QUESTS,BADGES,GIFT_CARDS,BONUS_MODES,BONUS_COINS_PER_WORD,canonicalKey,hashPassword,verifyPassword,publicUser,today};
