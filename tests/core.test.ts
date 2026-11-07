import{describe,it,expect}from'vitest';import{readFileSync}from'node:fs';import{Stabilizer,cameraError}from'../src/recognition/contracts';import{normalizeLandmarks,predict}from'../src/recognition/jemari';import{indonesian,javanese,concepts}from'../src/language';
describe('recognition state machine',()=>{it('does not guess missing hands',()=>expect(new Stabilizer().push(null).result.status).toBe('no_hand'));it('filters unknown and uncertain predictions',()=>{const s=new Stabilizer();expect(s.push({label:'A',confidence:.2}).result.status).toBe('unknown');expect(s.push({label:'A',confidence:.6}).result.status).toBe('uncertain')});it('requires consensus, suppresses held letters, and releases after no hand',()=>{const s=new Stabilizer();const p={label:'A',confidence:.95};for(let i=0;i<5;i++)expect(s.push(p).commit).toBeUndefined();expect(s.push(p).commit).toBe('A');for(let i=0;i<20;i++)expect(s.push(p).commit).toBeUndefined();s.push(null);for(let i=0;i<5;i++)s.push(p);expect(s.push(p).commit).toBe('A')});it('discards stale votes after uncertain frames',()=>{const s=new Stabilizer();for(let i=0;i<5;i++)s.push({label:'A',confidence:.99});s.push({label:'A',confidence:.1});expect(s.push({label:'A',confidence:.99}).commit).toBeUndefined()});it('explains permission denial',()=>expect(cameraError(new DOMException('denied','NotAllowedError'))).toContain('Izin kamera ditolak'))});
describe('language adapters',()=>{it('switches register with independent adapters',()=>{expect(indonesian.resolve('EAT','ngoko')).toBe('makan');expect(javanese.resolve('EAT','ngoko')).toBe('mangan');expect(javanese.resolve('EAT','krama')).toBe('nedha')});it('preserves letters and missing entries',()=>{expect(javanese.resolve('LETTER_B','krama')).toBe('B');expect(javanese.resolve('UNSUPPORTED','krama')).toBeUndefined()});it('never claims linguistic verification',()=>expect(concepts.every(c=>c.verification==='draft'&&c.source&&c.note)).toBe(true))});
describe('actual bundled model',()=>{it('executes all layers with 63 real feature dimensions',()=>{const model=JSON.parse(readFileSync('public/models/jemari-v1/model.json','utf8'));const features=normalizeLandmarks(Array.from({length:21},(_,i)=>({x:i/40,y:i/60,z:i/100})));const p=predict(model,features)!;expect(features).toHaveLength(63);expect(model.classes).toContain(p.label);expect(p.confidence).toBeGreaterThanOrEqual(0);expect(p.confidence).toBeLessThanOrEqual(1)});it('normalization is translation and scale invariant',()=>{const hand=Array.from({length:21},(_,i)=>({x:i/10,y:i/20,z:i/30}));const f=normalizeLandmarks(hand),g=normalizeLandmarks(hand.map(p=>({x:p.x*2+4,y:p.y*2+3,z:p.z*2+2})));f.forEach((x:number,i:number)=>expect(x).toBeCloseTo(g[i],10))})});

