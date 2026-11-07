/** Spatial slots are ordered by wrist x in the UNMIRRORED input image.
 * Shared unchanged by browser extraction, training and live inference.
 * Local shape (63) + relative global positions (63) per hand + presence (2).
 */
export interface Point {x:number;y:number;z:number}
export const MODEL_VERSION='twohand-v1';
export const FEATURE_VERSION='aspect-4by3-v1';
export interface FrameSize {width:number;height:number}
export const FEATURE_COUNT=254;
export const MIN_SCORE=0.35;
export const MAX_DISTANCE=0.20;
export interface Sample {features:number[];label:string;handCount:number;source?:'personal'}
export interface TwoHandModel {version:typeof MODEL_VERSION;featureCount:number;classes:string[];samples:Sample[];maxDistance:number;minScore:number;source:string;}
export function extractFeatures(input:Point[][],frame:FrameSize={width:4,height:3}):{features:number[];handCount:number}{
 if(input.length>2)throw Error('At most two hands supported');
 for(const hand of input)if(hand.length!==21||hand.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('Invalid hand landmarks');
 if(!Number.isFinite(frame.width)||!Number.isFinite(frame.height)||frame.width<=0||frame.height<=0)throw Error('Invalid frame dimensions');
 // MediaPipe normalizes x/z by width and y by height. Match the 4:3 source geometry.
 const correction=(frame.width/frame.height)/(4/3);
 const corrected=input.map(hand=>hand.map(p=>({x:p.x*correction,y:p.y,z:p.z*correction})));
 const hands=[...corrected].sort((a,b)=>a[0].x-b[0].x);
 if(!hands.length)return {features:Array(FEATURE_COUNT).fill(0),handCount:0};
 const radii=hands.map(h=>Math.max(...h.map(p=>Math.hypot(p.x-h[0].x,p.y-h[0].y,p.z-h[0].z)),1e-6));
 const scale=radii.reduce((a,b)=>a+b,0)/hands.length;
 const center={x:hands.reduce((s,h)=>s+h[0].x,0)/hands.length,y:hands.reduce((s,h)=>s+h[0].y,0)/hands.length,z:hands.reduce((s,h)=>s+h[0].z,0)/hands.length};
 const features:number[]=[];
 for(let i=0;i<2;i++){
  const h=hands[i];if(!h){features.push(...Array(126).fill(0));continue}
  for(const p of h)features.push((p.x-h[0].x)/radii[i],(p.y-h[0].y)/radii[i],(p.z-h[0].z)/radii[i]);
  // Cross-hand depth is unreliable; keep per-hand wrist-relative z.
  for(const p of h)features.push((p.x-center.x)/scale,(p.y-center.y)/scale,(p.z-h[0].z)/scale);
 }
 features.push(1,hands.length===2?1:0);
 return {features,handCount:hands.length};
}
export function validateModel(value:unknown):asserts value is TwoHandModel{
 const m=value as TwoHandModel;
 if(!m||m.version!==MODEL_VERSION||m.featureCount!==FEATURE_COUNT||m.classes?.length!==26||!m.classes.every((c,i)=>c===String.fromCharCode(65+i))||!Array.isArray(m.samples)||m.samples.length<26||!Number.isFinite(m.maxDistance)||m.maxDistance<=0||m.maxDistance>1||!Number.isFinite(m.minScore)||m.minScore<0.1||m.minScore>0.95)throw Error('Invalid two-hand model contract');
 for(const s of m.samples)if(!m.classes.includes(s.label)||![1,2].includes(s.handCount)||s.features?.length!==FEATURE_COUNT||!s.features.every(Number.isFinite))throw Error('Invalid model sample');
}
export function mirrorFeatures(features:number[],handCount:number):number[]{
 if(!handCount)return features;
 const out=[...features];
 if(handCount===1){for(let i=0;i<126;i+=3)out[i]=-out[i];return out}
 for(let i=0;i<126;i++){
  const sign=i%3===0?-1:1;
  out[i]=sign*features[126+i];
  out[126+i]=sign*features[i];
 }
 return out;
}
export function swapHandSlots(features:number[]):number[]{
 const out=[...features];
 for(let i=0;i<126;i++){
  out[i]=features[126+i];
  out[126+i]=features[i];
 }
 return out;
}
function isCurvedArc(f:number[],isPrototype=false):boolean{
 const x4=f[4*3],y4=f[4*3+1],x5=f[5*3],y5=f[5*3+1],x6=f[6*3],y6=f[6*3+1],x7=f[7*3],y7=f[7*3+1],x8=f[8*3],y8=f[8*3+1],y12=f[12*3+1];
 const d48=Math.hypot(x8-x4,y8-y4),len=Math.hypot(x8-x5,y8-y5);
 const segs=Math.hypot(x6-x5,y6-y5)+Math.hypot(x7-x6,y7-y6)+Math.hypot(x8-x7,y8-y7)+1e-6;
 const straight=len/segs;
 if(isPrototype){
  const dyMCP=f[63+5*3+1]-f[189+5*3+1];
  return d48>0.44&&y4-y8>0.40&&y5-y8>0.17&&dyMCP>-0.40&&x8-x5>0.18;
 }
 const cLoop=d48>0.36&&y4-y8>0.24&&y5-y8>0.08&&x8-x5>0.10&&x8>0.22;
 const middleUp=y5-y12>0.10;
 if(!cLoop)return false;
 if(middleUp&&straight>0.965)return false;
 return true;
}
function isTwoFingerHorizontalF(f:number[],isPrototype=false):boolean{
 const x8=f[8*3],y8=f[8*3+1],x12=f[12*3],y12=f[12*3+1],x16=f[16*3],x20=f[20*3];
 const h1y8=f[126+8*3+1],h1y12=f[126+12*3+1];
 const minCurl16=isPrototype?0.42:0.22,minCurl20=isPrototype?0.45:0.26;
 return x8>0.68&&x12>0.68&&y12-y8>0.12&&y12>-0.38&&x12-x16>minCurl16&&x8-x16>minCurl16&&x12-x20>minCurl20&&h1y8<-0.65&&h1y12-h1y8>0.25;
}
const BONE_PAIRS:readonly[number,number,number][]=[[4,8,1.8],[4,5,0.8],[8,5,1.2],[9,12,1.6],[13,16,1.6],[17,20,1.0],[8,12,1.5],[12,16,1.6]];
export function poseDistance(f1:number[],f2:number[],handCount:number,maxAngle=0.24):number{
 let sum=0,norm=0;
 const cArcMatch=handCount===2&&isCurvedArc(f1,false)&&isCurvedArc(f2,true);
 const fMatch=handCount===2&&isTwoFingerHorizontalF(f1,false)&&isTwoFingerHorizontalF(f2,true);
 for(let h=0;h<handCount;h++){
  const base=h*126;
  const relaxPassive=cArcMatch&&h===0;
  const relaxF=fMatch&&h===0;
  let dot=0,cross=0;
  for(let pt=0;pt<21;pt++){
   if(relaxPassive&&pt>=9)continue;
   if(relaxF&&(pt<=4||pt>=14))continue;
   const i=pt*3;
   dot+=f1[base+i]*f2[base+i]+f1[base+i+1]*f2[base+i+1];
   cross+=f1[base+i]*f2[base+i+1]-f1[base+i+1]*f2[base+i];
  }
  const angle=maxAngle>0?Math.max(-maxAngle,Math.min(maxAngle,Math.atan2(cross,Math.max(dot,1e-6)))):0;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  for(let pt=0;pt<21;pt++){
   const i=pt*3;
   const isTip=pt===4||pt===8||pt===12||pt===16||pt===20;
   const isFPassive=relaxF&&(pt<=4||(pt>=14&&pt!==16));
   const wXY=relaxPassive&&pt>=9?0.04:isFPassive?0.18:isTip?1.4:1.0,wZ=relaxPassive&&pt>=9?0.01:0.25;
   const rx=f1[base+i]*cos-f1[base+i+1]*sin,ry=f1[base+i]*sin+f1[base+i+1]*cos;
   const dx=rx-f2[base+i],dy=ry-f2[base+i+1],dz=f1[base+i+2]-f2[base+i+2];
   sum+=wXY*(dx*dx+dy*dy)+wZ*(dz*dz);
   norm+=2*wXY+wZ;
  }
  if(handCount===2){
   for(const[a,b,wBoneBase]of BONE_PAIRS){
    if(relaxPassive&&(a>=9||b>=9))continue;
    const wBone=relaxF&&(a===4||b===4)?0.25:wBoneBase;
    const ia=base+a*3,ib=base+b*3;
    const vx1=(f1[ib]-f1[ia])*cos-(f1[ib+1]-f1[ia+1])*sin,vy1=(f1[ib]-f1[ia])*sin+(f1[ib+1]-f1[ia+1])*cos;
    const vx2=f2[ib]-f2[ia],vy2=f2[ib+1]-f2[ia+1];
    sum+=wBone*((vx1-vx2)**2+(vy1-vy2)**2);
    norm+=2*wBone;
   }
   let gx1=0,gy1=0,gx2=0,gy2=0,cnt=0;
   for(let pt=0;pt<21;pt++){
    if(relaxPassive&&pt>=9)continue;
    if(relaxF&&(pt<=4||pt>=13))continue;
    const i=63+pt*3;
    gx1+=f1[base+i];gy1+=f1[base+i+1];gx2+=f2[base+i];gy2+=f2[base+i+1];cnt++;
   }
   gx1/=cnt;gy1/=cnt;gx2/=cnt;gy2/=cnt;
   const relaxShift=cArcMatch||fMatch;
   const maxSX=relaxShift?0.35:0.16,fracX=relaxShift?0.65:0.38;
   const maxSY=relaxShift?0.22:0.08,fracY=relaxShift?0.50:0.25;
   const shiftX=Math.max(-maxSX,Math.min(maxSX,(gx2-gx1)*fracX));
   const shiftY=Math.max(-maxSY,Math.min(maxSY,(gy2-gy1)*fracY));
   for(let pt=0;pt<21;pt++){
    const i=63+pt*3;
    const wG=relaxPassive&&pt>=9?0.02:relaxF&&(pt<=4||pt>=13)?0.08:0.48;
    const dx=(f1[base+i]+shiftX)-f2[base+i],dy=(f1[base+i+1]+shiftY)-f2[base+i+1],dz=f1[base+i+2]-f2[base+i+2];
    sum+=wG*(dx*dx+dy*dy)+0.15*(dz*dz);
    norm+=2*wG+0.15;
   }
  }else{
   for(let pt=0;pt<21;pt++){
    const i=63+pt*3;
    const rx=f1[base+i]*cos-f1[base+i+1]*sin,ry=f1[base+i]*sin+f1[base+i+1]*cos;
    const dx=rx-f2[base+i],dy=ry-f2[base+i+1],dz=f1[base+i+2]-f2[base+i+2];
    sum+=0.5*(dx*dx+dy*dy)+0.15*(dz*dz);
    norm+=1.0+0.15;
   }
  }
 }
 return Math.sqrt(sum/norm);
}
export function classify(model:TwoHandModel,features:number[],handCount:number){
 if(!handCount)return {prediction:null,distance:null};
 if(features.length!==FEATURE_COUNT||!features.every(Number.isFinite))throw Error('Invalid features');
 const mirrored=mirrorFeatures(features,handCount);
 const swapped=handCount===2?swapHandSlots(features):features;
 const swappedMirr=handCount===2?swapHandSlots(mirrored):mirrored;
 const mirrPenalty=handCount===2?1.04:1.15;
 const distances=model.samples.filter(s=>s.handCount===handCount).map(s=>{
  const dOrig=poseDistance(features,s.features,handCount,0.24);
  const dMirr=poseDistance(mirrored,s.features,handCount,handCount===2?0.22:0.13)*mirrPenalty;
  const dSwap=handCount===2?poseDistance(swapped,s.features,handCount,0.20)*1.06:Infinity;
  const dSwapMirr=handCount===2?poseDistance(swappedMirr,s.features,handCount,0.20)*1.08:Infinity;
  return {label:s.label,source:s.source??'dataset',distance:Math.min(dOrig,dMirr,dSwap,dSwapMirr),sampleFeatures:s.features};
 }).sort((a,b)=>a.distance-b.distance);
 if(!distances.length)return {prediction:null,distance:null};
 const best=distances[0],other=distances.find(s=>s.label!==best.label);
 if(!other)return {prediction:{label:best.label,confidence:0,source:best.source},distance:best.distance};
 const dProto=handCount===2?poseDistance(best.sampleFeatures,other.sampleFeatures,handCount,0.10):0;
 const orthoVar=handCount===2&&best.distance<=0.11?Math.max(0,best.distance**2-(0.45*dProto)**2)*0.60*(1-best.distance/0.14):0;
 const dBestAdj=Math.sqrt(Math.max(1e-9,best.distance**2-orthoVar));
 const dOtherAdj=Math.sqrt(Math.max(1e-9,other.distance**2-orthoVar));
 const top3Same=distances.slice(0,3).filter(s=>s.label===best.label).length;
 const exp=top3Same===3?1.55:top3Same===2?1.3:1.0;
 // A geometric separation score, NOT a calibrated probability.
 const score=Math.max(0,1-Math.pow(dBestAdj/Math.max(dOtherAdj,1e-9),exp));
 if(best.distance>model.maxDistance)return {prediction:{label:best.label,confidence:0,source:best.source},distance:best.distance};
 return {prediction:{label:best.label,confidence:score,source:best.source},distance:best.distance};
}
