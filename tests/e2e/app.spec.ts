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
const draft=(page:Page)=>page.getByTestId('draft');
const nav=(page:Page,name:string)=>page.getByRole('button',{name,exact:true}).first().click();
async function chooseLanguage(page:Page,lang:RegExp,register?:RegExp){
 await page.getByRole('button',{name:/Ganti bahasa tujuan/}).click();
 const sheet=page.getByRole('dialog',{name:'Bahasa tujuan'});
 await sheet.getByRole('radio',{name:lang}).click();
 if(register)await sheet.getByRole('radio',{name:register}).click();
 await sheet.getByRole('button',{name:/^Pakai /}).click();
}

test('navigation, language sheet, register, dictionary and persistent progress',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toContainText('Didengar dalam Bahasa Jawa');
 await page.getByRole('tab',{name:'Ketik'}).click();
 await page.getByRole('textbox',{name:/Tulis dalam/}).fill('terima kasih');
 await expect(page.getByTestId('translation-output')).toHaveText('Suwun');
 await chooseLanguage(page,/^Jawa/,/^Krama/);
 await expect(page.getByRole('button',{name:/sekarang Bahasa Jawa · Krama/})).toBeVisible();
 await expect(page.getByTestId('translation-output')).toHaveText('Matur nuwun');
 await nav(page,'Kamus');await page.getByRole('searchbox',{name:'Cari kamus'}).fill('makan');await expect(page.getByRole('heading',{name:'makan',exact:true}).first()).toBeVisible();
 await nav(page,'Belajar');await expect(page.getByTestId('progress-summary')).toHaveText('0 XP · 0/26 huruf');
 await page.evaluate(async()=>{const{award}=await import('/src/storage/progress.ts');await award('A')});await page.reload();await nav(page,'Belajar');await expect(page.getByTestId('progress-summary')).toHaveText('10 XP · 1/26 huruf');
});
test('the interface uses no native browser dropdowns',async({page})=>{
 await page.goto('/');
 for(const name of ['Bicara','Frasa','Belajar','Kamus','Pengaturan']){await nav(page,name);await expect(page.locator('select')).toHaveCount(0)}
 await page.getByRole('button',{name:/^Pilih kamera/}).click();
 await expect(page.getByRole('dialog',{name:'Pilih kamera'}).getByRole('radio',{name:/Kamera belakang/})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Pilih kamera'})).toBeHidden();
});
test('two-way conversation: speak, partner reply, and show screen',async({page})=>{
 await page.goto('/');
 await page.getByRole('tab',{name:'Ketik'}).click();
 await page.getByRole('textbox',{name:/Tulis dalam/}).fill('Saya mau makan nasi');
 await expect(page.getByTestId('translation-output')).toHaveText('Aku gelem mangan sega');
 await page.getByRole('button',{name:'Ucapkan',exact:true}).last().click();
 const thread=page.getByRole('region',{name:'Percakapan'});
 await expect(thread.getByText('Aku gelem mangan sega')).toBeVisible();
 await page.getByRole('tab',{name:'Balasan'}).click();
 await page.getByPlaceholder('Ketik balasan…').fill('Monggo, sega wonten pawon');
 await page.getByRole('button',{name:'Kirim'}).click();
 await expect(thread.getByText('Monggo, sega wonten pawon')).toBeVisible();
 await expect(thread.getByText(/^Artinya:/)).toBeVisible();
 await thread.getByRole('button',{name:'Tunjukkan'}).click();
 const show=page.getByRole('dialog',{name:'Tunjukkan ke lawan bicara'});
 await expect(show.getByText('Aku gelem mangan sega')).toBeVisible();
 await page.keyboard.press('Escape');await expect(show).toBeHidden();
 await nav(page,'Frasa');await page.getByRole('tab',{name:'Perkenalan'}).click();
 await page.getByRole('button',{name:/^Ucapkan: Halo/}).click();
 await expect(page.getByRole('status').filter({hasText:'ditambahkan ke percakapan'})).toBeVisible();
});
test('camera permission denial on auto-start and manual retry',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>Promise.reject(new DOMException('denied','NotAllowedError')),enumerateDevices:()=>Promise.resolve([])}}));
 await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Izin kamera ditolak.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Izin kamera ditolak.',{exact:false})).toBeVisible();
});
test('missing two-hand model releases camera on auto-start',async({page})=>{
 await referenceStream(page,'A');await page.route('**/models/twohand-v1/model.json',r=>r.fulfill({status:404,body:'missing'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Kamera atau model gagal:',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__testStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
test('camera disconnect is reported after auto-start',async({page})=>{
 await page.addInitScript(()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const stream=canvas.captureStream(10);Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>{setTimeout(()=>stream.getVideoTracks()[0].dispatchEvent(new Event('ended')),1000);return Promise.resolve(stream)},enumerateDevices:()=>Promise.resolve([])}})});
 await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Kamera terputus.',{exact:false})).toBeVisible();
});
for(const letter of ['A','C'])test(`real two-hand pipeline auto-starts, recognizes reference ${letter} and cleans up`,async({page})=>{
 await referenceStream(page,letter);await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
 await expect(draft(page)).toHaveAttribute('data-value',letter,{timeout:15000});
 if(letter==='A')await expect(page.getByRole('status').filter({hasText:'Dua tangan terdeteksi'})).toHaveCount(1);
 // A held pose must not repeatedly append the same letter.
 await page.waitForTimeout(700);await expect(draft(page)).toHaveAttribute('data-value',letter);
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
 await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Tangan belum terlihat',{exact:true})).toBeVisible({timeout:20000});await expect(draft(page)).toHaveAttribute('data-value','');await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('model worker consumes both hands rather than the first hand only',async({page})=>{
 await page.goto('/');const output=await page.evaluate(async()=>{
  await(await fetch('/models/twohand-v1/model.json')).json();
  const fixture=await(await fetch('/models/twohand-v1/smoke-fixture.json')).json();
  return new Promise<any>((resolve,reject)=>{const worker=new Worker('/src/recognition/worker.ts',{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(Error('timeout'))},10000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message))};worker.onmessage=e=>{if(e.data.type==='ready')worker.postMessage({type:'frame',hands:fixture.hands});else{clearTimeout(timer);worker.terminate();resolve({...e.data,expected:fixture.label})}};worker.postMessage({type:'load'})});
 });
 expect(output.handCount).toBe(2);expect(output.prediction.label).toBe(output.expected);expect(output.prediction.confidence).toBeGreaterThanOrEqual(.75);
});
test('mobile and desktop layouts keep the speak action on screen without overflow',async({page})=>{
 await referenceStream(page,'A',true);
 for(const vp of [{width:390,height:844},{width:768,height:1024},{width:1280,height:720},{width:1440,height:900}]){
  await page.setViewportSize(vp);await page.goto('/');
  await page.getByRole('button',{name:'Nyalakan kamera'}).click();
  await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
  const fit=await page.evaluate(()=>({scrollW:document.documentElement.scrollWidth,innerW:innerWidth,scrollH:document.documentElement.scrollHeight,innerH:innerHeight}));
  expect(fit.scrollW,`no horizontal overflow at ${vp.width}`).toBeLessThanOrEqual(fit.innerW);
  expect(fit.scrollH,`Bicara fits the screen at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(fit.innerH);
  const speak=await page.getByRole('button',{name:'Ucapkan',exact:true}).last().boundingBox();
  expect(speak!.y+speak!.height,`Ucapkan visible at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(vp.height);
  await page.getByRole('button',{name:'Hentikan kamera'}).click();
 }
 await page.setViewportSize({width:390,height:844});
 for(const name of ['Frasa','Belajar','Kamus','Pengaturan']){await nav(page,name);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name).toBe(true)}
 await nav(page,'Kamus');await page.getByRole('tab',{name:'Alfabet'}).click();
 await expect(page.getByRole('link',{name:'Sumber: Rhio Sutoyo dan tim (MIT)'})).toBeVisible();await expect(page.getByRole('link',{name:'Asal setiap foto'})).toBeVisible();
});
test('real A recognition survives a 16:9 camera with letterboxed input',async({page})=>{
 await referenceStream(page,'A',true);await page.goto('/');
 await nav(page,'Belajar');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Bagus! Model mengenali huruf A.')).toBeVisible({timeout:20000});
 await expect(page.getByText('1280 × 720 · rasio dikoreksi',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('personal calibration persists, suppresses training output, requires hand release, then uses fresh inference',async({page})=>{
 await referenceStream(page,'A',true);await page.goto('/');
 await nav(page,'Belajar');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByText('Bagus! Model mengenali huruf A.')).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'Simpan contoh pribadi A',exact:true}).click();
 await expect(page.getByText('8 contoh pribadi tersimpan.',{exact:false})).toBeVisible({timeout:15000});
 await page.waitForTimeout(800);await expect(page.locator('.feedback')).not.toContainText('mengenali huruf A');
 await page.evaluate(()=>(window as any).__setTestBlank(true));
 await expect(page.getByText('Siap menguji A.',{exact:false})).toBeVisible({timeout:10000});
 await page.evaluate(()=>(window as any).__setTestBlank(false));
 await expect(page.locator('.feedback')).toContainText(/contoh pribadi A|mengenali huruf A/,{timeout:15000});
 await page.reload();await nav(page,'Belajar');await expect(page.getByText('8 contoh pribadi tersimpan.',{exact:false})).toBeVisible();
 await nav(page,'Pengaturan');
 await page.getByRole('button',{name:'Hapus semua contoh pribadi'}).click();
 await expect(page.getByText('Contoh pribadi dihapus.',{exact:false})).toBeVisible();
 await page.reload();await nav(page,'Belajar');await expect(page.getByText('0 contoh pribadi tersimpan.',{exact:false})).toBeVisible();
});
test('hand count is visible directly on preview from actual landmark detection',async({page})=>{
 await referenceStream(page,'A');await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('2/2 tangan',{timeout:20000});
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('0/2 tangan');
});
test('single-hand C remains one tracked hand with recovery enabled',async({page})=>{
 await referenceStream(page,'C');await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(draft(page)).toHaveAttribute('data-value','C',{timeout:20000});
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('1/2 tangan');
 await page.waitForTimeout(800);await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('1/2 tangan');
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('tracker finds two hands in A previously missed by IMAGE extraction',async({page})=>{
 await referenceStream(page,'A');
 await page.route('**/ref/A/a_da7115.jpg',async route=>{const r=await page.request.get('/ref/tracking-fixture-A.jpg');await route.fulfill({response:r})});
 await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByRole('status',{name:'Jumlah tangan terlacak'})).toHaveText('2/2 tangan',{timeout:20000});
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
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(draft(page)).toHaveAttribute('data-value','A',{timeout:20000});
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
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(draft(page)).toHaveAttribute('data-value','A',{timeout:20000});
 for(const [l,expected] of [['B','AB'],['C','ABC'],['D','ABCD'],['E','ABCDE'],['F','ABCDEF']]){
  await page.evaluate(x=>(window as any).__setSignLetter(x),l);
  await expect(draft(page)).toHaveAttribute('data-value',expected,{timeout:20000});
 }
 await page.getByRole('button',{name:'Hentikan kamera'}).click();
});
test('spelled text is normalized, translated across regional languages and transliterated to Aksara',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'terima kasih',exact:true}).click();
 await expect(draft(page)).toHaveAttribute('data-value','TERIMA KASIH ');
 await expect(page.getByTestId('translation-output')).toHaveText('Suwun');
 await chooseLanguage(page,/^Jawa/,/^Krama/);
 await expect(page.getByTestId('translation-output')).toHaveText('Matur nuwun');
 await expect(page.getByTestId('live-aksara-output')).toHaveText('ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀');
 await chooseLanguage(page,/^Sunda/);
 await expect(page.getByTestId('translation-output')).toHaveText('Hatur nuhun');
 await expect(page.getByTestId('live-aksara-output')).toHaveText('ᮠᮒᮥᮁ ᮔᮥᮠᮥᮔ᮪');
 // Fingerspelling without spaces is split and shown to the user.
 await page.getByRole('button',{name:'Bersihkan ejaan'}).click();
 await page.keyboard.type('SAYAMAKAN');
 await expect(draft(page)).toHaveAttribute('data-value','SAYAMAKAN');
 await expect(page.getByText('Dibaca sebagai',{exact:false})).toContainText('saya makan');
 await page.getByRole('button',{name:'Pakai ejaan asli'}).click();
 await expect(page.getByText('Memakai ejaan asli.',{exact:false})).toBeVisible();
 await nav(page,'Kamus');await page.getByRole('tab',{name:'Aksara'}).click();
 await page.getByRole('tab',{name:'Jawa',exact:true}).click();
 await expect(page.getByTestId('aksara-converter-result')).toHaveText('ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀');
 await page.getByRole('tab',{name:'Bali',exact:true}).click();
 await expect(page.getByTestId('aksara-converter-result')).toContainText('ᬫᬢᬸᬂ');
 await page.getByRole('button',{name:'Sampurasun',exact:true}).click();
 await expect(page.getByTestId('cultural-literacy-card')).toContainText('Sampura ning ingsun');
});
test('typed regional input is auto-detected, typing mode turns the camera off, and Aksara is shown only where it exists',async({page})=>{
 await referenceStream(page,'A');
 await page.goto('/');
 await page.getByRole('button',{name:'Nyalakan kamera'}).click();
 await expect(page.getByRole('button',{name:'Hentikan kamera'})).toBeVisible({timeout:20000});
 await page.getByRole('tab',{name:'Ketik'}).click();
 expect(await page.evaluate(()=>(window as any).__testStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
 await chooseLanguage(page,/^Sunda/,/^Lemes/);
 await page.getByRole('textbox',{name:/Tulis dalam/}).fill('Aku mangan sega');
 await expect(page.getByText('Bahasa Indonesia: Saya makan nasi')).toBeVisible();
 await expect(page.getByTestId('translation-output')).toHaveText('Abdi neda sangu');
 await expect(page.getByTestId('live-aksara-output')).toContainText('ᮃᮘ᮪ᮓᮤ');
 await chooseLanguage(page,/^Batak Toba/);
 await expect(page.getByTestId('live-aksara-output')).toHaveCount(0);
});
test('every modal and page stays within the screen width on small phones',async({page})=>{
 const fits=async(label:string)=>{
  const m=await page.evaluate(()=>{const d=[...document.querySelectorAll('dialog[open]')].pop() as HTMLDialogElement|undefined;const r=d?.getBoundingClientRect();
   return{open:!!d,vw:document.documentElement.clientWidth,doc:document.documentElement.scrollWidth,dlgScroll:d?.scrollWidth??0,dlgClient:d?.clientWidth??0,right:r?Math.round(r.right):0,
    spill:d?[...d.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>r!.right+0.5||b.left<r!.left-0.5)}).length:0}});
  expect(m.open,`${label} open`).toBe(true);
  expect(m.doc,`${label}: page width`).toBeLessThanOrEqual(m.vw);
  expect(m.dlgScroll,`${label}: no sideways scroll inside modal`).toBeLessThanOrEqual(m.dlgClient);
  expect(m.right,`${label}: modal edge`).toBeLessThanOrEqual(m.vw);
  expect(m.spill,`${label}: content spilling out`).toBe(0);
  await page.keyboard.press('Escape');await expect(page.locator('dialog[open]')).toHaveCount(0);
 };
 for(const width of [320,375]){
  await page.setViewportSize({width,height:740});await page.goto('/');
  for(const name of ['Bicara','Frasa','Belajar','Kamus','Pengaturan']){
   await nav(page,name);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${name} at ${width}px`).toBe(true);
  }
  await nav(page,'Bicara');await page.getByRole('button',{name:/^Bahasa tujuan:/}).click();await fits(`Bahasa tujuan ${width}`);
  await nav(page,'Frasa');await page.getByRole('tab',{name:'Perkenalan'}).click();await page.getByRole('button',{name:/^Tunjukkan: /}).first().click();await fits(`Tunjukkan ${width}`);
  await nav(page,'Pengaturan');await page.getByRole('button',{name:/^Pilih kamera/}).click();await fits(`Pilih kamera ${width}`);
  await nav(page,'Belajar');await page.getByText('Kalibrasi & diagnostik').click();await page.getByRole('button',{name:/^Contoh pribadi untuk huruf/}).click();await fits(`Huruf kalibrasi ${width}`);
  await nav(page,'Kamus');await page.getByRole('tab',{name:'Aksara'}).click();await page.getByRole('button',{name:/^Bahasa istilah/}).click();await fits(`Bahasa istilah ${width}`);
 }
});
test('word-sign toggle appears on Bicara once the built-in word model file exists',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('radio',{name:'Kata isyarat'})).toHaveCount(0);
 await page.route('**/models/words-v1/model.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.reload();
 await expect(page.getByRole('radio',{name:'Kata isyarat'})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Ejaan huruf'})).toHaveAttribute('aria-checked','true');
});
