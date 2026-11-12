import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  BLENDSHAPES, HOLISTIC_FRAME_SIZE, HOLISTIC_LAYOUT, HOLISTIC_STEPS, assignHands, headAngles, holisticSequence,
  mirrorRaw, pickBlendshapes, trimToHands, validHolisticRaw, type HolisticRaw, type PosePoint,
} from '../src/recognition/holistic';
import { classifyWord, predictWord, validateWordModel, WORD_MODEL_VERSION, type WordModel } from '../src/recognition/wordModel';
import type { Point } from '../src/recognition/twoHand';

const hand = (cx: number, cy: number, size = 0.08): Point[] =>
  Array.from({ length: 21 }, (_, i) => (i === 0 ? { x: cx, y: cy, z: 0 } : { x: cx + (((i - 1) % 5) - 2) * size * 0.2, y: cy - Math.ceil(i / 5) * size * 0.25, z: 0 }));

/** Upright signer facing the camera: their right side is on the image left. */
function pose(cx = 0.5, cy = 0.55, s = 0.25): PosePoint[] {
  const p: PosePoint[] = Array.from({ length: 33 }, () => ({ x: cx, y: cy + s, z: 0, visibility: 0.9 }));
  p[0] = { x: cx, y: cy - s * 0.8, z: 0, visibility: 0.99 };          // nose
  p[11] = { x: cx + s / 2, y: cy, z: 0, visibility: 0.99 };           // left shoulder
  p[12] = { x: cx - s / 2, y: cy, z: 0, visibility: 0.99 };           // right shoulder
  p[13] = { x: cx + s * 0.7, y: cy + s * 0.6, z: 0, visibility: 0.9 };
  p[14] = { x: cx - s * 0.7, y: cy + s * 0.6, z: 0, visibility: 0.9 };
  p[15] = { x: cx + s * 0.6, y: cy + s * 1.1, z: 0, visibility: 0.9 }; // left wrist (resting)
  p[16] = { x: cx - s * 0.2, y: cy - s * 0.5, z: 0, visibility: 0.9 }; // right wrist (near chin)
  return p;
}
const frame = (t: number, over: Partial<HolisticRaw> = {}): HolisticRaw => {
  const p = pose();
  return { t, width: 640, height: 480, hands: [hand(p[16].x, p[16].y)], pose: p, blend: BLENDSHAPES.map((_, i) => i / 100), head: [0.1, 0.05, -0.02], ...over };
};

describe('holistic features', () => {
  it('has a fixed size and a layout matching the frame', () => {
    const seq = holisticSequence([frame(0), frame(100), frame(200)]);
    expect(seq).toHaveLength(HOLISTIC_STEPS);
    expect(seq[0]).toHaveLength(HOLISTIC_FRAME_SIZE);
    expect(HOLISTIC_LAYOUT.bodyPresent).toBe(HOLISTIC_FRAME_SIZE - 1);
    expect(seq[0][HOLISTIC_LAYOUT.slots[0].present]).toBe(1);   // right hand signing
    expect(seq[0][HOLISTIC_LAYOUT.slots[1].present]).toBe(0);
    expect(seq[0][HOLISTIC_LAYOUT.facePresent]).toBe(1);
    expect(seq[0][HOLISTIC_LAYOUT.bodyPresent]).toBe(1);
  });

  it('assigns hands to anatomical arms by pose wrist, not by image order', () => {
    const p = pose();
    const right = hand(p[16].x, p[16].y), left = hand(p[15].x, p[15].y);
    expect(assignHands(frame(0, { hands: [left, right] }))).toEqual([right, left]);
    expect(assignHands(frame(0, { hands: [left] }))).toEqual([null, left]);
  });

  it('describes positions relative to the body, independent of camera distance and framing', () => {
    const near = holisticSequence([frame(0), frame(100)]);
    const zoom = (q: Point) => ({ ...q, x: 0.3 + q.x * 0.6, y: 0.2 + q.y * 0.6 });
    const far = holisticSequence([frame(0), frame(100)].map((f) => ({ ...f, hands: f.hands.map((h) => h.map(zoom)), pose: f.pose!.map((q) => ({ ...zoom(q), visibility: q.visibility })) })));
    near[0].forEach((v, i) => expect(v).toBeCloseTo(far[0][i], 5));
    const wrist = HOLISTIC_LAYOUT.slots[0].wrist[0];
    expect(near[0][wrist + 1]).toBeLessThan(0); // above the shoulder line (y grows downward)
  });

  it('mirroring twice is the identity and swaps arms and left/right face cues', () => {
    const f = frame(0);
    const back = mirrorRaw(mirrorRaw(f));
    expect(back.pose![16].x).toBeCloseTo(f.pose![16].x, 10);
    expect(back.blend).toEqual(f.blend);
    const m = mirrorRaw(f);
    const sm = holisticSequence([m]), so = holisticSequence([f]);
    expect(sm[0][HOLISTIC_LAYOUT.slots[1].present]).toBe(1);          // now a left-handed sign
    expect(sm[0][HOLISTIC_LAYOUT.slots[1].wrist[0] + 1]).toBeCloseTo(so[0][HOLISTIC_LAYOUT.slots[0].wrist[0] + 1], 6); // same height
    const bl = BLENDSHAPES.indexOf('browDownLeft'), br = BLENDSHAPES.indexOf('browDownRight');
    expect(m.blend![bl]).toBe(f.blend![br]);
    expect(m.head![0]).toBeCloseTo(-f.head![0], 10);
  });

  it('works without a body or face (flags 0) and rejects empty input', () => {
    const seq = holisticSequence([frame(0, { pose: null, blend: null, head: null })]);
    expect(seq[0][HOLISTIC_LAYOUT.bodyPresent]).toBe(0);
    expect(seq[0][HOLISTIC_LAYOUT.facePresent]).toBe(0);
    expect(seq[0].every(Number.isFinite)).toBe(true);
    expect(() => holisticSequence([])).toThrow();
    expect(() => holisticSequence([frame(0, { hands: [], pose: null })])).toThrow();
  });

  it('trims to the span with visible hands', () => {
    const fs = [frame(0, { hands: [] }), frame(1), frame(2, { hands: [] }), frame(3), frame(4, { hands: [] })];
    expect(trimToHands(fs).map((f) => f.t)).toEqual([1, 2, 3]);
    expect(trimToHands([frame(0, { hands: [] })])).toEqual([]);
  });

  it('reads blendshapes by name and head angles from the transform matrix', () => {
    expect(pickBlendshapes([{ categoryName: 'jawOpen', score: 0.7 }])[BLENDSHAPES.indexOf('jawOpen')]).toBe(0.7);
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(headAngles(identity).map((a) => Math.abs(a))).toEqual([0, 0, 0]);
    const yaw = 0.4, rotY = [Math.cos(yaw), 0, -Math.sin(yaw), 0, 0, 1, 0, 0, Math.sin(yaw), 0, Math.cos(yaw), 0, 0, 0, 0, 1];
    expect(headAngles(rotY)[0]).toBeCloseTo(yaw, 6);
    expect(validHolisticRaw(frame(0))).toBe(true);
    expect(validHolisticRaw({ ...frame(0), blend: [1] })).toBe(false);
  });
});

