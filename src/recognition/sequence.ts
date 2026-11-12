/**
 * Word-level (isolated sign) recognition prototype.
 *
 * Pipeline: per-frame hand landmarks → segment one sign between "hands appear" and
 * "hands lowered" → resample to a fixed number of time steps → sequence-normalized
 * features → Dynamic Time Warping (DTW) against personally recorded templates.
 *
 * No training step: templates are matched directly (nearest neighbour), so a word can be
 * taught with a handful of recordings. Location relative to the BODY (mouth, chest) is not
 * captured yet because only hand landmarks are tracked; trajectories are relative to the
 * sign's own centre. See docs/WORD_RECOGNITION.md.
 */
import type { FrameSize, Point } from './twoHand';

export const SEQUENCE_VERSION = 'wordseq-v1';
export const STEPS = 32;
const SHAPE_POINTS = 21;
/** Per slot: 42 wrist-relative shape values + 2 trajectory values + 1 presence flag. */
export const SLOT_SIZE = SHAPE_POINTS * 2 + 3;
export const FRAME_SIZE = SLOT_SIZE * 2;
const POSITION_WEIGHT = 0.6;
const MISSING_PENALTY = 1.0;

export interface RawHand { wx: number; wy: number; radius: number; shape: number[] }
export interface RawFrame { t: number; hands: RawHand[] }
export type Sequence = number[][];

/** Hands ordered by aspect-corrected wrist x; shape is scale/translation invariant. */
export function rawFrame(hands: Point[][], size: FrameSize, t: number): RawFrame {
  if (hands.length > 2) throw Error('At most two hands supported');
  if (!(size.width > 0 && size.height > 0)) throw Error('Invalid frame dimensions');
  const aspect = size.width / size.height;
  const out: RawHand[] = [];
  for (const hand of hands) {
    if (hand.length !== SHAPE_POINTS || hand.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      throw Error('Invalid hand landmarks');
    }
    // MediaPipe normalizes x by width and y by height; put both in height units.
    const pts = hand.map((p) => ({ x: p.x * aspect, y: p.y }));
    const w = pts[0];
    const radius = Math.max(1e-6, ...pts.map((p) => Math.hypot(p.x - w.x, p.y - w.y)));
    const shape: number[] = [];
    for (const p of pts) shape.push((p.x - w.x) / radius, (p.y - w.y) / radius);
    out.push({ wx: w.x, wy: w.y, radius, shape });
  }
  out.sort((a, b) => a.wx - b.wx);
  return { t, hands: out };
}

/** Below this share of two-hand frames, a sign is treated as one-handed. */
export const TWO_HAND_RATIO = 0.3;

/**
 * Removes spurious second-hand detections from a mostly one-handed sign. The detector
 * sometimes reports a phantom or partial second hand for a few frames; keeping it would
 * shift the real hand into the other slot and add presence-mismatch cost. The tracked hand
 * is the one nearest the previously kept wrist (or the median one-hand wrist at the start).
 */
export function dropSpuriousHands(frames: RawFrame[]): RawFrame[] {
  const visible = frames.filter((f) => f.hands.length > 0);
  const single = visible.filter((f) => f.hands.length === 1);
  if (!single.length || visible.length - single.length >= TWO_HAND_RATIO * visible.length) return frames;
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  let ref = { wx: median(single.map((f) => f.hands[0].wx)), wy: median(single.map((f) => f.hands[0].wy)) };
  return frames.map((f) => {
    if (!f.hands.length) return f;
    const kept = f.hands.length === 1 ? f.hands[0] : f.hands.reduce((a, b) =>
      Math.hypot(a.wx - ref.wx, a.wy - ref.wy) <= Math.hypot(b.wx - ref.wx, b.wy - ref.wy) ? a : b);
    ref = kept;
    return { t: f.t, hands: [kept] };
  });
}

/**
 * Assigns hands to two stable slots. With one visible hand right after a two-hand frame,
 * the hand keeps the slot whose previous wrist is nearest, so a briefly lost hand does not
 * swap the other hand's identity.
 */
