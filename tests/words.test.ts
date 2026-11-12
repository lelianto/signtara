import { describe, it, expect } from 'vitest';
import {
  rawFrame, toSequence, dtw, sequenceDistance, EXTRA_HAND_PENALTY, matchWord, crossValidate, wordThresholds, SignSegmenter, validSequence,
  STEPS, FRAME_SIZE, type RawFrame, type WordTemplate,
} from '../src/recognition/sequence';
import { normalizeWord, wordConceptId, SUGGESTED_WORDS } from '../src/recognition/vocabulary';
import { validWordTemplate } from '../src/storage/wordTemplates';
import { SEQUENCE_VERSION } from '../src/recognition/sequence';
import { translateText } from '../src/language';
import type { Point } from '../src/recognition/twoHand';

/** Synthetic hand: `curl` bends the finger points toward the wrist (0 = open palm, 1 = fist). */
function hand(cx: number, cy: number, size = 0.1, curl = 0): Point[] {
  return Array.from({ length: 21 }, (_, i) => {
    if (i === 0) return { x: cx, y: cy, z: 0 };
    const finger = Math.floor((i - 1) / 4), joint = ((i - 1) % 4) + 1;
    const reach = joint * size * 0.25 * (1 - curl * 0.7 * (joint / 4));
    return { x: cx + (finger - 2) * size * 0.2, y: cy - reach, z: 0 };
  });
}
const SIZE = { width: 640, height: 480 };

/** A sign: hand path over time `path(u)` for u in [0,1], sampled at `fps` for `ms`. */
function sign(path: (u: number) => Point[][], ms = 1000, fps = 30, t0 = 0): RawFrame[] {
  const n = Math.round((ms / 1000) * fps);
  return Array.from({ length: n + 1 }, (_, i) => rawFrame(path(i / n), SIZE, t0 + (i * ms) / n));
}
const circle = (u: number) => [hand(0.5 + 0.08 * Math.cos(u * 2 * Math.PI), 0.5 + 0.08 * Math.sin(u * 2 * Math.PI))];
const downward = (u: number) => [hand(0.5, 0.35 + 0.3 * u)];
const fistTap = (u: number) => [hand(0.5, 0.5 + 0.05 * Math.sin(u * 4 * Math.PI), 0.1, 1)];
const twoHands = (u: number) => [hand(0.35 + 0.1 * u, 0.5), hand(0.65 - 0.1 * u, 0.5)];

const tpl = (id: string, word: string, frames: RawFrame[]): WordTemplate =>
  ({ id, word, conceptId: wordConceptId(word), sequence: toSequence(frames) });

describe('word sequence features', () => {
  it('produces a fixed-size sequence', () => {
    const s = toSequence(sign(circle));
    expect(s).toHaveLength(STEPS);
    expect(s.every((f) => f.length === FRAME_SIZE)).toBe(true);
    expect(validSequence(s)).toBe(true);
  });

  it('is invariant to where the signer stands and how close they are', () => {
    const near = toSequence(sign(circle));
    const moved = toSequence(sign((u) => circle(u).map((h) => h.map((p) => ({ x: p.x * 1.5 - 0.2, y: p.y * 1.5 - 0.2, z: p.z })))));
    near.forEach((f, i) => f.forEach((v, j) => expect(v).toBeCloseTo(moved[i][j], 6)));
  });

  it('is robust to frame rate and signing speed', () => {
    const ref = toSequence(sign(circle, 1000, 30));
    expect(dtw(ref, toSequence(sign(circle, 1000, 12)))).toBeLessThan(0.1);
    // Slow start, fast finish: DTW should absorb the non-linear timing.
    const warped = toSequence(sign((u) => circle(u * u), 1500, 30));
    expect(dtw(ref, warped)).toBeLessThan(dtw(ref, toSequence(sign(downward))) / 3);
  });

  it('keeps a hand in its slot when the other hand drops out briefly', () => {
    const frames = sign(twoHands, 1000, 30);
    const withDropout = frames.map((f, i) => (i === 10 ? { ...f, hands: [f.hands[1]] } : f));
    const seq = toSequence(withDropout);
    // The surviving hand (image-right) must stay in slot 1; slot 0 is empty at that step.
    const step = seq.findIndex((f) => f[44] === 0);
    expect(step).toBeGreaterThan(-1);
    expect(seq[step][89]).toBe(1);
  });

  it('ignores a phantom second hand that appears in only a few frames', () => {
    const clean = toSequence(sign(circle));
    const noisy = toSequence(sign(circle).map((f, i) => (i % 6 === 0 ? { ...f, hands: [...rawFrame([hand(0.1, 0.8)], SIZE, f.t).hands, ...f.hands] } : f)));
    expect(dtw(clean, noisy)).toBeLessThan(0.02);
  });

  it('tolerates a resting hand in view at a fixed extra cost', () => {
    const oneHand = toSequence(sign(circle));
    const withRest = toSequence(sign((u) => [hand(0.15, 0.8), ...circle(u)]));
    expect(dtw(oneHand, withRest)).toBeGreaterThan(0.5);
    const d = sequenceDistance(oneHand, withRest);
    expect(d).toBeGreaterThanOrEqual(EXTRA_HAND_PENALTY);
    expect(d).toBeLessThan(EXTRA_HAND_PENALTY + 0.05);
    // A different one-hand movement must stay far even when the extra hand is ignored.
    expect(sequenceDistance(toSequence(sign(downward)), withRest)).toBeGreaterThan(0.3);
  });

  it('rejects malformed landmarks', () => {
    expect(() => rawFrame([[{ x: NaN, y: 0, z: 0 }]], SIZE, 0)).toThrow();
    expect(() => rawFrame([hand(0.5, 0.5)], { width: 0, height: 480 }, 0)).toThrow();
    expect(() => toSequence([])).toThrow();
  });
});

