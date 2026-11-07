import{classify,extractFeatures,validateModel,type TwoHandModel,type Point}from'./twoHand';
import{validPersonalSample,type PersonalSample}from'../storage/calibration';
let base:TwoHandModel|undefined,personal:PersonalSample[]=[];
self.onmessage=async(e:MessageEvent)=>{
 try{
  if(e.data.type==='load'){
   const response=await fetch('/models/twohand-v1/model.json');
   if(!response.ok)throw Error(`Model HTTP ${response.status}`);
   const value:unknown=await response.json();validateModel(value);base=value;
   personal=Array.isArray(e.data.samples)?e.data.samples.filter(validPersonalSample):[];
   self.postMessage({type:'ready',version:base.version,minScore:base.minScore});
  }else if(e.data.type==='personal'){
   if(!Array.isArray(e.data.samples)||!e.data.samples.every(validPersonalSample))throw Error('Invalid personal samples');
   personal=e.data.samples;
  }else if(e.data.type==='frame'){
   if(!base)throw Error('Model not loaded');
   const {features,handCount}=extractFeatures(e.data.hands as Point[][],e.data.frame);
   const output=classify({...base,samples:[...base.samples,...personal]},features,handCount);
   const reason=!handCount?'no_hand':output.distance===null?'no_examples':output.distance>base.maxDistance?'too_far':(output.prediction?.confidence??0)<base.minScore?'ambiguous':'candidate';
   self.postMessage({type:'prediction',...output,handCount,reason,minScore:base.minScore,maxDistance:base.maxDistance,...(e.data.capture?{features}:{})});
  }
 }catch(error){self.postMessage({type:'error',message:String(error)})}
};
