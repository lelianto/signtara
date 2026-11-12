/**
 * Holistic word-sign features (wordseq-v2): hands + upper body + face, shared unchanged by
 * dataset extraction/training (ml/words) and live inference.
 *
 * Coordinates are MediaPipe-normalized image coordinates of the UNMIRRORED frame. x is
 * converted to height units (x * width / height) before any geometry.
 *
 * Body frame: origin = shoulder midpoint, unit = shoulder width (pose 11/12), so position
 * means "where relative to the signer's body" (mouth, chin, chest), independent of camera
 * distance. Arm slots are anatomical: slot 0 = signer's RIGHT arm (pose 12/14/16), slot 1 =
 * LEFT arm (pose 11/13/15); detected hands are assigned to the nearest pose wrist.
 */
import type { FrameSize, Point } from './twoHand';

export const HOLISTIC_VERSION = 'wordseq-v2';
export const HOLISTIC_STEPS = 32;

export interface PosePoint extends Point { visibility?: number }

/** One tracked camera frame as produced by the hand, pose and face landmarkers. */
export interface HolisticRaw {
  t: number;
  width: number;
  height: number;
  hands: Point[][];
  /** 33 pose landmarks, or null when no body was found. */
  pose: PosePoint[] | null;
  /** Selected blendshape scores in BLENDSHAPES order, or null when no face was found. */
  blend: number[] | null;
  /** Head yaw, pitch, roll (radians) from the facial transformation matrix, or null. */
  head: [number, number, number] | null;
}

/** Facial grammar cues: brows (questions), eyes, mouth shapes (mouthing, negation, intensity). */
export const BLENDSHAPES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
  'jawOpen', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthFrownLeft', 'mouthFrownRight', 'mouthPressLeft', 'mouthPressRight', 'cheekPuff',
] as const;

const SHAPE = 42;
/** present + shape + wrist(2) + elbow(2) + wrist-from-nose(2) */
const SLOT = 1 + SHAPE + 6;
const GLOBAL = 2 + BLENDSHAPES.length + 3 + 2;
export const HOLISTIC_FRAME_SIZE = SLOT * 2 + GLOBAL;

/** Feature index layout, exported for the training code (ml/words/train.py). */
export const HOLISTIC_LAYOUT = {
  slotSize: SLOT,
  slots: [0, SLOT].map((o) => ({ present: o, shape: [o + 1, o + 1 + SHAPE], wrist: [o + 43, o + 45], elbow: [o + 45, o + 47], fromNose: [o + 47, o + 49] })),
  nose: [SLOT * 2, SLOT * 2 + 2],
  blend: [SLOT * 2 + 2, SLOT * 2 + 2 + BLENDSHAPES.length],
  head: [SLOT * 2 + 2 + BLENDSHAPES.length, SLOT * 2 + 5 + BLENDSHAPES.length],
  facePresent: SLOT * 2 + 5 + BLENDSHAPES.length,
  bodyPresent: SLOT * 2 + 6 + BLENDSHAPES.length,
};

// Pose indices: signer's right then left.
const WRIST = [16, 15], ELBOW = [14, 13], SHOULDER_R = 12, SHOULDER_L = 11, NOSE = 0;
const VISIBLE = 0.5;

const hx = (p: Point, aspect: number) => p.x * aspect;
const visible = (p: PosePoint | undefined) => !!p && (p.visibility ?? 1) >= VISIBLE;

/** Rotation (column-major 4x4 facial transformation matrix) to yaw/pitch/roll. */
export function headAngles(m: ArrayLike<number>): [number, number, number] {
  const r = (row: number, col: number) => m[col * 4 + row];
  const pitch = Math.atan2(r(2, 1), r(2, 2));
  const yaw = Math.asin(Math.max(-1, Math.min(1, -r(2, 0))));
  const roll = Math.atan2(r(1, 0), r(0, 0));
  return [yaw, pitch, roll];
}

/** Picks BLENDSHAPES scores from MediaPipe's category list. */
export function pickBlendshapes(categories: { categoryName: string; score: number }[]): number[] {
  const map = new Map(categories.map((c) => [c.categoryName, c.score]));
  return BLENDSHAPES.map((n) => map.get(n) ?? 0);
}

