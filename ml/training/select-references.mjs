import{readFile,writeFile,copyFile}from'node:fs/promises';import{join,resolve}from'node:path';
const root=resolve(process.argv[2]||'ml/data/source');const data=JSON.parse(await readFile('ml/data/landmarks.json','utf8')),expected=JSON.parse(await readFile('ml/preprocessing/reference-hands.json','utf8'));
const provenance={source:'https://github.com/rhiosutoyo/Indonesian-Sign-Language-BISINDO-Hand-Sign-Detection-Dataset',commit:'e1a48c6caa9d12318c8561e9962da845ab50226e',license:'MIT, Copyright (c) 2024 Rhio Sutoyo',verification:'Research dataset labels; not independently verified by a BISINDO teacher. References are training images, not held-out evaluation images.',entries:{}};
const index={};let smoke;
for(const label of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
 const candidates=data.rows.filter(r=>r.split==='train'&&r.label===label&&r.handCount===expected[label]);
 if(!candidates.length)throw Error(`No complete reference for ${label}`);
 const distance=(a,b)=>Math.sqrt(a.features.reduce((s,v,i)=>s+(v-b.features[i])**2,0)/254);
 const selected=candidates.map(a=>({row:a,mean:candidates.reduce((s,b)=>s+distance(a,b),0)/candidates.length})).sort((a,b)=>a.mean-b.mean)[0].row;
 const alias=`${label.toLowerCase()}_da7115.jpg`;
 await copyFile(join(root,'train',selected.name),`public/ref/${label}/${alias}`);index[label]=[alias];
 provenance.entries[label]={file:`${label}/${alias}`,originalFile:`train/${selected.name}`,sha256:selected.sha256,expectedHands:expected[label],sourceURL:`${provenance.source}/blob/${provenance.commit}/train/${encodeURIComponent(selected.name)}`};
 if(label==='A')smoke={label,hands:selected.hands,source:provenance.entries[label].sourceURL,purpose:'Training-image execution fixture only, not an accuracy benchmark'};
}
await writeFile('public/ref/provenance.json',JSON.stringify(provenance,null,2));await writeFile('public/ref/index.json',JSON.stringify(index,null,2));await writeFile('public/models/twohand-v1/smoke-fixture.json',JSON.stringify(smoke));
console.log('Updated 26 full-resolution references, provenance and A two-hand smoke fixture');
