# Current architecture — TwoHand v1

Camera → local MediaPipe VIDEO (up to two hands) → complete landmark arrays → classifier worker → shared `twoHand.ts` features → nearest-prototype model → distance/separation rejection → temporal consensus → canonical LETTER_X concept → independent language adapter.

## Joint features

`src/recognition/twoHand.ts` is reused unchanged by dataset extraction and runtime. Hands are ordered spatially by wrist x in the unmirrored frame; these are image-left/image-right slots, **not claimed anatomical left/right identities**. Detector enumeration order does not affect features. For each hand: 63 wrist-relative, hand-radius-normalized shape values, plus 63 positions relative to the common wrist midpoint and common hand scale. Cross-hand z is not compared because independent wrist depth is unreliable. Two presence bits give 254 inputs. A missing slot is zero padded. Translation and common scale are invariant; rotations/mirrors and inter-hand position are deliberately preserved. Camera preview and overlay are unmirrored like source photos.

## Classifier / rejection

The JSON prototype bank is a nonparametric supervised model fitted on real training feature vectors. Runtime searches samples matching detected hand count, computes RMS feature distance, and compares nearest same-class exemplar with nearest competing class. Separation score = 1 − nearest distance / competing distance. It is **not a calibrated probability**. Max distance 0.20; minimum separation 0.35, selected on training-only leave-one-image-out with a fixed minimum floor. No hands returns no_hand. Weak/ambiguous/distant frames never append a letter. A high score can still be wrong on unsupported gestures; no general open-set guarantee is made.

Six matching frames in an eight-frame history commit a letter. No-hand/low-score transitions clear stale votes; a held pose cannot repeatedly commit the same letter. Model version is twohand-v1. Raw worker predictions never directly award XP. Only a committed target match in Learn earns first-mastery XP.

## Training / provenance

`ml/preprocessing/extract.mjs` runs the same MediaPipe version in Chrome, resolves original train/test image files through a local browser interception route, and stores coordinates and hashes. `reference-hands.json` is a visual inventory of source photographs, not linguistic validation. Training extractions whose hand count disagrees with the photographed sign are excluded. Train/test SHA overlaps and within-split exact duplicate hashes are excluded. Training and evaluation are reproducible via README commands. Anatomical handedness is not used because misclassification of handedness can swap the two inputs.

The held-out photo report is in `ml/evaluation/report.json` with per-class metrics, confusion matrix and every prediction. Full-resolution reference medoids are chosen only from complete training samples. `public/ref/provenance.json` names the exact original image and source commit for each alias. Public model manifest records SHA-256 hashes.

## Lifecycle and local state

Camera generation tokens discard stale async starts; cleanup stops tracks, terminates worker, closes MediaPipe and cancels RAF. Track-ended events report disconnection. Main-thread MediaPipe is bounded to one frame in flight with a worker classifier. Frames never leave the browser. Model/runtime are local assets. Camera permission and browser errors are displayed; restart retries model loading.

Canonical concepts and `language/index.ts` adapters are independent of recognition. An additional language adapter does not require changes to camera/model logic. Draft word mappings are not fabricated recognition results or sentence translations. Progress uses IndexedDB transactions; settings remain session-scoped. No LLM or backend is involved.

Legacy Jemari code/model remain for attribution and regression comparison only; the active worker no longer loads the 63-feature MLP.

## Live-camera aspect correction and personal examples (v0.3)

A real integration gap was identified after the user's live A attempt failed: input landmarks are normalized per image width/height, but v0.2 used them as if all cameras shared the source photos' 4:3 ratio. `extractFeatures` now accepts actual dimensions and maps x/z into the 4:3 reference geometry before normalization; features of 4:3 sources remain unchanged. Webcam requests 640×480 with an ideal 4:3 ratio; actual dimensions are used regardless of negotiated constraints. MediaPipe's coordinate conventions: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js . This fixes a geometry defect, but has not been established as the cause of this user's particular failure.

Worker diagnostics now return actual hand count, nearest candidate, score, distance and rejection reason. Candidate text is explicitly provisional and does not become recognition output without acceptance/consensus. No thresholds were lowered in this correction.

Personal adaptation is opt-in via **Simpan contoh pribadi**. Eight stable, correctly counted hand-feature frames are manually labelled by the user, persisted in a separate local IndexedDB store, and added to the classifier prototype bank. Each record carries model/feature versions; validation rejects incompatible/non-finite entries. Maximum 12 per letter. Only vectors are stored, not images/video. Labels are user-provided and not linguistically verified. UI marks matches sourced from personal examples.

Capture suppresses output/XP and resets temporal history. A release gate requires three processed no-hand frames after saving before new recognition can run, preventing immediate recitation of the training frame as a validation result. Storage writes/deletions are serialized; deletion waits for pending writes. Clear personal examples in Settings; baseline data is unchanged. Read failures fall back to baseline inference and report the storage error. No person-specific data is embedded in public model artifacts or uploaded.

## Missing-hand recovery (v0.3.1)

`TwoHandTracker` freezes each camera frame on a local canvas. The primary VIDEO model reads that image. If fewer than two hands are found, an independent IMAGE graph periodically searches the **same frame**, then its horizontal reflection if needed. Reflected detections are restored to original coordinates. `handRecovery.ts` removes duplicate same-hand detections using normalized wrist and median point distances. Only fresh detected landmark sets are returned; no second hand is synthesized or carried over from prior frames. After a successful recovery, fresh searches continue on subsequent missing-hand frames, avoiding flicker from stale coordinate reuse. A sustained one-hand input falls back to periodic search rather than full search every frame.

Primary detection threshold 0.5, recovery palm-candidate threshold 0.35, landmark presence threshold 0.5. This changes detector acquisition, not letter acceptance thresholds. Optional recovery failure retains baseline tracking and is exposed in diagnostics. All graphs/canvas resources close at stop. Source references, model weights and feature schema are unchanged. The old static-photo classifier metrics do not evaluate this updated tracker end to end; external live-signer evaluation remains necessary.