function slotted(frames: RawFrame[]): (RawHand | null)[][] {
  const near = (a: RawHand, b: RawHand | null) => (b ? Math.hypot(a.wx - b.wx, a.wy - b.wy) : Infinity);
  const result: (RawHand | null)[][] = [];
  // Seed with the first two-hand frame (left-to-right) so leading one-hand frames pick a consistent slot.
  const firstTwo = frames.find((f) => f.hands.length === 2);
  let previous: (RawHand | null)[] = firstTwo ? [firstTwo.hands[0], firstTwo.hands[1]] : [null, null];
  for (const f of frames) {
    let slots: (RawHand | null)[];
    if (f.hands.length === 2) {
      const [a, b] = f.hands;
      if (previous[0] && previous[1]) {
        // Keep identities by the cheaper assignment, not by x order (hands may cross).
        const keep = near(a, previous[0]) + near(b, previous[1]), swap = near(a, previous[1]) + near(b, previous[0]);
        slots = swap < keep ? [b, a] : [a, b];
      } else if (previous[0] || previous[1]) {
        const s = previous[0] ? 0 : 1, ref = previous[s]!;
        const [closer, other] = near(a, ref) <= near(b, ref) ? [a, b] : [b, a];
        slots = s === 0 ? [closer, other] : [other, closer];
      } else slots = [a, b];
    } else if (f.hands.length === 1) {
      const h = f.hands[0];
      if (previous[0] && previous[1]) slots = near(h, previous[1]) < near(h, previous[0]) ? [null, h] : [h, null];
      else if (previous[1] && !previous[0]) slots = [null, h];
      else slots = [h, null];
    } else slots = [null, null];
    result.push(slots);
    // Remember the last known position of each hand separately.
    previous = [slots[0] ?? previous[0], slots[1] ?? previous[1]];
  }
  return result;
}

/** Nearest-in-time resampling to STEPS frames (robust to uneven inference frame rates). */
function resample<T>(items: T[], times: number[], steps = STEPS): T[] {
  const start = times[0], end = times[times.length - 1];
  const out: T[] = [];
  let j = 0;
  for (let i = 0; i < steps; i++) {
    const target = steps === 1 ? start : start + ((end - start) * i) / (steps - 1);
    while (j < times.length - 1 && Math.abs(times[j + 1] - target) <= Math.abs(times[j] - target)) j++;
    out.push(items[j]);
  }
  return out;
}

/**
 * Turns a segmented sign into a fixed-size feature sequence. Trajectories are expressed
 * relative to the mean wrist position of the whole sign and in units of median hand size,
 * so standing further away or off-centre does not change the features.
 */
export function toSequence(input: RawFrame[]): Sequence {
  if (!input.length) throw Error('Empty sign segment');
  const frames = dropSpuriousHands(input);
  const all = frames.flatMap((f) => f.hands);
  if (!all.length) throw Error('Segment contains no hands');
  const ax = all.reduce((s, h) => s + h.wx, 0) / all.length;
  const ay = all.reduce((s, h) => s + h.wy, 0) / all.length;
  const radii = all.map((h) => h.radius).sort((a, b) => a - b);
  const scale = radii[Math.floor(radii.length / 2)];
  const slots = resample(slotted(frames), frames.map((f) => f.t));
  return slots.map((pair) => {
    const v: number[] = [];
    for (const h of pair) {
      if (!h) { v.push(...Array(SLOT_SIZE).fill(0)); continue; }
      v.push(...h.shape, (h.wx - ax) / scale, (h.wy - ay) / scale, 1);
    }
    return v;
  });
}

export function validSequence(value: unknown): value is Sequence {
  return Array.isArray(value) && value.length === STEPS &&
    value.every((f) => Array.isArray(f) && f.length === FRAME_SIZE && f.every(Number.isFinite));
}

/** Frame cost: hand-shape RMS + weighted trajectory offset per slot, fixed penalty when presence differs. */
export function frameDistance(a: number[], b: number[]): number {
  let total = 0;
  for (let s = 0; s < 2; s++) {
    const o = s * SLOT_SIZE;
    const pa = a[o + SLOT_SIZE - 1] > 0, pb = b[o + SLOT_SIZE - 1] > 0;
    if (!pa && !pb) continue;
    if (pa !== pb) { total += MISSING_PENALTY; continue; }
    let sq = 0;
    for (let i = 0; i < SHAPE_POINTS * 2; i++) { const d = a[o + i] - b[o + i]; sq += d * d; }
    const shape = Math.sqrt(sq / (SHAPE_POINTS * 2));
    const pos = Math.hypot(a[o + 42] - b[o + 42], a[o + 43] - b[o + 43]);
    total += shape + POSITION_WEIGHT * pos;
  }
  return total;
}

