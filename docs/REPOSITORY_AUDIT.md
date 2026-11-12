# Repository audit — 2026-10-31

Workspace was empty: no existing framework, lockfile, assets, or baseline app. Selected React + Vite + strict TypeScript. npm retained as available local package manager.

## Inspected upstream snapshots

- https://github.com/Alvnvnc/bisindo-translator — `4eb890d7c46e97214e3df103941efa54c25f3b2a`. MIT root license. Vanilla browser JavaScript, MediaPipe Tasks Vision 0.10.14. `web/model.json` contains MLP scaler and layers, 63 float features, 26 outputs A–Z, ReLU hidden layers and softmax. Wrist-relative coordinates divided by furthest wrist distance. Single-hand model, no temporal motion input. Upstream camera loaded runtime and landmark model from CDN; BISARA bundles both locally. Model present and executable; original baseline camera could not be verified with a physical signer during this audit.
- https://github.com/indomiekwah/bisindo-detection — `ef21bf1b0814477b04c7eb868f25c8731538017b`. Python TensorFlow/Keras, MediaPipe Holistic/OpenCV. Keras weights and pickle encoders present. Default fixed model metadata specifies 60 frames × 154 features, **7 emotion classes**, not the 32 WL-BISINDO words: Jijik, Marah, Neutral, Sedih, Senang, Takut, Terkejut. Relative two-hand coordinates, orientation/finger features; this differs materially from Jemari normalization. No root license found. Do not copy, convert, or distribute these artifacts without permission. Pickle encoders were not executed.
- https://github.com/AceKinnn/WL-BISINDO — `a1a2efdd911da810b1181f60505759614f5e9009`. Banten variant, 1,600 RGB videos, 32 glosses, five signers, Kaggle download outside repository (~2.16 GB per README). SPOTER and Siformer training baselines, SD/SI split metadata. No blanket root license found; nested `spoter/LICENSE` is Apache-2.0 but does not establish rights for dataset or other files. Dataset use/redistribution permission unresolved; no videos or trained vocabulary model integrated. No compatibility presumed.

## Reuse matrix

| Component | Classification | Decision |
|---|---|---|
| Jemari MLP JSON | Reusable without modification | Bundled under versioned path with MIT notice |
| Jemari normalization/inference | Reusable with adaptation | Preserved JavaScript math, isolated in worker |
| Jemari alphabet reference thumbnails | Reusable without modification | Upstream attributes source dataset MIT; upstream attribution preserved. Independent asset chain review advisable before commercial release |
| Jemari camera pattern | Reusable with adaptation | Independently typed lifecycle, local MediaPipe, cleanup and recovery |
| Jemari smoother | Reference only | Replaced: clear stale votes on missing/uncertain frames |
| Word Keras models | Blocked by licensing and semantic mismatch | Not copied; seven emotion labels are not vocabulary support |
| WL-BISINDO | Reference only / blocked by unresolved data rights | No data or code copied |
| Semantic adapters, pages, persistence, tests | Must be implemented | New modules in BISARA |

## Failure cases / compatibility

Camera needs secure context (localhost qualifies) and user permission. Single-hand spatial model cannot represent all two-hand/dynamic BISINDO signs. Softmax confidence is not calibrated unknown-sign detection. Random-split upstream accuracy does not demonstrate signer-independent validity. Browser WASM/Worker support required. Main-thread landmark extraction can affect UI on slower devices; classifier runs in worker. No ONNX conversion needed for JSON MLP. No paid APIs or cloud storage.

## Corrective implementation: joint two-hand model

The initial Jemari reference photos visibly contain two-handed forms (including A), while its extractor/runtime only used one hand. Initial advice to copy those signs with one hand was incorrect. The current implementation fixes the data/model mismatch instead of simply changing camera capacity.

Original alphabet source independently inspected and downloaded: https://github.com/rhiosutoyo/Indonesian-Sign-Language-BISINDO-Hand-Sign-Detection-Dataset at `e1a48c6caa9d12318c8561e9962da845ab50226e`. Root MIT license explicitly names Copyright (c) 2024 Rhio Sutoyo; exact notice is bundled as `public/licenses/Alphabet-Dataset-MIT.txt`. Original paper DOI 10.1109/ICRAIE59459.2023.10468194. Repository contains 416 train and 104 test JPEG files, plus original collected images/XML boxes. No signer IDs provided. Five raw training duplicate hashes and one test duplicate hash exist; after incomplete-hand filtering, four usable train duplicates remain and are removed. No exact train/test hash overlap found.

New independently implemented feature extraction and nearest-prototype model: 254 features representing local shape and shared relative positions of up to two hands. Original full-resolution training photos replace the downsampled Jemari thumbnails. Each photo has exact source URL, commit, SHA-256 and visually inventoried hand count in `public/ref/provenance.json`. Linguistic/Deaf community verification remains outstanding. Old Jemari math/model are retained as legacy comparison artifacts; active inference no longer uses them.

New reuse classification: original MIT image dataset **reusable with adaptation** for local feature extraction/model fitting; new joint feature/inference/training modules **implemented independently**; root MIT notice **retained unchanged**. No word weights or WL-BISINDO assets copied. Current evaluation and caveats are in MODEL_EVALUATION.md; original audit observations above describe the baseline, not the current active model.
