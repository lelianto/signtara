/**
 * Few-shot simulation for PERSONAL words, on signers the model never saw (WL-BISINDO s3, s4)
 * and including words the model never learned (eval-model.json hiddenWords).
 *
 * Protocol per trial: a signer "teaches" 10 random words with 3 recordings each; the other 7
 * takes of those words are positives; 2 takes from each of 8 untaught words are unknowns.
 * Compares: (A) wordseq-v1 DTW on hand landmarks (current personal matcher) and
 * (B) cosine nearest neighbour on the words-v1 embedding of holistic features.
 *
 * Build & run: npm run ml:words:fewshot   (needs ml/words/out/eval-model.json and raw/*.ndjson)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { headAngles, holisticSequence, pickBlendshapes, trimToActive, trimToHands, type HolisticRaw } from '../../src/recognition/holistic';
import { embedWord, embeddingDistance, validateWordModel, type WordModel } from '../../src/recognition/wordModel';
import { matchWord, rawFrame, toSequence, wordThresholds, type WordTemplate } from '../../src/recognition/sequence';

const ROOT = resolve(process.argv[2] || '.');
const OUT = join(ROOT, 'ml/words/out');
const modelPath = process.argv[3] ? resolve(process.argv[3]) : join(OUT, 'eval-model.json');
const model = JSON.parse(readFileSync(modelPath, 'utf8')) as WordModel & { hiddenWords?: string[] };
validateWordModel(model);
const hidden = new Set(model.hiddenWords ?? []);

interface Video { id: string; signer: string; label: string; emb: number[]; hand: number[][] }
const videos: Video[] = [];
for (const line of readFileSync(join(OUT, 'raw/wl-bisindo.ndjson'), 'utf8').split('\n')) {
  if (!line) continue;
  const v = JSON.parse(line);
  if (v.signer !== 's3' && v.signer !== 's4') continue;
  if (videos.some((x) => x.id === v.id)) continue;
  const frames: HolisticRaw[] = v.frames.map((f: any) => ({
    t: f.t, width: v.width, height: v.height,
    hands: f.h.map((h: number[][]) => h.map(([x, y, z]) => ({ x, y, z }))),
    pose: f.p ? f.p.map(([x, y, z, visibility]: number[]) => ({ x, y, z, visibility })) : null,
    blend: f.b ? pickBlendshapes(f.b.map(([categoryName, score]: [string, number]) => ({ categoryName, score }))) : null,
    head: f.m ? headAngles(f.m) : null,
  }));
  const active = trimToActive(frames), visible = trimToHands(frames);
  if (active.length < 6 || visible.length < 6) continue;
  videos.push({
    id: v.id, signer: v.signer, label: v.label,
    emb: embedWord(model, holisticSequence(active)),
    hand: toSequence(visible.map((f) => rawFrame(f.hands, { width: f.width, height: f.height }, f.t))),
  });
}
console.log(`${videos.length} videos from unseen signers s3/s4`);

let seed = 99;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const shuffle = <T>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

interface Obs { kind: 'pos' | 'unk'; truth: string; hiddenWord: boolean; d1: number; d2: number; pred: string; dtwAccepted: boolean; dtwPred?: string }
const obs: Obs[] = [];
const TRIALS = 12;
for (const signer of ['s3', 's4']) {
  const mine = videos.filter((v) => v.signer === signer);
  const labels = [...new Set(mine.map((v) => v.label))];
  for (let trial = 0; trial < TRIALS; trial++) {
    const order = shuffle(labels);
    const taught = order.slice(0, 10), untaught = order.slice(10, 18);
    const templates: { label: string; v: Video }[] = [];
    const queries: { kind: 'pos' | 'unk'; v: Video }[] = [];
    for (const w of taught) {
      const takes = shuffle(mine.filter((v) => v.label === w));
      takes.slice(0, 3).forEach((v) => templates.push({ label: w, v }));
      takes.slice(3).forEach((v) => queries.push({ kind: 'pos', v }));
    }
    for (const w of untaught) shuffle(mine.filter((v) => v.label === w)).slice(0, 2).forEach((v) => queries.push({ kind: 'unk', v }));
    const dtwTemplates: WordTemplate[] = templates.map((t, i) => ({ id: `t${i}`, word: t.label, conceptId: t.label, sequence: t.v.hand }));
    const th = wordThresholds(dtwTemplates);
    for (const q of queries) {
      const best = new Map<string, number>();
      for (const t of templates) {
        const d = embeddingDistance(q.v.emb, t.v.emb);
        if (d < (best.get(t.label) ?? Infinity)) best.set(t.label, d);
      }
      const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
      const m = matchWord(q.v.hand, dtwTemplates, th);
      obs.push({ kind: q.kind, truth: q.v.label, hiddenWord: hidden.has(q.v.label), d1: ranked[0][1], d2: ranked[1][1], pred: ranked[0][0], dtwAccepted: m.accepted, dtwPred: m.word });
    }
  }
}

const pos = obs.filter((o) => o.kind === 'pos'), unk = obs.filter((o) => o.kind === 'unk');
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const summary: Record<string, unknown> = {
  protocol: `${TRIALS} trials × 2 unseen signers; 10 taught words × 3 recordings; 7 positives/word; 16 unknown queries/trial`,
  positives: pos.length, unknowns: unk.length,
  embeddingTop1: pct(pos.filter((o) => o.pred === o.truth).length, pos.length),
  embeddingTop1HiddenWords: pct(pos.filter((o) => o.hiddenWord && o.pred === o.truth).length, pos.filter((o) => o.hiddenWord).length),
  dtw: {
    acceptedCorrect: pct(pos.filter((o) => o.dtwAccepted && o.dtwPred === o.truth).length, pos.length),
    acceptedWrong: pct(pos.filter((o) => o.dtwAccepted && o.dtwPred !== o.truth).length, pos.length),
    unknownFalselyAccepted: pct(unk.filter((o) => o.dtwAccepted).length, unk.length),
  },
};
const curve = [];
for (const maxD of [0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2]) {
  for (const minRatio of [0, 0.1, 0.2, 0.3]) {
    const ok = (o: Obs) => o.d1 <= maxD && 1 - o.d1 / o.d2 >= minRatio;
    const acc = pos.filter(ok);
    curve.push({
      maxDistance: maxD, minSeparation: minRatio,
      acceptedCorrect: pct(acc.filter((o) => o.pred === o.truth).length, pos.length),
      acceptedWrong: pct(acc.filter((o) => o.pred !== o.truth).length, pos.length),
      unknownFalselyAccepted: pct(unk.filter(ok).length, unk.length),
    });
  }
}
summary.embeddingCurve = curve;
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
summary.distanceQuantiles = {
  correctPositive: [0.1, 0.5, 0.9].map((p) => +q(pos.filter((o) => o.pred === o.truth).map((o) => o.d1), p).toFixed(3)),
  unknown: [0.1, 0.5, 0.9].map((p) => +q(unk.map((o) => o.d1), p).toFixed(3)),
};
writeFileSync(join(OUT, process.argv[3] ? 'fewshot-release.json' : 'fewshot.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, embeddingCurve: undefined }, null, 1));
for (const c of curve) console.log(JSON.stringify(c));
