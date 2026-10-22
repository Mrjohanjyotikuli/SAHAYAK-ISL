"""Read-only checks for the active SAHAYAK local models and preserved datasets.

Run after activating .venv and installing requirements.txt:
    python verify_local_project.py
This script does not train, overwrite, or collect anything.
"""
from __future__ import annotations
import csv
import json
import sqlite3
from pathlib import Path
import joblib
from features import TOTAL_FEATURES
from sequence_features import SEQUENCE_FEATURES
from sequence_db import DB_PATH

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "model"
STATIC_CSV = ROOT / "data" / "landmarks_2hand.csv"
STATIC_MODEL = MODEL_DIR / "sahayak_twohand.joblib"
SEQUENCE_MODEL = MODEL_DIR / "sahayak_sequence.joblib"
STATIC_LABELS = MODEL_DIR / "labels_twohand.json"
EXPECTED_STATIC = {"HELLO", "YES", "NO", "THANK_YOU", "I_LOVE_YOU"}


def main() -> int:
    errors = []
    if not STATIC_CSV.exists():
        errors.append(f"Missing static dataset: {STATIC_CSV}")
    else:
        with STATIC_CSV.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            fields = reader.fieldnames or []
            rows = list(reader)
        if fields != ["label"] + [f"v{i}" for i in range(TOTAL_FEATURES)]:
            errors.append("Static CSV header is not the expected 126-feature format.")
        label_counts = {}
        for row in rows:
            label = str(row.get("label", "")).strip().upper()
            label_counts[label] = label_counts.get(label, 0) + 1
        missing = EXPECTED_STATIC - set(label_counts)
        if missing:
            errors.append(f"Static dataset is missing original labels: {sorted(missing)}")
        print(f"Static dataset: {len(rows)} rows; counts={dict(sorted(label_counts.items()))}")

    for name, path, expected in (
        ("Static", STATIC_MODEL, TOTAL_FEATURES),
        ("Continuous", SEQUENCE_MODEL, SEQUENCE_FEATURES),
    ):
        if not path.exists():
            errors.append(f"Missing {name.lower()} model: {path}")
            continue
        model = joblib.load(path)
        input_count = getattr(model, "n_features_in_", None)
        classes = sorted(map(str, getattr(model, "classes_", [])))
        if input_count != expected:
            errors.append(f"{name} model expects {input_count} features, expected {expected}.")
        if len(classes) < 2:
            errors.append(f"{name} model has fewer than two classes.")
        print(f"{name} model: input_features={input_count}; classes={classes}")

    if STATIC_LABELS.exists():
        metadata = json.loads(STATIC_LABELS.read_text(encoding="utf-8"))
        if not EXPECTED_STATIC.issubset(set(metadata)):
            errors.append("Static label metadata does not contain every original static label.")
        print(f"Static metadata labels: {metadata}")
    else:
        errors.append(f"Missing static label metadata: {STATIC_LABELS}")

    if not DB_PATH.exists():
        errors.append(f"Missing continuous sequence database: {DB_PATH}")
    else:
        with sqlite3.connect(DB_PATH) as con:
            rows = con.execute("SELECT label, COUNT(*) FROM sequence_samples GROUP BY label ORDER BY label").fetchall()
            total = sum(int(count) for _, count in rows)
        print(f"Continuous database: {total} samples; counts={dict(rows)}")
        if total < 1:
            errors.append("Continuous sequence database has no samples.")

    if errors:
        print("\nFAILED:")
        for error in errors:
            print(" -", error)
        return 1
    print("\nChecks passed. This verifies file shape/metadata, not real-world recognition accuracy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
