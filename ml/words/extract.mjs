/**
 * Extracts hand + pose + face landmarks from sign videos with the SAME MediaPipe web runtime
 * the app uses (tasks-vision WASM in headless Chromium), so training features match live ones.
 *
 * Usage: node ml/words/extract.mjs ml/words/out/manifest.json [workers=5]
 * Output: ml/words/out/raw/<dataset>.ndjson (one video per line, resumable).
 *
 * Videos are decoded with ffmpeg to 15 fps JPEG frames (longest side <= 1280 px), which avoids
 * browser codec differences. Pose runs on the full frame; hands and face run on a zoomed
 * upper-body crop and are mapped back, so far-away signers are still tracked.
 */
import { readFile, mkdir, rm, readdir, appendFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const run = promisify(execFile);
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const OUT = join(ROOT, 'ml/words/out');
const FPS = 15;
const manifestPath = resolve(process.argv[2] || join(OUT, 'manifest.json'));
const workers = Number(process.argv[3] || 5);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

await mkdir(join(OUT, 'raw'), { recursive: true });
const done = new Set();
for (const ds of new Set(manifest.map((v) => v.dataset))) {
  const file = join(OUT, 'raw', `${ds}.ndjson`);
  if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) if (line) done.add(JSON.parse(line).id);
}
const queue = manifest.filter((v) => !done.has(v.id));
console.log(`${manifest.length} videos, ${done.size} already extracted, ${queue.length} to go, ${workers} workers`);

