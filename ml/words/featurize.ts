/**
 * Raw extracted landmarks (ml/words/out/raw/*.ndjson) → training tensors using the exact
 * runtime feature code (src/recognition/holistic.ts).
 *
 * Build & run: npm run ml:words:featurize
 * Output: ml/words/out/features.bin (Float32, N × STEPS × D) + ml/words/out/features.json.
 *
 * Variants per video: 0 = original, 1 = mirrored (left-handed rendition), 2..K = random
 * temporal crop + speed warp (half of them mirrored). Evaluation uses variant 0 only.
 */
import { readFileSync, readdirSync, writeFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BLENDSHAPES, HOLISTIC_FRAME_SIZE, HOLISTIC_LAYOUT, HOLISTIC_STEPS, HOLISTIC_VERSION,
  headAngles, holisticSequence, mirrorRaw, pickBlendshapes, trimToHands, type HolisticRaw,
} from '../../src/recognition/holistic';

const ROOT = resolve(process.argv[2] || '.');
const OUT = join(ROOT, 'ml/words/out');
const RANDOM_VARIANTS = 3;
const MIN_FRAMES = 6;

/** Gloss normalisation across datasets. */
const ALIASES: Record<string, string> = { dimana: 'di mana', 'di mana': 'di mana' };
const canonical = (label: string) => ALIASES[label] ?? label;

interface RawVideo {
  id: string; dataset: string; label: string; signer: string; license: string; width: number; height: number;
  frames: { t: number; h: number[][][]; p: number[][] | null; b: [string, number][] | null; m: number[] | null }[];
}

function toHolistic(v: RawVideo): HolisticRaw[] {
  return v.frames.map((f) => ({
    t: f.t, width: v.width, height: v.height,
    hands: f.h.map((hand) => hand.map(([x, y, z]) => ({ x, y, z }))),
    pose: f.p ? f.p.map(([x, y, z, visibility]) => ({ x, y, z, visibility })) : null,
    blend: f.b ? pickBlendshapes(f.b.map(([categoryName, score]) => ({ categoryName, score }))) : null,
    head: f.m ? headAngles(f.m) : null,
  }));
}

let seed = 12345;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Random start/end crop (0–12% each) and a monotone time warp t' = T·(t/T)^γ, γ ∈ [0.75, 1.33]. */
function temporalAugment(frames: HolisticRaw[]): HolisticRaw[] {
  const n = frames.length;
  const a = Math.floor(rand() * 0.12 * n), b = n - Math.floor(rand() * 0.12 * n);
  const cut = frames.slice(a, Math.max(a + MIN_FRAMES, b));
  const t0 = cut[0].t, span = Math.max(1, cut[cut.length - 1].t - t0);
  const gamma = Math.exp((rand() * 2 - 1) * Math.log(1.33));
  return cut.map((f) => ({ ...f, t: t0 + span * Math.pow((f.t - t0) / span, gamma) }));
}

const files = readdirSync(join(OUT, 'raw')).filter((f) => f.endsWith('.ndjson'));
const samples: { id: string; dataset: string; label: string; signer: string; license: string; variant: number; mirrored: boolean }[] = [];
const binPath = join(OUT, 'features.bin');
const fd = openSync(binPath, 'w');
const skipped: Record<string, number> = {};
for (const file of files) {
  for (const line of readFileSync(join(OUT, 'raw', file), 'utf8').split('\n')) {
    if (!line) continue;
    const v: RawVideo = JSON.parse(line);
    const frames = trimToHands(toHolistic(v));
    if (frames.length < MIN_FRAMES) { skipped[v.dataset] = (skipped[v.dataset] ?? 0) + 1; continue; }
    const variants: { frames: HolisticRaw[]; mirrored: boolean }[] = [
      { frames, mirrored: false },
      { frames: frames.map(mirrorRaw), mirrored: true },
    ];
    for (let k = 0; k < RANDOM_VARIANTS; k++) {
      const mirrored = k % 2 === 1;
      const aug = temporalAugment(frames);
      variants.push({ frames: mirrored ? aug.map(mirrorRaw) : aug, mirrored });
    }
    variants.forEach((variant, i) => {
      const seq = holisticSequence(variant.frames);
      const buf = new Float32Array(HOLISTIC_STEPS * HOLISTIC_FRAME_SIZE);
      seq.forEach((row, t) => buf.set(row, t * HOLISTIC_FRAME_SIZE));
      writeSync(fd, Buffer.from(buf.buffer));
      samples.push({ id: v.id, dataset: v.dataset, label: canonical(v.label), signer: v.signer, license: v.license, variant: i, mirrored: variant.mirrored });
    });
  }
}
closeSync(fd);
const classes = [...new Set(samples.map((s) => s.label))].sort();
writeFileSync(join(OUT, 'features.json'), JSON.stringify({
  featureVersion: HOLISTIC_VERSION, steps: HOLISTIC_STEPS, dims: HOLISTIC_FRAME_SIZE, layout: HOLISTIC_LAYOUT,
  blendshapes: BLENDSHAPES, classes, samples,
}));
const videos = samples.filter((s) => s.variant === 0);
console.log(`${videos.length} videos → ${samples.length} sequences, ${classes.length} classes, D=${HOLISTIC_FRAME_SIZE}; skipped (too few hand frames):`, skipped);
