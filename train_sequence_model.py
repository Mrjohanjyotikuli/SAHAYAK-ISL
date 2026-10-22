"""Train a candidate continuous-sign model from the complete sequence database.

By default this writes model/sahayak_sequence_candidate.joblib and does NOT change
model/sahayak_sequence.joblib. Review the printed report and validate the candidate,
then pass --promote to back up and replace the active sequence model.

Input format: labelled variable-length sequences of 132-value frames, resampled to
1,320 ordered temporal features. The single-sign model is never modified.
"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sequence_features import summarize_sequence, SEQUENCE_FEATURES
from sequence_db import DB_PATH, load_samples

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "model"
OUT = MODEL_DIR / "sahayak_sequence.joblib"
CANDIDATE = MODEL_DIR / "sahayak_sequence_candidate.joblib"


def load_dataset(path: Path):
    try:
        samples = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read valid JSON dataset {path}: {exc}") from exc
    if not isinstance(samples, list) or not samples:
        raise ValueError("Dataset must be a non-empty JSON list of labelled sequence objects.")
    X, y = [], []
    for i, sample in enumerate(samples, start=1):
        if not isinstance(sample, dict):
            raise ValueError(f"Sample {i} must be a JSON object.")
        label = sample.get("label")
        if not isinstance(label, str) or not label.strip():
            raise ValueError(f"Sample {i} has no valid label.")
        try:
            vector = summarize_sequence(sample.get("frames", []))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Sample {i} ({label!r}) is invalid: {exc}") from exc
        X.append(vector)
        y.append(label.strip().upper().replace(" ", "_"))
    counts = Counter(y)
    if len(counts) < 2:
        raise ValueError("Collect at least two different labels before training.")
    too_small = {label: count for label, count in counts.items() if count < 2}
    if too_small:
        raise ValueError(f"Need at least 2 samples per label; insufficient counts: {too_small}")
    return np.asarray(X, dtype=np.float32), np.asarray(y), counts


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", nargs="?", help="Optional exported JSON dataset")
    parser.add_argument("--db", action="store_true", help="Train from continuous_gesture_db.db")
    parser.add_argument("--promote", action="store_true", help="Back up and activate the candidate after training")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    if args.db and args.dataset:
        parser.error("Use either a JSON dataset or --db, not both.")
    if not args.db and not args.dataset:
        args.db = True
    try:
        if args.db:
            samples = load_samples(DB_PATH)
            if not samples:
                raise ValueError(f"No continuous samples saved in {DB_PATH}. Collect labelled samples first.")
            # Pass through the same validation path as JSON datasets.
            import tempfile
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as tmp:
                json.dump(samples, tmp)
                temp_path = Path(tmp.name)
            try:
                X, y, counts = load_dataset(temp_path)
            finally:
                temp_path.unlink(missing_ok=True)
        else:
            X, y, counts = load_dataset(Path(args.dataset))
    except ValueError as exc:
        print(f"DATASET ERROR: {exc}", file=sys.stderr)
        return 2

    print(f"Validated {len(y)} samples; temporal input features: {X.shape[1]} (expected {SEQUENCE_FEATURES}).")
    print("Samples per label:", dict(sorted(counts.items())))
    if min(counts.values()) >= 5:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        evaluator = RandomForestClassifier(
            n_estimators=200, class_weight="balanced", random_state=42, n_jobs=-1
        )
        evaluator.fit(X_train, y_train)
        pred = evaluator.predict(X_test)
        print(f"Holdout accuracy (small dataset; not a guarantee): {accuracy_score(y_test, pred):.3f}")
        print(classification_report(y_test, pred, zero_division=0))
    else:
        print("WARNING: Some classes have fewer than 5 samples, so no stratified holdout estimate is printed.")
        print("Collect more varied samples per class; 20-50+ is a better starting target, not a guarantee.")

    model = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42, n_jobs=-1)
    model.fit(X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    tmp_candidate = CANDIDATE.with_suffix(".tmp")
    joblib.dump(model, tmp_candidate)
    os.replace(tmp_candidate, CANDIDATE)
    print(f"Candidate saved: {CANDIDATE}")
    print("The live sequence model was NOT changed; the static model and both databases were not changed.")
    if not args.promote:
        print("Review the report and test the candidate before promotion.")
        print("To back up and activate it, rerun: python train_sequence_model.py --db --promote")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = MODEL_DIR / "backups" / stamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        shutil.copy2(OUT, backup_dir / OUT.name)
    active_tmp = OUT.with_suffix(".promote.tmp")
    shutil.copy2(CANDIDATE, active_tmp)
    os.replace(active_tmp, OUT)
    print(f"Promoted candidate to active sequence model: {OUT}")
    print(f"Previous active model backup: {backup_dir}")
    print("The static-sign model, static dataset, and legacy gesture databases were not changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
