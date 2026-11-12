/**
 * Browser inference for the trained word-sign classifier (public/models/words-v1/model.json,
 * produced by ml/words/train.py). Mirrors the PyTorch network exactly: standardize →
 * temporal convolutions (BatchNorm folded into weights) with ReLU and residuals →
 * mean+max pooling over time → linear → softmax.
 */
import { HOLISTIC_FRAME_SIZE, HOLISTIC_STEPS, HOLISTIC_VERSION } from './holistic';

export const WORD_MODEL_VERSION = 'words-v1';

export interface ConvLayer { inC: number; outC: number; k: number; dilation: number; residual: boolean; w: number[]; b: number[] }
export interface WordModel {
  version: typeof WORD_MODEL_VERSION;
  featureVersion: string;
  steps: number;
  dims: number;
  classes: string[];
  mean: number[];
  std: number[];
  layers: ConvLayer[];
  head: { inF: number; outF: number; w: number[]; b: number[] };
  thresholds: { minProb: number; minMargin: number };
  datasets: string[];
  licenses: string[];
  license: string;
}

export function validateWordModel(value: unknown): asserts value is WordModel {
  const m = value as WordModel;
  const finite = (a: unknown, n: number) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
  if (!m || m.version !== WORD_MODEL_VERSION || m.featureVersion !== HOLISTIC_VERSION || m.steps !== HOLISTIC_STEPS ||
    m.dims !== HOLISTIC_FRAME_SIZE || !Array.isArray(m.classes) || m.classes.length < 2 ||
    !finite(m.mean, m.dims) || !finite(m.std, m.dims) || !Array.isArray(m.layers) || !m.layers.length) {
    throw Error('Invalid word model contract');
  }
  let channels = m.dims;
  for (const l of m.layers) {
    if (l.inC !== channels || !finite(l.w, l.outC * l.inC * l.k) || !finite(l.b, l.outC) || (l.residual && l.inC !== l.outC)) throw Error('Invalid word model layer');
    channels = l.outC;
  }
  if (m.head.inF !== 2 * channels || m.head.outF !== m.classes.length || !finite(m.head.w, m.head.outF * m.head.inF) || !finite(m.head.b, m.head.outF)) {
    throw Error('Invalid word model head');
  }
}

/** Conv1d with 'same' padding (k//2 * dilation), weights [out][in][k]; input/output [channel][time]. */
function conv(input: Float32Array[], l: ConvLayer, T: number): Float32Array[] {
  const pad = Math.floor(l.k / 2) * l.dilation;
  const out: Float32Array[] = [];
  for (let o = 0; o < l.outC; o++) {
    const row = new Float32Array(T).fill(l.b[o]);
    for (let i = 0; i < l.inC; i++) {
      const x = input[i], base = (o * l.inC + i) * l.k;
      for (let k = 0; k < l.k; k++) {
        const w = l.w[base + k];
        if (w === 0) continue;
        const off = k * l.dilation - pad;
        const t0 = Math.max(0, -off), t1 = Math.min(T, T - off);
        for (let t = t0; t < t1; t++) row[t] += w * x[t + off];
      }
    }
    out.push(row);
  }
  return out;
}

/** Class probabilities for one STEPS × DIMS holistic sequence. */
export function predictWord(model: WordModel, sequence: number[][]): number[] {
  const T = model.steps, D = model.dims;
  if (sequence.length !== T || sequence.some((f) => f.length !== D)) throw Error('Sequence does not match model');
  let h: Float32Array[] = Array.from({ length: D }, (_, d) => {
    const row = new Float32Array(T);
    for (let t = 0; t < T; t++) row[t] = (sequence[t][d] - model.mean[d]) / model.std[d];
    return row;
  });
  for (const l of model.layers) {
    const y = conv(h, l, T);
    for (let c = 0; c < y.length; c++) {
      const row = y[c];
      for (let t = 0; t < T; t++) row[t] = Math.max(0, row[t]) + (l.residual ? h[c][t] : 0);
    }
    h = y;
  }
  const pooled = new Float32Array(2 * h.length);
  h.forEach((row, c) => {
    let sum = 0, max = -Infinity;
    for (let t = 0; t < T; t++) { sum += row[t]; if (row[t] > max) max = row[t]; }
    pooled[c] = sum / T; pooled[h.length + c] = max;
  });
  const logits = model.head.b.map((b, o) => {
    let s = b;
    for (let i = 0; i < model.head.inF; i++) s += model.head.w[o * model.head.inF + i] * pooled[i];
    return s;
  });
  const top = Math.max(...logits);
  const exp = logits.map((v) => Math.exp(v - top));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

export interface ModelGuess {
  accepted: boolean;
  word: string;
  probability: number;
  margin: number;
  ranking: { word: string; probability: number }[];
}

/** Applies the calibrated thresholds stored with the model (precision-targeted on validation data). */
export function classifyWord(model: WordModel, sequence: number[][]): ModelGuess {
  const probs = predictWord(model, sequence);
  const ranking = probs.map((probability, i) => ({ word: model.classes[i], probability })).sort((a, b) => b.probability - a.probability);
  const [first, second] = ranking;
  const margin = first.probability - (second?.probability ?? 0);
  return {
    accepted: first.probability >= model.thresholds.minProb && margin >= model.thresholds.minMargin,
    word: first.word, probability: first.probability, margin, ranking: ranking.slice(0, 3),
  };
}
