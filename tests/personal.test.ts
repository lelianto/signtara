import { describe, it, expect } from 'vitest';
import { matchEmbedding, crossValidateEmbeddings, PERSONAL_EMBEDDING, type EmbeddedTemplate } from '../src/recognition/personalEmbedding';
import { decideWord } from '../src/recognition/wordDecision';
import { embeddingDistance, normalizeEmbedding } from '../src/recognition/wordModel';
import { validWordTemplate } from '../src/storage/wordTemplates';
import { HOLISTIC_FRAME_SIZE, HOLISTIC_STEPS, HOLISTIC_VERSION } from '../src/recognition/holistic';
import { SEQUENCE_VERSION, STEPS, FRAME_SIZE } from '../src/recognition/sequence';
import type { ModelGuess } from '../src/recognition/wordModel';

/** Unit vector pointing mostly along axis `k`, rotated by `angle` toward axis k+1. */
function unit(k: number, angle = 0, dims = 16): number[] {
  const v = Array(dims).fill(0);
  v[k] = Math.cos(angle); v[(k + 1) % dims] = Math.sin(angle);
  return v;
}
// Cosine distance 1 - cos(angle): 0.05 ≈ 18°, 0.1 ≈ 26°, 0.2 ≈ 37°.
const deg = (d: number) => (d * Math.PI) / 180;
const tpl = (id: string, word: string, embedding: number[]): EmbeddedTemplate => ({ id, word, conceptId: `WORD_${word.toUpperCase()}`, embedding });

const library = [
  tpl('a1', 'sakit', unit(0, deg(0))), tpl('a2', 'sakit', unit(0, deg(8))), tpl('a3', 'sakit', unit(0, deg(-6))),
  tpl('b1', 'tolong', unit(4)), tpl('b2', 'tolong', unit(4, deg(10))),
  tpl('c1', 'obat', unit(8)),
];

describe('personal words in embedding space', () => {
  it('accepts a close repetition of a taught word', () => {
    expect(matchEmbedding(unit(0, deg(12)), library)).toMatchObject({ accepted: true, word: 'sakit' });
  });

  it('offers suggestions in the uncertain band and rejects far signs', () => {
    const mid = matchEmbedding(unit(4, deg(-30)), library); // ~0.13 from tolong (b1 at 0°)
    expect(mid.accepted).toBe(false);
    expect(mid.suggestions).toEqual(['tolong']);
    const far = matchEmbedding(unit(12), library);
    expect(far).toMatchObject({ accepted: false, reason: 'too_far', suggestions: [] });
  });

  it('rejects when two words are equally close', () => {
    const between = normalizeEmbedding(Float32Array.from(unit(0).map((v, i) => v + unit(4)[i] * 0.98)));
    const m = matchEmbedding(between, [tpl('x', 'sakit', unit(0)), tpl('y', 'tolong', unit(4))], undefined, { ...PERSONAL_EMBEDDING, maxDistance: 0.4, suggestDistance: 0.5 });
    expect(m).toMatchObject({ accepted: false, reason: 'ambiguous' });
    expect(m.suggestions).toHaveLength(2);
  });

  it('cross-validates the user\'s own recordings', () => {
    const r = crossValidateEmbeddings(library);
    expect(r.tested).toBe(5); // obat has a single recording and is not tested
    expect(r.correct).toBe(5);
  });

  it('uses cosine distance on unit vectors', () => {
    expect(embeddingDistance(unit(0), unit(0))).toBeCloseTo(0, 10);
    expect(embeddingDistance(unit(0), unit(3))).toBeCloseTo(1, 10);
    const n = normalizeEmbedding(Float32Array.from([3, 4]));
    expect(n[0]).toBeCloseTo(0.6, 10);
  });
});

const guess = (word: string, probability: number, accepted: boolean, suggest: boolean, others = ['makan', 'minum']): ModelGuess => ({
  accepted, suggest, word, probability, margin: probability - 0.1,
  ranking: [{ word, probability }, ...others.map((w) => ({ word: w, probability: 0.05 }))],
});
const model = (g: ModelGuess) => ({ guess: g, minProb: 0.7, minMargin: 0.15 });

describe('word decision', () => {
  it('prefers the user\'s own recordings over the model', () => {
    const r = decideWord({ embedding: matchEmbedding(unit(0, deg(5)), library), model: model(guess('makan', 0.9, true, false)) });
    expect(r).toMatchObject({ accepted: true, word: 'sakit', source: 'personal' });
  });

  it('falls back to the model when no personal word is close', () => {
    const r = decideWord({ embedding: matchEmbedding(unit(12), library), model: model(guess('makan', 0.9, true, false)) });
    expect(r).toMatchObject({ accepted: true, word: 'makan', source: 'model', probability: 0.9 });
  });

  it('merges personal and model suggestions when nothing is confident', () => {
    const r = decideWord({ embedding: matchEmbedding(unit(4, deg(-30)), library), model: model(guess('minum', 0.5, false, true, ['air', 'tolong'])) });
    expect(r.accepted).toBe(false);
    expect(r.suggestions).toEqual(['tolong', 'minum', 'air']);
  });

  it('never accepts on its own when everything rejects', () => {
    const r = decideWord({ embedding: matchEmbedding(unit(12), library), model: model(guess('minum', 0.2, false, false)) });
    expect(r.accepted).toBe(false);
    expect(r.suggestions).toBeUndefined();
    expect(decideWord({})).toMatchObject({ accepted: false, reason: 'no_templates' });
  });
});

describe('stored templates with holistic data', () => {
  const base = {
    id: 'x', word: 'sakit', conceptId: 'WORD_SAKIT', sequence: Array.from({ length: STEPS }, () => Array(FRAME_SIZE).fill(0)),
    capturedAt: 1, sequenceVersion: SEQUENCE_VERSION, source: 'personal' as const,
  };
  it('accepts legacy hand-only and holistic records, rejects malformed holistic data', () => {
    expect(validWordTemplate(base)).toBe(true);
    const holistic = Array.from({ length: HOLISTIC_STEPS }, () => Array(HOLISTIC_FRAME_SIZE).fill(0.1));
    expect(validWordTemplate({ ...base, holistic, holisticVersion: HOLISTIC_VERSION, origin: 'confirmed' })).toBe(true);
    expect(validWordTemplate({ ...base, holistic, holisticVersion: 'wordseq-v1' })).toBe(false);
    expect(validWordTemplate({ ...base, holistic: holistic.slice(1), holisticVersion: HOLISTIC_VERSION })).toBe(false);
  });
});
