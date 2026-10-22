# SAHAYAK Change Log

## Preservation-first feature implementation
- Preserved original single-sign model path, 126-feature extraction, five labels, camera route, phrase pad and local speech controls.
- Added optional `include_features` field to `/api/predict`; the original prediction response fields and endpoint remain compatible.
- Added `/api/sequence/predict`, validating >=60 frames and 126 values per frame. Requires separate `model/sahayak_sequence.joblib`; it never uses the single-frame model as a temporal model.
- Added `train_sequence_model.py` for separately training a baseline temporal classifier from exported labelled JSON samples. Output is a new model file; original model is not overwritten.
- Added browser-based 60-frame sequence collection and JSON export.
- Added online text-only translation endpoint using MyMemory, language selection, original/translated speech controls, and browser-local recognition history.
- Translation requires internet; no images or landmarks are sent to the translation provider.

## Branding update — 2026-10-18
- Added the supplied SAHAYAK logo at `website/assets/sahayak-logo.png`.
- Replaced the emoji header mark and duplicate text heading with the supplied responsive logo image.
- Kept the existing website layout and camera/recognition sections intact.


## Sequence workflow hardening (2026-10-18)
- Added `sequence_features.py` as the single shared training/inference implementation. It validates at least 60 frames, exactly 126 features per frame, and finite values.
- Replaced unordered mean/std/motion summary with 10 ordered temporal-bin means (1260 features) so coarse temporal progression is retained. This is still a baseline classifier, not a universal dynamic sign recognizer.
- Updated `/api/sequence/predict` model compatibility and `/api/status` metadata to use the shared 1260-feature contract.
- The webcam API now marks feature frames as valid/invalid; the collector excludes frames without detected hands rather than saving missing-hand zeros as genuine examples.
- Hardened `train_sequence_model.py` dataset validation and added a cautious holdout estimate when there are enough samples per label. It saves only `model/sahayak_sequence.joblib`; the existing single-sign model path is unchanged.
- Added `test_sequence.py` and continuous collection/training instructions to README.md.

## Sign-to-text, translation, and translated speech integration (2026-10-18)
- Added human-readable text mapping for the five existing model labels (HELLO, YES, NO, I_LOVE_YOU, THANK_YOU) in the recognition output and text field.
- Kept original recognized text editable and available for the phrase pad.
- Added a one-click Translate + speak action: it translates recognized/manual English text to the selected target language, then speaks the translated result using a compatible browser voice.
- Continuous predictions now also use readable text in the phrase pad and translation input.
- Translation still sends text only to the online provider; camera images and landmarks are never sent for translation.

## Mobile performance and camera switching (2026-10-18)
- Reduced requested webcam dimensions to 320×240 and use a lighter JPEG quality setting on mobile to reduce upload size.
- Added mobile-aware request pacing, a five-second request timeout, one-at-a-time sequence inference at approximately one-second intervals, and cancellation/generation checks so old requests cannot overwrite results after switching/stopping the camera.
- Added touch-friendly controls, safe-area padding, mobile layout improvements, and a viewport theme color.
- Camera switching is shared by both recognition modes. Front-camera preview and overlay are mirrored together; rear-camera preview and overlay are unmirrored.
- Kept model inference preprocessing mirrored for both cameras to preserve the existing model's input convention; for rear-camera mode only the returned annotation coordinates are unmirrored for display alignment.
- Removed per-frame backend console logging to reduce avoidable I/O overhead.
- Added regression tests for mobile capture settings, camera switching, mirror alignment, and stale-request cancellation.


## Audit repair
- Corrected front-camera annotation coordinates so the API returns raw camera-frame points before the preview/overlay are mirrored together.
- Continuous mode now stores 132 values per valid frame (126 pose + six wrist-position values) and trains on 1320 ordered temporal-bin features; the single-sign model contract remains 126. Existing older sequence models with 1260 inputs must be retrained.
- Single-sign training now creates a candidate by default; `--promote` backs up the active model and label file before replacing them.
- Camera dropdown changes now restart the stream, camera enumeration preserves selection, and continuous prediction has a timeout.
- Corrected test regexes that previously failed to inspect HTML IDs/element references.


## Re-test and collector consistency fix (2026-10-18)
- Re-ran all regression tests and added a check that desktop and browser collectors share the same 600-frame safety limit.
- Changed the desktop collector safety limit from 1800 to 600 to match the browser workflow and avoid different behavior across collection paths.
- Prevented repeated console messages once the desktop collector reaches the safety limit.
- Corrected stale frontend wording that incorrectly implied training samples must contain 60 frames.