const POSE_SWAP = [0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24, 23, 26, 25, 28, 27, 30, 29, 32, 31];
const BLEND_SWAP = BLENDSHAPES.map((n) => {
  const other = n.endsWith('Left') ? n.replace(/Left$/, 'Right') : n.endsWith('Right') ? n.replace(/Right$/, 'Left') : n;
  return BLENDSHAPES.indexOf(other as typeof BLENDSHAPES[number]);
});

/** Horizontal mirror of a raw frame: a left-handed rendition of the same sign. */
export function mirrorRaw(f: HolisticRaw): HolisticRaw {
  const flip = <T extends Point>(p: T): T => ({ ...p, x: 1 - p.x });
  return {
    ...f,
    hands: f.hands.map((h) => h.map(flip)),
    pose: f.pose ? POSE_SWAP.map((i) => flip(f.pose![i])) : null,
    blend: f.blend ? BLEND_SWAP.map((i) => f.blend![i]) : null,
    head: f.head ? [-f.head[0], f.head[1], -f.head[2]] : null,
  };
}

interface Body { ox: number; oy: number; scale: number; present: boolean }

function bodyOf(f: HolisticRaw): Body | null {
  const a = f.width / f.height, p = f.pose;
  if (!p || !visible(p[SHOULDER_L]) || !visible(p[SHOULDER_R])) return null;
  const l = p[SHOULDER_L], r = p[SHOULDER_R];
  const scale = Math.hypot(hx(l, a) - hx(r, a), l.y - r.y);
  if (!(scale > 1e-3)) return null;
  return { ox: (hx(l, a) + hx(r, a)) / 2, oy: (l.y + r.y) / 2, scale, present: true };
}

/** Assigns detected hands to anatomical slots by nearest pose wrist (x-order fallback). */
export function assignHands(f: HolisticRaw): (Point[] | null)[] {
  const a = f.width / f.height;
  const hands = f.hands.filter((h) => h.length === 21);
  const slots: (Point[] | null)[] = [null, null];
  if (!hands.length) return slots;
  const wrists = WRIST.map((i) => (f.pose && visible(f.pose[i]) ? f.pose[i] : null));
  if (wrists[0] || wrists[1]) {
    const cost = (h: Point[], s: number) => {
      const w = wrists[s];
      return w ? Math.hypot(hx(h[0], a) - hx(w, a), h[0].y - w.y) : 10;
    };
    if (hands.length === 1) slots[cost(hands[0], 0) <= cost(hands[0], 1) ? 0 : 1] = hands[0];
    else {
      const keep = cost(hands[0], 0) + cost(hands[1], 1), swap = cost(hands[0], 1) + cost(hands[1], 0);
      [slots[0], slots[1]] = keep <= swap ? [hands[0], hands[1]] : [hands[1], hands[0]];
    }
    return slots;
  }
  // Facing the camera, the signer's right hand appears on the image left.
  const sorted = [...hands].sort((p, q) => p[0].x - q[0].x);
  if (sorted.length === 2) return [sorted[0], sorted[1]];
  return [sorted[0], null];
}

/**
 * Converts one segmented sign to a HOLISTIC_STEPS × HOLISTIC_FRAME_SIZE sequence.
 * Frames without a body reuse the median body frame of the sign; when no frame has a body,
 * positions fall back to the hands' own centre and size and the body flag stays 0.
 */
