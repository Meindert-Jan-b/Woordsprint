'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {AsyncLocalStorage} = require('node:async_hooks');
const {Accounts,GIFT_CARDS} = require('./lib/accounts');
const {createCloudStore,createWriteQueue}=require('./lib/cloud-state');
const {validateBook,bookIndex,openChapter,localBookStore,sharedBookLibrary}=require('./lib/private-book');
const germanClassBook=require('./lib/german-class-book.json');
const {config:whatsappConfig,sendOwnerMessage}=require('./lib/whatsapp');
const multer = require('multer');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const {tsvLines,glossaryLines,pairAligned,splitTsvColumns,cropFromPercents}=require('./lib/ocr-layout');
const {discoverGlossary}=require('./lib/auto-glossary');
const {detectKnownPage}=require('./lib/known-page');
const {parsePastedText,fetchPublicStudyGo,parsePdfPages}=require('./lib/studygo-import');

const app = express();
app.set('trust proxy',1); // Render terminates HTTPS before proxying to Node
const CLOUD_MODE=!!(process.env.SUPABASE_URL||process.env.SUPABASE_SECRET_KEY);
const cloudStore=CLOUD_MODE?createCloudStore():null;
const bookStore=cloudStore||localBookStore(path.join(__dirname,'data','private-books'));
let cloudQueue=null;
app.get('/health',(_req,res)=>res.json({ok:true,storage:CLOUD_MODE?'supabase':'local'}));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = path.join(__dirname, 'data', 'woordsprint.json');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(path.join(__dirname, '.ocr-cache'), { recursive: true });
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: 0 }));

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const text = (value, length=250) => String(value ?? '').trim().slice(0, length);
const demo = () => ({
  lists: [
    { id: id(), name: 'Frans · De basis', subject: 'Frans', fromLang: 'fr-FR', toLang: 'nl-NL', createdAt: now(), updatedAt: now(), demo: true, words: [
      ['bonjour', 'hallo'], ['merci', 'bedankt'], ['au revoir', 'tot ziens'], ['la maison', 'het huis'],
      ['le chat', 'de kat'], ['le chien', 'de hond'], ['le livre', 'het boek'], ['l’école', 'de school'],
      ['le soleil', 'de zon'], ['la pluie', 'de regen'], ['manger', 'eten'], ['parler', 'praten']
    ].map(([front,back])=> ({id:id(),front,back})) },
    { id: id(), name: 'Duits · Op reis', subject: 'Duits', fromLang: 'de-DE', toLang: 'nl-NL', createdAt: now(), updatedAt: now(), demo: true, words: [
      ['der Bahnhof', 'het station'], ['die Straße', 'de straat'], ['das Fahrrad', 'de fiets'],
      ['die Reise', 'de reis'], ['das Wetter', 'het weer'], ['der Koffer', 'de koffer'],
      ['die Fahrkarte', 'het kaartje'], ['das Flugzeug', 'het vliegtuig'], ['der Urlaub', 'de vakantie'],
      ['die Unterkunft', 'de accommodatie']
    ].map(([front,back])=>({id:id(),front,back})) }
  ],
  progress: {},
  activity: [],
  settings: { createdAt: now() }
});
// Every HTTP request carries its own account state, isolated even across concurrent OCR/import requests.
const accounts=new Accounts(path.join(__dirname,'data','accounts.json'),{legacyPath:DB_PATH,ownerSetupCode:CLOUD_MODE?process.env.OWNER_SETUP_CODE:null});
const scope=new AsyncLocalStorage();
const db=new Proxy({}, {
  get(_target,key){return scope.getStore()?.state?.[key];},
  set(_target,key,value){const st=scope.getStore()?.state;if(!st)throw Error('Geen accountcontext');st[key]=value;return true;},
  ownKeys(){return Reflect.ownKeys(scope.getStore()?.state||{});},
  getOwnPropertyDescriptor(_target,key){const st=scope.getStore()?.state||{};return Object.prototype.hasOwnProperty.call(st,key)?{enumerable:true,configurable:true,value:st[key],writable:true}:undefined;}
});
function save(){accounts.persist();}
function cookieToken(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ws_session='))?.slice(11)||'';}
function setSessionCookie(req,res,token){res.cookie('ws_session',token,{httpOnly:true,sameSite:'lax',secure:req.secure||CLOUD_MODE,maxAge:7*24*3600*1000,path:'/'});}
function clearSessionCookie(res){res.clearCookie('ws_session',{httpOnly:true,sameSite:'lax',path:'/'});}
function authError(res,msg,status=400){return res.status(status).json({error:msg});}
function sameOrigin(req,res,next){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
  const origin=req.get('origin');
  if(origin){try{const url=new URL(origin);if(url.host!==req.get('host'))return authError(res,'Deze aanvraag komt van een andere website.',403);}catch{return authError(res,'Ongeldige websiteherkomst.',403);}}
  next();
}
app.use('/api',sameOrigin);
// In cloud mode a write is not a success until Supabase has confirmed persistence.
// Serialize snapshot writes, since Render Free can lose its local filesystem.
app.use('/api',(req,res,next)=>{
  if(!CLOUD_MODE||req.method==='GET')return next();
  const originalJson=res.json.bind(res);
  res.json=function(value){
    cloudQueue.flush().then(()=>{if(!res.headersSent)originalJson(value);}).catch(err=>{
      console.error('Supabase kon gegevens niet opslaan:',err.message);
      if(!res.headersSent)res.status(503),originalJson({error:'Opslaan in de online database is mislukt. Probeer opnieuw. Er zijn geen beloningen bevestigd.'});
    });
    return res;
  };
  next();
});
app.get('/api/auth/me',(req,res)=>{const user=accounts.fromSession(cookieToken(req));res.json({user:user?accounts.profile(user):null,hasLegacy:CLOUD_MODE?false:accounts.hasLegacy(),cloud:CLOUD_MODE});});
app.post('/api/auth/register',(req,res)=>{try{
  const u=accounts.register(req.body.username,req.body.password);u.state=demo();
  const token=accounts.createSession(u);setSessionCookie(req,res,token);res.status(201).json({user:accounts.profile(u)});
}catch(e){authError(res,e.message);}});
app.post('/api/auth/login',(req,res)=>{try{const u=accounts.login(req.body.username,req.body.password,req.ip);const token=accounts.createSession(u);setSessionCookie(req,res,token);res.json({user:accounts.profile(u)});}catch(e){authError(res,e.message,401);}});
app.post('/api/auth/logout',(req,res)=>{accounts.endSession(cookieToken(req));clearSessionCookie(res);res.json({ok:true});});
app.use('/api',(req,res,next)=>{
  const user=accounts.fromSession(cookieToken(req));if(!user)return authError(res,'Log eerst in om WoordSprint te gebruiken.',401);
  scope.run({user,state:user.state},()=>next());
});
app.get('/api/profile',(req,res)=>res.json(accounts.profile(scope.getStore().user)));
app.post('/api/profile/style',(req,res)=>{
  try{res.json(accounts.setProfileStyle(scope.getStore().user,req.body.id));}
  catch(err){error(res,400,err.message);}
});
app.post('/api/profile/legacy',(req,res)=>{try{const n=accounts.claimLegacy(scope.getStore().user,req.body.code);res.json({ok:true,count:n});}catch(e){authError(res,e.message);}});
app.post('/api/profile/privacy',(req,res)=>{const u=scope.getStore().user;u.privacy.showGlobal=req.body.showGlobal===true;save();res.json(accounts.profile(u));});
app.get('/api/friends',(req,res)=>res.json(accounts.friendsView(scope.getStore().user)));
app.get('/api/friends/search',(req,res)=>{const u=scope.getStore().user;const q=String(req.query.q||'').trim().toLowerCase();if(q.length<3)return res.json([]);res.json(accounts.data.users.filter(x=>x.id!==u.id&&x.username.toLowerCase().startsWith(q)).slice(0,8).map(x=>({id:x.id,username:x.username,level:1+Math.floor(Math.sqrt(x.rewards.xp/70))})));});
app.post('/api/friends/request',(req,res)=>{try{accounts.friendRequest(scope.getStore().user,req.body.username);res.json({ok:true});}catch(e){authError(res,e.message);}});
app.post('/api/friends/respond',(req,res)=>{try{accounts.acceptFriend(scope.getStore().user,req.body.userId,req.body.accept===true);res.json({ok:true});}catch(e){authError(res,e.message);}});
app.post('/api/friends/remove',(req,res)=>{try{accounts.removeFriend(scope.getStore().user,req.body.userId);res.json({ok:true});}catch(e){authError(res,e.message);}});
app.get('/api/leaderboard',(req,res)=>res.json(accounts.leaderboard(scope.getStore().user,req.query.scope==='global'?'global':'friends')));
// Owner-only, opt-in official Roblox gift-card requests. No direct Robux trading.
app.post('/api/owner/claim',(req,res)=>{try{res.json(accounts.ownerClaim(scope.getStore().user,req.body.code));}catch(e){authError(res,e.message);}});
app.get('/api/owner',(req,res)=>{try{res.json({...accounts.ownerView(scope.getStore().user),whatsappConfigured:!!whatsappConfig()});}catch(e){authError(res,e.message,403);}});
app.post('/api/owner/review',(req,res)=>{try{res.json(accounts.ownerReview(scope.getStore().user,req.body.id,req.body.status));}catch(e){authError(res,e.message,403);}});
async function attemptGiftNotice(requestId){
  const record=accounts.data.redemptions.find(x=>x.id===requestId);
  if(!record)throw Error('Aanvraag niet gevonden.');
  if(record.notificationStatus==='sent')return {status:'sent'};
  const nowMs=Date.now();
  if(record.notificationLastAt&&nowMs-Date.parse(record.notificationLastAt)<5*60_000)throw Error('Probeer de melding over vijf minuten opnieuw.');
  record.notificationLastAt=new Date(nowMs).toISOString();
  const user=accounts.data.users.find(x=>x.id===record.userId);
  const gift=GIFT_CARDS.find(x=>x.id===record.itemId);
  // Write the request before contacting an external service. A Meta outage must
  // never cause the redeemed coins or the request to disappear.
  accounts.persist();if(cloudQueue)await cloudQueue.flush();
  const result=await sendOwnerMessage(record,user?.username||'Leerling',gift?.title||record.itemId);
  record.notificationStatus=result.status;
  record.notificationError=result.status==='failed'?result.message:null;
  record.notificationMessageId=result.messageId||null;
  accounts.persist();if(cloudQueue)await cloudQueue.flush();
  return result;
}
app.post('/api/owner/resend',async(req,res)=>{try{
  const owner=scope.getStore().user;accounts.ownerCheck(owner);
  await attemptGiftNotice(String(req.body.id||''));
  res.json({...accounts.ownerView(owner),whatsappConfigured:!!whatsappConfig()});
}catch(e){authError(res,e.message);}});

const listView = (list) => ({...list, wordCount:list.words.length});
function getLanIps() {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) for (const info of list || []) {
    if (info.family === 'IPv4' && !info.internal) addresses.push(info.address);
  }
  const priority = (ip) => ip.startsWith('192.168.')?0:ip.startsWith('10.')?1:ip.startsWith('172.')?2:3;
  return addresses.sort((a,b) => priority(a)-priority(b));
}
function buildWords(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.slice(0, 3000).map(w => ({ id: text(w.id,70)||id(), front:text(w.front,400), back:text(w.back,400), context:text(w.context,600), contextAnswer:text(w.contextAnswer,300), contextForms:text(w.contextForms,300) }))
    .filter(w => w.front && w.back).filter(w => {
      const k = w.front.toLocaleLowerCase('nl') + '\0' + w.back.toLocaleLowerCase('nl');
      if (seen.has(k)) return false; seen.add(k); return true;
    });
}
function error(res,status,message) { return res.status(status).json({error:message}); }
const modeIds=['learn','type','flash','choice','dictation','hint','test','think','context','memory','match','scramble','sprint'];
function completionForList(user,list){
  const out={};for(const mode of modeIds){out[mode]={};for(const side of ['forward','reverse'])out[mode][side]=accounts.modeCompletion(user,list,mode,side);}
  return out;
}
function stateWithCompletion(user){
  const state=user.state;
  const modeStatus={},listBonuses={};
  for(const list of state.lists){
    modeStatus[list.id]=completionForList(user,list);
    listBonuses[list.id]={forward:accounts.listBonusStatus(user,list,'forward'),reverse:accounts.listBonusStatus(user,list,'reverse')};
  }
  return {...state,modeStatus,listBonuses};
}
app.get('/api/state',(_,res)=>res.json(stateWithCompletion(scope.getStore().user)));
// Shared catalog is stored once, outside per-account progress.
const sharedLibrary=sharedBookLibrary(bookStore,u=>accounts.ownerCheck(u));
function finishBooks() {
  return accounts.data.finishBooks ??= [];
}

