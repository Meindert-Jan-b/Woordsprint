'use strict';
const $ = s => document.querySelector(s);
const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc = escapeHtml;
const shuffle = a => [...a].sort(()=>Math.random()-.5);
const subjectSymbols = {Frans:'🇫🇷',Duits:'🇩🇪',Engels:'🇬🇧',Spaans:'🇪🇸',Nederlands:'🇳🇱',Biologie:'🧬',Aardrijkskunde:'🌍',Geschiedenis:'📜',Economie:'💶',Overig:'📚'};
const languages = {'nl-NL':'Nederlands','fr-FR':'Frans','de-DE':'Duits','en-GB':'Engels','es-ES':'Spaans','it-IT':'Italiaans','la':'Latijn','el-GR':'Grieks'};
const modes = [
  {id:'learn',name:'Slim leren',icon:'✦',text:'Makkelijk beginnen, steeds uitdagender.'},
  {id:'type',name:'Typen',icon:'⌨',text:'Typ zelf de goede vertaling.'},
  {id:'flash',name:'Flashcards',icon:'▣',text:'Draai een kaart om en test jezelf.'},
  {id:'choice',name:'Meerkeuze',icon:'◉',text:'Kies het juiste antwoord.'},
  {id:'dictation',name:'Dictee',icon:'♫',text:'Luister en schrijf wat je hoort.'},
  {id:'hint',name:'Hints',icon:'☀',text:'Krijg letterhulp bij moeilijke woorden.'},
  {id:'test',name:'Toets',icon:'☑',text:'Een echte overhoring met cijfer.'},
  {id:'think',name:'In gedachten',icon:'◈',text:'Zeg het antwoord in je hoofd.'},
  {id:'context',name:'Invullen in context',icon:'✍',text:'Vul het Engelse woord in de juiste vorm in een zin in.'}
];
const games = [
  {id:'memory',name:'Memory',icon:'▦',text:'Zoek de bij elkaar horende woordparen.'},
  {id:'match',name:'Koppelspel',icon:'⇄',text:'Verbind woorden en vertalingen.'},
  {id:'scramble',name:'Letterpuzzel',icon:'⌘',text:'Zet gehusselde letters in de juiste volgorde.'},
  {id:'sprint',name:'60 sec. sprint',icon:'⚡',text:'Hoeveel antwoorden haal jij binnen een minuut?'}
];
let db = {lists:[],progress:{},activity:[]}, config = null, session = null, rerenderTimer = null;
let classData=[];
let currentUser = null, ownerData=null, friendsData = null, leaderboardData = [], leaderScope='friends', authMode='login', legacyAvailable=false, hosted=false;
let prefs = {direction:'forward',hard:false,random:true,count:'all'};
try {prefs={...prefs,...JSON.parse(localStorage.getItem('ws-prefs')||'{}')};} catch {}
const bookCrop={x:.57,y:.13,w:.34,h:.50};
let studygoDraft={rows:[],url:'',paste:'',file:null,name:'',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',target:'new',method:'',message:'',error:'',busy:false,visible:50};
let scanDraft={rows:[],raw:'',diagnostics:'',scanWarning:'',file:null,preview:null,busy:false,layout:'auto',crop:{x:0,y:0,w:1,h:1},divider:.47,lang:'eng',target:'new',name:'',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL'};
const {normalized,isCorrect,alternatives}=WoordAnswers;
const contextExamples=typeof WoordContextExamples!=='undefined'?WoordContextExamples:{};

let bookData=[],bookLoading=false,bookError='',bookSearch='';
let listSearch='';
let listFilter='all';
let lastRoute = '';
function fmt(n){return Number(n||0).toLocaleString('nl-NL');}
function getList(id){return db.lists.find(l=>l.id===id);}
function xpTotal(){return currentUser?.xp || 0;}
function answeredTotal(){return db.activity.reduce((a,x)=>a+(x.answered||0),0);}
function masteredCount(l){return l.words.filter(w=>(db.progress[l.id]?.[w.id]?.mastery||0)>=3).length;}
function masteryPct(l){return l.words.length?Math.round(masteredCount(l)/l.words.length*100):0;}
function iconFor(l){return subjectSymbols[l.subject]||'📚';}
function dayStreak(){const days=new Set(db.activity.filter(x=>x.answered>0).map(x=>x.date));let d=new Date();const iso=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');if(!days.has(iso(d)))d.setDate(d.getDate()-1);let count=0;while(days.has(iso(d))){count++;d.setDate(d.getDate()-1);}return count;}
function toast(msg,isError=false){const el=document.createElement('div');el.className='toast'+(isError?' error':'');el.textContent=msg;$('#toasts').appendChild(el);setTimeout(()=>el.remove(),4400);}
async function request(url, opts={}){
  const init={...opts};
  if(opts.body && !(opts.body instanceof FormData)){init.body=JSON.stringify(opts.body);init.headers={'Content-Type':'application/json',...opts.headers};}
  let r;
  try {r=await fetch(url,init);} catch {throw Error('Geen verbinding met de server. Staat WoordSprint nog aan op je pc?');}
  let data; try{data=await r.json();}catch{throw Error('De server gaf geen geldig antwoord.');}
  if(!r.ok)throw Error(data.error||'Er is iets misgegaan.');
  return data;
}
async function refreshState(){db=await request('/api/state');await refreshProfile();}
async function refreshProfile(){currentUser=await request('/api/profile');$('#top-xp').textContent=fmt(xpTotal())+' XP';$('#top-avatar').textContent=(currentUser.username||'W').slice(0,1).toUpperCase();}
function savePrefs(){localStorage.setItem('ws-prefs',JSON.stringify(prefs));}
function pageTitle(label){$('#breadcrumb').textContent=label;$('#top-xp').textContent=fmt(xpTotal())+' XP';}
function setActive(view){for(const a of document.querySelectorAll('[data-nav]'))a.classList.toggle('active',a.dataset.nav===view);}
function cleanUpSession(){if(session?.ticker){clearInterval(session.ticker);session.ticker=null;}if(session?.delay){clearTimeout(session.delay);session.delay=null;}}
function navigate(view){location.hash='#'+view;}
function render(){
  if(!currentUser){renderAuth();return;}
  document.body.classList.remove('unauthenticated');
  const hash=decodeURIComponent(location.hash.slice(1)||'dashboard');
  const [page,arg]=hash.split('/');
  if(lastRoute!==hash && lastRoute.startsWith('play') && page!=='play'){cleanUpSession();session=null;}
  lastRoute=hash;
  const menu= ['list','edit','play','contexts'].includes(page)?'lists':page;
  setActive(menu);pageTitle(({dashboard:'Dashboard',lists:'Mijn woordenlijsten',list:'Woordenlijst',edit:'Woordenlijst bewerken',play:'Oefensessie',games:'Spelletjes',scan:'Woordjes scannen',stats:'Statistieken',studygo:'StudyGo importeren',book:'Finish Up',classes:'Klassen',profile:'Mijn profiel',friends:'Vrienden',leaderboard:'Klassement',owner:'Beheerder' })[page]||'Dashboard');
  let html;
  switch(page){
    case 'dashboard':html=renderDashboard();break;
    case 'lists':html=renderLists();break;
    case 'book':html=renderBook();break;
    case 'classes':html=renderClasses(arg);break;
    case 'list':html=renderListDetail(arg);break;
    case 'edit':html=renderEditor(arg);break;
    case 'contexts':html=renderContexts(arg);break;
    case 'play':if(!session)restoreActiveLearnSession();html=renderPlay();break;
    case 'games':html=renderGames();break;
    case 'scan':html=renderScan();break;
    case 'studygo':html=renderStudyGo();break;
    case 'stats':html=renderStats();break;
    case 'profile':html=renderProfile();break;
    case 'owner':html=renderOwner();break;
    case 'friends':html=renderFriends();break;
    case 'leaderboard':html=renderLeaderboard();break;
    default:html=renderDashboard();break;
  }
  $('#app').innerHTML=html;
  if(page==='play')saveLearnSession(session);
  // Automatic scanning uses the complete photograph; no crop selection needed.
  if(page==='play' && session && !session.done && session.mode==='dictation' && session.firstSound!==session.index){session.firstSound=session.index;setTimeout(()=>{if(location.hash==='#play'&&session?.mode==='dictation') speak(answerFor(currentQuestion()),langAnswer());},300);}
  if(page==='play' && ['type','test','learn','hint','dictation','scramble','context'].includes(session?.mode) && !session?.feedback && !session?.done){$('#answer-input')?.focus({preventScroll:true});}
}
function cardStats(l){const pct=masteryPct(l);return `<div class="meter-line"><span>${l.words.length} woorden</span><span>${pct}% beheerst</span></div><div class="meter"><i style="width:${pct}%"></i></div>`;}
function dirNames(l){const short=code=>String(code||'').split('-')[0].toLowerCase()==='en'?'E':String(code||'').split('-')[0].toLowerCase()==='nl'?'N':String(code||'?')[0].toUpperCase();return [short(l.fromLang),short(l.toLang)];}
function dirButtons(l){const [a,b]=dirNames(l);return `<div class="dir-switch" role="group" aria-label="Leerrichting"><button type="button" class="btn btn-sm ${prefs.direction==='forward'?'':'btn-secondary'}" data-action="direction-toggle" data-direction="forward">${esc(a)} → ${esc(b)}</button><button type="button" class="btn btn-sm ${prefs.direction==='reverse'?'':'btn-secondary'}" data-action="direction-toggle" data-direction="reverse">${esc(b)} → ${esc(a)}</button></div>`;}
function modeCompletionStatus(l,mode,direction=prefs.direction){
 const side=['memory','match','context'].includes(mode)?'forward':direction==='reverse'?'reverse':'forward';
 const available=mode==='context'?l.words.filter(w=>!!WoordCloze.questionFor(w,l,contextExamples)):l.words;
 // Completion is computed on the server using current word identities.
 const expected=db.modeStatus?.[l.id]?.[mode]?.[side];
 if(expected)return expected;
 return {count:0,total:available.length,done:false};
}
function modeCompletionChip(l,m){
 const s=modeCompletionStatus(l,m.id);
 if(!s.total)return '<span class="mode-status mode-unavailable">Geen oefenzinnen</span>';
 return s.done?'<span class="mode-status mode-done" aria-label="Voltooid">✓ Voltooid</span>':`<span class="mode-status mode-pending">${s.count} / ${s.total} woorden</span>`;
}
function modeCard(l,m){
 return `<button class="mode-card ${modeCompletionStatus(l,m.id).done?'completed':''}" data-action="start-mode" data-id="${esc(l.id)}" data-mode="${m.id}"><span class="mode-icon">${m.icon}</span><h3>${m.id==='learn'&&loadLearnSession(l)?'Slim leren hervatten':m.name}</h3><p>${m.text}</p>${modeCompletionChip(l,m)}</button>`;
}
function modeDoneSummary(l){const total=modes.length+games.length;const count=[...modes,...games].filter(m=>modeCompletionStatus(l,m.id).done).length;return `${count}/${total} oefenstanden afgerond`;}
function listBonusPanel(l){
 const completed=modeDoneSummary(l);
 return `<section class="card card-pad list-bonus-panel"><h3>Voortgang van deze lijst</h3><p class="muted">${esc(completed)}</p></section>`;
}
function listOrigin(l){return l.demo?'Voorbeeld':l.source==='studygo'?'StudyGo-import':l.source==='scan'?'Gescand':l.source==='book'?'Finish Up':l.source==='class'?'Klaslijst':l.source==='manual'?'Zelf gemaakt':'Bestaande lijst';}
function isImported(l){return l.source==='studygo'||l.source==='scan'||l.source==='book';}
function matchesList(l){const text=`${l.name} ${l.subject} ${listOrigin(l)}`.toLocaleLowerCase();return text.includes(listSearch.toLocaleLowerCase())&&(listFilter==='all'||(listFilter==='imported'&&isImported(l))||(listFilter==='own'&&!l.demo&&!isImported(l))||(listFilter==='demo'&&l.demo));}
function listCard(l,i){return `<article class="list-simple card"><div class="list-simple-main"><span class="subject-icon alt${i%4}">${iconFor(l)}</span><div class="list-simple-copy"><a href="#list/${encodeURIComponent(l.id)}" class="list-simple-title">${esc(l.name)}</a><span class="list-simple-sub">${esc(l.subject)} · ${l.words.length} woorden · ${esc(listOrigin(l))} · ${modeDoneSummary(l)}</span></div></div><div class="list-simple-actions"><span class="list-simple-pct">${masteryPct(l)}% geleerd</span><a class="btn btn-secondary btn-sm" href="#list/${encodeURIComponent(l.id)}">Bekijk woorden</a><button class="btn btn-sm" data-action="quick-learn" data-id="${esc(l.id)}">Slim leren →</button></div></article>`;}
function listResults(){const matches=db.lists.filter(matchesList);return matches.length?matches.map((l,i)=>listCard(l,i)).join(''):`<div class="card empty-state"><h3>Geen lijsten gevonden</h3><p>Pas je zoekterm of filter aan. Je opgeslagen lijsten blijven bewaard.</p></div>`;}
function lastWeek(){const data=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');data.push({date:d,day:['zo','ma','di','wo','do','vr','za'][d.getDay()],count:db.activity.find(a=>a.date===iso)?.answered||0});}return data;}
function graph(){const days=lastWeek(), max=Math.max(10,...days.map(x=>x.count));return `<div class="activity-bars">${days.map(x=>`<div class="activity-bar ${x.count?'filled':''}" style="height:${Math.max(6,Math.round(x.count/max*100))}%" title="${x.count} antwoorden"></div>`).join('')}</div><div class="activity-labels">${days.map(x=>`<span>${x.day}</span>`).join('')}</div>`;}
function renderDashboard(){
  const count=db.lists.reduce((a,l)=>a+l.words.length,0), mastered=db.lists.reduce((a,l)=>a+masteredCount(l),0);
  const metrics=[
    [fmt(count),'Woorden'],[fmt(mastered),'Beheerst'],
    [fmt(xpTotal()),'Ervaringspunten'],[dayStreak(),'Dagen op rij']
  ];
  const recent=[...db.lists].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).slice(0,4);
  return `<header class="page-heading dashboard-heading">
      <div><h1>Woordjes leren</h1><p>Bekijk je voortgang en ga verder met een woordenlijst.</p></div>
      <div class="row dashboard-actions"><a class="btn btn-secondary" href="#scan">Foto scannen</a><a class="btn" href="#edit/new">Nieuwe lijst</a></div>
    </header>
    <section class="kpi-grid" aria-label="Leerstatistieken">${metrics.map(([value,label])=>`<div class="card kpi-card"><div><div class="value">${value}</div><div class="small-name">${label}</div></div></div>`).join('')}</section>
    <section aria-labelledby="recent-lists">
      <div class="section-heading"><h2 id="recent-lists">Recente woordenlijsten</h2><a href="#lists" class="simple-link">Alle lijsten</a></div>
      <div class="simple-list-grid">${recent.map(listCard).join('')||`<div class="card card-pad"><p>Je hebt nog geen woordenlijsten.</p><a href="#studygo" class="simple-link">Importeer uit StudyGo</a></div>`}</div>
    </section>
    <section class="card card-pad dashboard-activity"><div class="row space-between"><h2>Activiteit deze week</h2><span class="muted tiny">${fmt(answeredTotal())} antwoorden totaal</span></div><p class="muted tiny">Beantwoorde woorden per dag</p>${graph()}</section>`;
}
function renderClasses(classId){
 const selected=classData.find(entry=>entry.id===classId);
 const canManage=currentUser.owner;
 if(!selected){
   return `<header class="page-heading"><div><h1>Klassen</h1><p>Kies je klas en open een woordenlijst.</p></div></header>
     <div class="class-grid">${classData.map(entry=>`<a class="card class-card" href="#classes/${esc(entry.id)}">
       <h2>${esc(entry.name)}</h2><span class="muted">${entry.lists.length} hoofdstukken en lijsten</span></a>`).join('')}</div>
     ${classData.length?'':'<p class="muted">Er zijn nog geen klassen.</p>'}
     ${canManage?`<form class="card card-pad class-form" id="class-create">
       <h2>Klas toevoegen</h2><label class="field-group">Klasnaam<input class="input" name="name" maxlength="80" placeholder="Bijv. 1MA Duits" required></label>
       <button class="btn">Klas aanmaken</button></form>`:''}`;
 }
 return `<a class="backline" href="#classes">← Alle klassen</a>
   <header class="page-heading"><div><h1>${esc(selected.name)}</h1><p>Open een lijst om met je eigen voortgang te oefenen.</p></div></header>
   ${bookFinder(selected.id)}
   <div class="simple-list-grid">${selected.lists.filter(list=>!list.book).map(list=>`<article class="card list-simple">
     <div><h3>${esc(list.name)}</h3><span class="muted">${esc(list.subject)} · ${list.wordCount} woorden</span></div>
     <button class="btn btn-secondary" data-action="class-open" data-class-id="${esc(selected.id)}" data-id="${esc(list.id)}">Open lijst</button>
   </article>`).join('')}</div>
   ${canManage?bookImportForm(selected.id):''}
   ${canManage?`<form class="card card-pad class-form" id="class-publish" data-id="${esc(selected.id)}">
     <h2>Woordenlijst delen</h2>
     <p class="muted">Alle ingelogde gebruikers kunnen klaslijsten openen. Deel dezelfde lijst opnieuw om nieuwe woorden toe te voegen. Leerlingen krijgen die woorden zodra ze de klaslijst opnieuw openen.</p>
     <label class="field-group">Mijn woordenlijsten<select name="listId" required><option value="">Kies een lijst</option>
       ${db.lists.map(list=>`<option value="${esc(list.id)}">${esc(list.name)}</option>`).join('')}</select></label>
     <div class="row class-actions"><button class="btn">Delen met klas</button><a class="simple-link" href="#edit/new">Nieuwe woordenlijst maken</a></div>
   </form>`:''}`;
}

function booksForClass(classId){
 const books=new Map();
 for(const list of classData.find(entry=>entry.id===classId)?.lists||[]){
   if(!list.book)continue;
   if(!books.has(list.book.id))books.set(list.book.id,{title:list.book.title,chapters:[]});
   books.get(list.book.id).chapters.push({...list.book,id:list.id,title:list.name,wordCount:list.wordCount});
 }
 return [...books.values()];
}
function bookRows(classId=''){
 const books=classId?booksForClass(classId):bookData;
 const query=bookSearch.trim().toLocaleLowerCase('nl');
 const matches=books.map(book=>({...book,chapters:book.chapters.filter(chapter=>
   [book.title,chapter.title,chapter.section,chapter.number==null?'':'hoofdstuk '+chapter.number,chapter.page==null?'':'pagina '+chapter.page]
     .join(' ').toLocaleLowerCase('nl').includes(query)
 )})).filter(book=>book.chapters.length);
 if(!matches.length)return `<p class="muted">${query?'Geen hoofdstukken gevonden.':'Er zijn nog geen boeken toegevoegd.'}</p>`;
 return matches.map((book,index)=>`<details class="card book-volume" ${query||index===0?'open':''}>
   <summary><strong>${esc(book.title)}</strong> <span class="muted">${book.chapters.length} hoofdstukken</span></summary>
   ${[...new Set(book.chapters.map(chapter=>chapter.section))].map(section=>{
     const chapters=book.chapters.filter(chapter=>chapter.section===section).sort((a,b)=>(a.number??Infinity)-(b.number??Infinity));
     return `<details class="book-section" ${query||section===book.chapters[0].section?'open':''}><summary>${esc(section)}</summary><div class="book-grid">${chapters.map(chapter=>{
       const list=classId?db.lists.find(item=>item.classListId===chapter.id):getList(chapter.listId);
       return `<button class="card book-row" data-action="${classId?'class-open':'book-chapter'}" data-class-id="${esc(classId)}" data-id="${esc(chapter.id)}">
         ${chapter.number==null?'':`<span class="book-number">${chapter.number}</span>`}
         <span class="book-copy"><strong>${esc(chapter.title)}</strong><small>${chapter.wordCount} woorden${chapter.page==null?'':' · p. '+chapter.page}${list?' · '+masteryPct(list)+'% geleerd':''}</small></span>
         <span class="book-arrow" aria-hidden="true">→</span></button>`;
     }).join('')}</div></details>`;
   }).join('')}</details>`).join('');
}
function bookFinder(classId=''){
 return `<div class="book-search"><input class="search-input" type="search" id="book-search" data-class-id="${esc(classId)}"
   placeholder="Zoek op boek, hoofdstuk of paginanummer" value="${esc(bookSearch)}" aria-label="Zoek in boeken"></div>
   <div id="book-results">${bookRows(classId)}</div>`;
}
function readBookText(raw){
 const lines=raw.split(/\r?\n/);
 const title=lines.shift()?.trim();
 if(!title)throw Error('Zet de boektitel op de eerste regel.');
 const chapters=[];
 let chapter;
 let section='Hoofdstukken';
 const addChapter=(title,group)=>{
   chapter={id:'hoofdstuk-'+(chapters.length+1),number:chapters.length+1,title,section:group,words:[]};
   chapters.push(chapter);
 };
 const entries=lines.map((line,index)=>({value:line.trim(),line:index+2})).filter(row=>row.value);
 for(const [index,row] of entries.entries()){
   const {value,line}=row;
   if(value.startsWith('# ')){
     const heading=value.slice(2).trim();
     if(entries[index+1]?.value.startsWith('## ')){
       section=heading;
       chapter=null;
     }else{
       section='Hoofdstukken';
       addChapter(heading,section);
     }
   }else if(value.startsWith('## ')){
     addChapter(value.slice(3).trim(),section);
   }else{
     const pair=parsePairs(value)[0];
     if(!chapter||!pair)throw Error('Controleer regel '+line+': gebruik # Hoofdstuk, ## Paragraaf of woord - vertaling.');
     chapter.words.push(pair);
   }
 }
 return {format:'woordsprint-book-v1',title,chapters};
}
function bookImportForm(classId=''){
 return `<details class="card card-pad book-import"><summary>Hele boeken toevoegen</summary>
   <form id="book-import-form" data-class-id="${esc(classId)}">
     <p class="muted">Upload één bestand per boek (.txt of WoordSprint .json). Je kunt meerdere bestanden tegelijk kiezen.</p>
     <label class="field-group">Boekbestanden<input type="file" name="book" accept=".txt,.json,text/plain,application/json" multiple required></label>
     <details class="book-format"><summary>Voorbeeld van een tekstbestand</summary><pre>Mijn Duitse boek
# Hoofdstuk 1
## 1.1 Kennismaken
Guten Morgen - goedemorgen
## 1.2 Op school
das Buch - het boek</pre></details>
     <div class="form-grid">
       <label class="field-group">Vak<select name="subject">${subjectOptions(classId?'Duits':'Engels')}</select></label>
       <label class="field-group">Taal van de woorden<select name="fromLang">${languageOptions(classId?'de-DE':'en-GB')}</select></label>
       <label class="field-group">Taal van de vertalingen<select name="toLang">${languageOptions('nl-NL')}</select></label>
     </div>
     <label class="checkrow"><input type="checkbox" name="rights" required> Ik mag deze woordenlijsten delen met ingelogde gebruikers.</label>
     <button class="btn" type="submit">Boeken toevoegen</button>
   </form></details>`;
}
function renderBook(){
 return `<header class="page-heading"><div><h1>Finish Up</h1><p>Kies een boek en zoek het hoofdstuk dat je wilt oefenen.</p></div></header>
   ${bookLoading?'<div class="card card-pad">Boeken laden…</div>':bookError?`<div class="card card-pad"><p>${esc(bookError)}</p><button class="btn" data-action="book-refresh">Opnieuw proberen</button></div>`:bookFinder()}
   ${currentUser?.owner?bookImportForm():''}`;
}
async function loadBook(){
 const uid=currentUser?.id;
 bookLoading=true;
 bookError='';
 try{
   const result=await request('/api/book');
   if(currentUser?.id===uid)bookData=result.books;
 }catch(e){
   if(currentUser?.id===uid){bookData=[];bookError=e.message;}
 }finally{
   if(currentUser?.id===uid)bookLoading=false;
 }
}
function renderLists(){
 const count=db.lists.filter(isImported).length;
 return `<div class="page-heading"><div><span class="eyebrow">AL JE LIJSTEN OP ÉÉN PLEK</span><h1>Mijn woordenlijsten</h1><p>Klik op een lijst om alle woordjes te bekijken, of begin direct met leren.</p></div><div class="toolbar"><a class="btn btn-secondary" href="#book">📘 Finish Up</a><a class="btn btn-secondary" href="#studygo">↧ Importeren</a><a class="btn" href="#edit/new">+ Nieuwe lijst</a></div></div>
 <div class="list-directory card"><div class="list-directory-top"><div><strong>${db.lists.length} lijsten</strong><span>${count} geïmporteerd sinds deze functie wordt bijgehouden</span></div><input class="search-input" type="search" id="list-search" value="${esc(listSearch)}" placeholder="Zoek op naam of vak…" aria-label="Zoek woordenlijsten"></div>
 <div class="list-tabs" aria-label="Filter woordenlijsten">${[['all','Alle lijsten'],['imported','Geïmporteerd'],['own','Zelf gemaakt'],['demo','Voorbeelden']].map(([id,label])=>`<button data-action="lists-filter" data-filter="${id}" class="list-tab ${listFilter===id?'active':''}" aria-pressed="${listFilter===id}">${label}</button>`).join('')}</div></div>
 <section id="list-results" class="simple-list-grid">${listResults()}</section>
 ${!db.lists.length?`<div class="card empty-state"><h2>Je hebt nog geen lijst</h2><a href="#studygo" class="btn">Importeer je eerste lijst →</a></div>`:''}`;
}
function renderListDetail(id){const l=getList(id);if(!l)return `<a href="#lists" class="backline">← Terug</a><div class="card empty-state"><h2>Deze lijst bestaat niet meer.</h2></div>`;
  return `<a href="#lists" class="backline">← Alle woordenlijsten</a><section class="card detail-summary"><span class="subject-icon">${iconFor(l)}</span><div><span class="eyebrow">${esc(l.subject)}</span><h1>${esc(l.name)}</h1><p class="muted tiny">${l.words.length} woorden · ${masteryPct(l)}% beheerst · ${modeDoneSummary(l)} · ${esc(languages[l.fromLang]||'Vraag')} → ${esc(languages[l.toLang]||'Antwoord')}</p></div><div class="detail-actions"><a href="#contexts/${encodeURIComponent(l.id)}" class="btn btn-secondary btn-sm">✍ Voorbeeldzinnen</a><button class="btn btn-secondary btn-sm" data-action="export-list" data-id="${esc(l.id)}">↓ CSV</button><a href="#edit/${encodeURIComponent(l.id)}" class="btn btn-secondary btn-sm">✎ Bewerken</a><button class="btn btn-secondary btn-sm" data-action="delete-list" data-id="${esc(l.id)}">Verwijder</button></div></section>
    <section class="card settings-row"><div class="dir-setting"><strong>Leerrichting</strong>${dirButtons(l)}<small>Leer beide kanten voor extra XP, maar geen onbeperkte XP.</small></div><label>Aantal woorden<select data-pref="count"><option value="all" ${prefs.count==='all'?'selected':''}>Hele lijst</option><option value="10" ${prefs.count==='10'?'selected':''}>10 woorden</option><option value="20" ${prefs.count==='20'?'selected':''}>20 woorden</option></select></label><label class="checkrow" style="margin-top:13px"><input type="checkbox" data-pref="random" ${prefs.random?'checked':''}> Willekeurige volgorde</label><label class="checkrow" style="margin-top:13px"><input type="checkbox" data-pref="hard" ${prefs.hard?'checked':''}> Alleen moeilijke woorden</label></section>
    ${listBonusPanel(l)}
    <div class="section-heading"><div><h2>Kies een oefenstand</h2><p>Elke methode werkt anders, dus wissel af.</p></div></div><section class="mode-grid">${modes.map(m=>modeCard(l,m)).join('')}</section>
    <div class="section-heading"><div><h2>Spelen met deze lijst</h2><p>Oefenen zonder dat het als leren voelt.</p></div></div><section class="mode-grid">${games.map(m=>modeCard(l,m)).join('')}</section>
    <div class="section-heading"><div><h2>Alle woordjes <span class="muted tiny">(${l.words.length})</span></h2><p>Bekijk je woordenlijst of pas hem aan.</p></div><a href="#edit/${encodeURIComponent(l.id)}" class="simple-link">Bewerken →</a></div><div class="card word-table-wrap"><table class="word-table"><thead><tr><th>#</th><th>${esc(languages[l.fromLang]||'Voorkant')}</th><th>${esc(languages[l.toLang]||'Achterkant')}</th><th>Status</th></tr></thead><tbody>${l.words.map((w,i)=>`<tr><td>${i+1}</td><td>${esc(w.front)}</td><td>${esc(w.back)}</td><td><span class="tag ${(db.progress[l.id]?.[w.id]?.mastery||0)>=3?'green':''}">${(db.progress[l.id]?.[w.id]?.mastery||0)>=3?'✓ Beheerst':(db.progress[l.id]?.[w.id]?.wrong||0)>0?'Herhalen':'Nieuw'}</span></td></tr>`).join('')}</tbody></table></div>`;
}
function subjectOptions(selected){return Object.keys(subjectSymbols).map(k=>`<option ${selected===k?'selected':''}>${esc(k)}</option>`).join('');}
function languageOptions(selected){return Object.entries(languages).map(([k,v])=>`<option value="${k}" ${selected===k?'selected':''}>${v}</option>`).join('');}
function formatPairs(words){return words.map(w=>w.front+'\t'+w.back).join('\n');}
function parsePairs(raw){
 const lines=String(raw).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const result=[];
 for(let line of lines){let parts;
  if(line.includes('\t'))parts=line.split(/\t+/);
  else if(line.includes(';'))parts=splitCSV(line,';');
  else if(/\s[—–-]\s/.test(line))parts=line.split(/\s+[—–-]\s+/);
  else if(line.includes(' → '))parts=line.split(' → ');
  else if(/\s{2,}/.test(line))parts=line.split(/\s{2,}/);
  else if(line.includes(','))parts=splitCSV(line,',');
  else if(line.includes(' = '))parts=line.split(' = ');
  else parts=[];
  if(parts.length>=2){const front=parts[0].replace(/^"|"$/g,'').trim();const back=parts.slice(1).join(' / ').replace(/^"|"$/g,'').trim();if(front&&back)result.push({front,back});}
 }
 return result;
}
function splitCSV(line,separator){const out=[];let current='',inQuotes=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQuotes&&line[i+1]==='"'){current+='"';i++;}else{inQuotes=!inQuotes;}}else if(ch===separator&&!inQuotes){out.push(current.trim());current='';}else current+=ch;}out.push(current.trim());return out;}
function renderEditor(id){const l=id==='new'?null:getList(id);if(!l&&id!=='new')return `<p>Deze lijst bestaat niet meer.</p>`;
  return `<a href="${l?'#list/'+encodeURIComponent(l.id):'#lists'}" class="backline">← Terug</a><div class="page-heading"><div><span class="eyebrow">WOORDENLIJST</span><h1>${l?'Lijst bewerken':'Nieuwe woordenlijst'}</h1><p>Plak woorden uit Excel of typ ze zelf, één woordpaar per regel.</p></div><div class="row"><a class="btn btn-secondary" href="#studygo">↧ StudyGo importeren</a><a class="btn btn-secondary" href="#scan">▧ Scan uit boek</a></div></div><form data-form="edit-list" data-id="${esc(l?.id||'new')}"><div class="card card-pad"><div class="form-grid"><div class="field-group"><label for="list-name">Naam van je lijst</label><input class="input" id="list-name" name="name" required maxlength="110" value="${esc(l?.name||'')}" placeholder="Bijv. Frans hoofdstuk 3"></div><div class="field-group"><label for="list-subject">Vak</label><select id="list-subject" name="subject">${subjectOptions(l?.subject||'Frans')}</select></div><div class="field-group"><label for="lang-from">Taal vraag</label><select id="lang-from" name="fromLang">${languageOptions(l?.fromLang||'fr-FR')}</select></div><div class="field-group"><label for="lang-to">Taal antwoord</label><select id="lang-to" name="toLang">${languageOptions(l?.toLang||'nl-NL')}</select></div></div><div class="field-group"><label for="list-words">Je woordjes</label><textarea id="list-words" class="textarea" name="words" spellcheck="false" placeholder="bonjour - hallo&#10;merci - bedankt&#10;au revoir - tot ziens">${esc(l?formatPairs(l.words):'')}</textarea><div class="form-hint">Gebruik bijvoorbeeld: <strong>bonjour - hallo</strong> of plak twee kolommen uit Excel. Ondersteunt ook puntkomma's en CSV.</div></div><div class="toolbar" style="margin-top:20px"><label class="btn btn-secondary btn-sm" style="cursor:pointer">↑ Importeer CSV of TXT<input type="file" id="import-file" accept=".csv,.tsv,.txt,text/plain,text/csv" hidden></label><span id="word-counter" class="muted tiny">${l?.words.length||0} woordparen</span><button class="btn actions-right" type="submit">${l?'Wijzigingen opslaan':'Lijst aanmaken'} →</button></div></div></form>`;
}
function renderContexts(id){
 const l=getList(id);if(!l)return '<div class="card card-pad">De lijst bestaat niet meer.</div>';
 return `<a class="backline" href="#list/${encodeURIComponent(id)}">← Terug naar de lijst</a>
 <div class="page-heading"><div><span class="eyebrow">INVULLEN IN CONTEXT</span><h1>Oefenzinnen instellen</h1><p>Zet de <strong>juiste Engelse vorm</strong> tussen <strong>[[dubbele haken]]</strong>. Tijdens het oefenen verdwijnen de haken én het Engelse woord. De Nederlandse betekenis uit je lijst verschijnt als hint.</p></div></div>
 <div class="intro-panel"><strong>Voorbeeld:</strong> Yesterday I <strong>[[ate]]</strong> an apple. &nbsp;→&nbsp; Yesterday I <strong>_____</strong> an apple. <strong>(eten)</strong><br><span class="muted">Het juiste antwoord is <strong>ate</strong>, niet eat. Voeg bij ieder woord een zin toe die bij de juiste tijd en vorm past.</span></div>
 <form id="context-form" data-id="${esc(id)}"><div class="card card-pad"><div class="context-editor-list">${l.words.map((w,i)=>{
  const preview=WoordCloze.questionFor(w,l,contextExamples);
  return `<div class="context-row"><div class="context-word"><strong>${i+1}. ${esc(w.front)}</strong><span class="muted tiny">${esc(w.back)}</span></div><div class="context-edit-col"><input class="input" data-context-id="${esc(w.id)}" data-context-field="context" value="${esc(w.context||'')}" placeholder="Yesterday I [[ate]] an apple." aria-label="Oefenzin voor ${esc(w.front)}">${!w.context&&preview?`<span class="muted tiny">Standaardzin: ${esc(preview.context)}</span>`:''}</div><input class="input" data-context-id="${esc(w.id)}" data-context-field="contextForms" value="${esc(w.contextForms||'')}" placeholder="Extra goede vormen (optioneel)" aria-label="Andere geldige vormen voor ${esc(w.front)}"></div>`;
 }).join('')}</div><p class="form-hint">In de contextmodus geldt alleen de vorm tussen de haken als correct. Zet andere echt passende vormen in de derde kolom (gescheiden met /). Woorden zonder bruikbare oefenzin worden overgeslagen.</p><div class="toolbar"><button class="btn btn-big" type="submit">✓ Zinnen opslaan</button><a class="btn btn-secondary" href="#list/${encodeURIComponent(id)}">Annuleren</a></div></div></form>`;
}
function renderGames(){return `<div class="page-heading"><div><span class="eyebrow">SPELEND LEREN</span><h1>Gamezone 🎮</h1><p>Daag jezelf uit met vier verschillende games.</p></div></div><div class="card card-pad" style="margin-bottom:22px"><div class="row" style="flex-wrap:wrap"><strong>Met welke lijst wil je spelen?</strong><select id="game-list" class="field" style="min-width:220px;flex:1">${db.lists.map(l=>`<option value="${esc(l.id)}">${esc(l.name)} (${l.words.length} woorden)</option>`).join('')}</select></div></div><section class="mode-grid">${games.map(m=>`<button class="mode-card" data-action="start-game" data-mode="${m.id}"><span class="mode-icon">${m.icon}</span><h3>${m.id==='learn'&&loadLearnSession(l)?'Slim leren hervatten':m.name}</h3><p>${m.text}</p></button>`).join('')}</section><div class="section-heading"><div><h2>Nog meer oefenen?</h2><p>Alle methodes zijn beschikbaar zonder abonnement.</p></div></div><div class="mode-grid">${modes.slice(0,4).map(m=>`<button class="mode-card" data-action="start-game" data-mode="${m.id}"><span class="mode-icon">${m.icon}</span><h3>${m.id==='learn'&&loadLearnSession(l)?'Slim leren hervatten':m.name}</h3><p>${m.text}</p></button>`).join('')}</div>`;}
function renderStats(){const mastered=db.lists.reduce((a,l)=>a+masteredCount(l),0),all=db.lists.reduce((a,l)=>a+l.words.length,0),correct=db.activity.reduce((a,d)=>a+(d.correct||0),0),total=answeredTotal();return `<div class="page-heading"><div><span class="eyebrow">JOUW VOORTGANG</span><h1>Statistieken</h1><p>Zo gaat het met jouw woordjes.</p></div></div><div class="kpi-grid compact"><div class="card kpi-card"><span class="kpi-icon">⚡</span><div><div class="value">${fmt(xpTotal())}</div><div class="small-name">Totaal XP</div></div></div><div class="card kpi-card"><span class="kpi-icon teal">✓</span><div><div class="value">${fmt(mastered)}</div><div class="small-name">Beheerste woorden</div></div></div><div class="card kpi-card"><span class="kpi-icon yellow">🎯</span><div><div class="value">${total?Math.round(correct/total*100):0}%</div><div class="small-name">Goed beantwoord</div></div></div><div class="card kpi-card"><span class="kpi-icon pink">🔥</span><div><div class="value">${dayStreak()}</div><div class="small-name">Dagelijkse streak</div></div></div></div><div class="two-col"><div class="card card-pad"><h3>Je activiteit</h3><p class="muted tiny">Totaal ${fmt(total)} keer geoefend, verspreid over ${db.activity.filter(x=>x.answered).length} dagen.</p>${graph()}</div><div class="card card-pad"><h3>Al onder de knie</h3><p class="muted tiny">Minimaal drie keer goed opgebouwd in de oefenstanden.</p><div class="result-score" style="margin:5px 0">${all?Math.round(mastered/all*100):0}%</div><div class="meter"><i style="width:${all?Math.round(mastered/all*100):0}%"></i></div><p class="muted tiny" style="margin-top:12px">${mastered} van ${all} woordjes</p></div></div><div class="section-heading"><h2>Per woordenlijst</h2></div><div class="card card-pad stats-list">${db.lists.map(l=>`<div class="stats-row"><div class="row"><span class="subject-icon">${iconFor(l)}</span><div><strong>${esc(l.name)}</strong><div class="muted tiny">${masteredCount(l)} van ${l.words.length} beheerst</div></div></div><div class="row"><span class="tag">${masteryPct(l)}%</span><a class="simple-link" href="#list/${encodeURIComponent(l.id)}">Open →</a></div></div>`).join('')||'<p>Je hebt nog geen woordenlijsten.</p>'}</div><p class="stat-disclaimer" style="margin-top:17px">Je lijsten, XP en beloningen zijn persoonlijk en staan op jouw WoordSprint-server. Gebruik een beveiligde HTTPS-server voordat je de website openbaar maakt.</p>`;}
function renderScan(){
 const d=scanDraft;
 const p=d.crop||{x:0,y:0,w:1,h:1};
 const cropStyle=`left:${(p.x*100).toFixed(2)}%;top:${(p.y*100).toFixed(2)}%;width:${(p.w*100).toFixed(2)}%;height:${(p.h*100).toFixed(2)}%`;
 return `<div class="page-heading"><div><h1>Woordjes scannen</h1><p>Haal woorden en vertalingen uit een foto van je boek.</p></div></div>
 <div class="studygo-intro"><strong>Staan je woordjes al op StudyGo?</strong> Dan hoef je geen foto te maken. <a class="simple-link" href="#studygo">Importeer rechtstreeks een StudyGo-link, PDF of gekopieerde woordenlijst →</a></div>
 <div class="card scanner-hero" style="margin-bottom:20px"><div class="scanner-text"><h2 style="margin:12px 0 7px">Scannen met je telefoon</h2><p class="muted" style="margin-bottom:9px">Scan de QR-code met je telefoon op hetzelfde wifi-netwerk. Woordparen komen daarna ook op je pc.</p><div class="tiny muted">Telefoonlink: <strong>${esc(config?.lanUrl||'Adres wordt opgehaald…')}</strong></div></div><div class="qr-wrap">${config?.qr?`<img alt="QR-code" src="${config.qr}">`:'<div class="muted tiny">QR-code laden…</div>'}</div></div>
 <div class="scan-grid"><div class="card card-pad"><h3>Kies een foto</h3><div class="scan-drop"><strong>Fotografeer je woordenlijst</strong><p class="muted tiny">Neem de hele bladzijde op de foto. De scanner zoekt automatisch de woorden en vertalingen.</p><input id="scan-file" type="file" accept="image/*" capture="environment" aria-label="Foto van woordenlijst"></div>
 ${d.preview?`<div class="crop-help">✓ De <strong>hele foto</strong> wordt automatisch bekeken. De scanner zoekt woordparen tussen de andere tekst op de pagina.</div><div class="scan-preview"><img src="${d.preview}" alt="Hele foto van boek" style="width:100%;max-height:400px;object-fit:contain;border-radius:12px"></div>`:''}
 <div class="form-grid" style="margin-top:16px"><div class="field-group"><label>Taal van de woordjes</label><select data-scan-setting="lang"><option value="eng" ${d.lang==='eng'?'selected':''}>Engels + Nederlands</option><option value="fra" ${d.lang==='fra'?'selected':''}>Frans + Nederlands</option><option value="deu" ${d.lang==='deu'?'selected':''}>Duits + Nederlands</option><option value="spa" ${d.lang==='spa'?'selected':''}>Spaans + Nederlands</option><option value="nld" ${d.lang==='nld'?'selected':''}>Nederlands + Engels</option><option value="ita" ${d.lang==='ita'?'selected':''}>Italiaans + Nederlands</option></select></div></div>
 <button class="btn full" data-action="run-ocr" ${!d.file||d.busy?'disabled':''}>${d.busy?'⏳ Hele foto bekijken…':'Foto scannen'}</button><p class="form-hint">Zorg dat de woorden scherp en leesbaar zijn.</p>${d.diagnostics?`<div class="scan-diagnostics" role="status"><strong>${esc(d.diagnostics)}</strong>${d.scanWarning?`<p>${esc(d.scanWarning)}</p>`:''}</div>`:''}</div>
 <div class="card card-pad"><h3>Controleer de vertalingen</h3><div class="scan-callout">✓ Controleer de spelling en de gemarkeerde woordparen voordat je opslaat.</div><div style="margin-top:17px"><label class="tiny weight" for="scan-raw">Herkende tekst / handmatig plakken</label><textarea id="scan-raw" class="scan-raw" placeholder="lawyer - jurist/advocaat&#10;illegal - onwettig/illegaal" style="margin-top:7px">${esc(d.raw)}</textarea><button class="btn btn-secondary btn-sm" data-action="parse-scan" style="margin:8px 0 14px">⇄ Verdeel tekst in woordparen</button></div><div class="row space-between" style="margin-bottom:10px"><strong>${d.rows.length} woordparen</strong><button class="btn btn-secondary btn-sm" data-action="add-scan-row">+ Rij toevoegen</button></div><div class="scan-table">${d.rows.map((r,i)=>`<div class="scan-row ${r.needsReview?'scan-review':''}" ${r.needsReview?'title="OCR is onzeker: controleer dit woordpaar"':''}><input class="input" data-scan-row="${i}" data-side="front" value="${esc(r.front)}" placeholder="Woord"><input class="input" data-scan-row="${i}" data-side="back" value="${esc(r.back)}" placeholder="Vertaling(en)"><button class="btn btn-secondary" title="Rij verwijderen" aria-label="Rij verwijderen" data-action="remove-scan-row" data-index="${i}">×</button></div>`).join('')||'<p class="muted tiny">Nog geen woordparen. Maak een foto of voeg een rij toe.</p>'}</div></div></div>
 <div class="card card-pad" style="margin-top:18px"><span class="eyebrow">STAP 3</span><h3>Bewaar je woordenlijst</h3><p class="muted tiny">Bij meerdere betekenissen, zoals <strong>jurist/advocaat</strong>, mag je straks één van beide typen.</p><div class="form-grid"><div class="field-group"><label>Bestemming</label><select data-scan-setting="target"><option value="new" ${d.target==='new'?'selected':''}>Nieuwe woordenlijst maken</option>${db.lists.map(l=>`<option value="${esc(l.id)}" ${d.target===l.id?'selected':''}>Toevoegen aan ${esc(l.name)}</option>`).join('')}</select></div>${d.target==='new'?`<div class="field-group"><label>Naam nieuwe lijst</label><input class="input" data-scan-setting="name" value="${esc(d.name)}" placeholder="Bijv. Engels 51 The law"></div><div class="field-group"><label>Vak</label><select data-scan-setting="subject">${subjectOptions(d.subject)}</select></div><div class="field-group"><label>Taal vraag / antwoord</label><div class="row" style="gap:7px"><select style="min-width:0;width:50%" data-scan-setting="fromLang">${languageOptions(d.fromLang)}</select><select style="min-width:0;width:50%" data-scan-setting="toLang">${languageOptions(d.toLang)}</select></div></div>`:''}</div><button class="btn btn-big" data-action="save-scan">✓ ${d.target==='new'?'Maak woordenlijst':'Voeg toe aan woordenlijst'}</button></div>`;
}
function renderStudyGo(){
 const d=studygoDraft;
 return `<div class="page-heading"><div><span class="eyebrow">DIGITAAL IMPORTEREN</span><h1>Importeer uit StudyGo ↧</h1><p>Neem je eigen of gedeelde woordenlijst over zonder een boekfoto te scannen.</p></div><a href="#lists" class="btn btn-secondary">← Mijn lijsten</a></div>
 <div class="studygo-intro"><strong>Zo werkt het:</strong> gebruik een openbare gedeelde StudyGo-link, upload een <strong>PDF met tabel</strong> of plak gekopieerde woorden. We maken geen verbinding met je StudyGo-account. Een privélink of afgeschermde lijst kan niet automatisch worden uitgelezen.</div>
 <div class="studygo-import-grid">
  <section class="card card-pad"><span class="tag">OPTIE 1</span><h3>🔗 Link van StudyGo</h3><p class="muted tiny">Alleen als de gedeelde pagina de woorden openbaar meestuurt. Niet iedere link ondersteunt dit.</p><label class="field-group"><span class="field-title">Gedeelde woordenlijstlink</span><input class="input" data-studygo-setting="url" type="url" placeholder="https://studygo.com/nl/learn/..." value="${esc(d.url)}"></label><button class="btn" data-action="studygo-link" ${d.busy?'disabled':''}>Haal woordjes op</button></section>
  <section class="card card-pad"><span class="tag">OPTIE 2 · AANBEVOLEN</span><h3>📄 StudyGo-PDF</h3><p class="muted tiny">StudyGo → open lijst → Meer opties → Printen → <strong>Tabel</strong> → Print → Opslaan als PDF.</p><input class="input" id="studygo-pdf" type="file" accept=".pdf,application/pdf" aria-label="Kies StudyGo PDF"><div class="muted tiny studygo-filename">${esc(d.file?.name||'Nog geen PDF gekozen')}</div><button class="btn" data-action="studygo-pdf" ${d.busy?'disabled':''}>Lees PDF uit</button></section>
  <section class="card card-pad"><span class="tag">OPTIE 3</span><h3>📋 Kopiëren en plakken</h3><p class="muted tiny">Kopieer twee kolommen uit een StudyGo-lijst of Excel: <strong>woord [tab] vertaling</strong> op iedere regel. Ook <strong>woord = betekenis</strong> werkt.</p><textarea class="textarea studygo-paste" id="studygo-paste" placeholder="lawyer&#9;advocaat/jurist&#10;illegal&#9;onwettig/illegaal">${esc(d.paste)}</textarea><button class="btn" data-action="studygo-paste" ${d.busy?'disabled':''}>Verwerk geplakte tekst</button></section>
 </div>
 ${d.busy?'<div class="card card-pad studygo-feedback">⏳ Woordenlijst wordt ingelezen…</div>':''}
 ${d.error?`<div class="studygo-error" role="alert">⚠ ${esc(d.error)}</div>`:''}
 ${d.message?`<div class="scan-diagnostics"><strong>✓ ${esc(d.message)}</strong><p>Bekijk en verbeter de woordenparen voordat je opslaat.</p></div>`:''}
 ${d.rows.length?`<section class="card card-pad studygo-review" id="studygo-review"><div class="row space-between studygo-review-head"><div><span class="eyebrow">CONTROLE</span><h3>${d.rows.length} woordparen klaar om te leren</h3></div><button class="btn btn-secondary btn-sm" data-action="studygo-add-row">+ Woordpaar</button></div><div class="scan-table">${d.rows.slice(0,d.visible).map((r,i)=>`<div class="scan-row"><input class="input" data-studygo-row="${i}" data-side="front" value="${esc(r.front)}" aria-label="Woord ${i+1}"><input class="input" data-studygo-row="${i}" data-side="back" value="${esc(r.back)}" aria-label="Betekenis ${i+1}"><button class="btn btn-secondary" data-action="studygo-remove-row" data-index="${i}" title="Verwijder woordpaar ${i+1}">×</button></div>`).join('')}</div>${d.rows.length>d.visible?`<button class="btn btn-secondary" data-action="studygo-more" style="margin-top:12px">Toon nog ${Math.min(100,d.rows.length-d.visible)} woordparen</button>`:''}</section>
 <section class="card card-pad studygo-save"><h3>💾 Woordjes bewaren</h3><div class="form-grid"><div class="field-group"><label for="studygo-target">Bestemming</label><select id="studygo-target" data-studygo-setting="target"><option value="new">Nieuwe woordenlijst</option>${db.lists.map(l=>`<option value="${esc(l.id)}" ${d.target===l.id?'selected':''}>Toevoegen aan ${esc(l.name)}</option>`).join('')}</select></div>${d.target==='new'?`<div class="field-group"><label>Naam van je lijst</label><input class="input" data-studygo-setting="name" maxlength="110" value="${esc(d.name)}" placeholder="Bijv. Engels hoofdstuk 51"></div><div class="field-group"><label>Vak</label><select data-studygo-setting="subject">${subjectOptions(d.subject)}</select></div><div class="field-group"><label>Talen</label><div class="row" style="gap:8px"><select data-studygo-setting="fromLang" style="width:50%;min-width:0">${languageOptions(d.fromLang)}</select><select data-studygo-setting="toLang" style="width:50%;min-width:0">${languageOptions(d.toLang)}</select></div></div>`:''}</div><button class="btn btn-big" data-action="studygo-save" ${d.busy?'disabled':''}>✓ ${d.target==='new'?'Maak woordenlijst':'Voeg woordjes toe'}</button></section>`:''}
 <p class="muted tiny" style="margin-top:16px">Tip: lukt de StudyGo-link niet? De PDF- en plakoptie werken zonder toegang tot de StudyGo-website vanuit WoordSprint. Gebruik alleen woordenlijsten die je mag overnemen.</p>`;
}
function studygoImported(result){studygoDraft.rows=(result.pairs||[]).map(x=>({front:x.front,back:x.back}));studygoDraft.visible=50;studygoDraft.method=result.method||'';studygoDraft.message=studygoDraft.rows.length+' woordparen gevonden ('+studygoDraft.method+')';studygoDraft.error='';if(!studygoDraft.name.trim())studygoDraft.name=(result.title||'StudyGo woordenlijst').slice(0,110);}
function buildQuestion(w,reverse){return {wordId:w.id,question:reverse?w.back:w.front,answer:reverse?w.front:w.back,qLang:reverse?session.list.toLang:session.list.fromLang,aLang:reverse?session.list.fromLang:session.list.toLang};}
function buildContextQuestion(w){return WoordCloze.questionFor(w,session.list,contextExamples);}
function learnStorageKey(list,direction=prefs.direction){
 return 'ws-learn-v1:'+currentUser?.id+':'+list.id+':'+direction;
}
function learnListVersion(list){
 return JSON.stringify([list.fromLang,list.toLang,list.words.map(({id,front,back})=>[id,front,back])]);
}
function loadLearnSession(list){
 if(!currentUser?.id)return null;
 try{
   const saved=JSON.parse(localStorage.getItem(learnStorageKey(list))||'null');
   if(!saved||saved.version!==learnListVersion(list)||!saved.queue[saved.index])return null;
   return {
     ...saved,list,mode:'learn',direction:prefs.direction,submitting:false,
     learn:{completed:new Set(saved.completed),errors:new Map(saved.errors)}
   };
 }catch{return null;}
}
function restoreActiveLearnSession(){
 try{
   const list=getList(localStorage.getItem('ws-active-learn-v1:'+currentUser?.id));
   if(list)session=loadLearnSession(list);
 }catch{/* Browser storage is optional. */}
}
function saveLearnSession(s){
 if(!currentUser?.id||s?.mode!=='learn')return;
 const key=learnStorageKey(s.list,s.direction);
 try{
   const activeKey='ws-active-learn-v1:'+currentUser.id;
   if(s.done){localStorage.removeItem(key);localStorage.removeItem(activeKey);return;}
   localStorage.setItem(activeKey,s.list.id);
   const {words,queue,index,correct,wrong,answered,feedback,showAnswer,hints,choiceOptions,choiceCorrectIndex,
     questionNonce,selectedOption,mistakes,earnedXp}=s;
   localStorage.setItem(key,JSON.stringify({
     words,queue,index,correct,wrong,answered,feedback,showAnswer,hints,choiceOptions,choiceCorrectIndex,
     questionNonce,selectedOption,mistakes,earnedXp,version:learnListVersion(s.list),
     completed:[...s.learn.completed],errors:[...s.learn.errors]
   }));
 }catch{/* The round remains playable if browser storage is unavailable. */}
}
function startSession(listId,mode){
 const l=getList(listId);if(!l){toast('Kies eerst een woordenlijst.',true);return;}
 if(!l.words.length){toast('Deze lijst bevat geen woordjes.',true);return;}
 if(['memory','match'].includes(mode)&&l.words.length<2){toast('Voor dit spel heb je minimaal twee woordparen nodig.',true);return;}
 if(session)cleanUpSession();
 const saved=mode==='learn'?loadLearnSession(l):null;
 if(saved){session=saved;navigate('play');render();return;}
 let words=[...l.words];
 if(mode==='context'){words=words.filter(w=>!!WoordCloze.questionFor(w,l,contextExamples));if(!words.length){toast('Er zijn nog geen geldige invulzinnen met [[het antwoord]]. Voeg er eerst een paar toe.',true);navigate('contexts/'+encodeURIComponent(l.id));return;}}
 if(prefs.hard){let hard=words.filter(w=>(db.progress[l.id]?.[w.id]?.mastery||0)<3);if(hard.length)words=hard;else toast('Alles is al beheerst! Je oefent de hele lijst.');}
 if(prefs.random||['memory','match','sprint'].includes(mode))words=shuffle(words);
 if(prefs.count!=='all')words=words.slice(0,Number(prefs.count));
 // Memory and Koppelspel use ALL selected words, divided into short rounds.
 const gameWords=['memory','match'].includes(mode)?[...words]:null;
 session={list:l,mode,direction:prefs.direction,words,queue:[],index:0,correct:0,wrong:0,answered:0,feedback:null,showAnswer:false,done:false,hints:0,choiceOptions:null,choiceCorrectIndex:null,questionNonce:0,selectedOption:null,mistakes:[],repeated:{},timeLeft:60,firstSound:-1,earnedXp:0,submitting:false,gameId:null,gameReady:false,fullGameWords:gameWords,totalMatched:new Set(),roundIndex:0,roundFinished:false};
 const toQ=w=>{const reverse=prefs.direction==='reverse'||(prefs.direction==='mixed'&&Math.random()<.5);return buildQuestion(w,reverse);};
 if(mode==='learn'){
  session.learn=WoordLearn.create(words);
  session.queue=WoordLearn.initialTasks(session.learn,toQ);
 }else for(const w of words){if(mode==='context'){session.queue.push(buildContextQuestion(w));continue;}session.queue.push(toQ(w));}
 if(['memory','match'].includes(mode))beginGameRound(session);
 if(['memory','match','flash','think'].includes(mode)){
   const active=session;
   request('/api/game/start',{method:'POST',body:{listId:l.id,mode,wordIds:words.map(w=>w.id),direction:prefs.direction}})
     .then(r=>{if(session===active&&!active.done){active.gameId=r.gameId;active.gameReady=true;render();}})
     .catch(e=>{if(session===active)toast('Spel kon niet gestart worden: '+e.message,true);});
 }
 if(mode==='sprint'){
  session.queue=[];for(let i=0;i<60;i++){const w=words[Math.floor(Math.random()*words.length)];const reverse=prefs.direction==='reverse'||(prefs.direction==='mixed'&&Math.random()<.5);session.queue.push(buildQuestion(w,reverse));}
  session.ticker=setInterval(()=>{if(!session||session.mode!=='sprint'||location.hash!=='#play'){cleanUpSession();return;}session.timeLeft--;const el=$('#sprint-timer');if(el){el.textContent=session.timeLeft+'s';el.classList.toggle('low',session.timeLeft<=10);}if(session.timeLeft<=0)finishSession();},1000);
 }
 navigate('play');render();
}
function beginGameRound(s){
 const size=s.mode==='memory'?6:8;
 const round=s.fullGameWords.slice(s.roundIndex*size,(s.roundIndex+1)*size);
 s.words=round;s.matched=new Set();s.roundFinished=false;s.locked=false;
 if(s.mode==='memory'){
   s.tiles=shuffle(round.flatMap(w=>[{key:w.id+'f',id:w.id,side:'front',label:w.front},{key:w.id+'b',id:w.id,side:'back',label:w.back}]));s.picks=[];
 }else{s.left=shuffle(round.map(w=>({id:w.id,label:w.front})));s.right=shuffle(round.map(w=>({id:w.id,label:w.back})));s.selected={front:null,back:null};}
}
function gameRoundDone(s){
 if(s.totalMatched.size>=s.fullGameWords.length){finishSession();return;}
 s.roundFinished=true;s.locked=false;render();
}
function applyRewardResult(result){
 if(!session)return;
 session.earnedXp+=(result.awardedXp||0);
 if(result.stat){const m=(db.progress[session.list.id]||={});m[result.wordId||'']=result.stat;}
 if(result.modeProgress){(db.modeProgress||={})[session.list.id]=result.modeProgress;}
 if(result.modeStatus){(db.modeStatus||={})[session.list.id]=result.modeStatus;}
 if(result.activity){const i=db.activity.findIndex(x=>x.date===result.activity.date);if(i<0)db.activity.push(result.activity);else db.activity[i]=result.activity;}
 if(result.profile){currentUser=result.profile;$('#top-xp').textContent=fmt(xpTotal())+' XP';}
 if(result.awardedXp)toast('+'+result.awardedXp+' XP');
 if(result.badges?.length)toast('🏆 '+result.badges.join(', '));
}
function currentQuestion(){return session?.queue[session.index];}
function answerFor(q){return q?.answer||'';}
function langAnswer(){return currentQuestion()?.aLang||'nl-NL';}
function speak(str,lang){if(!('speechSynthesis' in window)){toast('Je browser ondersteunt geen voorlezen.',true);return;}try{speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(str);utter.lang=lang||'nl-NL';utter.rate=.85;speechSynthesis.speak(utter);}catch{toast('Voorlezen is niet beschikbaar.',true);}}
function chooseOptions(q){
 const out=[q.answer];
 const reverse=q.aLang===session.list.fromLang;
 const correctForms=new Set(alternatives(q.answer).map(normalized));
 for(const w of shuffle(session.list.words)){
  const candidate=reverse?w.front:w.back;
  if(!candidate||alternatives(candidate).some(t=>correctForms.has(normalized(t))))continue;
  if(!out.some(x=>normalized(x)===normalized(candidate)))out.push(candidate);
  if(out.length>=4)break;
 }
 return shuffle(out);
}
function nextQuestion(){
 if(!session||session.done)return;
 if(session.delay){clearTimeout(session.delay);session.delay=null;}session.feedback=null;session.showAnswer=false;session.hints=0;session.index++;session.choiceOptions=null;session.choiceCorrectIndex=null;session.selectedOption=null;session.questionNonce++;
 if(session.index>=session.queue.length){finishSession();}else render();
}
// Flashcards and untimed game clicks are self-reported and do not generate coins or XP.
function record(wordId,correct){if(!session)return;}
async function submitAnswer(given,selectedOption=null,choiceCorrect=null){
 if(!session||session.done||session.feedback||session.submitting)return;
 const active=session,q=currentQuestion();if(!q)return;
 session.submitting=true;
 const pressed=selectedOption!==null?document.querySelectorAll('[data-action=choose-answer]')[selectedOption]:document.querySelector('#answer-form button[type=submit]');
 if(pressed){pressed.setAttribute?.('aria-busy','true');pressed.classList?.add?.('checking-answer');}
 let result;
 try{
   const direction=q.aLang===session.list.fromLang?'reverse':'forward';
   result=await request('/api/practice',{method:'POST',body:{listId:session.list.id,wordId:q.wordId,given:String(given),mode:session.mode,direction,stage:q.stage}});
 }catch(e){toast('Antwoord kon niet gecontroleerd worden: '+e.message,true);if(session===active)session.submitting=false;if(pressed){pressed.removeAttribute?.('aria-busy');pressed.classList?.remove?.('checking-answer');}return;}
 if(session!==active||session.done)return;
 if(pressed){pressed.removeAttribute?.('aria-busy');pressed.classList?.remove?.('checking-answer');}
 const correct=result.correct===true;
 session.submitting=false;session.selectedOption=selectedOption;
 session.answered++;if(correct)session.correct++;
 else {session.wrong++;session.mistakes.push({question:session.mode==='context'?q.contextBefore+'___'+q.contextAfter+' ('+q.question+')':q.question,expected:result.expected||q.answer,given:given||'—'});}
 session.earnedXp+=(result.awardedXp||0);
 if(result.stat){const m=(db.progress[session.list.id] ||= {});m[q.wordId]=result.stat;}
 if(result.modeProgress){(db.modeProgress||={})[session.list.id]=result.modeProgress;}
 if(result.modeStatus){(db.modeStatus||={})[session.list.id]=result.modeStatus;}
 if(result.activity){const index=db.activity.findIndex(x=>x.date===result.activity.date);if(index>=0)db.activity[index]=result.activity;else db.activity.push(result.activity);}
 if(result.profile){currentUser=result.profile;$('#top-xp').textContent=fmt(xpTotal())+' XP';}
 if((result.awardedXp||0)>0)toast('+'+result.awardedXp+' XP');
 if(result.badges?.length)toast('🏆 Badge verdiend: '+result.badges.join(', '));
 if(session.mode==='learn')WoordLearn.schedule(session.learn,session.queue,session.index,q,correct);
 if(session.mode==='test'){nextQuestion();return;}
 session.feedback={correct,expected:result.expected||q.answer,given};render();
 if(session.mode==='sprint'||(getEffectiveMode()==='choice'&&correct)){
  active.delay=setTimeout(()=>{if(session===active&&!active.done&&active.feedback)nextQuestion();},session.mode==='sprint'?120:220);
 }
}

