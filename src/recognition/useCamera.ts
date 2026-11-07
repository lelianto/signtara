import{useEffect,useRef,useState}from'react';
import{FilesetResolver,HandLandmarker,DrawingUtils}from'@mediapipe/tasks-vision';
import{TwoHandTracker}from'./TwoHandTracker';
import{MODEL_VERSION,MIN_SCORE,poseDistance,type FrameSize}from'./twoHand';
import{cameraError,Stabilizer,type Recognition}from'./contracts';
import{readCalibration,saveCalibration,clearCalibration}from'../storage/calibration';
export interface CameraDiagnostics {handCount:number;width:number;height:number;candidate:string;score:number;distance:number|null;reason:string;minScore:number}
interface Capture {label:string;expectedHands:number;frames:{features:number[];handCount:number}[];started:number;lastAt:number}
const initialDiagnostics=():CameraDiagnostics=>({handCount:0,width:0,height:0,candidate:'',score:0,distance:null,reason:'idle',minScore:MIN_SCORE});
const initialResult=():Recognition=>({status:'unknown',confidence:0,modelVersion:MODEL_VERSION});
export function useCamera(onCommit:(letter:string,source?:string)=>void){
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),dispose=useRef(()=>{}),generation=useRef(0),callback=useRef(onCommit);callback.current=onCommit;
 const captureRef=useRef<Capture|null>(null),diagnosticsRef=useRef(initialDiagnostics());
 const[trackedHands,setTrackedHands]=useState(0),[recoveryEnabled,setRecoveryEnabled]=useState(false);
 const[running,setRunning]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('Kamera belum dinyalakan.'),[result,setResult]=useState<Recognition>(initialResult),[metrics,setMetrics]=useState({fps:0,latency:0});
 const[diagnostics,setDiagnostics]=useState(initialDiagnostics),[personalCount,setPersonalCount]=useState(0),[calibrationNotice,setCalibrationNotice]=useState(''),[capture,setCapture]=useState<{label:string;count:number;total:number}|null>(null),[saving,setSaving]=useState(false);
 useEffect(()=>{readCalibration().then(s=>setPersonalCount(s.length)).catch(()=>setCalibrationNotice('Contoh pribadi tidak dapat dibaca; model dasar tetap tersedia.'))},[]);
 const stop=()=>{generation.current++;dispose.current();dispose.current=()=>{};captureRef.current=null;setCapture(null);setSaving(false);setRunning(false);setTrackedHands(0);setRecoveryEnabled(false);setBusy(false);setResult(initialResult());setMessage('Kamera berhenti.');diagnosticsRef.current=initialDiagnostics();setDiagnostics(initialDiagnostics());};
 function beginCalibration(label:string,expectedHands:number){
  if(!running||saving||captureRef.current||!/^[A-Z]$/.test(label)||![1,2].includes(expectedHands))return;
  if(diagnosticsRef.current.handCount!==expectedHands){setCalibrationNotice(`Contoh ${label} memerlukan ${expectedHands} tangan terdeteksi; saat ini ${diagnosticsRef.current.handCount}.`);return}
  captureRef.current={label,expectedHands,frames:[],started:performance.now(),lastAt:0};setCapture({label,count:0,total:8});setCalibrationNotice(`Merekam bentuk ${label} yang Anda beri label. Ikuti referensi dan tahan posisi tangan tetap stabil.`);
 }
 async function removePersonalExamples(){stop();try{await clearCalibration();setPersonalCount(0);setCalibrationNotice('Contoh pribadi dihapus. Model dasar akan digunakan.')}catch{setCalibrationNotice('Contoh pribadi gagal dihapus. Periksa penyimpanan browser.')}}
 async function start(deviceId:string){
  stop();const token=generation.current;setBusy(true);setResult({...initialResult(),status:'loading'});setMessage('Menyiapkan model lokal…');
  let stream:MediaStream|undefined,landmarker:TwoHandTracker|undefined,worker:Worker|undefined,raf=0;
  const cleanup=()=>{cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());worker?.terminate();landmarker?.close();if(video.current)video.current.srcObject=null;const c=canvas.current;c?.getContext('2d')?.clearRect(0,0,c.width,c.height)};dispose.current=cleanup;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser memerlukan localhost / HTTPS dan dukungan kamera.');
   // Request source-like geometry; still normalize actual dimensions if the device chooses 16:9.
   const constraints={width:{ideal:640},height:{ideal:480},aspectRatio:{ideal:4/3},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'})};
   stream=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false});if(token!==generation.current){cleanup();return}
   stream.getVideoTracks()[0].onended=()=>{stop();setMessage('Kamera terputus. Sambungkan kembali dan coba lagi.');setResult({...initialResult(),status:'error'})};
   const samples=await readCalibration().catch(()=>{setCalibrationNotice('Penyimpanan contoh pribadi tidak tersedia; memakai model dasar.');return []});
   if(token!==generation.current){cleanup();return}setPersonalCount(samples.length);
   let minScore=MIN_SCORE;worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});const w=worker;
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Model loading timeout')),15000);w.onerror=()=>{clearTimeout(timer);reject(Error('Worker model gagal'))};w.onmessage=e=>{clearTimeout(timer);if(e.data.type==='ready'){minScore=e.data.minScore;resolve()}else reject(Error(e.data.message))};w.postMessage({type:'load',samples})});
   const files=await FilesetResolver.forVisionTasks('/mediapipe/wasm');
   landmarker=await TwoHandTracker.create(files);if(token===generation.current)setRecoveryEnabled(landmarker.recoveryAvailable);
   if(token!==generation.current){cleanup();return}const v=video.current!;v.srcObject=stream;await v.play();if(token!==generation.current){cleanup();return}
   const smoother=new Stabilizer(minScore);let pending=false,last=-1,lastHandCount=-1,lastTick=performance.now(),started=0,frame:FrameSize={width:640,height:480};
   let requireRelease=false,releaseFrames=0,awaitingPersonal=false,lastCalibrated='',twoHandStreak=0,oneHandFlicker=0,captureDropStreak=0;
   w.onmessage=e=>{
    if(token!==generation.current)return;pending=false;
    if(e.data.type==='error'){stop();setMessage(e.data.message);setResult({...initialResult(),status:'error'});return}
    const data=e.data;
    const diagnostic={handCount:data.handCount,width:frame.width,height:frame.height,candidate:data.prediction?.label??'',score:data.prediction?.confidence??0,distance:data.distance,reason:data.reason,minScore:data.minScore};
    diagnosticsRef.current=diagnostic;setDiagnostics(diagnostic);setMetrics(m=>({...m,latency:performance.now()-started}));
    const recording=captureRef.current;
    if(recording){
     smoother.reset();setResult({...initialResult(),status:data.handCount?'uncertain':'no_hand'});
     const now=performance.now();
     if(now-recording.started>15000){captureRef.current=null;setCapture(null);setCalibrationNotice('Belum memperoleh contoh stabil. Coba lagi dengan semua tangan terlihat.');return}
     if(data.handCount!==recording.expectedHands){
      captureDropStreak++;
      if(captureDropStreak>3){recording.frames=[];setCapture({label:recording.label,count:0,total:8})}
      setCalibrationNotice(`Pelacak membaca ${data.handCount} tangan; referensi ${recording.label} memerlukan ${recording.expectedHands}.`);return;
     }
     captureDropStreak=0;
     if(!Array.isArray(data.features)||now-recording.lastAt<110)return;
     const first=recording.frames[0];
     if(first){const drift=poseDistance(data.features,first.features,data.handCount);if(drift>.14)return}
     recording.lastAt=now;recording.frames.push({features:data.features,handCount:data.handCount});
     setCapture({label:recording.label,count:recording.frames.length,total:8});setCalibrationNotice(`Merekam contoh pribadi ${recording.label}: ${recording.frames.length}/8. Tahan posisi tangan.`);
     if(recording.frames.length>=8){
      captureRef.current=null;setCapture(null);awaitingPersonal=true;requireRelease=true;releaseFrames=0;lastCalibrated=recording.label;setSaving(true);
      saveCalibration(recording.label,recording.frames).then(saved=>{
       if(token!==generation.current)return;w.postMessage({type:'personal',samples:saved});setPersonalCount(saved.length);setCalibrationNotice(`Contoh pribadi ${recording.label} tersimpan. Turunkan semua tangan, lalu bentuk ${recording.label} lagi untuk menguji inferensi baru.`);
      }).catch(()=>{if(token===generation.current)setCalibrationNotice('Contoh gagal disimpan. Periksa penyimpanan browser.');}).finally(()=>{if(token===generation.current){awaitingPersonal=false;setSaving(false)}});
     }
     return;
    }
    if(awaitingPersonal)return;
    if(requireRelease){
     smoother.reset();setResult({...initialResult(),status:data.handCount?'unknown':'no_hand'});
     releaseFrames=data.handCount===0?releaseFrames+1:0;
     if(releaseFrames>=3){requireRelease=false;setCalibrationNotice(`Siap menguji ${lastCalibrated}. Bentuk kembali isyaratnya; hasil berasal dari frame baru.`)}
     return;
    }
    if(data.handCount===2){twoHandStreak++;oneHandFlicker=0}
    else if(data.handCount===1&&twoHandStreak>=2&&oneHandFlicker<2){oneHandFlicker++;return}
    else{twoHandStreak=0;oneHandFlicker=0}
    if(data.handCount!==lastHandCount){lastHandCount=data.handCount;setMessage(data.handCount>1?'Dua tangan terdeteksi. Tahan bentuk dan posisi kedua tangan hingga stabil.':data.handCount===1?'Satu tangan terdeteksi. Untuk A, pastikan titik pelacak muncul pada kedua tangan.':'Tangan belum terdeteksi. Posisikan tangan di dalam kamera.')}
    const next=smoother.push(data.prediction);setResult(next.result);if(next.commit)callback.current(next.commit,next.result.source);
   };
   w.onerror=()=>{stop();setMessage('Inference worker gagal. Coba mulai kembali.')};
   const loop=()=>{
    if(token!==generation.current)return;
    try{
     const now=performance.now();
     if(v.readyState>=2&&v.currentTime!==last&&!pending){
      last=v.currentTime;started=now;const detection=landmarker!.detect(v,now),c=canvas.current!,ctx=c.getContext('2d')!;setTrackedHands(detection.landmarks.length);
      frame={width:v.videoWidth,height:v.videoHeight};c.width=frame.width;c.height=frame.height;const draw=new DrawingUtils(ctx);
      detection.landmarks.forEach((hand,i)=>{draw.drawConnectors(hand,HandLandmarker.HAND_CONNECTIONS,{color:i?'#f6d68b':'#a9e8ba',lineWidth:3});draw.drawLandmarks(hand,{color:'#ffffff',radius:3})});
      pending=true;w.postMessage({type:'frame',hands:detection.landmarks,frame,capture:!!captureRef.current});
      setMetrics(m=>({...m,fps:1000/(now-lastTick)}));lastTick=now;
     }
     raf=requestAnimationFrame(loop);
    }catch(error){stop();setMessage(cameraError(error));setResult({...initialResult(),status:'error'})}
   };
   setRunning(true);setBusy(false);setMessage('Model dua tangan aktif. Ikuti referensi dan tahan posisi tangan hingga stabil.');loop();
  }catch(error){cleanup();if(token!==generation.current)return;setBusy(false);setRunning(false);setMessage(cameraError(error));setResult({...initialResult(),status:'error'})}
 }
 useEffect(()=>()=>{generation.current++;dispose.current()},[]);
 return{video,canvas,start,stop,running,trackedHands,recoveryEnabled,busy,message,result,metrics,diagnostics,personalCount,calibrationNotice,capture,saving,beginCalibration,removePersonalExamples};
}