/** Tiny hand-checkable model: one 1×1 conv (identity on feature 0), mean+max pooling, linear head. */
function tinyModel(): WordModel {
  const D = HOLISTIC_FRAME_SIZE;
  const w = Array(2 * D).fill(0); w[0] = 1;            // channel 0 = feature 0, channel 1 = -feature 0
  w[D] = -1;
  return {
    version: WORD_MODEL_VERSION, featureVersion: 'wordseq-v2', steps: HOLISTIC_STEPS, dims: D,
    classes: ['naik', 'turun'], mean: Array(D).fill(0), std: Array(D).fill(1),
    layers: [{ inC: D, outC: 2, k: 1, dilation: 1, residual: false, w, b: [0, 0] }],
    head: { inF: 4, outF: 2, w: [1, 0, 0, 0, 0, 1, 0, 0], b: [0, 0] },   // logits = [mean relu(f0), mean relu(-f0)]
    thresholds: { minProb: 0.6, minMargin: 0.2 }, datasets: [], licenses: [], license: 'test',
  };
}

describe('word model inference', () => {
  it('computes convolution, ReLU, pooling and softmax as specified', () => {
    const m = tinyModel();
    validateWordModel(m);
    const seq = Array.from({ length: HOLISTIC_STEPS }, () => { const r = Array(HOLISTIC_FRAME_SIZE).fill(0); r[0] = 3; return r; });
    const p = predictWord(m, seq);
    expect(p[0]).toBeCloseTo(Math.exp(3) / (Math.exp(3) + 1), 6);
    expect(classifyWord(m, seq)).toMatchObject({ accepted: true, word: 'naik' });
    const flat = seq.map((r) => r.map(() => 0));
    expect(classifyWord(m, flat).accepted).toBe(false); // 50/50 → rejected by the calibrated margin
  });

  it('applies dilation and same padding like PyTorch Conv1d', () => {
    const m = tinyModel();
    const D = HOLISTIC_FRAME_SIZE;
    const w = Array(1 * D * 3).fill(0); w[0] = 1; w[2] = 1;  // taps at t-2 and t+2 (k=3, dilation 2)
    m.layers = [{ inC: D, outC: 1, k: 3, dilation: 2, residual: false, w, b: [0] }];
    m.head = { inF: 2, outF: 2, w: [0, 1, 0, -1], b: [0, 0] }; // logits = ±max over time
    const seq = Array.from({ length: HOLISTIC_STEPS }, (_, t) => { const r = Array(D).fill(0); r[0] = t === 0 ? 5 : 0; return r; });
    // Only t=2 sees x[0] through the t-2 tap: max = 5.
    const p = predictWord(m, seq);
    expect(p[0]).toBeCloseTo(Math.exp(5) / (Math.exp(5) + Math.exp(-5)), 6);
  });

  it('rejects malformed models', () => {
    expect(() => validateWordModel({ ...tinyModel(), featureVersion: 'old' })).toThrow();
    expect(() => validateWordModel({ ...tinyModel(), head: { inF: 4, outF: 3, w: [], b: [] } })).toThrow();
  });

  const released = 'public/models/words-v1/model.json';
  it.skipIf(!existsSync(released))('matches PyTorch probabilities for the released model', () => {
    const model: unknown = JSON.parse(readFileSync(released, 'utf8'));
    validateWordModel(model);
    const fx = JSON.parse(readFileSync('tests/fixtures/words-v1-parity.json', 'utf8'));
    fx.inputs.forEach((input: number[][], i: number) => {
      const p = predictWord(model, input);
      p.forEach((v, j) => expect(v).toBeCloseTo(fx.probs[i][j], 3));
    });
  });
});