const STATIC = {
  '/vision_bundle.mjs': join(ROOT, 'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'),
};
const TYPES = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.jpg': 'image/jpeg', '.html': 'text/html' };
const frameDirs = new Map();

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { FilesetResolver, HandLandmarker, PoseLandmarker, FaceLandmarker } from '/vision_bundle.mjs';
const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
const base = (m) => ({ modelAssetPath: '/models/' + m, delegate: 'CPU' });
const make = async () => ({
  hand: await HandLandmarker.createFromOptions(files, { baseOptions: base('hand_landmarker.task'), runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .45, minHandPresenceConfidence: .45, minTrackingConfidence: .45 }),
  pose: await PoseLandmarker.createFromOptions(files, { baseOptions: base('pose_landmarker_lite.task'), runningMode: 'VIDEO', numPoses: 1 }),
  face: await FaceLandmarker.createFromOptions(files, { baseOptions: base('face_landmarker.task'), runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true }),
});
const r4 = (v) => Math.round(v * 1e4) / 1e4;
let ts = 0;
const canvas = new OffscreenCanvas(640, 640), ctx = canvas.getContext('2d');
/** Upper-body box from pose (pixels), or null. Far-away signers are zoomed so hands/face are detectable. */
function bodyBox(pose, W, H) {
  const pts = pose.slice(0, 23).filter((q) => (q.visibility ?? 1) > 0.3);
  if (pts.length < 5) return null;
  const xs = pts.map((q) => q.x * W), ys = pts.map((q) => q.y * H);
  const sw = Math.hypot((pose[11].x - pose[12].x) * W, (pose[11].y - pose[12].y) * H) || W * 0.2;
  let x0 = Math.min(...xs) - sw * 0.6, x1 = Math.max(...xs) + sw * 0.6;
  let y0 = Math.min(...ys, pose[0].y * H - sw * 0.9) - sw * 0.3, y1 = Math.max(...ys) + sw * 0.4;
  const side = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = Math.max(0, cx - side / 2); x1 = Math.min(W, cx + side / 2);
  y0 = Math.max(0, cy - side / 2); y1 = Math.min(H, cy + side / 2);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
window.extractVideo = async (id, count) => {
  const lm = await make();   // fresh trackers: no state carried between videos
  const frames = [];
  let width = 0, height = 0, box = null, cropped = 0;
  try {
    for (let i = 1; i <= count; i++) {
      const blob = await (await fetch('/frames/' + id + '/' + String(i).padStart(5, '0') + '.jpg')).blob();
      const img = await createImageBitmap(blob);
      const W = img.width, H = img.height;
      ts += 67;
      const p = lm.pose.detectForVideo(img, ts);
      const target = p.landmarks[0] ? bodyBox(p.landmarks[0], W, H) : null;
      if (target) box = box ? { x: box.x * .6 + target.x * .4, y: box.y * .6 + target.y * .4, w: box.w * .6 + target.w * .4, h: box.h * .6 + target.h * .4 } : target;
      const crop = box && box.w * box.h < W * H * 0.6 ? box : { x: 0, y: 0, w: W, h: H };
      if (crop.w < W) cropped++;
      const k = 640 / Math.max(crop.w, crop.h);
      canvas.width = Math.round(crop.w * k); canvas.height = Math.round(crop.h * k);
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
      const h = lm.hand.detectForVideo(canvas, ts);
      const f = lm.face.detectForVideo(canvas, ts);
      const back = (q) => [r4((crop.x + q.x * crop.w) / W), r4((crop.y + q.y * crop.h) / H), r4(q.z * crop.w / W)];
      // Output in a 640-px-equivalent frame (like a webcam) regardless of source resolution.
      const s = 640 / Math.max(W, H);
      width = Math.round(W * s); height = Math.round(H * s);
      img.close();
      frames.push({
        t: Math.round((i - 1) * 1000 / ${FPS}),
        h: h.landmarks.map((hand) => hand.map(back)),
        p: p.landmarks[0] ? p.landmarks[0].map((q) => [r4(q.x), r4(q.y), r4(q.z), r4(q.visibility ?? 1)]) : null,
        b: f.faceBlendshapes?.[0] ? f.faceBlendshapes[0].categories.map((c) => [c.categoryName, r4(c.score)]) : null,
        m: f.facialTransformationMatrixes?.[0] ? Array.from(f.facialTransformationMatrixes[0].data, r4) : null,
      });
    }
  } finally { lm.hand.close(); lm.pose.close(); lm.face.close(); }
  return { width, height, cropped, frames };
};
window.ready = true;
</script>`;

async function decode(video) {
  const dir = join(OUT, 'tmp', video.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await run('ffmpeg', ['-v', 'error', '-i', video.path, '-vf', `fps=${FPS},scale='if(gt(iw,ih),min(iw,1280),-2)':'if(gt(iw,ih),-2,min(ih,1280))'`, '-q:v', '3', join(dir, '%05d.jpg')]);
  const count = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).length;
  frameDirs.set(video.id, dir);
  return { dir, count };
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
let finished = 0, failed = 0;
const started = Date.now();
async function worker(n) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(`[page ${n}]`, e.message));
  await page.route('http://extract.local/**', async (route) => {
    const url = new URL(route.request().url());
    let file;
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: PAGE });
    if (STATIC[url.pathname]) file = STATIC[url.pathname];
    else if (url.pathname.startsWith('/mediapipe/') || url.pathname.startsWith('/models/')) file = join(ROOT, 'public', url.pathname);
    else if (url.pathname.startsWith('/frames/')) {
      const [, , id, name] = url.pathname.split('/');
      const dir = frameDirs.get(decodeURIComponent(id));
      if (dir && /^\d{5}\.jpg$/.test(name)) file = join(dir, name);
    }
    if (!file || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ contentType: TYPES[extname(file)] || 'application/octet-stream', body: await readFile(file) });
  });
  await page.goto('http://extract.local/');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  while (queue.length) {
    const video = queue.shift();
    try {
      const { dir, count } = await decode(video);
      if (!count) throw Error('no frames decoded');
      const result = await page.evaluate(([id, c]) => window.extractVideo(id, c), [encodeURIComponent(video.id), count]);
      const { path, ...meta } = video;
      await appendFile(join(OUT, 'raw', `${video.dataset}.ndjson`), JSON.stringify({ ...meta, fps: FPS, ...result }) + '\n');
      await rm(dir, { recursive: true, force: true });
      frameDirs.delete(video.id);
      finished++;
    } catch (error) {
      failed++;
      console.error(`FAILED ${video.id}: ${error.message}`);
    }
    if ((finished + failed) % 25 === 0) {
      const rate = (finished + failed) / ((Date.now() - started) / 1000);
      console.log(`${finished} done, ${failed} failed, ${queue.length} left, ${rate.toFixed(2)} videos/s`);
    }
  }
  await page.close();
}
try {
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
} finally {
  await browser.close();
  await rm(join(OUT, 'tmp'), { recursive: true, force: true });
}
console.log(`EXTRACT_DONE ${finished} extracted, ${failed} failed`);