import{extractFeatures,classify,validateModel,mirrorFeatures,FEATURE_COUNT,MODEL_VERSION,MIN_SCORE,MAX_DISTANCE,type Point,type TwoHandModel}from'../src/recognition/twoHand';
const hand=(dx=0,dy=0,scale=1):Point[]=>Array.from({length:21},(_,i)=>({x:dx+(i%5)*.04*scale,y:dy+Math.floor(i/5)*.05*scale,z:i*.001*scale}));
describe('joint two-hand features',()=>{
 it('encodes both hands, independent of detector enumeration order',()=>{
  const left=hand(.1),right=hand(.6);const a=extractFeatures([left,right]);
  expect(a.features).toHaveLength(FEATURE_COUNT);expect(a.handCount).toBe(2);
  expect(a.features).toEqual(extractFeatures([right,left]).features);expect(a.features.slice(-2)).toEqual([1,1]);
 });
 it('preserves relative hand positions instead of normalizing them away',()=>{
  const a=extractFeatures([hand(.1),hand(.6)]),b=extractFeatures([hand(.1),hand(.9)]);
  expect(a.features.slice(0,63)).toEqual(b.features.slice(0,63));
  expect(a.features.slice(63,126)).not.toEqual(b.features.slice(63,126));
 });
 it('is invariant to common translation and scale',()=>{
  const input=[hand(.1,.2),hand(.6,.3)];const a=extractFeatures(input).features;
  const b=extractFeatures(input.map(h=>h.map(p=>({x:p.x*2+3,y:p.y*2+4,z:p.z*2+5})))).features;
  a.forEach((v,i)=>expect(v).toBeCloseTo(b[i],10));
 });
 it('distinguishes missing hands and rejects malformed coordinates',()=>{
  expect(extractFeatures([]).handCount).toBe(0);expect(extractFeatures([hand()]).features.slice(-2)).toEqual([1,0]);
  expect(()=>extractFeatures([[{x:NaN,y:0,z:0}]])).toThrow();expect(()=>extractFeatures([hand(),hand(),hand()])).toThrow();
 });
 it('loads the real retrained artifact and classifies a complete two-hand sample',()=>{
  const model:unknown=JSON.parse(readFileSync('public/models/twohand-v1/model.json','utf8'));validateModel(model);
  const sample=model.samples.find(s=>s.handCount===2)!;expect(sample).toBeDefined();
  expect(classify(model,sample.features,2).prediction?.label).toBe(sample.label);
  expect(classify(model,sample.features,0).prediction).toBeNull();
 });
 it('rejects distant gestures and incompatible model dimensions',()=>{
  const model:TwoHandModel=JSON.parse(readFileSync('public/models/twohand-v1/model.json','utf8'));
  expect(classify(model,Array(FEATURE_COUNT).fill(100),2).prediction?.confidence).toBe(0);
  expect(()=>validateModel({...model,featureCount:63})).toThrow();
  expect(()=>classify(model,[1,2,3],2)).toThrow();
 });
});

import{validPersonalSample}from'../src/storage/calibration';
import{FEATURE_VERSION}from'../src/recognition/twoHand';
describe('live camera geometry and personal examples',()=>{
 it('corrects 16:9 letterboxing to the 4:3 training geometry',()=>{
  const fixture=JSON.parse(readFileSync('public/models/twohand-v1/smoke-fixture.json','utf8'));
  const original=extractFeatures(fixture.hands,{width:640,height:480});
  const wide=fixture.hands.map((h:Point[])=>h.map(p=>({x:p.x*.75+.125,y:p.y,z:p.z*.75})));
  const corrected=extractFeatures(wide,{width:1280,height:720});
  original.features.forEach((v,i)=>expect(v).toBeCloseTo(corrected.features[i],10));
  const model=JSON.parse(readFileSync('public/models/twohand-v1/model.json','utf8'));
  expect(classify(model,corrected.features,2).prediction?.label).toBe('A');
 });
 it('rejects invalid frame sizes instead of producing corrupt features',()=>{
  expect(()=>extractFeatures([hand()],{width:0,height:480})).toThrow('Invalid frame dimensions');
 });
 it('requires valid provenance and finite dimensions for personal samples',()=>{
  const fixture=JSON.parse(readFileSync('public/models/twohand-v1/smoke-fixture.json','utf8'));
  const s={...extractFeatures(fixture.hands),label:'A',id:'test-a',capturedAt:1,source:'personal',featureVersion:FEATURE_VERSION,modelVersion:MODEL_VERSION};
  expect(validPersonalSample(s)).toBe(true);expect(validPersonalSample({...s,featureVersion:'old'})).toBe(false);
  expect(validPersonalSample({...s,features:[NaN]})).toBe(false);expect(validPersonalSample({...s,label:'unverified word'})).toBe(false);
 });
});
describe('visible temporal acceptance diagnostics',()=>{it('distinguishes pending consensus from rejected matching',()=>{
 const s=new Stabilizer();const first=s.push({label:'A',confidence:.8});expect(first.result.status).toBe('uncertain');expect(first.result.stabilityVotes).toBe(1);expect(first.result.stabilityRequired).toBe(6);
 const rejected=s.push({label:'A',confidence:.1});expect(rejected.result.status).toBe('unknown');expect(rejected.result.stabilityVotes).toBe(0);expect(rejected.commit).toBeUndefined();
 for(let i=0;i<5;i++)s.push({label:'A',confidence:.8});const accepted=s.push({label:'A',confidence:.8});expect(accepted.result.stabilityVotes).toBe(6);expect(accepted.commit).toBe('A');
})});

