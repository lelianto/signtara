# BISARA

Formerly ISYARA. Browser storage keys still use the old `isyara` prefix so data already saved on users' devices is kept.

Local-first BISINDO research alphabet recognizer and Indonesian/Javanese learning app. React + strict TypeScript + Vite. No account, paid API, inference server, or frame upload.

## Run

Node 24+ (Node 26 used for validation) and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Click **Nyalakan kamera** and allow camera access. Follow **the number, orientation and relative position of hands in the reference photo**. A uses two hands in this dataset; C uses one. Preview is unmirrored to match reference orientation. Hold the pose steadily. The new joint model uses both hands; it no longer classifies A from one hand alone.

```sh
npm test
npm run lint
npm run build
npm start
npm run test:e2e
```

Production preview uses port 3000; stop dev first. Tests use installed Google Chrome. Alternatively `npx playwright install chromium`, then `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

## What actually works

Translate, Learn, Dictionary and Settings are implemented. Active classifier **TwoHand v1** uses 254 shape/relative-position features for up to two hands and actual supervised nearest-prototype inference. It is fitted on 388 unique complete training examples from the MIT-licensed original alphabet dataset. Low-separation/distant gestures are rejected; six agreeing frames commit a letter. Held letters are not duplicated. Practice rewards and progress persist in IndexedDB. Indonesian/Javanese Ngoko/Krama adapters remain independent; lexical content is explicitly unverified draft. Alphabet outputs remain letters in all languages.

Two-hand A and one-hand C both pass full browser stream tests using real reference images and local inference. This validates execution; it does not validate live users' accuracy. All 26 labels are research/experimental. References are now full-resolution originals with per-image provenance, hand counts, source links and license. Reference images come from training, not the evaluation split. The UI flags letters with errors in held-out-photo evaluation.

Vocabulary recognition is still unavailable. No sentence or dynamic-sign recognition is claimed. Physical webcam/signers and linguistic correctness require further validation. See [current evaluation](docs/MODEL_EVALUATION.md) and [limitations](docs/KNOWN_LIMITATIONS.md).

## Reproduce the model

Download the source snapshot in [audit](docs/REPOSITORY_AUDIT.md), start dev, and in another terminal run:

```sh
npm run ml:extract -- /absolute/path/to/dataset
npm run ml:train
npm run ml:references -- /absolute/path/to/dataset
npm run ml:manifest
```

Extraction uses the same browser MediaPipe runtime and TypeScript feature function as live inference. Browser/source images are local; training artifacts under `ml/data/` are gitignored. Training excludes missing/spurious-hand extractions and exact duplicates. Test images are never fitted. Threshold calibration uses training-only leave-one-image-out, with a 0.35 safety floor. This photo split is NOT signer-independent.

Models and WASM are bundled under `public/`; installation needs network, application inference does not. No environment variables or cloud services are required.

[Architecture](docs/ARCHITECTURE.md) · [Audit](docs/REPOSITORY_AUDIT.md) · [Evaluation](docs/MODEL_EVALUATION.md) · [Attributions](docs/UPSTREAM_ATTRIBUTIONS.md)

## Live-camera correction and personal examples (v0.3)

The webcam requests 640×480/4:3 where available, and uses actual video dimensions to correct feature geometry if the device instead supplies e.g. 1280×720. The 4:3 training features are unchanged. The diagnostic panel displays actual hands, resolution, candidate, separation score and rejection reason. It does not silently force an A output.

If your pose is still rejected, select A under **Contoh pribadi**, ensure **2/2 hands tracked**, follow the reference and click **Simpan contoh pribadi A**. Eight stable landmark-feature examples are stored in this browser's separate IndexedDB database. No image or video is stored or uploaded. Training capture suppresses recognition and XP. You must lower all hands for at least three processed frames, then form the sign again to test fresh inference. User-provided labels are not expert verification; personal matches are labelled explicitly. Remove these examples from Settings. Maximum 12 stored samples per letter; incompatible feature/model versions are ignored.

The original photo-only classifier remains limited and its reference-stream results do not demonstrate success on your webcam. No live-user accuracy is claimed. New regression checks cover aspect-ratio invariance, actual 16:9 reference-video recognition, personal-example persistence/deletion, capture suppression and required hand release before fresh inference.

### Missing second hand (v0.3.1)

The hand count is now shown on the video itself and comes from fresh detections. When it remains 1/2, same-frame IMAGE/mirrored-search recovery attempts to find the missing hand, deduplicating overlaps and restoring coordinates before classification. This helps some cases but can still fail under occlusion. Start with both palms open and slightly separated, then form A with both wrists visible. Do not save a two-hand example while only one hand is tracked. See `ml/evaluation/tracker-recovery.json` for the limited source-photo diagnostic, not live-user accuracy.
