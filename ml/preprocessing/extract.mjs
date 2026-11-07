/** Usage: node ml/preprocessing/extract.mjs /absolute/dataset/root [baseURL] */
import{readdir,readFile,writeFile,mkdir}from'node:fs/promises';import{resolve,join}from'node:path';import{createHash}from'node:crypto';import{chromium}from'@playwright/test';
const root=resolve(process.argv[2]||'ml/data/source'),base=process.argv[3]||'http://127.0.0.1:3000';
const items=[];const trainHashes=new Set();let overlap=0;
for(const split of ['train','test'])for(const name of (await readdir(join(root,split))).sort()){
 if(!/^[A-Z]\..*\.jpg$/i.test(name))continue;
 const path=join(root,split,name),sha256=createHash('sha256').update(await readFile(path)).digest('hex');
 if(split==='train')trainHashes.add(sha256);else if(trainHashes.has(sha256)){overlap++;continue}
 items.push({id:items.length,label:name[0].toUpperCase(),split,name,sha256,path});
}
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/__training/*',async route=>{const id=Number(new URL(route.request().url()).pathname.split('/').pop());const item=items[id];if(!item)return route.abort();await route.fulfill({contentType:'image/jpeg',body:await readFile(item.path)})});
 await page.goto(base);
 await page.evaluate(async()=>{
  const{FilesetResolver,HandLandmarker}=await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
  window.__extract=await HandLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/mediapipe/wasm'),{baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numHands:2});
  window.__features=(await import('/src/recognition/twoHand.ts')).extractFeatures;
 });
 const rows=[];
 for(let offset=0;offset<items.length;offset+=20){
  const batch=items.slice(offset,offset+20).map(({path,...item})=>item);
  const values=await page.evaluate(async batch=>{const rows=[];for(const item of batch){const img=new Image();img.src=`/__training/${item.id}`;try{await img.decode();const detection=window.__extract.detect(img);rows.push({...item,width:img.naturalWidth,height:img.naturalHeight,...window.__features(detection.landmarks,{width:img.naturalWidth,height:img.naturalHeight}),hands:detection.landmarks})}catch(error){rows.push({...item,...window.__features([]),hands:[],decodeError:String(error)})}}return rows},batch);
  rows.push(...values);console.log(`Extracted ${rows.length}/${items.length}`);
 }
 await mkdir('ml/data',{recursive:true});await writeFile('ml/data/landmarks.json',JSON.stringify({source:'rhiosutoyo dataset',featureVersion:'aspect-4by3-v1',overlapRemoved:overlap,rows}));
 console.log(`Saved ${rows.length} image records; train/test exact overlaps removed: ${overlap}`);
 await page.evaluate(()=>window.__extract.close());
}finally{await browser.close()}
