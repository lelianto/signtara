# Word recognition — words-v1 (trained) + wordseq-v1 (personal)

Isolated-sign (one word at a time) recognition with two engines:

1. **Trained model `words-v1`**: 66 BISINDO words recognised with no setup. It reads hands, upper-body position and facial expression (section *Trained model* below).
2. **Personal words**: any word the user teaches with 3 recordings, including words the model never learned. Each recording stores the holistic sequence, which is matched as a cosine nearest neighbour in the model's 256-d embedding (`src/recognition/personalEmbedding.ts`). Records saved before holistic tracking existed still use the hand-only DTW matcher (`wordseq-v1`, section at the end).

`src/recognition/wordDecision.ts` decides in this order: personal embedding → trained model → legacy DTW. When nothing is confident, it returns up to 3 `suggestions` (personal ones first). The Talk and Learn screens show them as chips, and `confirmWord(word)` emits the chosen word. **The confirmed sign is also saved as a personal example of that word**, so the system adapts to the user's own signing over time.

## Personal words by embedding (few-shot)

`npm run ml:words:fewshot` simulates the realistic case of a new user teaching words. It uses a model that never saw the test signers (`train.py export-eval`: WL-BISINDO s3/s4 held out, plus 6 words hidden from training). Each of 12 trials per signer teaches 10 random words with 3 recordings each. Positives are the remaining 7 takes of each taught word (1,680 in total). Unknowns are 2 takes each of 8 untaught words (384 in total).

| Matcher | Correct, accepted | Wrong, accepted | Untaught word falsely accepted |
|---|---|---|---|
| DTW on hand landmarks (wordseq-v1) | 77.2% | 2.7% | 27.1% |
| **Embedding, cosine ≤ 0.10 (released)** | **88.9%** | **0.1%** | **2.6%** |
| Embedding, cosine ≤ 0.12 | 94.5% | 0.2% | 4.9% |
| Embedding, cosine ≤ 0.15 | 97.4% | 0.3% | 9.6% |

The nearest neighbour is right 99.0% of the time, and 96.6% of the time for words the model never learned. Matches between 0.10 and 0.20 become suggestions. On the release model, same-word distances (median 0.024) and different-word distances (median 0.42) keep the same scale, so the threshold transfers. Full curve: `ml/words/out/fewshot.json`. Caveat: unknown words in this simulation come from the same dataset and signer as the taught words.

# Trained model — words-v1

## Data

| Dataset | Videos | Words | Signers | License |
|---|---|---|---|---|
| WL-BISINDO (Banten variant) | 1,600 | 32 | 5 (s0–s4) | CC BY-NC 4.0 |
| BISINDO 40 Kata mp4 | 2,000 | 40 | 1 (not stated) | MIT |
| Bahasa Isyarat Indonesia Dinamis | 160 | 5 | not stated | MIT |

Datasets with the same gloss are merged into one class. The merged vocabulary has 66 words, and some of them have more than one regional variant. The videos are not in the repository: `ml/datasets/` is git-ignored. Attribution is in `public/licenses/Word-Datasets.txt`. **Because WL-BISINDO is non-commercial, the `words-v1` weights are released under CC BY-NC 4.0.** A commercial build must retrain without it: drop it from `DATASETS` in `ml/words/index-datasets.mjs`.

Rejected candidates:
- Two image-only sets (letters/static frames).
- `bisindo-dinamis-5kata-a`, which ships only legacy MediaPipe Holistic `.npy` keypoints without blendshapes or frame size.
- A set that ships a pickled model (`.pkl`). It was never loaded, because pickles execute code.

## Pipeline

```bash
npm run ml:words:download    # Kaggle public archives → ml/datasets/raw (≈3 GB), then unzip each into <name>/extracted
npm run ml:words:index       # → ml/words/out/manifest.json (label, signer, license per video)
npm run ml:words:extract     # headless Chrome + the app's MediaPipe WASM → ml/words/out/raw/*.ndjson (resumable)
npm run ml:words:featurize   # src/recognition/holistic.ts → features.bin/json (+ mirrored/speed-warped variants)
npm run ml:words:train -- evaluate   # held-out metrics      (Python venv: uv venv ml/.venv --python 3.12; uv pip install torch numpy)
npm run ml:words:train -- open-set   # rejection of words never trained
npm run ml:words:train -- release    # all data → public/models/words-v1, parity fixture → tests/fixtures
node scripts/model-manifest.mjs
```

- **Extraction** (`ml/words/extract.mjs`): uses the same tasks-vision 0.10.14 WASM as the app, so training features equal live features. Videos are decoded by ffmpeg at 15 fps. Pose runs on the full frame. Hands and face run on a zoomed upper-body crop, because many dataset signers stand far from the camera: without the crop, face detection was 0% on one set.
- **Features** (`src/recognition/holistic.ts`, `wordseq-v2`, 124 values × 32 steps):
  - Per anatomical arm (assigned to the nearest pose wrist): handshape (42), wrist and elbow relative to the shoulder midpoint in shoulder widths, and wrist relative to the nose.
  - Nose position.
  - 19 face blendshapes: brows (question marking), eyes, mouth shapes.
  - Head yaw/pitch/roll.
  - Face/body presence flags.