function finishSession(){if(!session||session.done)return;cleanUpSession();session.done=true;render();}
function getEffectiveMode(){return session.mode==='learn'?WoordLearn.STAGES[currentQuestion()?.stage??0]:session.mode;}
function renderPlay(){if(!session)return `<div class="card empty-state"><h2>Geen oefensessie gestart</h2><p>Open een woordenlijst om te beginnen.</p><a class="btn" href="#lists">Kies een lijst →</a></div>`;
 const title=[...modes,...games].find(x=>x.id===session.mode)?.name||'Oefenen';
 if(session.done)return renderResult(title);
 const s=session;const progress = s.mode==='learn'?Math.round(s.learn.completed.size/s.words.length*100):['memory','match'].includes(s.mode)?Math.round(s.totalMatched.size/s.fullGameWords.length*100):Math.round(s.index/s.queue.length*100);
 const timer=s.mode==='sprint'?`<span id="sprint-timer" class="sprint-time ${s.timeLeft<=10?'low':''}">${s.timeLeft}s</span>`:s.mode==='learn'?`<span class="tag">${s.learn.completed.size}/${s.words.length} geleerd</span>`:['memory','match'].includes(s.mode)?`<span class="tag">Ronde ${s.roundIndex+1}/${Math.ceil(s.fullGameWords.length/(s.mode==='memory'?6:8))}</span>`:`<span class="tag">${s.index+1} / ${s.queue.length}</span>`;
 let body;
 if(s.mode==='memory')body=renderMemory();
 else if(s.mode==='match')body=renderMatch();
 else body=renderQuestion();
 const learnProgress=s.mode==='learn'?`<div class="learn-track" aria-label="Leerfase">${WoordLearn.NAMES.map((name,i)=>`<span class="learn-track-step ${currentQuestion()?.stage===i?'now':currentQuestion()?.stage>i?'done':''}">${i+1}. ${name}</span>`).join('')}</div><div class="learn-status">${s.learn.completed.size} van ${s.words.length} woorden volledig geleerd · Gevarieerd oefenen: nieuw → meerkeuze → nieuw → hints → typen</div>`:'';
 return `<div class="play-shell"><div class="play-top"><a href="#list/${encodeURIComponent(s.list.id)}" class="backline" style="margin:0">← ${s.mode==='learn'?'Pauzeren':'Stoppen'}</a><strong>${title}</strong>${timer}</div><div class="round-progress"><i style="width:${progress}%"></i></div>${learnProgress}${s.mode==='learn'?`<div class="dir-in-play">${dirButtons(s.list)}</div>`:''}<div class="score-pills"><span class="tag green">✓ ${s.correct} goed</span><span class="tag red">× ${s.wrong} fout</span><span class="tag">⚡ +${s.earnedXp} XP</span></div><div class="card play-card">${body}</div><div class="muted tiny" style="text-align:center;margin-top:19px">${esc(s.list.name)} · ${esc(languages[s.list.fromLang])} / ${esc(languages[s.list.toLang])}</div></div>`;
}
function renderQuestion(){const s=session,q=currentQuestion();if(!q)return `<p>Alle vragen zijn beantwoord.</p>`;
 const effective=getEffectiveMode(),hasFeedback=!!s.feedback;
 const feedback=hasFeedback?`<div class="feedback ${s.feedback.correct?'correct':'wrong'}">${s.feedback.correct?'✓ Goed gedaan!':'✕ Nog even oefenen.'}<span style="display:block;font-weight:500;margin-top:6px">Jij typte: <strong>${esc(s.feedback.given||'—')}</strong></span><span style="display:block;font-weight:500;margin-top:4px">${s.feedback.correct?'Betekenis(sen): ':'Juiste antwoord: '}<strong>${esc(s.feedback.expected)}</strong></span>${!s.feedback.correct?'<span style="display:block;font-weight:500;margin-top:5px">Bij meerdere betekenissen is één juist antwoord genoeg. Controleer de spelling.</span>':''}</div>${s.mode==='sprint'?'':`<button class="btn btn-big" style="margin:18px auto 0" data-action="next-question">${s.index===s.queue.length-1?'Volgende stap →':'Volgende woord →'}</button>`}`:'';
 if(s.mode==='context'){
  const blank=hasFeedback?`<span class="context-filled ${s.feedback.correct?'correct':'wrong'}">${esc(q.answer)}</span>`:`<input id="answer-input" class="context-inline-input" type="text" spellcheck="false" autocomplete="off" placeholder="_____" aria-label="Vul het Engelse woord in de juiste vorm in" required>`;
  const contextFeedback=hasFeedback?`<div class="feedback ${s.feedback.correct?'correct':'wrong'}">${s.feedback.correct?'✓ Goed!':'✕ Niet goed.'}<span style="display:block;font-weight:500;margin-top:5px">Goede vorm(en): <strong>${esc(q.accepted||q.answer)}</strong></span><span class="context-complete">${esc(q.contextFilled)}</span></div><div class="play-buttons"><button class="btn btn-secondary btn-sm" data-action="speak-context">♫ Luister naar de volledige zin</button><button class="btn btn-big" data-action="next-question">${s.index===s.queue.length-1?'Bekijk resultaat →':'Volgende zin →'}</button></div>`:'';
  return `<div class="play-kicker">VUL HET WOORD IN DE JUISTE VORM IN</div><p class="context-cue">Nederlandse betekenis: <strong>${esc(q.question)}</strong></p><form id="answer-form" autocomplete="off"><div class="context-sentence">${esc(q.contextBefore)}${blank}${esc(q.contextAfter)}</div>${!hasFeedback?`<p class="play-instruction">Let op de tijd en de grammatica van de zin.</p><div class="play-buttons"><button class="btn btn-big" type="submit">Controleer antwoord →</button></div>`:''}</form>${contextFeedback}`;
 }
 if(effective==='flash'||effective==='think'){
  return `<div class="play-kicker">${s.mode==='learn'?'STAP 1 · BEKIJK HET WOORD':effective==='think'?'ZEG HET ANTWOORD IN JE HOOFD':'DRAAI DE KAART OM'}</div><div class="flip-card" data-action="flip-card" style="margin-top:18px"><div><div class="flip-hint">${s.showAnswer?'ANTWOORD':'VRAAG'}</div><div class="big-word">${esc(s.showAnswer?q.answer:q.question)}</div><span class="flip-hint">${s.showAnswer?'Klik om terug te draaien':'Klik om antwoord te zien'}</span></div></div><div class="play-buttons">${s.showAnswer?`<button class="btn btn-red" data-action="self-grade" data-correct="false">Nog een keer</button><button class="btn btn-green" data-action="self-grade" data-correct="true">${s.mode==='learn'?'Begrepen →':'Ik wist het! ✓'}</button>`:`<button class="btn" data-action="flip-card">Bekijk antwoord</button>`}</div>`;
 }
 if(effective==='choice'||effective==='sprint'){
  if(!s.choiceOptions){
   s.choiceOptions=chooseOptions(q);
   s.choiceCorrectIndex=s.choiceOptions.findIndex(a=>normalized(a)===normalized(q.answer));
   // Always keep the exact correct answer as an option, even for imported OCR strings.
   if(s.choiceCorrectIndex<0){s.choiceOptions[0]=q.answer;s.choiceCorrectIndex=0;}
  }
  return `<div class="play-kicker">${s.mode==='sprint'?'SNEL! KIES DE VERTALING':(s.mode==='learn'?'STAP 2 · KIES HET JUISTE ANTWOORD':'KIES HET JUISTE ANTWOORD')}</div><div class="big-word">${esc(q.question)}</div><button class="btn btn-secondary btn-sm" style="align-self:center" data-action="speak-question">♫ Luister</button><div class="choices">${s.choiceOptions.map((a,i)=>`<button class="choice ${hasFeedback?(i===s.choiceCorrectIndex?'choice-correct':i===s.selectedOption?'choice-wrong':'choice-muted'):''}" aria-pressed="${i===s.selectedOption}" data-action="choose-answer" data-answer-index="${i}" data-question-key="${s.questionNonce}" ${hasFeedback?'disabled':''}>${esc(a)}</button>`).join('')}</div>${hasFeedback?`<p class="choice-selection">Je koos: <strong>${esc(s.feedback.given)}</strong></p>`:''}${feedback}`;
 }
 let heading=s.mode==='dictation'?'WAT HOOR JE?':s.mode==='learn'?(effective==='hint'?'STAP 3 · SCHRIJF MET HINTS':'STAP 4 · TYP ZELF HET WOORD'):'VERTAAL DIT WOORD';
 let display=s.mode==='dictation'?`<div class="big-word">🎧</div><div class="play-instruction">Betekenis: <strong>${esc(q.question)}</strong></div><button class="btn btn-secondary" data-action="speak-answer" style="align-self:center">♫ Speel geluid opnieuw af</button>`:`<div class="big-word">${esc(q.question)}</div><button class="btn btn-secondary btn-sm" style="align-self:center;margin-bottom:12px" data-action="speak-question">♫ Luister</button>`;
 if(s.mode==='scramble'){const letters=Array.from(q.answer.replace(/\s/g,''));if(!s.scramble||s.scrambleIndex!==s.index){s.scramble=shuffle(letters);if(s.scramble.join('')===letters.join('')&&letters.length>1)s.scramble.reverse();s.scrambleIndex=s.index;}display+=`<div class="scramble-letters" style="margin-top:13px">${s.scramble.map(c=>`<span>${esc(c)}</span>`).join('')}</div>`;heading='ZET DE LETTERS GOED';}
 let hint='';if(effective==='hint'){const length=Math.max(1,1+2*s.hints);const first=alternatives(q.answer)[0]||q.answer;const answer=Array.from(WoordAnswers.acceptedForms(first).find(x=>!x.includes('('))||first);hint=`<div class="hint-text">${answer.map((c,i)=>/\s|[^\p{L}\p{N}]/u.test(c)?esc(c):i<length?esc(c):'_').join(' ')}</div><p class="play-instruction">Dit is een hint voor één betekenis. Een andere juiste betekenis mag ook.</p><button class="btn btn-secondary btn-sm" style="align-self:center;margin-bottom:17px" data-action="more-hint">+ Extra hint</button>`;}
 return `<div class="play-kicker">${heading}</div>${display}${hint}<form id="answer-form" autocomplete="off"><input id="answer-input" class="answer-input" type="text" spellcheck="false" autocomplete="off" placeholder="Typ één juiste betekenis…" ${hasFeedback?`disabled value="${esc(s.feedback.given||'')}"`:'required'} aria-label="Jouw antwoord"><div class="play-buttons">${!hasFeedback?`<button class="btn btn-big" type="submit">Controleer antwoord →</button>`:''}</div></form>${feedback}`;
}
function renderMemory(){const s=session;if(s.roundFinished)return `<div class="game-round-finished"><h2>✓ Ronde klaar!</h2><p>${s.totalMatched.size} van ${s.fullGameWords.length} woordparen gedaan</p><button class="btn btn-big" data-action="next-game-round">Volgende ronde →</button></div>`;return `<div class="play-kicker">ZOEK DE BIJ ELKAAR HORENDE PAREN</div><h3 style="margin:10px 0 19px">${s.totalMatched.size} van ${s.fullGameWords.length} woordparen gevonden</h3><div class="game-board">${s.tiles.map((t,i)=>{const open=s.picks.includes(i),matched=s.matched.has(t.id);return `<button class="memory-tile ${matched?'matched':open?'':'covered'}" data-action="memory-pick" data-index="${i}" ${matched||s.locked?'disabled':''}>${matched||open?esc(t.label):'✦'}</button>`;}).join('')}</div><p class="play-instruction" style="margin:16px 0 0">Draai steeds twee kaarten om. Vind een woord en de vertaling.</p>`;}
function renderMatch(){const s=session;if(s.roundFinished)return `<div class="game-round-finished"><h2>✓ Ronde klaar!</h2><p>${s.totalMatched.size} van ${s.fullGameWords.length} woordparen gedaan</p><button class="btn btn-big" data-action="next-game-round">Volgende ronde →</button></div>`;const col=(items,side)=>`<div class="match-column">${items.map(w=>`<button class="match-item ${s.matched.has(w.id)?'matched':s.selected[side]===w.id?'selected':''}" data-action="match-pick" data-id="${esc(w.id)}" data-side="${side}" ${s.matched.has(w.id)||s.locked?'disabled':''}>${esc(w.label)}</button>`).join('')}</div>`;return `<div class="play-kicker">VERBIND DE VERTALINGEN</div><h3 style="margin:10px 0 22px">${s.totalMatched.size} van ${s.fullGameWords.length} gekoppeld</h3><div class="match-cols">${col(s.left,'front')}${col(s.right,'back')}</div>`;}
function renderResult(title){const s=session;const ratio=s.answered?s.correct/s.answered:0,grade=(1+9*ratio).toFixed(1).replace('.',',');return `<div class="play-shell"><a href="#list/${encodeURIComponent(s.list.id)}" class="backline">← Terug naar je lijst</a><div class="card play-card" style="padding:45px 28px"><div class="result-emoji">${ratio>=.8?'🏆':ratio>=.5?'🎉':'💪'}</div><div class="eyebrow">RONDE AFGEROND</div><h1 class="result-title">${ratio>=.8?'Lekker bezig!':ratio>=.5?'Goed geoefend!':'Blijf oefenen!'}</h1><p class="muted">${esc(title)} · ${esc(s.list.name)}</p>${s.mode==='test'?`<div class="result-score">${grade}</div><p class="muted tiny">Je oefencijfer</p>`:`<div class="result-score">${Math.round(ratio*100)}%</div><p class="muted tiny">Goed beantwoord</p>`}<div class="score-pills"><span class="tag green">✓ ${s.correct} goed</span><span class="tag red">× ${s.wrong} fout</span><span class="tag">⚡ ${s.earnedXp} XP</span></div><div class="play-buttons" style="margin-top:21px"><button class="btn btn-big" data-action="again">Opnieuw oefenen ↻</button><a href="#list/${encodeURIComponent(s.list.id)}" class="btn btn-secondary btn-big">Andere oefenstand</a></div></div>${s.mistakes.length?`<div class="card card-pad" style="margin-top:19px"><h3>Deze woorden kun je nog oefenen</h3><div class="stats-list">${s.mistakes.slice(0,30).map(x=>`<div class="stats-row"><div><strong>${esc(x.question)}</strong><div class="tiny muted">Jij: ${esc(x.given)}</div></div><span class="tag red">${esc(x.expected)}</span></div>`).join('')}</div></div>`:''}</div>`;}
async function verifiedGamePair(s,frontId,backId,known=false){
 if(!s.gameReady||!s.gameId)throw Error('Het spel is nog aan het laden.');
 const r=await request('/api/game/match',{method:'POST',body:{listId:s.list.id,gameId:s.gameId,frontId,backId,known}});
 if(session===s)applyRewardResult({...r,wordId:frontId});return r;
}
async function memoryPick(index){
 const s=session;if(!s||!s.gameReady||s.locked||!s.tiles[index]||s.matched.has(s.tiles[index].id)||s.picks.includes(index))return;
 s.picks.push(index);if(s.picks.length===1){render();return;}
 const [a,b]=s.picks.map(i=>s.tiles[i]);s.locked=true;let good=a.id===b.id&&a.side!==b.side;
 if(good){try{await verifiedGamePair(s,a.id,b.id);}catch(e){good=false;toast(e.message,true);}}
 if(session!==s)return;
 if(good){s.matched.add(a.id);s.totalMatched.add(a.id);s.correct++;s.answered++;}else{s.wrong++;s.answered++;}
 render();s.delay=setTimeout(()=>{if(session!==s)return;s.picks=[];s.locked=false;if(s.matched.size===s.words.length)gameRoundDone(s);else render();},good?350:800);
}
async function matchPick(side,id){
 const s=session;if(!s||!s.gameReady||s.locked||s.matched.has(id))return;s.selected[side]=id;
 if(!s.selected.front||!s.selected.back){render();return;}
 s.locked=true;let good=s.selected.front===s.selected.back;
 if(good){try{await verifiedGamePair(s,s.selected.front,s.selected.back);}catch(e){good=false;toast(e.message,true);}}
 if(session!==s)return;
 s.answered++;if(good){s.correct++;s.matched.add(id);s.totalMatched.add(id);}else{s.wrong++;}
 render();s.delay=setTimeout(()=>{if(session!==s)return;s.selected={front:null,back:null};s.locked=false;if(s.matched.size===s.words.length)gameRoundDone(s);else render();},good?320:650);
}
function download(name,data,type='text/plain;charset=utf-8'){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
function csvEscape(s){return '"'+String(s).replace(/"/g,'""')+'"';}
function renderAuth(){
 document.body.classList.add('unauthenticated');
 $('#app').innerHTML=`<section class="auth-page"><div class="auth-pane"><div class="auth-mark" aria-hidden="true">W</div><h1>WoordSprint</h1><p>${authMode==='login'?'Log in om verder te oefenen.':'Maak een account aan om je voortgang op te slaan.'}</p><div class="auth-tabs"><button class="${authMode==='login'?'on':''}" data-action="auth-toggle" data-mode="login">Inloggen</button><button class="${authMode==='register'?'on':''}" data-action="auth-toggle" data-mode="register">Registreren</button></div><form id="auth-form" class="auth-form"><label>Gebruikersnaam<input class="input" name="username" required minlength="3" maxlength="20" autocomplete="username" placeholder="Jouw gebruikersnaam"></label><label>Wachtwoord<input class="input" name="password" required minlength="8" maxlength="128" autocomplete="${authMode==='login'?'current-password':'new-password'}" type="password" placeholder="Minimaal 8 tekens"></label><button type="submit" class="btn btn-big">${authMode==='login'?'Inloggen':'Account aanmaken'} →</button></form><p class="muted tiny">Je account en woordenlijsten worden veilig op de server opgeslagen. Deel je wachtwoord nooit.</p></div></section>`;
}
function renderProfileStyles(user){
 const styles=user.profileStyles||[];
 return `<section class="card card-pad profile-styles"><h3>Profielstijlen</h3>
   <div class="row profile-links">${[{id:'default',title:'Standaard',unlocked:true},...styles].map(style=>
     `<button class="btn btn-secondary" data-action="profile-style" data-id="${esc(style.id)}"
        ${!style.unlocked||((user.equipped||'default')===style.id)?'disabled':''}>
        ${esc(style.title)}${!style.unlocked?' · Niveau '+style.level:''}${(user.equipped||'default')===style.id?' · Actief':''}
     </button>`).join('')}</div></section>`;
}
function renderProfile(){const u=currentUser||{};const nextLevelTarget=70*Math.pow(u.level||1,2),previousLevelTarget=70*Math.pow((u.level||1)-1,2);const levelPct=Math.max(0,Math.min(100,Math.round(((u.xp||0)-previousLevelTarget)/(nextLevelTarget-previousLevelTarget)*100)));return `<div class="page-heading"><div><span class="eyebrow">JOUW ACCOUNT</span><h1>Mijn profiel</h1><p>Je voortgang blijft bewaard als je op een ander apparaat inlogt.</p></div><button class="btn btn-secondary" data-action="logout">Uitloggen</button></div><div class="profile-hero card ${u.equipped==='banner'?'galaxy':u.equipped==='neon'?'neon':''}"><div class="profile-portrait ${u.equipped==='frame'?'starred':''}">${esc((u.username||'W')[0].toUpperCase())}</div><div><span class="eyebrow">LEVEL ${u.level}</span><h2 class="${u.equipped==='gold'?'gold-name':''}">${esc(u.username)}</h2><p>⚡ ${fmt(u.xp)} XP · 🔥 ${u.streak} dagen streak</p><div class="level-meter"><div class="meter"><i style="width:${levelPct}%"></i></div><small>${fmt(Math.max(0,nextLevelTarget-u.xp))} XP tot level ${(u.level||1)+1}</small></div></div></div>${!u.owner?`<form id="owner-claim-form" class="row" style="margin:14px 0;flex-wrap:wrap"><input class="input" name="code" placeholder="Alleen voor eigenaar: privé-beheerdercode" style="flex:1;min-width:180px"><button class="btn btn-secondary">Beheerder activeren</button></form>`:''}<div class="profile-links">${u.owner?`<a class="btn" href="#owner">🔐 Beheerder</a>`:''}<a class="btn btn-secondary" href="#friends">👥 Vrienden</a><a class="btn btn-secondary" href="#leaderboard">🏆 Klassement</a></div>${renderProfileStyles(u)}<section class="kpi-grid compact"><div class="card kpi-card"><span class="kpi-icon">📚</span><div><div class="value">${u.mastered}</div><div class="small-name">Unieke woorden beheerst</div></div></div><div class="card kpi-card"><span class="kpi-icon teal">🏅</span><div><div class="value">${u.badges?.length||0}</div><div class="small-name">Badges verdiend</div></div></div><div class="card kpi-card"><span class="kpi-icon yellow">👥</span><div><div class="value">${u.friends||0}</div><div class="small-name">Vrienden</div></div></div></section><div class="two-col"><div class="card card-pad"><h3>Behaalde badges</h3><div class="badge-grid">${(u.badges||[]).length?u.badges.map(b=>`<span class="tag">🏅 ${esc(b)}</span>`).join(''):'Je hebt nog geen badges. Leer nieuwe woorden om je eerste badge te halen.'}</div><p class="muted tiny">Een badge kan één keer XP geven. Herhalen levert niet opnieuw een badge op.</p></div>${hosted?'':`<div class="card card-pad"><h3>Oude woordenlijsten overzetten</h3><p class="muted tiny">Heb je nog lijsten van v1.10? Plaats het oude <code>data/woordsprint.json</code> in de map <code>data</code>. Vind de migratiecode in <code>data/MIGRATIE-CODE-ALLEEN-VOOR-JOU.txt</code>. Dit kan maar één keer.</p><form id="legacy-form" class="row" style="flex-wrap:wrap"><input class="input" name="code" placeholder="Eenmalige migratiecode" required style="flex:1;min-width:170px"><button class="btn">Oude lijsten overzetten</button></form></div>`}</div>`;}
function renderOwner(){
 if(!currentUser?.owner)return `<div class="card card-pad">Geen toegang tot beheerderpaneel.</div>`;
 const d=ownerData||{users:[],requests:[]};
 return `<div class="page-heading"><div><span class="eyebrow">ALLEEN VOOR BEHEERDER</span><h1>Beheerder</h1></div></div>
 <section class="card card-pad"><h2>Geregistreerde gebruikers (${d.users.length})</h2><ul class="account-list">${d.users.map(user=>`<li>${esc(user.username)}</li>`).join('')}</ul></section>
 <div class="card card-pad" style="margin-top:16px"><h3>Eerdere cadeaubonaanvragen (${d.requests.filter(r=>r.status==='pending').length} open)</h3><p class="muted tiny">Automatische WhatsApp: ${d.whatsappConfigured?'Ingesteld (voor verzending is een door Meta goedgekeurd sjabloon nodig)':'Niet ingesteld — zie online installatiehandleiding'}.</p>${d.requests.map(r=>`<div class="friend-row"><div><strong>${esc(r.username)} · ${esc(r.itemId)}</strong><p class="muted tiny">${fmt(r.price)} coins · ${esc(r.status)} · ${esc(r.createdAt.slice(0,10))} · WhatsApp: ${esc(r.notificationStatus||'niet ingesteld')}${r.notificationError?' — '+esc(r.notificationError):''}</p></div><div class="row" style="flex-wrap:wrap">${r.status==='pending'?`<button class="btn btn-sm" data-action="owner-review" data-id="${esc(r.id)}" data-status="delivered">Afgeleverd</button><button class="btn btn-secondary btn-sm" data-action="owner-review" data-id="${esc(r.id)}" data-status="rejected">Afwijzen + terugstorten</button>`:''}${r.notificationStatus!=='sent'?`<button class="btn btn-sm btn-secondary" data-action="owner-resend" data-id="${esc(r.id)}">Melding opnieuw sturen</button>`:''}<a class="btn btn-sm btn-secondary" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent('WoordSprint aanvraag: '+r.username+' wil '+r.itemId+' (aanvraag '+r.id+'). Controleer deze in het beheerderpaneel.')}">Deel via WhatsApp</a></div></div>`).join('')||'Nog geen aanvragen.'}</div>`;
}
function renderFriends(){const data=friendsData||{friends:[],requests:[]};return `<div class="page-heading"><div><span class="eyebrow">SAMEN LEREN</span><h1>Mijn vrienden</h1><p>Voeg iemand toe met diens gebruikersnaam. Jullie zien elkaars XP, niet elkaars woordenlijsten.</p></div><a class="btn" href="#leaderboard">🏆 Klassement</a></div><div class="card card-pad"><h3>Vriend toevoegen</h3><form id="friend-form" class="row" style="flex-wrap:wrap"><input class="input" name="username" placeholder="Gebruikersnaam" required maxlength="20" style="flex:1;min-width:180px"><button class="btn">Verstuur verzoek</button></form></div>${data.requests.length?`<div class="card card-pad" style="margin-top:15px"><h3>Nieuwe verzoeken</h3>${data.requests.map(u=>`<div class="friend-row"><strong>${esc(u.username)}</strong><div class="row"><button class="btn btn-sm" data-action="friend-respond" data-id="${esc(u.id)}" data-accept="true">Accepteren</button><button class="btn btn-secondary btn-sm" data-action="friend-respond" data-id="${esc(u.id)}" data-accept="false">Afwijzen</button></div></div>`).join('')}</div>`:''}<div class="card card-pad" style="margin-top:15px"><h3>Vrienden (${data.friends.length})</h3>${data.friends.length?data.friends.map(u=>`<div class="friend-row"><div><strong>${esc(u.username)}</strong><p class="muted tiny" style="margin:0">Level ${u.level} · ${fmt(u.xp)} XP</p></div><button class="btn btn-secondary btn-sm" data-action="friend-remove" data-id="${esc(u.id)}">Verwijder</button></div>`).join(''):'Je hebt nog geen vrienden toegevoegd.'}</div>`;}
function renderLeaderboard(){const u=currentUser;return `<div class="page-heading"><div><span class="eyebrow">WEKELIJKSE RANGLIJST</span><h1>Klassement 🏆</h1><p>Alleen echt verdiende XP telt mee. De week begint op maandag.</p></div></div><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:16px"><button class="btn ${leaderScope==='friends'?'':'btn-secondary'}" data-action="leader-scope" data-scope="friends">Vrienden</button><button class="btn ${leaderScope==='global'?'':'btn-secondary'}" data-action="leader-scope" data-scope="global">Openbaar klassement</button></div><div class="card card-pad"><h3>Deze week</h3>${leaderboardData.length?leaderboardData.map((p,i)=>`<div class="leader-row"><strong>#${i+1} ${esc(p.username)}${p.id===u.id?' (jij)':''}</strong><span>${fmt(p.weeklyXp)} XP · Level ${p.level}</span></div>`).join(''):'Er zijn nog geen scores deze week.'}</div><div class="card card-pad" style="margin-top:15px"><h3>Privacy</h3><p class="muted tiny">Je staat standaard alleen bij je vrienden in het klassement. Je kunt zelf kiezen of je ook in het openbare klassement wilt verschijnen.</p><label class="row" style="gap:9px"><input type="checkbox" id="global-optin" ${u.privacy?.showGlobal?'checked':''}> Toon mijn naam en XP ook openbaar</label></div>`;}
async function loadSocial(view){if(view==='owner'&&currentUser?.owner)ownerData=await request('/api/owner');if(view==='friends')friendsData=await request('/api/friends');if(view==='leaderboard')leaderboardData=await request('/api/leaderboard?scope='+leaderScope);}
async function refreshAndRenderSocial(){const view=location.hash.slice(1).split('/')[0];if(view==='classes'){bookSearch='';classData=await request('/api/classes');if(location.hash.slice(1).split('/')[0]==='classes')render();return;}if(view==='book'){bookSearch='';bookLoading=true;render();await loadBook();if(location.hash==='#book')render();return;}if(['friends','leaderboard','owner'].includes(view)){await refreshProfile();await loadSocial(view);}render();}
async function handleClick(e){const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;const id=button.dataset.id;
 if(action==='auth-toggle'){authMode=button.dataset.mode==='register'?'register':'login';renderAuth();return;}
 if(action==='profile-style'){
   currentUser=await request('/api/profile/style',{method:'POST',body:{id}});
   render();
   return;
 }
 if(action==='book-refresh'){await loadBook();render();return;}
 if(action==='class-open'){
   button.disabled=true;
   try {
     const result=await request('/api/classes/'+encodeURIComponent(button.dataset.classId)+'/lists/'+encodeURIComponent(id)+'/open',{method:'POST',body:{}});
     await refreshState();
     navigate('list/'+encodeURIComponent(result.id));
   }finally{button.disabled=false;}
   return;
 }
 if(action==='book-chapter'){button.disabled=true;try{const existing=db.lists.find(l=>l.bookChapter===id);if(existing){navigate('list/'+encodeURIComponent(existing.id));return;}const r=await request('/api/book/chapter/'+encodeURIComponent(id),{method:'POST',body:{}});await refreshState();navigate('list/'+encodeURIComponent(r.list.id));}catch(e){button.disabled=false;throw e;}return;}
 if(action==='logout'){classData=[];bookData=[];bookError='';bookSearch='';await request('/api/auth/logout',{method:'POST',body:{}});currentUser=null;ownerData=null;friendsData=null;leaderboardData=[];cleanUpSession();session=null;location.hash='#dashboard';renderAuth();return;}

 if(action==='owner-resend'){ownerData=await request('/api/owner/resend',{method:'POST',body:{id}});render();toast('Verzoek opnieuw verwerkt. Bekijk de WhatsApp-status.');return;}
 if(action==='owner-review'){if(!confirm('Weet je zeker dat je deze aanvraag wilt '+(button.dataset.status==='delivered'?'markeren als afgeleverd':'afwijzen')+'?'))return;ownerData=await request('/api/owner/review',{method:'POST',body:{id,status:button.dataset.status}});render();return;}
 if(action==='leader-scope'){leaderScope=button.dataset.scope==='global'?'global':'friends';await loadSocial('leaderboard');render();return;}
 if(action==='friend-respond'){await request('/api/friends/respond',{method:'POST',body:{userId:id,accept:button.dataset.accept==='true'}});friendsData=await request('/api/friends');render();return;}
 if(action==='friend-remove'){if(!confirm('Vriend verwijderen?'))return;await request('/api/friends/remove',{method:'POST',body:{userId:id}});friendsData=await request('/api/friends');render();return;}

 if(['studygo-link','studygo-pdf','studygo-paste'].includes(action)){
  const d=studygoDraft;const url={'studygo-link':'/api/import/studygo-link','studygo-pdf':'/api/import/studygo-pdf','studygo-paste':'/api/import/paste'}[action];
  if(action==='studygo-link'&&!d.url.trim()){toast('Plak eerst een gedeelde StudyGo-link.',true);return;}
  if(action==='studygo-pdf'&&!d.file){toast('Kies eerst een PDF-bestand.',true);return;}
  if(action==='studygo-paste'&&!d.paste.trim()){toast('Plak eerst je woorden en betekenissen.',true);return;}
  d.busy=true;d.error='';d.message='';render();
  try{
   let result;
   if(action==='studygo-pdf'){const form=new FormData();form.append('pdf',d.file);result=await request(url,{method:'POST',body:form});}
   else result=await request(url,{method:'POST',body:action==='studygo-link'?{url:d.url}:{text:d.paste}});
   studygoImported(result);toast(`${d.rows.length} woordparen gevonden. Controleer ze eerst!`);
  }catch(err){d.error=err.message;toast(err.message,true);}
  finally{d.busy=false;render();}return;
 }
 if(action==='studygo-add-row'){studygoDraft.rows.push({front:'',back:''});studygoDraft.visible=Math.max(studygoDraft.visible,studygoDraft.rows.length);render();return;}
 if(action==='studygo-remove-row'){studygoDraft.rows.splice(Number(button.dataset.index),1);render();return;}
 if(action==='studygo-more'){studygoDraft.visible+=100;render();return;}
 if(action==='studygo-save'){
  const d=studygoDraft;const words=d.rows.map(x=>({front:x.front.trim(),back:x.back.trim()})).filter(x=>x.front&&x.back);
  if(!words.length){toast('Geen complete woordparen om te bewaren.',true);return;}
  if(d.target==='new'&&!d.name.trim()){toast('Vul een naam voor de woordenlijst in.',true);return;}
  d.busy=true;render();
  try{
   let list;if(d.target==='new')list=await request('/api/lists',{method:'POST',body:{name:d.name,subject:d.subject,fromLang:d.fromLang,toLang:d.toLang,words,source:'studygo'}});
   else {const original=getList(d.target);if(!original)throw Error('De gekozen lijst bestaat niet meer.');list=await request('/api/lists/'+encodeURIComponent(original.id),{method:'PUT',body:{...original,words:[...original.words,...words]}});}
   studygoDraft={rows:[],url:'',paste:'',file:null,name:'',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',target:'new',method:'',message:'',error:'',busy:false,visible:50};
   await refreshState();toast(`${words.length} woorden opgeslagen!`);navigate('list/'+encodeURIComponent(list.id));render();
  }catch(err){d.error=err.message;toast(err.message,true);d.busy=false;render();}return;
 }
 if(action==='lists-filter'){listFilter=button.dataset.filter||'all';render();return;}
 if(action==='direction-toggle'){const target=button.dataset.direction;if(!['forward','reverse'].includes(target))return;if(session&&!session.done&&location.hash==='#play'){if(!confirm('Van leerrichting wisselen? Je kunt later verder met deze ronde.'))return;const l=session.list.id,m=session.mode;prefs.direction=target;savePrefs();startSession(l,m);}else{prefs.direction=target;savePrefs();render();}return;}
 if(action==='next-game-round'){if(session&&session.roundFinished){session.roundIndex++;beginGameRound(session);render();}return;}
 if(action==='quick-learn'){startSession(id,'learn');return;}
 if(action==='start-mode'){startSession(id,button.dataset.mode);return;}
 if(action==='start-game'){startSession($('#game-list')?.value,button.dataset.mode);return;}
 if(action==='delete-list'){
  const l=getList(id);if(!l)return;
  if(!confirm(`Weet je zeker dat je "${l.name}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`))return;
  try{await request('/api/lists/'+encodeURIComponent(id),{method:'DELETE'});await refreshState();toast('Woordenlijst verwijderd.');navigate('lists');render();}catch(err){toast(err.message,true);}return;
 }
 if(action==='export-list'){
  const l=getList(id);if(!l)return;const csv='\ufeff'+[l.fromLang+';'+l.toLang,...l.words.map(w=>csvEscape(w.front)+';'+csvEscape(w.back))].join('\r\n');download(l.name.replace(/[\\/:*?"<>|]/g,'-')+'.csv',csv,'text/csv;charset=utf-8');toast('CSV-bestand gemaakt.');return;
 }
 if(action==='choose-answer'){
  if(!session||session.feedback||session.done)return;
  // A delayed tap on the previous card must never mark the new card wrong.
  if(button.dataset.questionKey!==undefined&&String(session.questionNonce)!==String(button.dataset.questionKey))return;
  const optionIndex=Number(button.dataset.answerIndex);
  if(!Number.isInteger(optionIndex)||optionIndex<0)return;
  const answer=session.choiceOptions?.[optionIndex];
  if(typeof answer!=='string')return;
  submitAnswer(answer,optionIndex,optionIndex===session.choiceCorrectIndex);return;
 }
 if(action==='next-question'){nextQuestion();return;}
 if(action==='flip-card'){if(session){session.showAnswer=!session.showAnswer;if(session.showAnswer&&['flash','think'].includes(session.mode)&&session.gameId)await request('/api/game/reveal',{method:'POST',body:{gameId:session.gameId,wordId:currentQuestion().wordId}});render();}return;}
 if(action==='self-grade'){if(!session||!session.showAnswer||session.done)return;const q=currentQuestion(),correct=button.dataset.correct==='true';if(correct&&['flash','think'].includes(session.mode)){await verifiedGamePair(session,q.wordId,q.wordId,true);}session.answered++;if(correct)session.correct++;else{session.wrong++;session.mistakes.push({question:q.question,expected:q.answer,given:'Niet gekend'});}if(session.mode==='learn')WoordLearn.schedule(session.learn,session.queue,session.index,q,correct);nextQuestion();return;}
 if(action==='speak-question'){const q=currentQuestion();speak(q.question,q.qLang);return;}
 if(action==='speak-context'){const q=currentQuestion();speak(q.contextFilled,q.aLang);return;}
 if(action==='speak-answer'){const q=currentQuestion();speak(q.answer,q.aLang);return;}
 if(action==='more-hint'){if(session){session.hints++;render();}return;}
 if(action==='again'){if(session)startSession(session.list.id,session.mode);return;}
 if(action==='memory-pick'){await memoryPick(Number(button.dataset.index));return;}
 if(action==='match-pick'){await matchPick(button.dataset.side,button.dataset.id);return;}
 if(action==='book-crop'){scanDraft.crop={...bookCrop};render();return;}
 if(action==='full-crop'){scanDraft.crop={x:0,y:0,w:1,h:1};render();return;}
 if(action==='add-scan-row'){scanDraft.rows.push({front:'',back:''});render();return;}
 if(action==='remove-scan-row'){scanDraft.rows.splice(Number(button.dataset.index),1);render();return;}
 if(action==='parse-scan'){const p=parsePairs(scanDraft.raw);if(p.length===0){toast('Geen duidelijke woordparen gevonden. Gebruik bijvoorbeeld "bonjour - hallo" per regel.',true);return;}scanDraft.rows=p;toast(`${p.length} woordparen gevonden. Controleer ze goed.`);render();return;}
 if(action==='run-ocr'){
  if(!scanDraft.file){toast('Kies eerst een foto.',true);return;}
  const form=new FormData();form.append('image',scanDraft.file);form.append('layout','auto');form.append('lang',scanDraft.lang);
  scanDraft.busy=true;render();
  try{const result=await request('/api/ocr',{method:'POST',body:form});scanDraft.raw=result.raw||'';scanDraft.rows=result.pairs||[];const d=result.diagnostics;scanDraft.diagnostics=`${scanDraft.rows.length} paren gevonden${d?` · Woordjes: ${d.leftLines} regels · vertalingen: ${d.rightLines} regels${d.missingWords?` · ${d.missingWords} woorden zonder vertaling`:``}${d.review?` · ${d.review} controleren`:``}`:''}${result.method?` · methode: ${result.method}`:''}`;scanDraft.scanWarning=result.warning||'';if(scanDraft.rows.length)toast(`${scanDraft.rows.length} paren herkend. Controleer de vertalingen!`);else toast('Geen woordparen gevonden. Maak een scherpe, rechte foto van de hele pagina.',true);}
  catch(err){scanDraft.diagnostics='Scannen mislukt';scanDraft.scanWarning=err.message;toast(err.message,true);}finally{scanDraft.busy=false;render();}return;
 }
 if(action==='save-scan'){
  const words=scanDraft.rows.map(x=>({front:x.front.trim(),back:x.back.trim()})).filter(x=>x.front&&x.back);
  if(!words.length){toast('Er zijn nog geen complete woordparen.',true);return;}
  try{
   let list;
   if(scanDraft.target==='new'){
    if(!scanDraft.name.trim()){toast('Vul eerst de naam van je lijst in.',true);return;}
    list=await request('/api/lists',{method:'POST',body:{name:scanDraft.name,subject:scanDraft.subject,fromLang:scanDraft.fromLang,toLang:scanDraft.toLang,words,source:'scan'}});
   }else{
    const existing=getList(scanDraft.target);if(!existing){toast('De gekozen lijst bestaat niet meer.',true);return;}
    list=await request('/api/lists/'+encodeURIComponent(existing.id),{method:'PUT',body:{...existing,words:[...existing.words,...words]}});
   }
   if(scanDraft.preview)URL.revokeObjectURL(scanDraft.preview);
   scanDraft={rows:[],raw:'',diagnostics:'',scanWarning:'',file:null,preview:null,busy:false,layout:'auto',crop:{x:0,y:0,w:1,h:1},divider:.47,lang:'eng',target:'new',name:'',subject:'Engels',fromLang:'en-GB',toLang:'nl-NL'};
   await refreshState();toast(`${words.length} woorden opgeslagen!`);navigate('list/'+encodeURIComponent(list.id));render();
  }catch(err){toast(err.message,true);}return;
 }
}
async function handleSubmit(e){
 if(e.target.id==='class-create'||e.target.id==='class-publish'){
   e.preventDefault();
   const form=e.target;
   const submit=form.querySelector('button');
   submit.disabled=true;
   try {
     if(form.id==='class-create'){
       const result=await request('/api/classes',{method:'POST',body:{name:form.elements.name.value}});
       classData=result.classes;
       navigate('classes/'+encodeURIComponent(result.id));
     }else{
       classData=await request('/api/classes/'+encodeURIComponent(form.dataset.id)+'/lists',{
         method:'POST',body:{listId:form.elements.listId.value}
       });
       render();
       toast('Woordenlijst gedeeld.');
     }
   }finally{submit.disabled=false;}
   return;
 }
 if(e.target.id==='book-import-form'){
   e.preventDefault();
   const form=e.target;
   const button=form.querySelector('[type=submit]');
   const classId=form.dataset.classId;
   const endpoint=classId?'/api/classes/'+encodeURIComponent(classId)+'/books':'/api/book/import';
   const options={
     subject:form.elements.subject.value,fromLang:form.elements.fromLang.value,toLang:form.elements.toLang.value,
     rightsConfirmed:form.elements.rights.checked
   };
   button.disabled=true;
   let saved=0;
   try{
     for(const file of form.elements.book.files){
       if(file.size>3*1024*1024)throw Error(file.name+' is te groot.');
       const raw=await file.text();
       const book=/\.txt$/i.test(file.name)?readBookText(raw):JSON.parse(raw);
       const result=await request(endpoint,{method:'POST',body:{...options,book}});
       if(classId)classData=result;
       saved++;
     }
     toast(saved===1?'Boek toegevoegd.':saved+' boeken toegevoegd.');
   }catch(err){
     toast((saved?saved+' boeken opgeslagen. ':'')+err.message,true);
   }finally{
     if(saved){
       if(!classId)await loadBook();
       render();
     }
     button.disabled=false;
   }
   return;
 }


 if(e.target.id==='auth-form'){e.preventDefault();const form=e.target;const u=form.elements.username.value.trim(),password=form.elements.password.value;try{const r=await request('/api/auth/'+(authMode==='register'?'register':'login'),{method:'POST',body:{username:u,password}});currentUser=r.user;await refreshState();config=await request('/api/config');navigate('dashboard');render();toast('Welkom '+currentUser.username+'!');}catch(err){toast(err.message,true);}return;}
 if(e.target.id==='owner-claim-form'){e.preventDefault();try{currentUser=await request('/api/owner/claim',{method:'POST',body:{code:e.target.elements.code.value}});toast('Beheerder geactiveerd!');render();}catch(err){toast(err.message,true);}return;}
 if(e.target.id==='legacy-form'){e.preventDefault();try{const r=await request('/api/profile/legacy',{method:'POST',body:{code:e.target.elements.code.value}});legacyAvailable=false;await refreshState();toast(r.count+' oude woordenlijsten overgezet!');navigate('lists');render();}catch(err){toast(err.message,true);}return;}
 if(e.target.id==='friend-form'){e.preventDefault();try{await request('/api/friends/request',{method:'POST',body:{username:e.target.elements.username.value}});friendsData=await request('/api/friends');render();toast('Vriendschapsverzoek verstuurd!');}catch(err){toast(err.message,true);}return;}

 if(e.target.id==='context-form'){e.preventDefault();const form=e.target,l=getList(form.dataset.id);if(!l)return;for(const field of form.querySelectorAll('[data-context-field="context"]')){if(field.value.trim()&&!WoordCloze.readCloze(field.value)){const w=l.words.find(x=>x.id===field.dataset.contextId);toast('Controleer de invulzin bij '+(w?.front||'dit woord')+': zet precies één antwoord tussen [[dubbele haken]].',true);field.focus();return;}}const entries=l.words.map(w=>({id:w.id,context:'',contextForms:''}));for(const input of form.querySelectorAll('[data-context-id]')){const entry=entries.find(w=>w.id===input.dataset.contextId);if(entry)entry[input.dataset.contextField]=input.value;}try{await request('/api/lists/'+encodeURIComponent(l.id)+'/contexts',{method:'PUT',body:{entries}});await refreshState();toast('Voorbeeldzinnen opgeslagen.');navigate('list/'+encodeURIComponent(l.id));render();}catch(err){toast(err.message,true);}return;}

 if(e.target.id==='answer-form'){
  e.preventDefault();
  const input=$('#answer-input');
  const given=input?.value?.trim()||'';
  if(!given){input?.focus();toast('Typ eerst één betekenis in.',true);return;}
  submitAnswer(given);return;
 }
 if(e.target.dataset.form==='edit-list'){
  e.preventDefault();const form=e.target;const body={name:form.elements.name.value,subject:form.elements.subject.value,fromLang:form.elements.fromLang.value,toLang:form.elements.toLang.value,words:parsePairs(form.elements.words.value)};
  if(!body.words.length){toast('Voer woordjes in, één paar per regel, bijvoorbeeld "bonjour - hallo".',true);return;}
  const oldId=form.dataset.id;
  if(oldId!=='new'){
   const old=getList(oldId);const previous=new Map(old.words.map(w=>[normalized(w.front)+'|'+normalized(w.back),w]));
   for(const w of body.words){const prior=previous.get(normalized(w.front)+'|'+normalized(w.back));if(prior){w.id=prior.id;w.context=prior.context||'';w.contextAnswer=prior.contextAnswer||'';w.contextForms=prior.contextForms||'';}}
  }
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{const result=await request(oldId==='new'?'/api/lists':'/api/lists/'+encodeURIComponent(oldId),{method:oldId==='new'?'POST':'PUT',body});await refreshState();toast('Je woordenlijst is opgeslagen!');navigate('list/'+encodeURIComponent(result.id));render();}
  catch(err){toast(err.message,true);submit.disabled=false;}
 }
}
function handleChange(e){const t=e.target;
  if(t.id==='global-optin'){request('/api/profile/privacy',{method:'POST',body:{showGlobal:t.checked}}).then(u=>{currentUser=u;toast('Privacyinstelling opgeslagen.');}).catch(e=>toast(e.message,true));return;}
 if(t.id==='studygo-pdf'){studygoDraft.file=t.files?.[0]||null;const label=$('.studygo-filename');if(label)label.textContent=studygoDraft.file?.name||'Nog geen PDF gekozen';return;}
 if(t.dataset.studygoSetting){studygoDraft[t.dataset.studygoSetting]=t.value;if(t.dataset.studygoSetting==='target')render();return;}
 if(t.dataset.pref){prefs[t.dataset.pref]=t.type==='checkbox'?t.checked:t.value;savePrefs();return;}
 if(t.dataset.scanSetting){scanDraft[t.dataset.scanSetting]=t.value;
  if(t.dataset.scanSetting==='lang'){
   const mapping={fra:['Frans','fr-FR'],deu:['Duits','de-DE'],eng:['Engels','en-GB'],spa:['Spaans','es-ES'],ita:['Overig','it-IT'],nld:['Nederlands','nl-NL']};
   const v=mapping[t.value]||mapping.fra;scanDraft.subject=v[0];scanDraft.fromLang=v[1];scanDraft.toLang=t.value==='nld'?'en-GB':'nl-NL';
  }
  if(t.dataset.scanSetting==='layout'){scanDraft.crop=t.value==='book'?{...bookCrop}:{x:0,y:0,w:1,h:1};}
  if(t.dataset.scanSetting==='divider'){scanDraft.divider=Number(t.value)/100;}
  if(['target','lang','layout','divider'].includes(t.dataset.scanSetting))render();return;
 }
 if(t.id==='scan-file'){
  const file=t.files?.[0];if(!file)return;
  if(scanDraft.preview)URL.revokeObjectURL(scanDraft.preview);
  scanDraft.file=file;scanDraft.preview=URL.createObjectURL(file);scanDraft.diagnostics='';scanDraft.scanWarning='';scanDraft.rows=[];scanDraft.raw='';scanDraft.crop={x:0,y:0,w:1,h:1};render();toast('Foto gekozen. Klik op "Foto scannen".');return;
 }
 if(t.id==='import-file'){
  const file=t.files?.[0];if(!file)return;
  file.text().then(text=>{let content=text.replace(/^\uFEFF/,'');if(/^([^\n]*)(front|voorkant|woord|nederlands|frans|duits|engels)/i.test(content)){const lines=content.split(/\r?\n/);if(lines.length>1)content=lines.slice(1).join('\n');}const textarea=$('#list-words');textarea.value=textarea.value.trim()?textarea.value.trim()+'\n'+content:content;$('#word-counter').textContent=parsePairs(textarea.value).length+' woordparen';toast('Bestand ingelezen. Controleer de woordparen.');}).catch(()=>toast('Bestand kon niet worden ingelezen.',true));return;
 }
}
function handleInput(e){const t=e.target;
 if(t.id==='book-search'){bookSearch=t.value;$('#book-results').innerHTML=bookRows(t.dataset.classId);return;}
 if(t.id==='studygo-paste'){studygoDraft.paste=t.value;return;}
 if(t.dataset.studygoSetting){studygoDraft[t.dataset.studygoSetting]=t.value;return;}
 if(t.dataset.studygoRow!==undefined){const row=studygoDraft.rows[Number(t.dataset.studygoRow)];if(row)row[t.dataset.side]=t.value;return;}
 if(t.id==='list-search'){listSearch=t.value;const results=$('#list-results');if(results){results.innerHTML=listResults();}return;}
 if(t.id==='list-words'){$('#word-counter').textContent=parsePairs(t.value).length+' woordparen';return;}
 if(t.id==='scan-raw'){scanDraft.raw=t.value;return;}
 if(t.dataset.scanRow!==undefined){const row=scanDraft.rows[Number(t.dataset.scanRow)];if(row)row[t.dataset.side]=t.value;return;}
 if(t.dataset.scanSetting==='name'){scanDraft.name=t.value;return;}
}
function activateCropSelection(){
 const el=$('#crop-photo');if(!el)return;
 let origin=null;
 function locationFor(e){const rect=el.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};}
 function setCrop(a,b){scanDraft.crop={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};const mask=el.querySelector('.crop-mask');if(mask){mask.style.left=(scanDraft.crop.x*100)+'%';mask.style.top=(scanDraft.crop.y*100)+'%';mask.style.width=(scanDraft.crop.w*100)+'%';mask.style.height=(scanDraft.crop.h*100)+'%';}}
 el.addEventListener('pointerdown',e=>{e.preventDefault();origin=locationFor(e);el.setPointerCapture(e.pointerId);setCrop(origin,origin);});
 el.addEventListener('pointermove',e=>{if(origin)setCrop(origin,locationFor(e));});
 function end(e){if(!origin)return;const final=locationFor(e),start=origin;origin=null;setCrop(start,final);if(scanDraft.crop.w<.06||scanDraft.crop.h<.06){scanDraft.crop={...bookCrop};toast('Selectie te klein. Probeer een groter vlak.',true);}render();}
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',()=>{origin=null;render();});
}
function handleKeydown(e){if(e.key===' '&&location.hash==='#play'&&['flash','think'].includes(session?.mode)&&!['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();session.showAnswer=!session.showAnswer;render();}}
async function initialize(){
 document.addEventListener('click',e=>{handleClick(e).catch(err=>toast(err.message,true));});
 document.addEventListener('submit',e=>{handleSubmit(e).catch(err=>toast(err.message,true));});
 document.addEventListener('change',handleChange);
 document.addEventListener('input',handleInput);
 document.addEventListener('keydown',handleKeydown);
 window.addEventListener('hashchange',()=>{refreshAndRenderSocial().catch(err=>toast(err.message,true));});
 try{
  const result=await request('/api/auth/me');currentUser=result.user;legacyAvailable=result.hasLegacy===true;hosted=result.cloud===true;
  if(!currentUser){renderAuth();return;}
  await refreshState();config=await request('/api/config');
  if(!location.hash)navigate('dashboard');
  await refreshAndRenderSocial();
 }catch(err){currentUser=null;renderAuth();toast(err.message,true);}
 setInterval(async()=>{
  if(!currentUser)return;
  const view=location.hash.slice(1).split('/')[0];
  if(!['dashboard','lists','list','games','stats','profile','friends','leaderboard'].includes(view))return;
  try{const fresh=await request('/api/state');if(JSON.stringify(fresh)!==JSON.stringify(db)){db=fresh;render();}}
  catch{/* authenticated calls handle errors when clicked */}
 },6500);
}
initialize();