/** DTW with a Sakoe–Chiba band, normalized by path length so distances are comparable. */
export function dtw(a: Sequence, b: Sequence, bandRatio = 0.3): number {
  const n = a.length, m = b.length;
  const band = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * bandRatio));
  const INF = Number.POSITIVE_INFINITY;
  let prev = new Float64Array(m + 1).fill(INF), curr = new Float64Array(m + 1).fill(INF);
  let prevLen = new Float64Array(m + 1), currLen = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    curr.fill(INF); curr[0] = INF;
    const lo = Math.max(1, i - band), hi = Math.min(m, i + band);
    for (let j = lo; j <= hi; j++) {
      const c = frameDistance(a[i - 1], b[j - 1]);
      let best = prev[j - 1], len = prevLen[j - 1];
      if (prev[j] < best) { best = prev[j]; len = prevLen[j]; }
      if (curr[j - 1] < best) { best = curr[j - 1]; len = currLen[j - 1]; }
      curr[j] = best + c; currLen[j] = len + 1;
    }
    [prev, curr] = [curr, prev];
    [prevLen, currLen] = [currLen, prevLen];
  }
  return prev[m] / Math.max(1, prevLen[m]);
}

/** Cost added when an extra hand (e.g. the resting hand coming into view) is ignored. */
export const EXTRA_HAND_PENALTY = 0.12;
const SLOT_USED = 0.2;

function slotPresence(seq: Sequence, s: number) {
  return seq.filter((f) => f[s * SLOT_SIZE + SLOT_SIZE - 1] > 0).length / seq.length;
}

/** Keeps one slot as a one-hand sequence (moved to slot 0) with its trajectory re-centred on itself. */
function projectSlot(seq: Sequence, s: number): Sequence {
  const o = s * SLOT_SIZE;
  const present = seq.filter((f) => f[o + SLOT_SIZE - 1] > 0);
  const mx = present.reduce((t, f) => t + f[o + 42], 0) / Math.max(1, present.length);
  const my = present.reduce((t, f) => t + f[o + 43], 0) / Math.max(1, present.length);
  return seq.map((f) => {
    const out = Array(FRAME_SIZE).fill(0);
    if (f[o + SLOT_SIZE - 1] > 0) {
      for (let i = 0; i < SLOT_SIZE; i++) out[i] = f[o + i];
      out[42] -= mx; out[43] -= my;
    }
    return out;
  });
}

/**
 * Distance between two signs. When one is one-handed and the other shows a second hand
 * (a two-handed sign, or a resting hand that came into view), the one-handed sign is also
 * compared with each hand of the other on its own, at a fixed extra cost.
 */
export function sequenceDistance(a: Sequence, b: Sequence): number {
  const direct = dtw(a, b);
  const used = (q: Sequence) => [0, 1].filter((s) => slotPresence(q, s) >= SLOT_USED);
  const ua = used(a), ub = used(b);
  if (ua.length !== 1 && ub.length !== 1) return direct;
  if (ua.length === ub.length) return direct;
  const [one, oneSlots, two] = ua.length === 1 ? [a, ua, b] : [b, ub, a];
  const base = projectSlot(one, oneSlots[0]);
  const partial = Math.min(...[0, 1].filter((s) => slotPresence(two, s) > 0).map((s) => dtw(base, projectSlot(two, s))));
  return Math.min(direct, partial + EXTRA_HAND_PENALTY);
}

export interface WordTemplate { id: string; conceptId: string; word: string; sequence: Sequence }
export interface WordMatch {
  accepted: boolean;
  word?: string;
  conceptId?: string;
  distance: number | null;
  threshold: number | null;
  separation: number | null;
  reason: 'no_templates' | 'too_far' | 'ambiguous' | 'accepted';
  ranking: { word: string; distance: number }[];
}

export const MIN_SEPARATION = 0.12;
const DEFAULT_THRESHOLD = 0.3;

/**
 * Acceptance distance per word from its own recordings: a new attempt must be about as
 * close to the word as the word's recordings are to each other. A single recording uses a
 * conservative default.
 */
export function wordThresholds(templates: WordTemplate[]): Map<string, number> {
  const byWord = new Map<string, WordTemplate[]>();
  for (const t of templates) byWord.set(t.conceptId, [...(byWord.get(t.conceptId) ?? []), t]);
  const out = new Map<string, number>();
  for (const [id, list] of byWord) {
    if (list.length < 2) { out.set(id, DEFAULT_THRESHOLD); continue; }
    const d: number[] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) d.push(sequenceDistance(list[i].sequence, list[j].sequence));
    const mean = d.reduce((s, x) => s + x, 0) / d.length;
    out.set(id, Math.min(0.9, Math.max(0.2, mean * 1.6)));
  }
  return out;
}

