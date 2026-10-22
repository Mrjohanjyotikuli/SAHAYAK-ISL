
"""Train a candidate static-sign model without overwriting the working model.

Run:
    python train_model.py
to train a candidate only.

After reviewing and testing the candidate:
    python train_model.py --promote

The previous active model and labels are backed up before promotion.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_sample_weight

from features import TOTAL_FEATURES


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "landmarks_2hand.csv"

MODEL_DIR = ROOT / "model"
MODEL = MODEL_DIR / "sahayak_twohand.joblib"
LABELS = MODEL_DIR / "labels_twohand.json"

CANDIDATE = MODEL_DIR / "sahayak_twohand_candidate.joblib"
CANDIDATE_LABELS = MODEL_DIR / "labels_twohand_candidate.json"

EXPECTED_FIELDS = ["label"] + [
    f"v{i}" for i in range(TOTAL_FEATURES)
]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Back up and activate the trained candidate.",
    )
    args = parser.parse_args(argv)

    # 1. Validate that the expected dataset exists.
    if not DATA.exists():
        raise SystemExit(
            "No two-hand dataset found. "
            "Run collect_data.py first."
        )

    with DATA.open(
        newline="",
        encoding="utf-8-sig",
    ) as file:
        reader = csv.DictReader(file)

        if reader.fieldnames != EXPECTED_FIELDS:
            raise SystemExit(
                "Dataset header does not match the expected "
                f"{TOTAL_FEATURES}-feature format. "
                "No models were changed."
            )

        rows = list(reader)

    if len(rows) < 20:
        raise SystemExit(
            f"Only {len(rows)} samples found. "
            "Collect more samples before training. "
            "No models were changed."
        )

    # 2. Validate labels and numerical features.
    try:
        labels = [
            str(row["label"]).strip().upper()
            for row in rows
        ]

        if any(not label for label in labels):
            raise ValueError("Empty sign label found.")

        X = np.asarray(
            [
                [
                    float(row[f"v{i}"])
                    for i in range(TOTAL_FEATURES)
                ]
                for row in rows
            ],
            dtype=np.float32,
        )

    except (KeyError, ValueError, TypeError) as exc:
        raise SystemExit(
            f"Invalid dataset columns, labels or values: {exc}. "
            "No models were changed."
        )

    if not np.isfinite(X).all():
        raise SystemExit(
            "Dataset contains NaN or infinite values. "
            "No models were changed."
        )

    y = np.asarray(labels, dtype=str)

    classes, counts = np.unique(y, return_counts=True)

    if len(classes) < 2:
        raise SystemExit(
            "At least TWO different sign labels are required. "
            "No models were changed."
        )

    small = {
        str(label): int(count)
        for label, count in zip(classes, counts)
        if count < 10
    }

    if small:
        raise SystemExit(
            f"Each sign needs at least 10 samples; too few: "
            f"{small}. No models were changed."
        )

    print("\nDataset verification")
    print(f"Total samples: {len(rows)}")
    print(f"Feature count per sample: {TOTAL_FEATURES}")
    print(f"Number of labels: {len(classes)}")

    for label, count in zip(classes, counts):
        print(f"  {label}: {count} samples")

    # 3. Make a stratified holdout split for evaluation.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    # 4. Compute weights separately.
    # This avoids the scikit-learn 1.9 RandomForest bug affecting
    # string labels that look like integers, for example "1".
    train_weights = compute_sample_weight(
        class_weight="balanced",
        y=y_train,
    )

    model = RandomForestClassifier(
        n_estimators=180,
        class_weight=None,
        random_state=42,
        n_jobs=-1,
    )

    print("\nTraining candidate model...")
    model.fit(
        X_train,
        y_train,
        sample_weight=train_weights,
    )

    # 5. Evaluate on the held-out samples.
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)

    print(
        "\nHoldout accuracy: "
        f"{accuracy:.1%}"
    )
    print(
        "\nClassification report "
        "(held-out samples):"
    )
    print(
        classification_report(
            y_test,
            predictions,
            zero_division=0,
        )
    )

    # 6. Refit on the complete dataset after evaluation.
    # This candidate includes all validated old and new samples.
    all_weights = compute_sample_weight(
        class_weight="balanced",
        y=y,
    )

    model.fit(
        X,
        y,
        sample_weight=all_weights,
    )

    # 7. Save a candidate, never replacing the active model here.
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    temporary_model = CANDIDATE.with_suffix(".tmp")
    temporary_labels = CANDIDATE_LABELS.with_suffix(".tmp")

    try:
        joblib.dump(model, temporary_model)

        temporary_labels.write_text(
            json.dumps(
                sorted(str(label) for label in classes),
                indent=2,
            ),
            encoding="utf-8",
        )

        os.replace(temporary_model, CANDIDATE)
        os.replace(temporary_labels, CANDIDATE_LABELS)

    finally:
        if temporary_model.exists():
            temporary_model.unlink()

        if temporary_labels.exists():
            temporary_labels.unlink()

    print("\nCandidate training completed.")
    print(f"Candidate samples: {len(rows)}")
    print(f"Candidate labels: {sorted(classes.tolist())}")
    print(f"Candidate model: {CANDIDATE}")
    print(f"Candidate label file: {CANDIDATE_LABELS}")

    if not args.promote:
        print(
            "\nThe active model was NOT changed.\n"
            "Review and test the candidate before promotion."
        )
        return 0

    # 8. Promotion is explicit. Back up the active files first.
    stamp = datetime.now(timezone.utc).strftime(
        "%Y%m%dT%H%M%SZ"
    )

    backup_dir = MODEL_DIR / "backups" / stamp
    backup_dir.mkdir(parents=True, exist_ok=False)

    if MODEL.exists():
        shutil.copy2(MODEL, backup_dir / MODEL.name)

    if LABELS.exists():
        shutil.copy2(LABELS, backup_dir / LABELS.name)

    model_tmp = MODEL.with_suffix(".promote.tmp")
    labels_tmp = LABELS.with_suffix(".promote.tmp")

    try:
        shutil.copy2(CANDIDATE, model_tmp)
        shutil.copy2(CANDIDATE_LABELS, labels_tmp)

        os.replace(model_tmp, MODEL)
        os.replace(labels_tmp, LABELS)

    finally:
        if model_tmp.exists():
            model_tmp.unlink()

        if labels_tmp.exists():
            labels_tmp.unlink()

    print("\nCandidate promoted successfully.")
    print(f"Previous model backup: {backup_dir}")
    print(
        "The continuous model and both gesture databases "
        "were not changed."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
