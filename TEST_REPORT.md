# SAHAYAK local-package verification report

## Checks run during this packaging pass

- Preserved the original `data/landmarks_2hand.csv`, `continuous_gesture_db.db`, both active `.joblib` model files, both supplied static-model backup files, zero-byte root `gesture_db.db`, and `Code/gesture_db.db` without modification before building the archive.
- Replaced the local website with the current GitHub frontend layout and unified Live Studio, while setting the local config to use `http://127.0.0.1:5000`. A separate `deployment/` copy keeps the production Render API URL.
- Updated the local backend to the current API that supports browser-computed static features and continuous sequence prediction.
- Preserved the static collector/trainer and sequence collector; hardened the sequence trainer so it saves a candidate by default and only replaces the active sequence model when `--promote` is explicitly requested. The promotion step backs up the previous sequence model first.
- Python syntax compilation succeeded for the backend, feature utilities, collection scripts, and training scripts.
- Node syntax checks passed for the local config, service worker, and inline scripts extracted from current `website/index.html` and `website/studio.html`.
- `python -m unittest test_sahayak.py test_sequence.py test_sequence_db.py test_frontend.py -v`: **27 tests passed**.
- HTML checks found no duplicate IDs in the current home page or Studio; simple JavaScript element references resolve; expected API paths and current team roles are present.
- Static data at packaging time: 1,225 rows, labels HELLO (230), I_LOVE_YOU (237), NO (250), THANK_YOU (268), YES (240).
- Continuous DB at packaging time: 160 stored sequence samples, labels GOOD_MORNING (40), HELLO (40), HOW_ARE_YOU (40), NAMASTE (40).

## Checks not possible in this build environment

This container does not have Flask or MediaPipe installed and its scikit-learn version is 1.8.0 rather than the project's pinned 1.9.1. Therefore I did not claim a live Flask/API startup, physical webcam recognition test, or model-loading test under the correct Python environment. The included `requirements.txt` pins the expected dependencies. After creating `.venv`, run `python verify_local_project.py`, `python -m pip check`, and the live camera/API tests described in README.md on your computer.

## Important interpretation

The passing tests verify feature shapes, sequence resampling/database behaviour, HTML structure, route strings, and JavaScript syntax. They do not prove real-world sign-recognition accuracy. Test the newly promoted model against both new and prior signs before deploying it.