/** 1-nearest-neighbour per word with distance and separation rejection. */
export function matchWord(
  sequence: Sequence,
  templates: WordTemplate[],
  thresholds = wordThresholds(templates),
  exclude?: string,
): WordMatch {
  const best = new Map<string, { word: string; distance: number }>();
  for (const t of templates) {
    if (t.id === exclude) continue;
    const d = sequenceDistance(sequence, t.sequence);
    const cur = best.get(t.conceptId);
    if (!cur || d < cur.distance) best.set(t.conceptId, { word: t.word, distance: d });
  }
  const ranking = [...best.entries()].sort((a, b) => a[1].distance - b[1].distance);
  if (!ranking.length) return { accepted: false, distance: null, threshold: null, separation: null, reason: 'no_templates', ranking: [] };
  const [conceptId, top] = ranking[0];
  const threshold = thresholds.get(conceptId) ?? DEFAULT_THRESHOLD;
  const separation = ranking[1] ? 1 - top.distance / Math.max(1e-9, ranking[1][1].distance) : null;
  const base = { word: top.word, conceptId, distance: top.distance, threshold, separation, ranking: ranking.slice(0, 3).map(([, r]) => r) };
  if (top.distance > threshold) return { ...base, accepted: false, reason: 'too_far' };
  if (separation !== null && separation < MIN_SEPARATION) return { ...base, accepted: false, reason: 'ambiguous' };
  return { ...base, accepted: true, reason: 'accepted' };
}

/** Leave-one-out check over the user's own recordings (same signer, not a general accuracy claim). */
export function crossValidate(templates: WordTemplate[]) {
  const thresholds = wordThresholds(templates);
  let correct = 0, wrong = 0, rejected = 0, tested = 0;
  const perWord = new Map<string, { word: string; correct: number; total: number }>();
  for (const t of templates) {
    const siblings = templates.filter((x) => x.conceptId === t.conceptId && x.id !== t.id);
    if (!siblings.length) continue; // needs at least one other recording of the same word
    tested++;
    const m = matchWord(t.sequence, templates, thresholds, t.id);
    const entry = perWord.get(t.conceptId) ?? { word: t.word, correct: 0, total: 0 };
    entry.total++;
    if (!m.accepted) rejected++;
    else if (m.conceptId === t.conceptId) { correct++; entry.correct++; }
    else wrong++;
    perWord.set(t.conceptId, entry);
  }
  return { tested, correct, wrong, rejected, perWord: [...perWord.values()] };
}

export type SegmentEvent =
  | { type: 'idle' }
  | { type: 'signing'; duration: number }
  | { type: 'segment'; frames: RawFrame[]; duration: number }
  | { type: 'rejected'; reason: 'too_short' | 'too_long' };

/**
 * Isolated-sign segmentation: a sign starts when a hand is visible on two consecutive
 * frames and ends when hands have been lowered out of view for `releaseMs`. Brief tracker
 * dropouts shorter than that are kept inside the sign.
 */
export class SignSegmenter {
  private frames: RawFrame[] = [];
  private seen = 0;
  private lastHandAt = 0;
  private tooLong = false;
  private pendingFirst?: RawFrame;
  constructor(private releaseMs = 350, private minMs = 300, private maxMs = 4000) {}
  reset() { this.frames = []; this.seen = 0; this.lastHandAt = 0; this.tooLong = false; this.pendingFirst = undefined; }
  push(frame: RawFrame): SegmentEvent {
    const visible = frame.hands.length > 0;
    if (this.tooLong) {
      // Wait for hands to be lowered before a new sign can begin.
      if (!visible && frame.t - this.lastHandAt >= this.releaseMs) this.reset();
      if (visible) this.lastHandAt = frame.t;
      return { type: 'idle' };
    }
    if (!this.frames.length) {
      if (!visible) { this.seen = 0; this.pendingFirst = undefined; return { type: 'idle' }; }
      this.seen++;
      this.pendingFirst ??= frame;
      if (this.seen < 2) return { type: 'idle' };
      this.frames.push(this.pendingFirst, frame);
      this.pendingFirst = undefined;
      this.lastHandAt = frame.t;
      return { type: 'signing', duration: frame.t - this.frames[0].t };
    }
    if (visible) this.lastHandAt = frame.t;
    this.frames.push(frame);
    const duration = this.lastHandAt - this.frames[0].t;
    if (duration > this.maxMs) {
      this.frames = []; this.seen = 0; this.pendingFirst = undefined; this.tooLong = true;
      return { type: 'rejected', reason: 'too_long' };
    }
    if (!visible && frame.t - this.lastHandAt >= this.releaseMs) {
      // Drop trailing empty frames; the sign ends at the last visible hand.
      const segment = this.frames.filter((f) => f.t <= this.lastHandAt);
      this.frames = []; this.seen = 0; this.pendingFirst = undefined;
      if (duration < this.minMs) return { type: 'rejected', reason: 'too_short' };
      return { type: 'segment', frames: segment, duration };
    }
    return { type: 'signing', duration };
  }
}
