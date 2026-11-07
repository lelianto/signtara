# Current limitations — TwoHand v1

The app now genuinely feeds **both hands and their relative positions** into the classifier. Two-hand A and single-hand C have passed browser reference-stream tests with actual inference. These are training-image execution tests, not human accuracy tests.

All A–Z labels remain experimental research labels. The source has only about 20 static images per letter in a controlled setting; signer identities are not supplied. Held-out photos are not held-out people, and adjacent photos may be very similar. Generalization across people, skin tones, cameras, lighting, dominant hand and signing variants is unmeasured. No physical webcam session with a human signer has been validated by the agent. No motion sequence is modelled; dynamic signs/letters require video data and temporal modelling.

MediaPipe can miss a hand when fingers/hands overlap. Training examples with missing/spurious hands were excluded, but live failures remain possible. The classifier compares only examples with the detected hand count. If one hand is missed, the result may be rejected or confused with another one-hand sign. The UI displays the current hand count and source reference count. Move hands into clear view; do not change a two-hand sign into a one-hand sign to satisfy the model.

Score is geometric separation, not probability. Thresholds reject ambiguity but do not guarantee that an unknown gesture is rejected. The limited photo evaluation includes errors and rejected examples; all raw results are published. Per-class labels in the dictionary flag errors in that evaluation, not definitive linguistic correctness. Pixel duplicates were removed; perceptual/near-duplicate grouping and signer-independent evaluation remain future work.

Research reference photos/labels have not been verified by a BISINDO teacher or Deaf community reviewer. They are not an authoritative guide for all regional variants. Source links, license and exact filenames are available in the dictionary and provenance file.

Word recognition remains unavailable: no licensed compatible vocabulary weights are integrated. No sentence translation. Javanese mappings remain unverified drafts with review references, not claims of expert verification. No offline service worker, cloud sync or AI tutor. IndexedDB may be restricted by browser privacy settings; errors are displayed. Preferences are session-only.

Licensing: original alphabet dataset MIT notice retained (Copyright 2024 Rhio Sutoyo); Jemari MIT notices retained for legacy code; MediaPipe Apache-2.0 notice retained. Word-model and WL-BISINDO datasets are not redistributed. Runtime inference uses local assets and never uploads frames.

## User-reported live-camera failure and correction

A user reported that two-hand A still failed despite reference-photo smoke checks. That report is real evidence of a generalization/integration limitation. v0.3 corrects per-frame aspect ratio and adds visible diagnostics and optional locally labelled personal examples. Reference-video tests still do not demonstrate success on that user's live hands. Actual tracker count/lighting/occlusion and live geometry must be observed to determine the specific cause. Do not report the live failure as solved solely because reference tests pass.

Personal calibration teaches user-labelled examples. It is not expert verification, and incorrect labels can teach incorrect associations. Calibrating A does not establish accuracy for other letters. Holding a pose during capture produces no translation or XP; hands must be removed and the pose formed again to test fresh inference. Even that test remains same-user testing, not signer-independent evaluation. Only feature vectors are stored locally; clear them in Settings.

v0.3.1 adds same-frame fresh/mirrored palm-search recovery for lost hands. It improves some source-photo cases but does not resolve every overlapping pose and has not been confirmed on the user's webcam. It consumes extra CPU/memory. The reported 22-photo recovery diagnostic is deliberately selected for missing-hand cases and includes a duplicate; it is not an accuracy benchmark. If the indicator stays 1/2, do not store that as a two-hand A example. First acquire both open palms separately in view, then form the reference pose with both wrists visible.
