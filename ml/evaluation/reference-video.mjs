/** Diagnostic only: training-reference photos streamed as video, NOT live-user accuracy. */
import{chromium}from'@playwright/test';import{writeFile}from'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:3000',browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const results=[],letters=process.argv[3]||'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
try{for(const letter of letters){
 const page=await browser.newPage();
 try{
  await page.addInitScript(({letter})=>{Object.defineProperty(navigator,'mediaDevices',{value:{enumerateDevices:()=>Promise.resolve([]),getUserMedia:async()=>{
   const img=new Image();img.src=`/ref/${letter}/${letter.toLowerCase()}_da7115.jpg`;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const stream=canvas.captureStream(15);const timer=setInterval(()=>ctx.drawImage(img,0,0),66);const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop()};return stream;
  }}})}, {letter});
  await page.goto(base);const start=performance.now();await page.getByRole('button',{name:'Nyalakan kamera'}).click();await page.getByRole('button',{name:'Hentikan kamera'}).waitFor({timeout:15000});
  try{await page.waitForFunction(()=>!!document.querySelector('#transcript')?.value,{timeout:4000})}catch{}
  const predicted=await page.locator('#transcript').inputValue(),score=Number(await page.locator('meter').getAttribute('value')),status=await page.getByRole('status').first().textContent();
  const result={reference:letter,predicted,correct:predicted===letter,score,status,elapsedMs:performance.now()-start};results.push(result);console.log(JSON.stringify(result));
  if(letter==='A'){await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/bisara-twohand-A.png',fullPage:false})}
  await page.getByRole('button',{name:'Hentikan kamera'}).click();
 }catch(error){results.push({reference:letter,error:String(error),correct:false});console.log(letter,String(error))}finally{await page.close()}
}}finally{await browser.close()}
const report={protocol:'Training-reference photo video-stream smoke diagnostic. No held-out signer or live webcam; no accuracy claim.',results,correct:results.filter(r=>r.correct).length,total:letters.length};
await writeFile(letters.length===26?'ml/evaluation/reference-video.json':`ml/evaluation/reference-video-${letters}.json`,JSON.stringify(report,null,2));
console.log(`${report.correct}/${report.total} reference streams committed the expected letter.`);
