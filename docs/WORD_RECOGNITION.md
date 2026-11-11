# Word recognition prototype — wordseq-v1

Isolated-sign (one word at a time) recognition from personal recordings. There is no training step and no new model file. A word is taught by recording it 3×, and new attempts are matched against those recordings.

## Why this design

BISINDO users sign words with dedicated signs that combine handshape, movement, location and facial grammar. Fingerspelling covers only names and unfamiliar terms. Word signs move, so the single-frame letter classifier (`twohand-v1`) cannot recognise them. No licensed word-level BISINDO model or dataset is integrated yet (see `KNOWN_LIMITATIONS.md`). Template matching with Dynamic Time Warping (DTW) gives a working word mode with no dataset: each user records their own signs, which is the same idea as the existing personal letter calibration.

## Pipeline

`useCamera` (existing MediaPipe hand tracker) → `camera.frameListener` → `SignSegmenter` → `toSequence` → `matchWord` → word concept → existing `translateText` (Indonesian pivot → regional language and register).

| Step | File | What it does |
|---|---|---|
| Segmentation | `src/recognition/sequence.ts` `SignSegmenter` | A sign starts when a hand is visible on 2 consecutive frames. It ends when hands have been out of view for 350 ms. Signs shorter than 0.3 s or longer than 4 s are rejected. Brief tracker dropouts inside a sign are tolerated. |
| Frame features | `rawFrame` | Per hand: 21 wrist-relative x/y points / hand radius (shape) plus the wrist position. x is put in height units so camera aspect ratio does not distort it. |
| Sequence features | `toSequence` | Drops phantom second-hand detections in mostly one-handed signs (<30% two-hand frames). Assigns hands to stable slots by wrist continuity, so crossing or briefly lost hands keep their identity. Expresses trajectories relative to the sign's own centre in units of median hand size. Resamples by time to 32 steps. |
| Distance | `sequenceDistance` / `dtw` | DTW with a 30% Sakoe–Chiba band, normalised by path length. Frame cost = handshape RMS + 0.6 × trajectory offset per hand + 1.0 when hand presence differs. If one sign shows an extra hand (two-handed sign, or the resting hand came into view), the one-handed sign is also compared with each hand alone, at +0.12. |
| Decision | `matchWord` | 1-nearest neighbour per word. The acceptance threshold per word is 1.6 × the mean distance between that word's own recordings, clamped to 0.2–0.9 (0.3 with a single recording). Ambiguous matches are rejected when the best word is <12% closer than the runner-up. |
| Storage | `src/storage/wordTemplates.ts` | IndexedDB `isyara-word-templates`. Only the 32×90 numeric sequence is stored, never images or video. Max 10 recordings per word. Records are versioned by `SEQUENCE_VERSION`. |
| UI hook | `src/recognition/useWordRecognizer.ts` | Returns recording/matching state and actions for any UI. `src/words/WordTrainer.tsx` is a reference UI. |

Words are lowercase Indonesian words or short phrases (`normalizeWord`) with concept ids `WORD_<WORD>`. Translation uses the existing lexicons, so a recognised `makan` becomes `mangan` / `nedha` in Javanese depending on register.

## Try it

```bash
npm run dev
```

Open `http://127.0.0.1:3000/words-lab.html`. This standalone dev page is independent of the main app UI and is not part of the production build. Turn on the camera, pick a word, sign it 3×, lowering your hands after each one. Then sign words one at a time and the lab page shows the Indonesian sentence and its regional translation. **Uji silang** runs leave-one-out over your own recordings.

## What has been measured

- **Unit tests** (`tests/words.test.ts`, synthetic landmarks): invariance to position/distance, robustness to frame rate and non-linear speed, slot continuity, phantom-hand removal, resting-hand tolerance, segmentation, recognition/rejection, and the storage contract.
- **Real MediaPipe pass** (browser, 2026-11-11): BISINDO reference photos C, E and L were moved along circle/down/right paths on a canvas and run through the bundled hand landmarker. 4 "words" × 3 recordings, at varied speed and offset with ±6 px jitter.
  - New attempts at different scale, position, speed and ±14 px jitter: **8/8 accepted correctly**.
  - Unrecorded handshape+movement combinations: **3/3 rejected**, at distance 0.30–0.40 against a 0.20 threshold.
  - Leave-one-out: **12/12**.
  - The tightest accepted case was 0.189 against a 0.20 threshold. It had a resting hand in view on 50–70% of frames.

These are **not human accuracy numbers**. The "signs" are rigid photos translated across the frame: there is no real hand articulation, no signer variation and no lighting change. No live webcam session with a human signer has been evaluated by the agent.

## Known limits

- **Body location is not captured.** Only hands are tracked, so signs that differ mainly by where they are made (at the mouth vs. at the chest) can collide. Adding MediaPipe Pose (shoulders/nose as the reference frame) is the next engine step. It needs the `pose_landmarker_lite.task` model (~5 MB, Apache-2.0) added to `public/models/`.
- **Facial grammar is not captured** (questions, negation, intensity).
- **Single-signer only.** Templates are personal. Another person's signing is not expected to match without their own recordings.
- **Isolated signs only.** Hands must be lowered between words; continuous signing is not segmented.
- **Thresholds are heuristic.** They were tuned on the synthetic pass above, not on human data.
- **Signs are user-defined and unverified.** Labels are whatever the user records. Nothing here is checked by a BISINDO teacher or Deaf reviewer.

## Next steps

1. Add pose landmarks: hand position relative to shoulders/face instead of relative to the sign's own centre.
2. Collect word recordings from Deaf signers with consent (≥10 signers, 20–30 takes per word). The same `toSequence` features can be exported for this.
3. Train a small sequence classifier (GRU / 1D-CNN on the 32×90 features) for signer-independent recognition. Keep DTW templates for personal additions.
4. Map recognised gloss sequences to Indonesian word order before regional translation. BISINDO grammar differs from Indonesian.
