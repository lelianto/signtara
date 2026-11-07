import{test,expect,type Page}from'@playwright/test';
async function referenceStream(page:Page,letter:string,wide=false){
 await page.addInitScript(({letter,wide})=>{
  Object.defineProperty(navigator,'mediaDevices',{value:{enumerateDevices:()=>Promise.resolve([]),getUserMedia:async()=>{
   const img=new Image();img.src=`/ref/${letter}/${letter.toLowerCase()}_da7115.jpg`;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=wide?1280:img.width;canvas.height=wide?720:img.height;
   const ctx=canvas.getContext('2d')!;let blank=false;const draw=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);if(!blank){const scale=Math.min(canvas.width/img.width,canvas.height/img.height);ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale)}};(window as any).__setTestBlank=(value:boolean)=>{blank=value;draw()};draw();const stream=canvas.captureStream(15);
   const timer=setInterval(draw,66),track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
   track.stop=()=>{clearInterval(timer);stop()};(window as any).__testStream=stream;return stream;
  }}});
 },{letter,wide});
}
test('navigation, register, unavailable vocabulary and persistent progress',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Dari tangan, jadi makna.'})).toBeVisible();
 await page.getByRole('button',{name:'Krama',exact:true}).click();await expect(page.getByText('BAHASA JAWA · KRAMA')).toBeVisible();
 await page.getByRole('button',{name:'Kosakata Belum tersedia'}).click();await expect(page.getByRole('button',{name:'Nyalakan kamera'})).toBeDisabled();
 await page.getByRole('button',{name:'Kamus',exact:true}).click();await page.getByRole('textbox',{name:'Cari kamus'}).fill('makan');await expect(page.getByRole('heading',{name:'makan',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Belajar',exact:true}).click();await expect(page.getByText('0 XP · 0/26 huruf')).toBeVisible();
 await page.evaluate(async()=>{const{award}=await import('/src/storage/progress.ts');await award('A')});await page.reload();await page.getByRole('button',{name:'Belajar',exact:true}).click();await expect(page.getByText('10 XP · 1/26 huruf')).toBeVisible();
});
test('camera permission denial on auto-start and manual retry',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>Promise.reject(new DOMException('denied','NotAllowedError')),enumerateDevices:()=>Promise.resolve([])}}));
 await page.goto('/');await expect(page.getByText('Izin kamera ditolak.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();await expect(page.getByText('Izin kamera ditolak.',{exact:false})).toBeVisible();
});
test('missing two-hand model releases camera on auto-start',async({page})=>{
 await referenceStream(page,'A');await page.route('**/models/twohand-v1/model.json',r=>r.fulfill({status:404,body:'missing'}));
 await page.goto('/');await expect(page.getByText('Kamera atau model gagal:',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__testStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
test('camera disconnect is reported after auto-start',async({page})=>{
 await page.addInitScript(()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const stream=canvas.captureStream(10);Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>{setTimeout(()=>stream.getVideoTracks()[0].dispatchEvent(new Event('ended')),1000);return Promise.resolve(stream)},enumerateDevices:()=>Promise.resolve([])}})});
 await page.goto('/');await expect(page.getByText('Kamera terputus.',{exact:false})).toBeVisible();
});
for(const letter of ['A','C'])test(`real two-hand pipeline auto-starts, recognizes reference ${letter} and cleans up`,async({page})=>{
 await referenceStream(page,letter);await page.goto('/');
 await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue(letter,{timeout:15000});
 if(letter==='A')await expect(page.getByRole('status').filter({hasText:'Dua tangan terdeteksi'})).toBeVisible();
 // A held pose must not repeatedly append the same letter.
 await page.waitForTimeout(700);await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue(letter);
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
 expect(await page.evaluate(()=>(window as any).__testStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
 await expect(page.getByRole('button',{name:'Nyalakan kamera'})).toBeVisible();
 if(letter==='A'){
  await page.getByRole('button',{name:'Nyalakan kamera'}).click();
  await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:'Hentikan kamera'}).click();
 }
});
test('no hands never creates a letter',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'mediaDevices',{value:{enumerateDevices:()=>Promise.resolve([]),getUserMedia:async()=>{
  const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,640,480);const s=canvasStream(c);return s;
  function canvasStream(canvas:HTMLCanvasElement){const st=canvas.captureStream(15);const timer=setInterval(()=>ctx.fillRect(0,0,640,480),66);const t=st.getVideoTracks()[0],stop=t.stop.bind(t);t.stop=()=>{clearInterval(timer);stop()};return st}
 }}}));
 await page.goto('/');await expect(page.getByText('Tangan belum terdeteksi',{exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('');await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('model worker consumes both hands rather than the first hand only',async({page})=>{
 await page.goto('/');const output=await page.evaluate(async()=>{
  await(await fetch('/models/twohand-v1/model.json')).json();
  const fixture=await(await fetch('/models/twohand-v1/smoke-fixture.json')).json();
  return new Promise<any>((resolve,reject)=>{const worker=new Worker('/src/recognition/worker.ts',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('timeout'))},10000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message))};worker.onmessage=e=>{if(e.data.type==='ready')worker.postMessage({type:'frame',hands:fixture.hands});else{clearTimeout(timer);worker.terminate();resolve({...e.data,expected:fixture.label})}};worker.postMessage({type:'load'})});
 });
 expect(output.handCount).toBe(2);expect(output.prediction.label).toBe(output.expected);expect(output.prediction.confidence).toBeGreaterThanOrEqual(.75);
});
test('desktop/mobile layout and transparent reference sources',async({page})=>{
 await page.goto('/');await page.setViewportSize({width:1440,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Kamus',exact:true}).click();await expect(page.getByRole('link',{name:'Sumber: Rhio Sutoyo dan tim (MIT)'})).toBeVisible();await expect(page.getByRole('link',{name:'Asal setiap foto'})).toBeVisible();
});

test('real A recognition survives a 16:9 camera with letterboxed input',async({page})=>{
 await referenceStream(page,'A',true);await page.goto('/');
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('A',{timeout:20000});
 await expect(page.getByText('1280 × 720 · rasio dikoreksi')).toBeVisible();
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('personal calibration persists, suppresses training output, requires hand release, then uses fresh inference',async({page})=>{
 await referenceStream(page,'A',true);await page.goto('/');
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('A',{timeout:20000});
 await page.getByRole('button',{name:'Simpan contoh pribadi A',exact:true}).click();
 await expect(page.getByText('8 contoh pribadi tersimpan.',{exact:false})).toBeVisible({timeout:15000});
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('');
 await page.waitForTimeout(800);await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('');
 await page.evaluate(()=>(window as any).__setTestBlank(true));
 await expect(page.getByText('Siap menguji A.',{exact:false})).toBeVisible({timeout:10000});
 await page.evaluate(()=>(window as any).__setTestBlank(false));
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('A',{timeout:15000});
 await expect(page.getByText('Model menggunakan contoh pribadi yang Anda beri label.')).toBeVisible();
 await page.reload();await expect(page.getByText('8 contoh pribadi tersimpan.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Pengaturan',exact:true}).click();
 await page.getByRole('button',{name:'Hapus semua contoh pribadi'}).click();
 await expect(page.getByText('Contoh pribadi dihapus.',{exact:false})).toBeVisible();
 await page.reload();await expect(page.getByText('0 contoh pribadi tersimpan.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('hand count is visible directly on preview from actual landmark detection',async({page})=>{
 await referenceStream(page,'A');await page.goto('/');
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('Pelacak: 2/2 tangan',{timeout:20000});
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('Pelacak: 0/2 tangan');
});
test('single-hand C remains one tracked hand with recovery enabled',async({page})=>{
 await referenceStream(page,'C');await page.goto('/');
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('C',{timeout:20000});
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('Pelacak: 1/2 tangan');
 await page.waitForTimeout(800);await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('Pelacak: 1/2 tangan');
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('tracker finds two hands in A previously missed by IMAGE extraction',async({page})=>{
 await referenceStream(page,'A');
 await page.route('**/ref/A/a_da7115.jpg',async route=>{const r=await page.request.get('/ref/tracking-fixture-A.jpg');await route.fulfill({response:r})});
 await page.goto('/');
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('Pelacak: 2/2 tangan',{timeout:20000});
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('missing-hand fixture records the actual primary and recovery counts',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const{FilesetResolver}=await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
  const{TwoHandTracker}=await import('/src/recognition/TwoHandTracker.ts');
  const img=new Image();img.src='/ref/tracking-fixture-H.jpg';await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d')!.drawImage(img,0,0);
  const stream=c.captureStream(15),v=document.createElement('video');v.muted=true;v.srcObject=stream;await v.play();
  const tracker=await TwoHandTracker.create(await FilesetResolver.forVisionTasks('/mediapipe/wasm'));
  try{const r=tracker.detect(v,performance.now());return{primary:r.primaryHandCount,final:r.landmarks.length,recovered:r.recovered}}finally{tracker.close();stream.getTracks().forEach(t=>t.stop())}
 });
 console.log('Actual tracker recovery:',result);expect(result.final).toBe(2);if(result.primary<2)expect(result.recovered).toBe(true);
});
test('horizontally mirrored live camera stream for A still commits A',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'mediaDevices',{value:{enumerateDevices:()=>Promise.resolve([]),getUserMedia:async()=>{
   const img=new Image();img.src='/ref/A/a_da7115.jpg';await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
   const ctx=canvas.getContext('2d')!;
   const draw=()=>{ctx.save();ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(img,0,0);ctx.restore()};
   draw();const stream=canvas.captureStream(15);
   const timer=setInterval(draw,66),track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
   track.stop=()=>{clearInterval(timer);stop()};return stream;
  }}});
 });
 await page.goto('/');
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('A',{timeout:20000});
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('sequential signs A through F commit ABCDEF in a single camera session',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'mediaDevices',{value:{enumerateDevices:()=>Promise.resolve([]),getUserMedia:async()=>{
   const imgs:Record<string,HTMLImageElement>={};
   for(const l of ['A','B','C','D','E','F']){const img=new Image();img.src=`/ref/${l}/${l.toLowerCase()}_da7115.jpg`;await img.decode();imgs[l]=img}
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
   const ctx=canvas.getContext('2d')!;let current='A';
   const draw=()=>{
    const img=imgs[current];ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    const scale=Math.min(canvas.width/img.width,canvas.height/img.height);
    ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);
   };
   (window as any).__setSignLetter=(l:string)=>{current=l;draw()};
   draw();const stream=canvas.captureStream(15);
   const timer=setInterval(draw,66),track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
   track.stop=()=>{clearInterval(timer);stop()};return stream;
  }}});
 });
 await page.goto('/');
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('A',{timeout:20000});
 await page.evaluate(()=>(window as any).__setSignLetter('B'));
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('AB',{timeout:20000});
 await page.evaluate(()=>(window as any).__setSignLetter('C'));
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('ABC',{timeout:20000});
 await page.evaluate(()=>(window as any).__setSignLetter('D'));
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('ABCD',{timeout:20000});
 await page.evaluate(()=>(window as any).__setSignLetter('E'));
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('ABCDE',{timeout:20000});
 await page.evaluate(()=>(window as any).__setSignLetter('F'));
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('ABCDEF',{timeout:20000});
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('Bhasantara integration translates spelled text across regional languages and transliterates to Aksara Nusantara',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'+ TERIMA KASIH'}).click();
 await expect(page.getByRole('textbox',{name:'HASIL EJAAN'})).toHaveValue('TERIMA KASIH');
 await expect(page.getByTestId('regional-translation-output')).toHaveText('Suwun');
 await page.getByRole('button',{name:'Krama',exact:true}).click();
 await expect(page.getByTestId('regional-translation-output')).toHaveText('Matur nuwun');
 await expect(page.getByTestId('live-aksara-output')).toHaveText('ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀');
 await page.getByRole('combobox',{name:'Pilih bahasa daerah'}).selectOption('sun');
 await expect(page.getByTestId('regional-translation-output')).toHaveText('Hatur nuhun');
 await expect(page.getByTestId('live-aksara-output')).toHaveText('ᮠᮒᮥᮁ ᮔᮥᮠᮥᮔ᮪');
 await page.getByRole('button',{name:'Kamus',exact:true}).click();
 await page.getByRole('tab',{name:'Aksara Jawa'}).click();
 await expect(page.getByTestId('aksara-converter-result')).toHaveText('ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀');
 await page.getByRole('tab',{name:'Aksara Bali'}).click();
 await expect(page.getByTestId('aksara-converter-result')).toContainText('ᬫᬢᬸᬂ');
 await page.getByRole('button',{name:'Sampurasun (Sunda)'}).click();
 await expect(page.getByTestId('cultural-literacy-card')).toContainText('Sampura ning ingsun');
});
test('single-screen cockpit fits 100% within desktop viewports with zero scroll (1440x900, 1366x768, and 1280x720)',async({page})=>{
 await referenceStream(page,'A',true);
 for(const vp of [{width:1440,height:900},{width:1366,height:768},{width:1280,height:720}]){
  await page.setViewportSize(vp);
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:'+ TERIMA KASIH'}).click();
  await expect(page.getByTestId('regional-translation-output')).toBeVisible();
  await expect(page.getByTestId('live-aksara-output')).toBeVisible();
  const docFit=await page.evaluate(()=>({
   scrollH:document.documentElement.scrollHeight,
   innerH:window.innerHeight,
   scrollW:document.documentElement.scrollWidth,
   innerW:window.innerWidth,
  }));
  expect(docFit.scrollH).toBeLessThanOrEqual(docFit.innerH);
  expect(docFit.scrollW).toBeLessThanOrEqual(docFit.innerW);
  const leftBox=await page.locator('.studio-left-card').boundingBox();
  const rightBox=await page.locator('.cockpit-results').boundingBox();
  const transcriptBox=await page.locator('#transcript').boundingBox();
  expect(rightBox!.width).toBeGreaterThan(leftBox!.width);
  expect(transcriptBox!.height).toBeGreaterThanOrEqual(56);
  expect(transcriptBox!.height).toBeLessThanOrEqual(62);
  for(const sel of ['.camera','.camera-help','#transcript','[data-testid="pivot-indonesian-output"]','[data-testid="regional-translation-output"]','[data-testid="live-aksara-output"]']){
   const box=await page.locator(sel).boundingBox();
   expect(box,`${sel} at ${vp.width}x${vp.height}`).not.toBeNull();
   expect(box!.y,`${sel} top >= 0 at ${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(0);
   expect(box!.y+box!.height,`${sel} bottom <= ${vp.height} at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(vp.height);
  }
  await page.getByRole('button',{name:'Hentikan kamera'}).click();
 }
});
test('dual input mode: direct regional-to-regional text flow, swap button, and conditional Aksara visibility',async({page})=>{
 await referenceStream(page,'A');
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
 // Switching to direct text automatically turns off the live camera
 await page.getByTestId('mode-text-btn').click();
 expect(await page.evaluate(()=>(window as any).__testStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
 // Direct Javanese -> Sundanese (Krama) via Indonesian pivot
 await page.getByRole('combobox',{name:'Pilih bahasa daerah'}).selectOption('sun');
 await page.getByRole('button',{name:'Krama',exact:true}).click();
 await page.getByRole('textbox',{name:'TEKS SUMBER'}).fill('Aku mangan sega');
 await expect(page.getByTestId('detected-language-badge')).toContainText('Terdeteksi: Bahasa Jawa');
 await expect(page.getByTestId('pivot-indonesian-output')).toHaveText('saya makan nasi');
 await expect(page.getByTestId('regional-translation-output')).toHaveText('Abdi neda sangu');
 await expect(page.getByTestId('native-aksara-card')).toBeVisible();
 await expect(page.getByTestId('live-aksara-output')).toContainText('ᮃᮘ᮪ᮓᮤ');
 // Swap direction: Sundanese -> Javanese (Krama)
 await page.getByRole('button',{name:'Tukar bahasa sumber dan tujuan'}).click();
 await expect(page.getByTestId('regional-translation-output')).toHaveText('Kula nedha sekul');
 await expect(page.getByTestId('live-aksara-output')).toContainText('ꦏꦸꦭ');
 // Conditional Aksara: Batak Toba hides Aksara card and shows honest Latin note
 await page.getByRole('combobox',{name:'Pilih bahasa daerah'}).selectOption('bbc');
 await expect(page.getByTestId('native-aksara-card')).toHaveCount(0);
 await expect(page.getByTestId('no-aksara-note')).toContainText('Batak Toba belum tersedia');
});