function readBookUpload(body) {
  if(body.rightsConfirmed!==true) throw Error('Bevestig dat je de woordenlijsten mag delen.');
  return {
    ...validateBook(body.book),
    subject:text(body.subject,60)||'Engels',
    fromLang:text(body.fromLang,20)||'en-GB',
    toLang:text(body.toLang,20)||'nl-NL'
  };
}

function bookForPractice(book) {
  return {...book,chapters:book.chapters.map(chapter=>({...chapter,id:book.id+':'+chapter.id}))};
}

app.get('/api/book',async(_req,res)=>{
  const user=scope.getStore().user;
  try {
    const legacy=await sharedLibrary.load();
    const books=finishBooks().map(book=>({id:book.id,...bookIndex(bookForPractice(book),user.state.lists)}));
    if(legacy) books.unshift({id:'legacy',...bookIndex(legacy,user.state.lists)});
    res.json({books});
  }catch(e){
    console.error('Book load:',e.message);
    error(res,503,'Boekopslag niet bereikbaar.');
  }
});

app.post('/api/book/import',requireOwner,(req,res)=>{
  try {
    const book=readBookUpload(req.body);
    const existing=finishBooks().find(item=>item.title.toLocaleLowerCase('nl')===book.title.toLocaleLowerCase('nl'));
    if(existing) Object.assign(existing,book);
    else finishBooks().push({id:id(),...book});
    save();
    res.status(existing?200:201).json({id:existing?.id||finishBooks().at(-1).id});
  }catch(e){error(res,400,e.message);}
});