export function holisticSequence(frames: HolisticRaw[], steps = HOLISTIC_STEPS): number[][] {
  if (!frames.length) throw Error('Empty sign segment');
  for (const f of frames) if (!(f.width > 0 && f.height > 0)) throw Error('Invalid frame dimensions');
  const bodies = frames.map(bodyOf);
  const known = bodies.filter((b): b is Body => !!b);
  const median = (xs: number[]) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];
  let fallback: Body;
  if (known.length) fallback = { ox: median(known.map((b) => b.ox)), oy: median(known.map((b) => b.oy)), scale: median(known.map((b) => b.scale)), present: false };
  else {
    const ws = frames.flatMap((f) => f.hands.map((h) => ({ x: hx(h[0], f.width / f.height), y: h[0].y, r: Math.max(1e-6, ...h.map((p) => Math.hypot(hx(p, f.width / f.height) - hx(h[0], f.width / f.height), p.y - h[0].y))) })));
    if (!ws.length) throw Error('Segment contains no hands');
    fallback = { ox: median(ws.map((w) => w.x)), oy: median(ws.map((w) => w.y)) - 0.0, scale: median(ws.map((w) => w.r)) * 2.5, present: false };
  }

  const encoded = frames.map((f, i) => {
    const a = f.width / f.height;
    const body = bodies[i] ?? fallback;
    const rel = (p: Point): [number, number] => [(hx(p, a) - body.ox) / body.scale, (p.y - body.oy) / body.scale];
    const nose = f.pose && visible(f.pose[NOSE]) ? rel(f.pose[NOSE]) : null;
    const slots = assignHands(f);
    const v: number[] = [];
    for (let s = 0; s < 2; s++) {
      const h = slots[s];
      const poseWrist = f.pose && visible(f.pose[WRIST[s]]) ? f.pose[WRIST[s]] : null;
      const elbow = f.pose && visible(f.pose[ELBOW[s]]) ? rel(f.pose[ELBOW[s]]) : [0, 0];
      if (h) {
        const w = h[0];
        const radius = Math.max(1e-6, ...h.map((p) => Math.hypot(hx(p, a) - hx(w, a), p.y - w.y)));
        v.push(1);
        for (const p of h) v.push((hx(p, a) - hx(w, a)) / radius, (p.y - w.y) / radius);
      } else v.push(0, ...Array(SHAPE).fill(0));
      const wristPt = h ? h[0] : poseWrist;
      const wrist = wristPt ? rel(wristPt) : [0, 0];
      const fromNose = wristPt && nose ? [wrist[0] - nose[0], wrist[1] - nose[1]] : [0, 0];
      v.push(wrist[0], wrist[1], elbow[0], elbow[1], fromNose[0], fromNose[1]);
    }
    v.push(...(nose ?? [0, 0]));
    v.push(...(f.blend ?? Array(BLENDSHAPES.length).fill(0)));
    v.push(...(f.head ?? [0, 0, 0]));
    v.push(f.blend ? 1 : 0, bodies[i] ? 1 : 0);
    return v;
  });

  // Nearest-in-time resampling to a fixed length.
  const t0 = frames[0].t, t1 = frames[frames.length - 1].t;
  const out: number[][] = [];
  let j = 0;
  for (let k = 0; k < steps; k++) {
    const target = steps === 1 ? t0 : t0 + ((t1 - t0) * k) / (steps - 1);
    while (j < frames.length - 1 && Math.abs(frames[j + 1].t - target) <= Math.abs(frames[j].t - target)) j++;
    out.push(encoded[j]);
  }
  return out;
}

/** Trims a recording to the span where at least one hand is visible (matches live segmentation). */
export function trimToHands(frames: HolisticRaw[]): HolisticRaw[] {
  const first = frames.findIndex((f) => f.hands.length > 0);
  if (first < 0) return [];
  let last = frames.length - 1;
  while (last > first && !frames[last].hands.length) last--;
  return frames.slice(first, last + 1);
}

export function validHolisticRaw(f: unknown): f is HolisticRaw {
  const r = f as HolisticRaw;
  const pt = (p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
  return !!r && Number.isFinite(r.t) && r.width > 0 && r.height > 0 && Array.isArray(r.hands) && r.hands.length <= 2 &&
    r.hands.every((h) => Array.isArray(h) && h.length === 21 && h.every(pt)) &&
    (r.pose === null || (Array.isArray(r.pose) && r.pose.length === 33 && r.pose.every(pt))) &&
    (r.blend === null || (Array.isArray(r.blend) && r.blend.length === BLENDSHAPES.length && r.blend.every(Number.isFinite))) &&
    (r.head === null || (Array.isArray(r.head) && r.head.length === 3 && r.head.every(Number.isFinite)));
}

export type { FrameSize };
