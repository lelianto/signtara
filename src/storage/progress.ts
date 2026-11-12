import {openDB} from 'idb';
export interface Progress {letters:string[];xp:number;days:string[]}
export const emptyProgress=():Progress=>({letters:[],xp:0,days:[]});
// Nama lama "isyara" (sebelum BISARA) sengaja dipertahankan; mengganti nama basis data menghilangkan progres yang sudah tersimpan.
async function db(){return openDB('isyara',1,{upgrade(d){d.createObjectStore('progress')}})}
export async function readProgress():Promise<Progress>{const d=await db();try{const p=await d.get('progress','main');return p&&Array.isArray(p.letters)&&Number.isFinite(p.xp)&&Array.isArray(p.days)?p:emptyProgress()}finally{d.close()}}
export async function award(letter:string){if(!/^[A-Z]$/.test(letter))throw Error('Invalid letter');const d=await db();try{const tx=d.transaction('progress','readwrite');const p:Progress=await tx.store.get('main')??emptyProgress();const day=new Date().toLocaleDateString('en-CA');if(!p.letters.includes(letter)){p.letters.push(letter);p.xp+=10}if(!p.days.includes(day))p.days.push(day);await tx.store.put(p,'main');await tx.done;return p}finally{d.close()}}