app.post('/api/book/chapter/:id',async(req,res)=>{
  const user=scope.getStore().user;
  const [bookId,chapterId]=req.params.id.split(':');
  try {
    const uploaded=finishBooks().find(book=>book.id===bookId);
    const book=chapterId?(uploaded&&bookForPractice(uploaded)):await sharedLibrary.load();
    const result=openChapter(book,req.params.id,user.state.lists);
    if(result.created) save();
    res.json(result);
  }catch(e){error(res,404,'Hoofdstuk kon niet worden geopend.');}
});

function classes() {
  return accounts.data.classes ??= [];
}

function classIndex() {
  return classes().map(({id,name,lists}) => ({
    id,name,
    lists:lists.map(({id,name,subject,words,book}) => ({id,name,subject,book,wordCount:words.length}))
  }));
}

function requireOwner(req,res,next) {
  try { accounts.ownerCheck(scope.getStore().user); }
  catch (err) { return error(res,403,err.message); }
  next();
}

app.get('/api/classes',(_req,res) => res.json(classIndex()));

app.post('/api/classes',requireOwner,(req,res) => {
  const name=text(req.body.name,80);
  if(!name) return error(res,400,'Vul een klasnaam in.');
  const existing=classes().find(entry=>entry.name.toLocaleLowerCase('nl')===name.toLocaleLowerCase('nl'));
  if(existing) {
    save();
    return res.json({id:existing.id,classes:classIndex()});
  }
  const entry={id:id(),name,lists:[]};
  classes().push(entry);
  save();
  res.status(201).json({id:entry.id,classes:classIndex()});
});

