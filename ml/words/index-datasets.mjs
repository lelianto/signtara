/**
 * Builds ml/words/out/manifest.json from the downloaded, unzipped datasets in ml/datasets/raw.
 * Each entry: { id, dataset, label (normalized Indonesian gloss), signer, file, path, license }.
 * Usage: node ml/words/index-datasets.mjs [limitPerDataset]
 */
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const RAW = join(ROOT, 'ml/datasets/raw');
const limit = Number(process.argv[2] || Infinity);

export const DATASETS = {
  'bisindo-40-kata-mp4': { license: 'MIT', source: 'https://www.kaggle.com/datasets/anggiyohanespardede/bisindo-40-kata-mp4' },
  'bisindo-dinamis-5kata-b': { license: 'MIT', source: 'https://www.kaggle.com/datasets/muhammaddhiaulhaq/bahasa-isyarat-indonesia-dinamis' },
  'wl-bisindo': { license: 'CC BY-NC 4.0', source: 'https://www.kaggle.com/datasets/glennleonali/wl-bisindo' },
};

const norm = (s) => s.toLowerCase().replace(/[_-]+/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (/\.(mp4|mov|avi|mkv|webm)$/i.test(e.name)) out.push(p);
  }
  return out;
}

/** Dataset-specific label/signer parsing. Returns null to skip a file. */
const PARSERS = {
  // raw_video/<Label>/BISINDO_<Label>_NNN.mp4 — signer not given.
  'bisindo-40-kata-mp4': (rel) => {
    const parts = rel.split('/');
    return { label: norm(parts[parts.length - 2]), signer: 'unknown' };
  },
  // dataset/dinamis/raw_videos/<label>/<n>.mp4 — signer not given.
  'bisindo-dinamis-5kata-b': (rel) => {
    const parts = rel.split('/');
    if (!rel.includes('raw_videos/')) return null;
    return { label: norm(parts[parts.length - 2]), signer: 'unknown' };
  },
  // all videos flat: signer<S>_label<L>_sample<N>.mp4
  'wl-bisindo': (rel) => parseWl(rel),
};

const WL_GLOSS = ['air', 'belajar', 'cari', 'hari', 'ingat', 'lagi', 'maaf', 'makan', 'motor', 'saya', 'terima kasih', 'tuli', 'apa', 'siapa', 'kapan', 'di mana', 'mengapa', 'bagaimana', 'merah', 'kuning', 'hijau', 'hitam', 'dengar', 'berangkat', 'datang', 'teman', 'keluarga', 'rumah', 'pagi', 'siang', 'sore', 'malam'];
function parseWl(rel) {
  // signer<S>_label<L>_sample<N>.mp4 (labels 0–31 in WL_GLOSS order, signers 0–4)
  const m = basename(rel).match(/^signer(\d+)_label(\d+)_sample(\d+)\./i);
  if (!m || !WL_GLOSS[Number(m[2])]) return null;
  return { label: WL_GLOSS[Number(m[2])], signer: `s${Number(m[1])}` };
}

const manifest = [];
const skipped = {};
for (const [dataset, meta] of Object.entries(DATASETS)) {
  const dir = join(RAW, dataset, 'extracted');
  if (!existsSync(dir)) { console.log(`skip ${dataset}: not extracted`); continue; }
  let n = 0;
  for (const path of (await walk(dir)).sort()) {
    const rel = relative(dir, path);
    const parsed = PARSERS[dataset](rel);
    if (!parsed || !parsed.label) { skipped[dataset] = (skipped[dataset] || 0) + 1; continue; }
    if (n++ >= limit) break;
    const id = `${dataset}__${rel.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '_')}`;
    manifest.push({ id, dataset, label: parsed.label, signer: parsed.signer, file: rel, path, license: meta.license });
  }
}
await mkdir(join(ROOT, 'ml/words/out'), { recursive: true });
await writeFile(join(ROOT, 'ml/words/out/manifest.json'), JSON.stringify(manifest, null, 1));
const byDs = {};
for (const v of manifest) (byDs[v.dataset] ??= new Set()).add(v.label);
for (const [d, s] of Object.entries(byDs)) console.log(`${d}: ${manifest.filter((v) => v.dataset === d).length} videos, ${s.size} labels: ${[...s].join(', ')}`);
console.log('skipped', skipped);