import{mergeDetectedHands,unmirrorHands}from'../src/recognition/handRecovery';
describe('missing-hand recovery',()=>{
 it('does not count duplicate detections of one hand twice',()=>{const h=hand(.1);const jitter=h.map(p=>({...p,x:p.x+.002}));expect(mergeDetectedHands([h],[jitter])).toHaveLength(1)});
 it('adds a genuinely separate hand found by another pass',()=>expect(mergeDetectedHands([hand(.1)],[hand(.6)])).toHaveLength(2));
 it('never fills in absent hands',()=>{expect(mergeDetectedHands([],[])).toHaveLength(0);expect(mergeDetectedHands([hand(.1)],[])).toHaveLength(1)});
 it('restores mirrored detections before classification',()=>{const h=[hand(.1),hand(.6)];const restored=unmirrorHands(unmirrorHands(h));h.forEach((v,i)=>v.forEach((p,j)=>{expect(restored[i][j].x).toBeCloseTo(p.x,10);expect(restored[i][j].y).toBe(p.y);expect(restored[i][j].z).toBe(p.z)}))});
 it('recognizes horizontally mirrored, slightly tilted, and wrist-shifted live poses',()=>{
  const model:TwoHandModel=JSON.parse(readFileSync('public/models/twohand-v1/model.json','utf8'));
  const fixture=JSON.parse(readFileSync('public/models/twohand-v1/smoke-fixture.json','utf8'));
  const mirroredHands=unmirrorHands(fixture.hands as Point[][]);
  const mirrExtract=extractFeatures(mirroredHands);
  const mirrOut=classify(model,mirrExtract.features,mirrExtract.handCount);
  expect(mirrOut.prediction?.label).toBe('A');
  expect(mirrOut.prediction?.confidence).toBeGreaterThanOrEqual(MIN_SCORE);
  const theta=10*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta);
  const tilted=(fixture.hands as Point[][]).map((h,idx)=>h.map(p=>{
   const dx=p.x-h[0].x,dy=p.y-h[0].y;
   return {x:h[0].x+(idx?0.02:-0.02)+dx*cos-dy*sin,y:h[0].y+dx*sin+dy*cos,z:p.z+0.03};
  }));
  const tiltExtract=extractFeatures(tilted);
  const tiltOut=classify(model,tiltExtract.features,tiltExtract.handCount);
  expect(tiltOut.prediction?.label).toBe('A');
  expect(tiltOut.prediction?.confidence).toBeGreaterThanOrEqual(MIN_SCORE);
  expect(mirrorFeatures(mirrorFeatures(tiltExtract.features,2),2).slice(0,252)).toEqual(tiltExtract.features.slice(0,252));
 });
 it('retains consensus progress across a brief borderline frame while clearing on hard rejection',()=>{
  const s=new Stabilizer();
  for(let i=0;i<4;i++)s.push({label:'A',confidence:0.75});
  const dip=s.push({label:'A',confidence:0.28});
  expect(dip.result.status).toBe('uncertain');
  expect(dip.result.stabilityVotes).toBe(4);
  s.push({label:'A',confidence:0.75});
  const done=s.push({label:'A',confidence:0.75});
  expect(done.commit).toBe('A');
 });
 it('recognizes letter D both with index-thumb arc and with a full C-hand plus vertical index finger (unmirrored and mirrored)',()=>{
  const model:TwoHandModel=JSON.parse(readFileSync('public/models/twohand-v1/model.json','utf8'));
  const data=JSON.parse(readFileSync('ml/data/landmarks.json','utf8'));
  const cHand=data.rows.find((r:{label:string;split:string})=>r.label==='C'&&r.split==='train').hands[0] as Point[];
  const dHands=data.rows.find((r:{label:string;split:string})=>r.label==='D'&&r.split==='train').hands as Point[][];
  const d0=dHands[0],d1=dHands[1];
  const rD0=Math.max(...d0.map(p=>Math.hypot(p.x-d0[0].x,p.y-d0[0].y,p.z-d0[0].z)));
  const rC=Math.max(...cHand.map(p=>Math.hypot(p.x-cHand[0].x,p.y-cHand[0].y,p.z-cHand[0].z)));
  const cPlusIndex:Point[][]=[
   cHand.map(p=>({x:d0[0].x-0.05+(p.x-cHand[0].x)*(rD0/rC),y:d0[0].y+0.03+(p.y-cHand[0].y)*(rD0/rC),z:d0[0].z+(p.z-cHand[0].z)*(rD0/rC)})),
   d1
  ];
  const ext=extractFeatures(cPlusIndex);
  const outOrig=classify(model,ext.features,2);
  expect(outOrig.prediction?.label).toBe('D');
  expect(outOrig.prediction?.confidence).toBeGreaterThanOrEqual(MIN_SCORE);
  const outMirr=classify(model,mirrorFeatures(ext.features,2),2);
  expect(outMirr.prediction?.label).toBe('D');
  expect(outMirr.prediction?.confidence).toBeGreaterThanOrEqual(MIN_SCORE);
 });
 it('recognizes letter F across live variations (tendon-pulled ring finger, shifted vertical index hand, mirrored, and wrist-swapped)',()=>{
  const model:TwoHandModel=JSON.parse(readFileSync('public/models/twohand-v1/model.json','utf8'));
  const data=JSON.parse(readFileSync('ml/data/landmarks.json','utf8'));
  const fHands=data.rows.find((r:{label:string;split:string})=>r.label==='F'&&r.split==='train').hands as Point[][];
  const f0=fHands[0],f1=fHands[1];
  const liveF:Point[][]=[
   f0.map((p,idx)=>idx>=13&&idx<=16?{x:p.x+0.032,y:p.y-0.01,z:p.z}:idx<=4?{x:p.x-0.02,y:p.y+0.025,z:p.z}:p),
   f1.map(p=>({x:p.x-0.06,y:p.y-0.04,z:p.z}))
  ];
  const ext=extractFeatures(liveF);
  const outOrig=classify(model,ext.features,2);
  expect(outOrig.prediction?.label).toBe('F');
  expect(outOrig.prediction?.confidence).toBeGreaterThanOrEqual(MIN_SCORE);
  const outMirr=classify(model,mirrorFeatures(ext.features,2),2);
  expect(outMirr.prediction?.label).toBe('F');
  expect(outMirr.prediction?.confidence).toBeGreaterThanOrEqual(MIN_SCORE);
 });
});