function classBookLists(book,bookId,idsByChapter=new Map()){
  return book.chapters.map(chapter=>({
    id:idsByChapter.get(chapter.id)||id(),name:chapter.title,
    subject:book.subject,fromLang:book.fromLang,toLang:book.toLang,words:chapter.words,
    book:{id:bookId,title:book.title,chapterId:chapter.id,number:chapter.number,page:chapter.page,section:chapter.section}
  }));
}

function addGermanClassBook(){
  const bookId='duits-hoofdstuk-1-6';
  const name='1MA Duits';
  let entry=classes().find(item=>item.name.toLocaleLowerCase('nl')===name.toLocaleLowerCase('nl'));
  if(entry?.lists.some(list=>list.book?.id===bookId||list.book?.title===germanClassBook.title))return false;
  const book={...validateBook(germanClassBook),subject:'Duits',fromLang:'de-DE',toLang:'nl-NL'};
  const chapters=classBookLists(book,bookId);
  if(entry)entry.lists.push(...chapters);
  else classes().push({id:id(),name,lists:chapters});
  return true;
}

app.post('/api/classes/:classId/books',requireOwner,(req,res)=>{
  const entry=classes().find(item=>item.id===req.params.classId);
  if(!entry) return error(res,404,'Klas niet gevonden.');
  try {
    const book=readBookUpload(req.body);
    const previous=entry.lists.filter(list=>list.book?.title.toLocaleLowerCase('nl')===book.title.toLocaleLowerCase('nl'));
    const bookId=previous[0]?.book.id||id();
    const idsByChapter=new Map(previous.map(list=>[list.book.chapterId,list.id]));
    const chapters=classBookLists(book,bookId,idsByChapter);
    entry.lists=entry.lists.filter(list=>list.book?.id!==bookId).concat(chapters);
    save();
    res.json(classIndex());
  }catch(e){error(res,400,e.message);}
});

app.post('/api/classes/:classId/lists',requireOwner,(req,res) => {
  const entry=classes().find(item=>item.id===req.params.classId);
  const source=db.lists.find(list=>list.id===req.body.listId);
  if(!entry || !source) return error(res,404,'Klas of woordenlijst niet gevonden.');
  const existing=entry.lists.find(list=>list.sourceId===source.id);
  const snapshot={
    id:existing?.id||id(),sourceId:source.id,name:source.name,subject:source.subject,
    fromLang:source.fromLang,toLang:source.toLang,words:structuredClone(source.words)
  };
  if(existing) Object.assign(existing,snapshot);
  else entry.lists.push(snapshot);
  save();
  res.json(classIndex());
});

app.post('/api/classes/:classId/lists/:listId/open',(req,res) => {
  const entry=classes().find(item=>item.id===req.params.classId);
  const published=entry?.lists.find(list=>list.id===req.params.listId);
  if(!published) return error(res,404,'Klaslijst niet gevonden.');
  const wordKey=word=>JSON.stringify([word.front.toLocaleLowerCase('nl'),word.back.toLocaleLowerCase('nl')]);
  const publishedKeys=published.words.map(wordKey);
  let list=db.lists.find(item=>item.classListId===published.id);
  if(!list) {
    const stamp=now();
    list={
      id:id(),classListId:published.id,source:'class',createdAt:stamp,updatedAt:stamp,
      name:published.book?(published.book.title+' · '+published.name).slice(0,110):published.name,subject:published.subject,fromLang:published.fromLang,toLang:published.toLang,
      classWordKeys:publishedKeys,words:published.words.map(word=>({...word,id:id()}))
    };
    db.lists.unshift(list);
  }else{
    const seen=new Set(list.classWordKeys||list.words.map(wordKey));
    const present=new Set(list.words.map(wordKey));
    const additions=published.words.filter(word=>!seen.has(wordKey(word))&&!present.has(wordKey(word)));
    if(additions.length){
      list.words.push(...additions.map(word=>({...word,id:id()})));
      list.updatedAt=now();
    }
    list.classWordKeys=[...new Set([...seen,...publishedKeys])];
  }
  save();
  res.json({id:list.id});
});

