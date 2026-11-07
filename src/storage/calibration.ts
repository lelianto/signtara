import{openDB}from'idb';
import{FEATURE_COUNT,FEATURE_VERSION,MODEL_VERSION,type Sample}from'../recognition/twoHand';
export interface PersonalSample extends Sample {id:string;capturedAt:number;featureVersion:string;modelVersion:string;source:'personal'}
export const MAX_PER_LETTER=12;
export function validPersonalSample(value:unknown):value is PersonalSample{
 const s=value as PersonalSample;
 return !!s&&typeof s.id==='string'&&/^[A-Z]$/.test(s.label)&&[1,2].includes(s.handCount)&&s.featureVersion===FEATURE_VERSION&&s.modelVersion===MODEL_VERSION&&s.source==='personal'&&Number.isFinite(s.capturedAt)&&Array.isArray(s.features)&&s.features.length===FEATURE_COUNT&&s.features.every(Number.isFinite);
}
let writes:Promise<unknown>=Promise.resolve();
async function db(){return openDB('isyara-personal-signs',1,{upgrade(d){d.createObjectStore('samples',{keyPath:'id'})}})}
export async function readCalibration():Promise<PersonalSample[]>{const d=await db();try{return(await d.getAll('samples')).filter(validPersonalSample)}finally{d.close()}}
export async function saveCalibration(label:string,frames:{features:number[];handCount:number}[]){
 if(!/^[A-Z]$/.test(label)||!frames.length||frames.length>MAX_PER_LETTER)throw Error('Invalid personal examples');
 const added=frames.map(frame=>({...frame,label,features:[...frame.features],id:crypto.randomUUID(),capturedAt:Date.now(),featureVersion:FEATURE_VERSION,modelVersion:MODEL_VERSION,source:'personal' as const}));
 if(!added.every(validPersonalSample))throw Error('Invalid personal features');
 const operation=writes.catch(()=>{}).then(async()=>{const d=await db();try{const tx=d.transaction('samples','readwrite');const existing:PersonalSample[]=await tx.store.getAll();const old=existing.filter(s=>s.label===label).sort((a,b)=>a.capturedAt-b.capturedAt);
 for(const s of old.slice(0,Math.max(0,old.length+added.length-MAX_PER_LETTER)))await tx.store.delete(s.id);
 for(const s of added)await tx.store.put(s);await tx.done;
 }finally{d.close()}return readCalibration();});writes=operation;return operation;
}
export async function clearCalibration(){const operation=writes.catch(()=>{}).then(async()=>{const d=await db();try{await d.clear('samples')}finally{d.close()}});writes=operation;await operation}