- **Trimming** (`trimToActive`): a sign spans the frames where a hand is *raised* (wrist < 1.0 shoulder widths below the shoulders), not merely visible. Hands below 1.1 (resting) contribute arm position only.
- **Augmentation**: mirror (left-handed signing), random start/end crop and speed warp, body scale/shift, hand-tracking dropout, face dropout (40% of sequences + 15% of frames).
- **Model** (`ml/words/train.py`): temporal CNN of 4 convolutions (128 channels, kernel 5/5/5/3, one dilated, residual), then mean+max pooling and a linear layer. It has ~0.3 M parameters, and the JSON weights are 3.3 MB. BatchNorm is folded at export. `src/recognition/wordModel.ts` reimplements the forward pass. A parity test checks it against PyTorch probabilities (`tests/fixtures/words-v1-parity.json`).

## Results (held-out; from `public/models/words-v1/evaluation.json`)

| Test | Top-1 | Top-3 |
|---|---|---|
| WL-BISINDO, **signer s3 never seen in training** | **74.4%** | **93.8%** |
| WL-BISINDO, signer s4 never seen (validation) | 90.9% | 97.5% |
| BISINDO 40 Kata, held-out videos (same signer) | 99.7% | 100% |
| Dinamis, held-out videos | 95.5% | 100% |

The single-signer sets measure *repeatability for that signer*, not generalisation to new people. The signer-independent WL-BISINDO rows are the realistic numbers. Remaining confusions are minimal pairs such as hitam↔hijau (same location, different handshape), sore↔pagi, and berangkat↔air.

Two fixes found while evaluating made the largest difference on the unseen signer. Top-1 for s3 went from 55% to 65% with `trimToActive`, then to 74% with resting-hand neutralisation. That signer's resting hand was detected in 43% of frames and had made the model read her signs as the 40-Kata signer's.

**Open-set rejection.** Six words were hidden from training, and 400 of their videos were run through the model:

| minProb | Unknown words falsely accepted | Known words auto-accepted | …on a new WL signer |
|---|---|---|---|
| 0.5 | 21.7% | 77% | 51% |
| **0.7 (released)** | **6.0%** | **66%** | **30%** |
| 0.8 | 0.7% | 56% | 13% |

Released thresholds are `minProb 0.7, minMargin 0.15`. Between 0.3 and 0.7 the hook returns `lastMatch.suggestions` (top-3) for the user to confirm with `confirmWord(word)` instead of guessing. On a new signer the right word is in the top 3 about 94% of the time.

Browser inference takes ~50 ms per sign. Pose + face tracking runs only while a sign is in progress.

## Limits of words-v1

- It has 9 distinct signers in total, mostly from one region (Banten), so other regional variants of the same word may not be recognised.
- It has not been evaluated on live webcam signing by a human. All numbers come from recorded datasets.
- Segmentation is still "hands visible → lowered". If a resting hand stays in the webcam view, the sign does not end. Webcams usually show head and shoulders, so this is rare.
- Facial grammar is captured as features, but no dataset labels it separately: there are no question/negation labels. The model only uses it where it helps word identity.
- Isolated words only; there is no continuous sentence recognition.

# Personal recordings — wordseq-v1

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

- **Body location is not captured (personal recordings only — words-v1 uses pose).** Only hands are tracked, so signs that differ mainly by where they are made (at the mouth vs. at the chest) can collide. Adding MediaPipe Pose (shoulders/nose as the reference frame) is the next engine step. It needs the `pose_landmarker_lite.task` model (~5 MB, Apache-2.0) added to `public/models/`.
- **Facial grammar is not captured by personal recordings** (words-v1 reads face blendshapes).
- **Single-signer only.** Templates are personal. Another person's signing is not expected to match without their own recordings.
- **Isolated signs only.** Hands must be lowered between words; continuous signing is not segmented.
- **Thresholds are heuristic.** They were tuned on the synthetic pass above, not on human data.
- **Signs are user-defined and unverified.** Labels are whatever the user records. Nothing here is checked by a BISINDO teacher or Deaf reviewer.

## Next steps

1. Evaluate live with Deaf signers, and collect consented recordings from more regions. The extraction pipeline accepts any folder of labelled videos: add a parser in `index-datasets.mjs`.
2. Offer re-recording for old hand-only personal words, so they move to the embedding matcher.
3. Activity-based segmentation from pose, so a sign can end while a resting hand stays in view.
4. Continuous signing (CTC over glosses), and BISINDO→Indonesian word-order mapping before regional translation.
