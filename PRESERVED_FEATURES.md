# Preserved Features

- `model/sahayak_twohand.joblib` and `model/sahayak_twohand.backup.joblib` are retained without modification.
- `model/labels_twohand.json` and `model/labels_twohand.backup.json` are retained.
- The existing `two_hand_features()` single-sign extractor still returns the same 126 features, normalized-hand extraction, and handedness slots. A separate temporal extractor adds six wrist-position values for continuous mode; it does not alter the single-sign vector.
- `data/landmarks_2hand.csv` and existing database files are retained.
- Existing `/api/predict` remains available and its original response keys remain present. `features` is only returned when requested with `include_features: true`.
- Existing camera preview, landmark annotations, phrase pad, localStorage phrase saving and speech controls remain.


## Separate continuous-sign pipeline (added)
- New `collect_sequences.py` captures visible webcam sequences and stores a complete variable-length sample per recording.
- New `sequence_db.py` owns only `continuous_gesture_db.db`; legacy `gesture_db.db` files are not opened by the new sequence collector/trainer.
- Website continuous collector saves to `/api/sequence/samples`; the API validates frames before writing to SQLite.
- `train_sequence_model.py --db` trains only `model/sahayak_sequence.joblib`.
- Website mode buttons route visible predictions to either the existing single-sign model or the separate sequence model.
- The offline phrasebook offers bundled phrase translations for English, Hindi, Assamese and Bengali, plus separate speech controls. General free-text translation remains online.
