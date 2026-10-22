import argparse
import json
import sqlite3
import sys
import joblib
import numpy as np
from sequence_features import summarize_sequence

parser = argparse.ArgumentParser()
parser.add_argument("--after-id", type=int, required=True)
args = parser.parse_args()

model = joblib.load("model/sahayak_sequence_candidate.joblib")
if getattr(model, "n_features_in_", None) != 1320:
    sys.exit("ERROR: Candidate does not accept 1320 features.")

con = sqlite3.connect("continuous_gesture_db.db")
rows = con.execute(
    "SELECT id, label, frames_json FROM sequence_samples "
    "WHERE id > ? ORDER BY id",
    (args.after_id,)
).fetchall()
con.close()

if not rows:
    sys.exit("No fresh samples found. Check the saved sample IDs.")

X, actual = [], []
for sample_id, label, frames_json in rows:
    X.append(summarize_sequence(json.loads(frames_json)))
    actual.append(label)

predicted = model.predict(np.asarray(X, dtype=np.float32))
accuracy = np.mean(np.asarray(actual) == predicted) * 100

print(f"Fresh test samples: {len(rows)}")
print(f"Overall fresh-test accuracy: {accuracy:.1f}%")
print("\nPer-label results:")
for label in sorted(set(actual)):
    indices = [i for i, value in enumerate(actual) if value == label]
    correct = sum(actual[i] == predicted[i] for i in indices)
    print(f"{label}: {correct}/{len(indices)} correct")

errors = [
    (rows[i][0], actual[i], predicted[i])
    for i in range(len(rows)) if actual[i] != predicted[i]
]
if errors:
    print("\nMisclassified samples (ID, actual, predicted):")
    for item in errors:
        print(item)