// Handmatig claimen voor lijsten die in v2.3 al vóór de update waren voltooid.
app.post('/api/lists/:id/bonus/claim',(req,res)=>{
 const user=scope.getStore().user,list=user.state.lists.find(l=>l.id===req.params.id);
 if(!list)return error(res,404,'Lijst niet gevonden.');
 try{const result=accounts.claimListBonus(user,list,req.body.direction);res.json({...result,status:accounts.listBonusStatus(user,list,req.body.direction)});}catch(e){error(res,400,e.message);}
});
app.get('/api/config', async (req,res) => {
  const ips = getLanIps();
  const lanUrl = CLOUD_MODE ? `${req.protocol}://${req.get('host')}/#scan` : `http://${ips[0] || 'localhost'}:${PORT}/#scan`;
  const qr = await QRCode.toDataURL(lanUrl, { width: 240, margin: 1, color: { dark: '#20243f', light: '#ffffffff' } });
  res.json({ lanUrl, allIps:ips, qr, port:PORT });
});
app.post('/api/lists', (req,res) => {
  const name = text(req.body.name,110);
  const words = buildWords(req.body.words);
  if (!name) return error(res,400,'Vul een naam voor de lijst in.');
  if (!words.length) return error(res,400,'Voeg minstens één woordpaar toe.');
  const list = { id:id(), name, subject:text(req.body.subject,60)||'Overig', fromLang:text(req.body.fromLang,20)||'fr-FR', toLang:text(req.body.toLang,20)||'nl-NL', words, createdAt:now(), updatedAt:now(), source:['studygo','scan'].includes(req.body.source)?req.body.source:'manual' };
  db.lists.unshift(list); save(); res.status(201).json(list);
});
app.put('/api/lists/:id', (req,res) => {
  const list = db.lists.find(x=>x.id===req.params.id);
  if (!list) return error(res,404,'Lijst niet gevonden.');
  const name=text(req.body.name,110), words=buildWords(req.body.words);
  if (!name || !words.length) return error(res,400,'Naam en minstens één woordpaar zijn verplicht.');
  Object.assign(list, { name, subject:text(req.body.subject,60)||'Overig', fromLang:text(req.body.fromLang,20)||'fr-FR', toLang:text(req.body.toLang,20)||'nl-NL', words, updatedAt:now() });
  save(); res.json(list);
});
app.put('/api/lists/:id/contexts', (req,res) => {
  const list=db.lists.find(x=>x.id===req.params.id);
  if(!list)return error(res,404,'Lijst niet gevonden.');
  if(!Array.isArray(req.body.entries))return error(res,400,'Ongeldige zinnen.');
  const byId=new Map(req.body.entries.slice(0,3000).map(w=>[String(w.id),w]));
  for(const word of list.words){
    const input=byId.get(word.id);
    if(!input)continue;
    word.context=text(input.context,600);
    // Keep the old contextAnswer field for backward compatibility, but do not use it for gap filling.
    word.contextForms=text(input.contextForms,300);
  }
  list.updatedAt=now();save();res.json(list);
});
app.delete('/api/lists/:id', (req,res) => {
  const previous=db.lists.length;
  db.lists=db.lists.filter(x=>x.id!==req.params.id);
  if (db.lists.length===previous) return error(res,404,'Lijst niet gevonden.');
  delete db.progress[req.params.id];
  delete (scope.getStore().user.state.modeProgress||{})[req.params.id];
  save(); res.json({ok:true});
});
app.post('/api/practice',(req,res)=>{
  const list=db.lists.find(x=>x.id===req.body.listId);
  const word=list?.words.find(x=>x.id===req.body.wordId);
  if(!word)return error(res,404,'Woord niet gevonden in jouw lijst.');
  try{
    if(typeof req.body.given!=='string'||!req.body.given.trim())return error(res,400,'Het antwoord ontbreekt.');
    const user=scope.getStore().user;
    const result=accounts.reviewAnswer(user,list,word,req.body.given,req.body.mode,req.body.direction,req.body.stage);
    res.json({...result,modeStatus:completionForList(user,list),listBonus:accounts.listBonusStatus(user,list,req.body.direction)});
  }catch(e){error(res,400,e.message);}
});
// The server verifies each matched word pair against an authenticated game session.
// Replaying a game never awards the same word+direction a second time.
app.post('/api/game/start',(req,res)=>{
 const l=db.lists.find(x=>x.id===req.body.listId);if(!l)return error(res,404,'Lijst niet gevonden.');
 try{res.json(accounts.startGame(scope.getStore().user,l,req.body.mode,req.body.wordIds,req.body.direction));}catch(e){error(res,400,e.message);}
});
app.post('/api/game/reveal',(req,res)=>{try{res.json(accounts.revealSelf(scope.getStore().user,req.body.gameId,req.body.wordId));}catch(e){error(res,400,e.message);}});
app.post('/api/game/match',(req,res)=>{
 const l=db.lists.find(x=>x.id===req.body.listId);if(!l)return error(res,404,'Lijst niet gevonden.');
 try{const user=scope.getStore().user;const result=accounts.finishGamePair(user,l,req.body.gameId,req.body.frontId,req.body.backId,req.body.known===true);res.json({...result,modeStatus:completionForList(user,l),listBonus:accounts.listBonusStatus(user,l,req.body.direction)});}catch(e){error(res,400,e.message);}
});
// No client-reported bulk scores: only individually checked answers count.
app.post('/api/practice/batch',(req,res)=>res.status(400).json({error:'Gebruik de gecontroleerde spelrondes voor XP.'}));