import{regionalLanguages,bhasantaraGlossary,LOCALE_PACKS,translateText,translateSpelledText,latinToJavaneseScriptLocal,latinToSundaneseScriptLocal,latinToBalineseScriptLocal,aksaraToLatinLocal,detectRegionalLanguageLocal,analyzeCulturalLiteracy,suggestWords,aksaraGuideData,supportsNativeAksara}from'../src/language';
describe('Bhasantara regional languages and Aksara integration',()=>{
 it('provides 9 Nusantara languages and translates spelled text across registers',()=>{
  expect(regionalLanguages.length).toBeGreaterThanOrEqual(9);
  const jvCasual=translateSpelledText('TERIMA KASIH','jv','ngoko');
  const jvFormal=translateSpelledText('TERIMA KASIH','jv','krama');
  expect(jvCasual.translatedText).toBe('Suwun');
  expect(jvFormal.translatedText).toBe('Matur nuwun');
  expect(jvFormal.aksaraText).toBe('ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀');
  const sunFormal=translateSpelledText('TERIMA KASIH','sun','krama');
  expect(sunFormal.translatedText).toBe('Hatur nuhun');
  const banFormal=translateSpelledText('TERIMA KASIH','ban','krama');
  expect(banFormal.translatedText).toBe('Matur suksma');
  const multiWord=translateSpelledText('SAYA MAKAN','jv','krama');
  expect(multiWord.translatedText.toLowerCase()).toBe('kula nedha');
  const crossRegional=translateSpelledText('Hatur nuhun','jv','krama');
  expect(crossRegional.indonesianText).toBe('terima kasih');
  expect(crossRegional.translatedText).toBe('Matur nuwun');
 });
 it('transliterates Latin <-> Aksara (Jawa, Sunda, Bali), detects regional language, and analyzes cultural literacy',()=>{
  expect(latinToJavaneseScriptLocal('bhasantara')).toBe('ꦨꦱꦤ꧀ꦠꦫ');
  expect(latinToSundaneseScriptLocal('sampurasun')).toBe('ᮞᮙ᮪ᮕᮥᮛᮞᮥᮔ᮪');
  expect(latinToBalineseScriptLocal('bali')).toBe('ᬩᬮᬶ');
  expect(aksaraToLatinLocal('ꦩꦠꦸꦂ ꦤꦸꦮꦸꦤ꧀')).toBe('matur nuwun');
  expect(detectRegionalLanguageLocal('Sampurasun kumaha damang').code).toBe('sun');
  expect(detectRegionalLanguageLocal('Matur nuwun sanget').code).toBe('jv');
  expect(analyzeCulturalLiteracy('sampurasun','sun').etymology).toContain('Sampura ning ingsun');
  expect(suggestWords('TER')).toContain('TERIMA KASIH');
  expect(aksaraGuideData.JAVANESE.Nglegena).toHaveLength(20);
  expect(aksaraGuideData.SUNDANESE.Ngangalagena).toHaveLength(20);
  expect(aksaraGuideData.BALINESE.Wianjana).toHaveLength(20);
 });
 it('enforces database integrity with real computed lexicon counts and zero duplicate idTerms',()=>{
  expect(regionalLanguages.length).toBe(11);
  expect(bhasantaraGlossary.length).toBeGreaterThanOrEqual(4800);
  expect(translateText({text:'abu',targetLang:'jv',register:'ngoko'}).translatedText.toLowerCase()).toBe('awu');
  expect(translateText({text:"Engko' terro ngakan nase'",sourceLang:'mad',targetLang:'id',inputMode:'text'}).translatedText.toLowerCase()).toContain('saya ingin makan nasi');
  expect(translateText({text:'Aku handak mihup danum',sourceLang:'nij',targetLang:'id',inputMode:'text'}).translatedText.toLowerCase()).toContain('saya ingin minum air');
  for(const pack of LOCALE_PACKS){
   const seen=new Set<string>();
   for(const entry of pack.lexicon){
    const key=entry.idTerm.trim().toLowerCase();
    expect(seen.has(key),`Duplicate idTerm "${key}" in ${pack.meta.code}`).toBe(false);
    seen.add(key);
    expect(entry.casual).toBe(entry.casual.trim());
    expect(entry.formal).toBe(entry.formal.trim());
    expect(entry.casual.length).toBeGreaterThan(0);
    expect(entry.formal.length).toBeGreaterThan(0);
    expect(entry.meaning.trim().length).toBeGreaterThan(0);
   }
   if(pack.meta.code!=='id'){
    const meta=regionalLanguages.find(l=>l.code===pack.meta.code)!;
    expect(meta.entriesCount).toBe(`${pack.lexicon.length} kosakata · ${(pack.parallel??[]).length} kalimat`);
   }
  }
 });
 it('translates multi-word regional-to-regional sentences via Bahasa Indonesia pivot',()=>{
  const jvToSunCasual=translateText({text:'Aku mangan sega',sourceLang:'auto',targetLang:'sun',register:'ngoko',inputMode:'text'});
  expect(jvToSunCasual.sourceLang).toBe('jv');
  expect(jvToSunCasual.indonesianText.toLowerCase()).toBe('saya makan nasi');
  expect(jvToSunCasual.translatedText.toLowerCase()).toBe('kuring dahar sangu');

  const jvToSunPolite=translateText({text:'Aku mangan sega',sourceLang:'jv',targetLang:'sun',register:'krama',inputMode:'text'});
  expect(jvToSunPolite.translatedText.toLowerCase()).toBe('abdi neda sangu');

  const sunToJvPolite=translateText({text:'Abdi hoyong nginum cai',sourceLang:'auto',targetLang:'jv',register:'krama',inputMode:'text'});
  expect(sunToJvPolite.sourceLang).toBe('sun');
  expect(sunToJvPolite.indonesianText.toLowerCase()).toBe('saya ingin minum air');
  expect(sunToJvPolite.translatedText.toLowerCase()).toBe('kula badhe ngombe toya');

  const minToBbc=translateText({text:'Ambo pai ka pasa',sourceLang:'min',targetLang:'bbc',register:'ngoko',inputMode:'text'});
  expect(minToBbc.indonesianText.toLowerCase()).toBe('saya pergi ke pasar');
  expect(minToBbc.translatedText.toLowerCase()).toBe('au lao tu onan');

  const bjnToId=translateText({text:'Ulun handak guring',sourceLang:'bjn',targetLang:'id',inputMode:'text'});
  expect(bjnToId.translatedText.toLowerCase()).toBe('saya ingin tidur');
 });
 it('locks sign input mode to Bahasa Indonesia pivot and distinguishes self-polite vs elder honorifics',()=>{
  const signFlow=translateText({text:'SAYA INGIN MINUM AIR',inputMode:'sign',targetLang:'ban',register:'krama'});
  expect(signFlow.sourceLang).toBe('id');
  expect(signFlow.translatedText.toLowerCase()).toBe('titiang meled nginem toya');

  const selfEat=translateText({text:'Saya makan nasi',targetLang:'jv',register:'krama'});
  const elderEat=translateText({text:'Bapak makan nasi',targetLang:'jv',register:'krama'});
  const elderSleep=translateText({text:'Ibu sedang tidur',targetLang:'jv',register:'krama'});
  const withElderPrep=translateText({text:'Saya pergi dengan Bapak',targetLang:'jv',register:'krama'});
  expect(selfEat.translatedText.toLowerCase()).toBe('kula nedha sekul');
  expect(elderEat.translatedText.toLowerCase()).toBe('bapak dhahar sekul');
  expect(elderSleep.translatedText.toLowerCase()).toBe('ibu nembe sare');
  expect(withElderPrep.translatedText.toLowerCase()).toBe('kula kesah kaliyan bapak');

  const sunSelf=translateText({text:'Saya makan',targetLang:'sun',register:'krama'});
  const sunElder=translateText({text:'Ibu makan',targetLang:'sun',register:'krama'});
  expect(sunSelf.translatedText.toLowerCase()).toBe('abdi neda');
  expect(sunElder.translatedText.toLowerCase()).toBe('ibu tuang');
 });
 it('handles Indonesian affixes, possessives, Javanese sandhi, native Aksara availability, and coverage honestly',()=>{
  expect(translateText({text:'rumahku',targetLang:'jv',register:'ngoko'}).translatedText).toBe('omahku');
  expect(translateText({text:'rumahku',targetLang:'jv',register:'krama'}).translatedText).toBe('griya kula');
  expect(translateText({text:'nasinya',targetLang:'jv',register:'ngoko'}).translatedText).toBe('segane');
  expect(translateText({text:'rumahnya',targetLang:'jv',register:'krama'}).translatedText).toBe('griyanipun');
  expect(translateText({text:'Saya memakan nasi dipasar',targetLang:'jv',register:'krama'}).translatedText.toLowerCase()).toBe('kula nedha sekul wonten ing peken');

  expect(supportsNativeAksara('jv')).toBe(true);
  expect(supportsNativeAksara('sun')).toBe(true);
  expect(supportsNativeAksara('ban')).toBe(true);
  expect(supportsNativeAksara('bbc')).toBe(false);
  expect(supportsNativeAksara('min')).toBe(false);

  const bbcRes=translateText({text:'Terima kasih',targetLang:'bbc',register:'krama'});
  expect(bbcRes.hasNativeAksara).toBe(false);
  expect(bbcRes.nativeAksaraText).toBeNull();

  const partial=translateText({text:'Saya makan pizza',targetLang:'jv',register:'ngoko'});
  expect(partial.translatedText.toLowerCase()).toBe('aku mangan pizza');
  expect(partial.untranslatedTokens).toEqual(['pizza']);
  expect(partial.coverage).toBeCloseTo(0.67,2);
 });
});
