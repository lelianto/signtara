# Model evaluation — TwoHand v1

## Scope and protocol

New model fitted on 388 unique complete training images from the MIT-licensed rhiosutoyo alphabet dataset at commit e1a48c6caa9d12318c8561e9962da845ab50226e. Both hands are encoded jointly with relative positions. Source split: 416 train / 104 test photos. All 520 photos decoded on the completed extraction run; initial transient decode failure was recovered by retrying. Seven training photos had no detected hands; further training photos had incomplete/spurious hand detections. A visual inventory of source reference hand counts excludes those extractions. This is not linguistic verification. Four duplicate usable training photos and one duplicate test photo were removed. No exact train/test hash overlap was found. Full exclusion list and every prediction are in [report.json](../ml/evaluation/report.json).

**This is an image split, not a signer-independent evaluation.** Source signer IDs are unavailable. Near-duplicate photos may remain, so results cannot establish live-user accuracy. Training references are used only for execution smoke checks, not held-out metrics.

## Calibration

Training-only leave-one-image-out selects a nearest-prototype separation threshold from a fixed grid, with a 0.35 minimum floor and zero accepted errors on that internal calibration. Max RMS distance is 0.20. Rejected/undetected training extractions are excluded before fitting. No test photo is used to fit the prototype bank or select the threshold. The two-hand feature/cleaning revision was informed by observed errors in earlier exploratory runs on this same test split; therefore this final test set is a development evaluation, **not an untouched confirmation set**. A new external test set is still required.

Scores measure geometric separation between classes and are not probabilities. Do not compare 35% separation directly with the previous MLP's 75% softmax threshold.

## Final development photo results

- Unique test photos: **103**. Hands detected in 103.
- Top label correct before rejection: **97/103 (94.2%)**.
- Accepted after distance/separation filtering: **86/103 (83.5% coverage)**.
- Accepted and correct in this limited set: **86/86**. This does not imply zero real-world errors.
- Rejected: 17. Rejections count as unrecognized inputs; do not report selective precision alone as overall accuracy.
- Single synchronous Node classifier call on these test vectors: p50 0.081 ms, p95 0.091 ms, darwin/arm64, Node v26.12.0. Includes prototype distance search only; excludes MediaPipe, transfer, rendering and camera capture. Not a browser/device benchmark.

| Letter | Test photos | Top label correct | Accepted correct / accepted | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| A | 4 | 4 | 3/3 | 0.800 | 1.000 | 0.889 |
| B | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| C | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| D | 4 | 4 | 4/4 | 0.800 | 1.000 | 0.889 |
| E | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| F | 4 | 4 | 1/1 | 1.000 | 1.000 | 1.000 |
| G | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| H | 3 | 3 | 3/3 | 1.000 | 1.000 | 1.000 |
| I | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| J | 4 | 4 | 4/4 | 0.800 | 1.000 | 0.889 |
| K | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| L | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| M | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| N | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| O | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| P | 4 | 3 | 2/2 | 1.000 | 0.750 | 0.857 |
| Q | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| R | 4 | 4 | 4/4 | 0.800 | 1.000 | 0.889 |
| S | 4 | 3 | 2/2 | 1.000 | 0.750 | 0.857 |
| T | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| U | 4 | 4 | 2/2 | 1.000 | 1.000 | 1.000 |
| V | 4 | 4 | 4/4 | 0.800 | 1.000 | 0.889 |
| W | 4 | 4 | 4/4 | 1.000 | 1.000 | 1.000 |
| X | 4 | 2 | 0/0 | 1.000 | 0.500 | 0.667 |
| Y | 4 | 2 | 1/1 | 1.000 | 0.500 | 0.667 |
| Z | 4 | 4 | 4/4 | 0.800 | 1.000 | 0.889 |

Per-class precision/recall/F1 above use all top-label predictions before rejection. The confusion matrix includes all such predictions, with true labels as rows and predicted labels as columns; it is in the JSON report.

## Browser verification

Real A two-hand and C one-hand reference streams commit their expected letters through the active camera → MediaPipe VIDEO → worker → joint classifier → smoother → UI flow. A test explicitly confirms that A has two tracked hands. Stop cleans up tracks. These are training-reference smoke checks, not human signer validation. Camera denial, disconnection, model load failure, no-hand handling, IndexedDB persistence, register switching and responsive layout are covered. See the current final test counts recorded in the completion report.

## Remaining validation

Collect consented signer-identified videos. Hold out entire signers before any tuning or augmentation. Evaluate both-handed and left/right-dominant signing, motion/occlusion, unsupported gestures and no-hand intervals. Report false accepts, per-class scores, unknown rejection, and end-to-end p50/p95 on named devices. Do not claim motion or sentence recognition from static photo results. Word recognition remains unavailable.

## Final A–Z video-reference diagnostic

`node ml/evaluation/reference-video.mjs` streamed each new full-resolution training reference into the real app camera path at 15 FPS. **26/26 reference streams committed their expected letter**. A and the other two-hand references reported both hands. Recorded startup-to-commit times ranged approximately 0.68–1.32 seconds in this run, including model/camera startup and temporal consensus. These are training references; this diagnostic confirms integration, not generalization or independent accuracy. Raw output: `ml/evaluation/reference-video.json`.

Final automated checks: 16 unit tests and 9 browser tests passed; strict TypeScript and production build passed. Browser tests simulate camera input from licensed photos or inject camera errors; no physical webcam test is claimed.

Production-bundle check also passed: the built app recognized two-hand A via its bundled worker and local model (separation about 0.69). This is a further execution smoke check on the same training reference, not independent accuracy evidence.

## v0.3 live-camera correction

A user subsequently reported failure on a real two-hand A pose. The reference-smoke success above must not be treated as evidence against that report. Input aspect ratio was not previously normalized: source features assume 4:3 while devices may return 16:9. Actual frame dimensions now correct x/z geometry to the 4:3 reference before feature extraction; 4:3 base training vectors and thresholds are unchanged. Unit tests verify invariance under a 4:3→16:9 letterbox transform, and a real MediaPipe video-stream test confirms A at 1280×720. This establishes a fix for a geometry defect, not the specific cause of the user's live failure.

Optional personal examples are manually labelled local feature vectors. Eight stable frames are collected without recognition output; saving requires subsequent no-hand release before new frames can be evaluated. Personal labels are not independently verified. New tests cover capture suppression, release gating, fresh inference, local persistence, deletion and schema/version validation. Latest checks: 19 unit tests and 11 browser tests passed, with targeted aspect/calibration regressions rerun successfully after storage serialization changes. No new live-human or signer-independent accuracy measurement is claimed.