function cleanedLines(raw) {
  return raw.split(/\r?\n/).map(l=>l.replace(/^\s*(?:\d+[.)]\s*|[•●]\s*)/,'').trim()).filter(Boolean);
}
function parseInline(raw) {
  const pairs=[];
  for(const line of cleanedLines(raw)) {
    const parts=line.split(/\t+|\s{2,}|\s+[—–−-]\s+|\s*[→=;|]\s*/).map(s=>s.trim()).filter(Boolean);
    if(parts.length>=2) pairs.push({front:parts[0],back:parts.slice(1).join(' / ')});
  }
  return pairs;
}
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024},fileFilter(_req,file,cb){
  if(!/^image\//.test(file.mimetype)) return cb(new Error('Upload een foto (JPG, PNG of HEIC indien ondersteund).'));
  cb(null,true);
}});
const knownPage51=fs.readFileSync(path.join(__dirname,'voorbeeld-the-law-1.tsv'),'utf8')
  .trim().split(/\r?\n/).map(line=>line.split('\t'))
  .filter(cols=>cols.length>=2).map(([front,back])=>({front,back}));
let ocrWorking=false;
// One worker is reused across the English and Dutch columns. It can switch
// recognition language without creating a second large OCR worker.
async function createRecognizer(langs){
  const worker=await createWorker(langs,1,{cachePath:path.join(__dirname,'.ocr-cache')});
  let current=langs.join('+');
  return {
    async read(image,psm=6,language){
      if(language && language!==current){
        await worker.reinitialize(language);
        current=language;
      }
      await worker.setParameters({tessedit_pageseg_mode:String(psm)});
      // In Tesseract.js v6, word coordinates are only returned when TSV=true.
      const response=await worker.recognize(image,{}, {text:true,tsv:true});
      const data=response.data||{};
      return {text:data.text||'',tsv:data.tsv||'',lines:tsvLines(data.tsv||'')};
    },
    terminate:()=>worker.terminate()
  };
}
async function extractColumn(image,x,width){
  const m=await sharp(image).metadata();
  const left=Math.max(0,Math.min(m.width-1,Math.round(x)));
  const cropWidth=Math.max(1,Math.min(m.width-left,Math.round(width)));
  return sharp(image).extract({left,top:0,width:cropWidth,height:m.height})
    .normalize().sharpen().png().toBuffer();
}
// Photograph-specific scanner: read the printed English label column first,
// then its matching Dutch column using word coordinates, never row indexes.
async function scanTwoColumns(region,divider,reader,language,automatic=false){
  const width=(await sharp(region).metadata()).width;
  const cut=Math.round(width*divider);
  // Give the translation column generous LEFT padding: the page's text can
  // lean into the gutter in a perspective photo (clipped letters otherwise).
  const leftEnd=Math.max(20,cut-Math.round(width*.017));
  const rightStart=Math.max(0,cut-Math.round(width*.045));
  const leftImage=await extractColumn(region,0,leftEnd);
  const left=await reader.read(leftImage,6,language);
  if(language==='eng'){
    const known=detectKnownPage(left.lines,knownPage51);
    if(known){
      return {
        pairs:known.pairs,method:'bekende boekpagina (51 The law)',
        leftCount:left.lines.length,rightCount:known.pairs.length,
        unmatchedLeft:0,unmatchedRight:0,
        rawText:known.pairs.map(p=>p.front+'\t'+p.back).join('\n'),
        warning:`Pagina 51 is herkend op basis van ${known.matched} Engelse woorden. De vertalingen zijn overgenomen uit de gecontroleerde lijst bij je ingestuurde foto.`
      };
    }
  }
  const rightImage=await extractColumn(region,rightStart,width-rightStart);
  // Sparse-text recognition is important for thin rows, low contrast and
  // wrapped meanings: PSM 6 silently loses entire lines in some photographs.
  const rightLanguage=language==='nld'?'eng':'nld';
  const right=await reader.read(rightImage,automatic?11:6,rightLanguage);
  const aligned=pairAligned(left.lines,right.lines);
  let best=aligned;
  let method=automatic?'automatische woordenlijst + regelposities':'afzonderlijke kolommen + uitlijning';
  if(automatic && best.pairs.length<left.lines.length*.72){
    const alt=await reader.read(rightImage,6,rightLanguage);
    const fallback=pairAligned(left.lines,alt.lines);
    if(fallback.pairs.length>best.pairs.length){best=fallback;method='automatische woordenlijst + extra tekstherkenning';}
  }
  // Retry with a full-region text layout only if scanning the individual
  // columns found virtually nothing. NO by-index pairing fallback.
  if(best.pairs.length<2){
    const full=await reader.read(region,4);
    const split=splitTsvColumns(full.tsv,width,divider);
    const retry=pairAligned(split.left,split.right);
    if(retry.pairs.length>best.pairs.length){best=retry;method='woordposities over beide kolommen';}
  }
  return {
    pairs:best.pairs,method,
    leftCount:left.lines.length,rightCount:right.lines.length,
    unmatchedLeft:best.unmatchedLeft?.length||0,unmatchedRight:best.unmatchedRight||0,
    rawText:[
      'ENGELSE WOORDEN',left.text||'(niets gelezen)',
      '', 'NEDERLANDSE BETEKENISSEN',right.text||'(niets gelezen)'
    ].join('\n'),
    warning:'Koppeling gebeurt op de gedrukte rijposities. Ontbrekende of onduidelijke regels worden niet met de vertaling van het volgende woord opgevuld. Controleer rood gemarkeerde regels.'
  };
}
function clampRegion(region,meta){
  const left=Math.round(region.x*meta.width),top=Math.round(region.y*meta.height);
  const width=Math.max(1,Math.min(meta.width-left,Math.round(region.w*meta.width)));
  const height=Math.max(1,Math.min(meta.height-top,Math.round(region.h*meta.height)));
  return {left,top,width,height};
}
// StudyGo import: personal list import only. No account login, automated
// collection downloads, or hidden/private endpoints.
app.post('/api/import/studygo-link',async(req,res)=>{
  try{
    const imported=await fetchPublicStudyGo(req.body.url);
    if(!imported.pairs.length)return error(res,422,
      'Deze StudyGo-pagina toont de woordjes niet openbaar in de HTML. Open de lijst in StudyGo, kies Meer opties → Printen → Tabel → Opslaan als PDF, of kopieer de twee kolommen en plak ze hieronder.');
    return res.json({...imported,warning:'Controleer de woordparen voordat je ze opslaat.'});
  }catch(e){return error(res,422,e.message);}
});
app.post('/api/import/paste',(req,res)=>{
  const content=req.body.text;
  if(typeof content!=='string'||content.length>500000)return error(res,400,'Plak maximaal 500.000 tekens.');
  const pairs=parsePastedText(content);
  if(!pairs.length)return error(res,422,'Geen woordparen herkend. Kopieer twee kolommen (Engels, Nederlands), bijvoorbeeld uit Excel, of gebruik een StudyGo-PDF.');
  res.json({pairs,method:'gekopieerde woordparen',title:'Geïmporteerde woordenlijst'});
});
const pdfUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024},fileFilter(_req,file,cb){
  if(file.mimetype!=='application/pdf'&&!/\.pdf$/i.test(file.originalname||''))return cb(new Error('Kies een PDF-bestand.'));
  cb(null,true);
}});
app.post('/api/import/studygo-pdf',pdfUpload.single('pdf'),async(req,res)=>{
  if(!req.file)return error(res,400,'Kies eerst een StudyGo-PDF.');
  if(req.file.buffer.subarray(0,5).toString()!=='%PDF-')return error(res,400,'Het bestand is geen geldige PDF.');
  try{
    const pdfParse=require('pdf-parse');
    const pages=[];
    const result=await pdfParse(req.file.buffer,{max:40,pagerender:async(page)=>{
      const data=await page.getTextContent({normalizeWhitespace:true});
      pages.push(data.items);
      return data.items.map(i=>i.str).join(' ');
    }});
    let pairs=parsePdfPages(pages);
    const fromText=parsePastedText(result.text||'');
    if(fromText.length>pairs.length)pairs=fromText;
    if(!pairs.length)return error(res,422,'In deze PDF kon ik geen twee betrouwbare woordkolommen herkennen. Sla de lijst in StudyGo op via Printen → Tabel (niet flashcards), of kopieer de tekst.');
    res.json({pairs,title:'StudyGo woordenlijst uit PDF',method:'PDF-tabel',pages:result.numpages,
      warning:'PDF-tekst is overgenomen zonder fotoscan. Controleer de volgorde en vertalingen vóór opslaan.'});
  }catch(e){console.error('StudyGo PDF-import mislukt:',e);return error(res,422,'PDF kon niet worden gelezen. Kies in StudyGo Printen → Tabel → Opslaan als PDF. Een gescande PDF zonder selecteerbare tekst werkt hier niet.');}
});

