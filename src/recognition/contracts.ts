import {MODEL_VERSION,MIN_SCORE} from './twoHand';
export type Status = 'recognized'|'uncertain'|'unknown'|'no_hand'|'loading'|'error';
export interface Recognition { signId?:string; conceptId?:string; confidence:number; status:Status; modelVersion:string;source?:string;stabilityVotes?:number;stabilityRequired?:number }
export interface Prediction { label:string; confidence:number;source?:string }
export class Stabilizer {
 private frames:Prediction[]=[]; private blocked='';
 constructor(private minConfidence=MIN_SCORE){}
 reset(){this.frames=[];this.blocked=''}
 push(p:Prediction|null):{result:Recognition;commit?:string}{
 const base={confidence:p?.confidence??0,modelVersion:MODEL_VERSION,source:p?.source,stabilityVotes:0,stabilityRequired:6};
 if(!p){this.reset();return {result:{...base,status:'no_hand'}}}
 if(!Number.isFinite(p.confidence)||p.confidence<0.25){this.frames=[];this.blocked='';return {result:{...base,confidence:Number.isFinite(p.confidence)?p.confidence:0,status:'unknown'}}}
 if(p.confidence<this.minConfidence){
  const existingVotes=this.frames.filter(x=>x.label===p.label).length;
  if(!existingVotes)this.frames=[];
  return {result:{...base,confidence:p.confidence,stabilityVotes:existingVotes,status:'uncertain'}};
 }
 this.frames.push(p);if(this.frames.length>8)this.frames.shift();
 const votes=this.frames.filter(x=>x.label===p.label).length;
 const stable=votes>=6;
 const result:Recognition={...base,stabilityVotes:votes,status:stable?'recognized':'uncertain',...(stable?{signId:`BISINDO_LETTER_${p.label}`,conceptId:`LETTER_${p.label}`}:{})};
 if(stable&&this.blocked!==p.label){this.blocked=p.label;this.frames=[];return {result,commit:p.label}}
 return {result};
 }
}
export function cameraError(e:unknown){return e instanceof DOMException&&e.name==='NotAllowedError'?'Izin kamera ditolak. Izinkan kamera melalui pengaturan browser.':`Kamera atau model gagal: ${e instanceof Error?e.message:String(e)}`}