describe('DTW word matching', () => {
  const templates = [
    tpl('c1', 'makan', sign(circle, 1000)), tpl('c2', 'makan', sign(circle, 1200)),
    tpl('d1', 'minum', sign(downward, 900)), tpl('d2', 'minum', sign(downward, 1100)),
    tpl('f1', 'sakit', sign(fistTap, 1000)), tpl('f2', 'sakit', sign(fistTap, 800)),
  ];

  it('recognizes each word from a new attempt at a different speed', () => {
    expect(matchWord(toSequence(sign(circle, 1400, 24)), templates)).toMatchObject({ accepted: true, word: 'makan' });
    expect(matchWord(toSequence(sign(downward, 700, 24)), templates)).toMatchObject({ accepted: true, word: 'minum' });
    expect(matchWord(toSequence(sign(fistTap, 1100, 24)), templates)).toMatchObject({ accepted: true, word: 'sakit' });
  });

  it('rejects a sign that matches nothing recorded', () => {
    const m = matchWord(toSequence(sign(twoHands)), templates);
    expect(m.accepted).toBe(false);
    expect(m.reason).toBe('too_far');
  });

  it('reports no templates instead of guessing', () => {
    expect(matchWord(toSequence(sign(circle)), [])).toMatchObject({ accepted: false, reason: 'no_templates' });
  });

  it('derives per-word thresholds from the user\'s own repetitions', () => {
    const th = wordThresholds(templates);
    expect(th.get('WORD_MAKAN')).toBeGreaterThanOrEqual(0.2);
    expect(th.get('WORD_MAKAN')).toBeLessThanOrEqual(0.9);
  });

  it('cross-validates recordings against each other', () => {
    const r = crossValidate(templates);
    expect(r.tested).toBe(6);
    expect(r.correct).toBe(6);
    expect(crossValidate([templates[0]]).tested).toBe(0);
  });
});

describe('isolated sign segmentation', () => {
  const empty = (t: number): RawFrame => ({ t, hands: [] });
  function run(frames: RawFrame[]) {
    const seg = new SignSegmenter();
    return frames.map((f) => seg.push(f));
  }

  it('emits one segment after the hands are lowered', () => {
    const body = sign(circle, 1000, 30, 100);
    const tail = Array.from({ length: 15 }, (_, i) => empty(1100 + (i + 1) * 33));
    const events = run([empty(0), empty(33), ...body, ...tail]);
    const segments = events.filter((e) => e.type === 'segment');
    expect(segments).toHaveLength(1);
    const s = segments[0] as Extract<typeof segments[0], { type: 'segment' }>;
    expect(s.frames.every((f) => f.hands.length > 0)).toBe(true);
    expect(s.duration).toBeCloseTo(1000, -1);
  });

  it('tolerates a short tracker dropout inside a sign', () => {
    const body = sign(circle, 1000, 30).map((f, i) => (i >= 10 && i <= 13 ? { ...f, hands: [] } : f));
    const tail = Array.from({ length: 15 }, (_, i) => empty(1000 + (i + 1) * 33));
    expect(run([...body, ...tail]).filter((e) => e.type === 'segment')).toHaveLength(1);
  });

  it('rejects flickers and over-long signs', () => {
    const blip = sign(circle, 150, 30);
    const tail = Array.from({ length: 15 }, (_, i) => empty(150 + (i + 1) * 33));
    expect(run([...blip, ...tail]).some((e) => e.type === 'rejected' && e.reason === 'too_short')).toBe(true);
    const long = sign(circle, 5000, 30);
    const events = run(long);
    expect(events.some((e) => e.type === 'rejected' && e.reason === 'too_long')).toBe(true);
    expect(events.filter((e) => e.type === 'segment')).toHaveLength(0);
  });
});

describe('word vocabulary and storage contract', () => {
  it('normalizes words and builds concept ids', () => {
    expect(normalizeWord('  Terima   Kasih ')).toBe('terima kasih');
    expect(wordConceptId('terima kasih')).toBe('WORD_TERIMA_KASIH');
    expect(normalizeWord('<script>')).toBe('');
    expect(normalizeWord('a'.repeat(31))).toBe('');
    expect(SUGGESTED_WORDS.every((w) => normalizeWord(w) === w)).toBe(true);
  });

  it('validates stored templates', () => {
    const t = { ...tpl('x', 'makan', sign(circle)), capturedAt: 1, sequenceVersion: SEQUENCE_VERSION, source: 'personal' };
    expect(validWordTemplate(t)).toBe(true);
    expect(validWordTemplate({ ...t, sequenceVersion: 'old' })).toBe(false);
    expect(validWordTemplate({ ...t, conceptId: 'WORD_MINUM' })).toBe(false);
    expect(validWordTemplate({ ...t, sequence: t.sequence.slice(1) })).toBe(false);
  });

  it('recognized words flow into the regional translation engine', () => {
    const r = translateText({ text: 'saya mau makan', sourceLang: 'id', targetLang: 'jv', register: 'ngoko', inputMode: 'sign' });
    expect(r.translatedText.toLowerCase()).toContain('mangan');
  });
});
