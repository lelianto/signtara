import{chromium}from'@playwright/test';import{readFile,writeFile}from'node:fs/promises';import{join,resolve}from'node:path';
const root=resolve(process.argv[2]||'ml/data/source'),base=process.argv[3]||'http://127.0.0.1:3000';
const data=JSON.parse(await readFile('ml/data/landmarks.json','utf8')),hands=JSON.parse(await readFile('ml/preprocessing/reference-hands.json','utf8'));
const rows=data.rows.filter(r=>hands[r.label]===2&&r.handCount<2);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});const output=[];
try{const page=await browser.newPage();await page.route('**/__tracker/*',async route=>{const i=Number(new URL(route.request().url()).pathname.split('/').pop()),r=rows[i];await route.fulfill({contentType:'image/jpeg',body:await readFile(join(root,r.split,r.name))})});await page.goto(base);
 for(let i=0;i<rows.length;i++){
  const result=await page.evaluate(async i=>{
   const{FilesetResolver}=await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');const{TwoHandTracker}=await import('/src/recognition/TwoHandTracker.ts');
   const img=new Image();img.src=`/__tracker/${i}`;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);const stream=c.captureStream(15),v=document.createElement('video');v.muted=true;v.srcObject=stream;await v.play();
   const tracker=await TwoHandTracker.create(await FilesetResolver.forVisionTasks('/mediapipe/wasm'));
   try{const r=tracker.detect(v,performance.now());return {primary:r.primaryHandCount,final:r.landmarks.length,recovered:r.recovered}}finally{tracker.close();stream.getTracks().forEach(t=>t.stop())}
  },i);
  const item={label:rows[i].label,file:`${rows[i].split}/${rows[i].name}`,previousImageCount:rows[i].handCount,...result};output.push(item);console.log(JSON.stringify(item));
 }
}finally{await browser.close()}
await writeFile('ml/evaluation/tracker-recovery.json',JSON.stringify({protocol:'Source photos with previously incomplete IMAGE extraction. Fresh VIDEO primary versus same-frame re-detection; not a live-user benchmark.',results:output},null,2));