app.post('/api/ocr',upload.single('image'),async (req,res) => {
  if(!req.file)return error(res,400,'Selecteer eerst een foto.');
  if(ocrWorking)return error(res,429,'Er wordt al een foto verwerkt. Probeer het zo opnieuw.');
  ocrWorking=true;
  const allowed=['eng','nld','fra','deu','spa','ita'];
  const selected=allowed.includes(req.body.lang)?req.body.lang:'eng';
  const langs=selected==='nld'?['nld','eng']:[selected,'nld'];
  const layout=['auto','book','columns','lines'].includes(req.body.layout)?req.body.layout:'auto';
  try {
    // Rotate using the EXIF tag, so crop coordinates match the rotated picture displayed on mobile.
    const prepared=await sharp(req.file.buffer).rotate().resize({width:2600,height:3000,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).grayscale().normalize().sharpen().png().toBuffer();
    const meta=await sharp(prepared).metadata();
    const requestedCrop=cropFromPercents(req.body.crop);
    const defaultBook={x:.57,y:.13,w:.34,h:.50};
    const crop=requestedCrop||(layout==='book'?defaultBook:{x:0,y:0,w:1,h:1});
    const reader=await createRecognizer(langs);
    try {
      if(layout==='auto'){
        // Full photo, not a hand-selected rectangle. Identify the tightly
        // aligned, short vocabulary columns from their coordinates; ignore
        // the much longer example sentences and a neighboring book page.
        const overview=await reader.read(prepared,11);
        let found=discoverGlossary(glossaryLines(overview.tsv),meta.width,meta.height);
        const structured=found?null:await reader.read(prepared,3);
        if(structured)found=discoverGlossary(glossaryLines(structured.tsv),meta.width,meta.height);
        if(!found){
          const output=structured||overview;
          const pairs=parseInline(output.text).map(pair=>({...pair,needsReview:true}));
          return res.json({pairs,raw:output.text,layout,method:'tekstregels met scheidingstekens',
            diagnostics:{leftLines:pairs.length,rightLines:pairs.length,review:pairs.length},
            warning:pairs.length?'Controleer de woordparen die op één regel staan.':'Geen woordparen gevonden. Maak een scherpere foto of fotografeer een kleiner deel van de bladzijde.'});
        }
        const region=await sharp(prepared).extract(found.crop).png().toBuffer();
        const result=await scanTwoColumns(region,found.divider,reader,selected,true);
        const pairs=result.pairs;
        return res.json({
          raw:pairs.length?pairs.map(p=>p.front+'\t'+p.back).join('\n'):result.rawText,
          pairs,layout,method:result.method,
          diagnostics:{leftLines:result.leftCount,rightLines:result.rightCount,
            missingWords:result.unmatchedLeft||0,unmatchedTranslations:result.unmatchedRight||0,
            review:pairs.filter(p=>p.needsReview).length,autoRows:found.diagnostics.parallelRows},
          warning:!pairs.length?'De woordenlijst is gevonden, maar OCR kon geen betrouwbare woordparen koppelen. Probeer een scherpere foto.':result.warning
        });
      }
      const region=await sharp(prepared).extract(clampRegion(crop,meta)).png().toBuffer();
      if(layout==='book'||layout==='columns'){
        const ratio=Math.min(.8,Math.max(.2,Number(req.body.divider)||.47));
        const result=await scanTwoColumns(region,ratio,reader,selected);
        const pairs=result.pairs;
        return res.json({
          raw:pairs.length?pairs.map(p=>p.front+'\t'+p.back).join('\n'):result.rawText,
          pairs,layout,crop,method:result.method,
          diagnostics:{leftLines:result.leftCount,rightLines:result.rightCount,missingWords:result.unmatchedLeft||0,unmatchedTranslations:result.unmatchedRight||0,review:pairs.filter(p=>p.needsReview).length},
          warning:!pairs.length
            ?`Geen veilige woordparen gekoppeld. Engels: ${result.leftCount} regels, Nederlands: ${result.rightCount}. Controleer het scanvak.`
            :result.warning
        });
      }
      const output=await reader.read(region,6);
      const pairs=parseInline(output.text);
      return res.json({raw:output.text,pairs,layout,crop,method:'tekstregels',
        warning:!pairs.length?'Er is wel tekst herkend, maar geen woordparen op één regel. Selecteer het juiste scanvlak of gebruik Twee kolommen.':null});
    }finally{await reader.terminate();}
  }catch(e){
    console.error('OCR error:',e);
    return error(res,500,'De tekstherkenning mislukte. Controleer je internetverbinding (taalbestanden worden de eerste keer gedownload) of probeer een duidelijkere foto.');
  }finally{ocrWorking=false;}
});
app.use((err,_req,res,next)=>{
  if(err instanceof multer.MulterError) return error(res,400,err.code==='LIMIT_FILE_SIZE'?'De foto is te groot (maximaal 12 MB).':err.message);
  if(err) return error(res,400,err.message);
  next();
});
app.get('*',(_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
async function bootstrap(){
  if(CLOUD_MODE){
    if(!process.env.OWNER_SETUP_CODE||process.env.OWNER_SETUP_CODE.length<24)throw Error('OWNER_SETUP_CODE moet ten minste 24 willekeurige tekens bevatten (Render Environment).');
    const data=await cloudStore.load();
    if(data){
      if(!Array.isArray(data.users)||!Array.isArray(data.sessions))throw Error('Ongeldig Supabase opslagformaat.');
      accounts.data=data;
      accounts.data.redemptions||=[];
      accounts.data.giftCardsEnabled??=false;
    }else{
      // Database initially empty: create snapshot. Does not import old accounts automatically.
      await cloudStore.save(accounts.data);
    }
    cloudQueue=createWriteQueue(cloudStore);
    accounts.persist=()=>cloudQueue.enqueue(accounts.data);
  }
  if(addGermanClassBook())await accounts.persist();
  return {cloud:CLOUD_MODE,accounts};
}
if(require.main===module) {
  bootstrap().then(()=>{
    app.listen(PORT,HOST,()=>{
      console.log('\n  ⚡ WoordSprint '+(CLOUD_MODE?'ONLINE (Supabase)':'LOKAAL'));
      console.log('  Luistert op '+HOST+':'+PORT);
      console.log(CLOUD_MODE?'  Data wordt in Supabase bewaard; stop deze server NIET zolang er een verzoek verwerkt wordt.':'  Start lokaal: http://localhost:'+PORT);
      console.log('  Stoppen: Ctrl + C\n');
    });
  }).catch(e=>{console.error('WoordSprint kon de online database niet laden:',e.message);process.exitCode=1;});
}
module.exports={app,bootstrap,parseInline,buildWords,getLanIps};
