'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const clean=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
function validateBook(input){
 if(!input||input.format!=='woordsprint-book-v1'||!Array.isArray(input.chapters)||!input.chapters.length||input.chapters.length>200)throw Error('Kies het WoordSprint-boekbestand (.json).');
 const ids=new Set();let count=0;
 const chapters=input.chapters.map(c=>{
  if(!c||!Array.isArray(c.words)||!c.words.length||c.words.length>500||!/^[-a-z0-9]{1,60}$/.test(c.id)||ids.has(c.id))throw Error('Een hoofdstuk is ongeldig of dubbel.');
  ids.add(c.id);const title=clean(c.title,100);if(!title)throw Error('Hoofdstuknaam ontbreekt.');
  const words=c.words.map(w=>({front:clean(w?.front,400),back:clean(w?.back,400),context:clean(w?.context,600),contextForms:clean(w?.contextForms,300)}));
  if(words.some(w=>!w.front||!w.back))throw Error('Een woordpaar is onvolledig.');count+=words.length;
  return {id:c.id,title,section:clean(c.section,100)||'Hoofdstukken',number:Number.isInteger(c.number)?c.number:null,page:Number.isInteger(c.page)?c.page:null,words};
 });
 if(count>12000)throw Error('Dit boek bevat te veel woorden.');
 return {format:'woordsprint-book-v1',title:clean(input.title,100)||'Mijn boek',chapters};
}
function bookIndex(book,lists=[]){if(!book)return null;return {title:book.title,chapters:book.chapters.map(({words,...c})=>({...c,wordCount:words.length,listId:lists.find(l=>l.bookChapter===c.id)?.id||null}))};}
function openChapter(book,chapterId,lists,now=()=>new Date().toISOString()){
 const c=book?.chapters.find(x=>x.id===chapterId);if(!c)throw Error('Hoofdstuk niet gevonden.');
 const existing=lists.find(l=>l.bookChapter===c.id);if(existing)return {list:existing,created:false};
 const stamp=now();const list={id:crypto.randomUUID(),name:('Finish Up · '+(c.number!==null?String(c.number)+' ': '')+c.title).slice(0,110),subject:'Engels',fromLang:'en-GB',toLang:'nl-NL',source:'book',bookChapter:c.id,createdAt:stamp,updatedAt:stamp,words:c.words.map(w=>({...w,id:crypto.randomUUID()}))};
 lists.unshift(list);return {list,created:true};
}
function localBookStore(dir){function file(uid){return path.join(dir,crypto.createHash('sha256').update(String(uid)).digest('hex')+'.json');}return {async loadBook(uid){try{return JSON.parse(await fs.readFile(file(uid),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},async saveBook(uid,book){await fs.mkdir(dir,{recursive:true});const target=file(uid),tmp=target+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(book),{mode:0o600});await fs.rename(tmp,target);}};}
// Reserved storage key cannot collide with the UUID of a normal account.
const SHARED_BOOK_KEY='__shared_finish_up_v1__';
function sharedBookLibrary(store,ownerCheck){
 return {
  async load(){return store.loadBook(SHARED_BOOK_KEY);},
  async publish(user,input){ownerCheck(user);if(input?.rightsConfirmed!==true)throw Error('Bevestig eerst dat je de inhoud met alle gebruikers mag delen.');const book=validateBook(input.book);await store.saveBook(SHARED_BOOK_KEY,book);return book;}
 };
}
module.exports={validateBook,bookIndex,openChapter,localBookStore,sharedBookLibrary,SHARED_BOOK_KEY};
