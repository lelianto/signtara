import{FilesetResolver,HandLandmarker,type NormalizedLandmark}from'@mediapipe/tasks-vision';
import{mergeDetectedHands,unmirrorHands}from'./handRecovery';
type Files=Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
/** Fresh palm searches when temporal tracking loses a hand; all passes share one frozen frame. */
export class TwoHandTracker{
 private snapshot=document.createElement('canvas');private mirrored=document.createElement('canvas');
 private lastSearch=-Infinity;private lastRecovered=-Infinity;private closed=false;
 private constructor(private primary:HandLandmarker,private search:HandLandmarker|null){}
 static async create(files:Files){
  const baseOptions={modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU' as const};
  const primary=await HandLandmarker.createFromOptions(files,{baseOptions,runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.45,minHandPresenceConfidence:.45,minTrackingConfidence:.45});
  let search:HandLandmarker|null=null;
  try{search=await HandLandmarker.createFromOptions(files,{baseOptions,runningMode:'IMAGE',numHands:2,minHandDetectionConfidence:.30,minHandPresenceConfidence:.45})}catch{/* A failed optional search must not disable the baseline camera. */}
  return new TwoHandTracker(primary,search);
 }
 get recoveryAvailable(){return this.search!==null}
 detect(video:HTMLVideoElement,now:number):{landmarks:NormalizedLandmark[][];recovered:boolean;primaryHandCount:number}{
  if(this.closed)throw Error('Tracker already closed');
  const width=video.videoWidth,height=video.videoHeight;
  if(this.snapshot.width!==width||this.snapshot.height!==height){this.snapshot.width=width;this.snapshot.height=height;this.mirrored.width=width;this.mirrored.height=height}
  this.snapshot.getContext('2d')!.drawImage(video,0,0,width,height);
  const original=this.primary.detectForVideo(this.snapshot,now).landmarks;
  if(original.length>=2||!this.search)return{landmarks:original,recovered:false,primaryHandCount:original.length};
  // Search periodically while missing; after recovery, verify every new frame (never reuse stale points).
  if(now-this.lastSearch<300&&now-this.lastRecovered>1000)return{landmarks:original,recovered:false,primaryHandCount:original.length};
  this.lastSearch=now;
  const fresh=this.search.detect(this.snapshot).landmarks;
  let combined=mergeDetectedHands(original,fresh);
  if(combined.length<2){
   const ctx=this.mirrored.getContext('2d')!;ctx.save();ctx.translate(width,0);ctx.scale(-1,1);ctx.drawImage(this.snapshot,0,0);ctx.restore();
   const mirrored=unmirrorHands(this.search.detect(this.mirrored).landmarks);
   combined=mergeDetectedHands(combined,mirrored);
  }
  const recovered=combined.length>original.length;
  if(combined.length===2)this.lastRecovered=now;
  return{landmarks:combined,recovered,primaryHandCount:original.length};
 }
 close(){if(this.closed)return;this.closed=true;this.primary.close();this.search?.close();this.snapshot.width=this.snapshot.height=this.mirrored.width=this.mirrored.height=0}
}
