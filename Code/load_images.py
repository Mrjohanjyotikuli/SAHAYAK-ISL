"""Prepare gesture images for SAHAYAK training.

Run from the Code directory:
    python load_images.py

Expected layout:
    gestures/<numeric_class_id>/*.jpg

The original database maps class IDs to gesture names. Dataset images are
not bundled with this repository; capture or add licensed images first.
"""
from pathlib import Path
import pickle
import random
import cv2
import numpy as np
from sklearn.model_selection import train_test_split

SEED = 42
IMAGE_SIZE = (50, 50)
DATA_DIR = Path("gestures")
OUT_DIR = Path(".")
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png"}

def main():
    if not DATA_DIR.exists():
        raise SystemExit("Missing Code/gestures/. Collect gesture images before preparing data.")
    samples = []
    for class_dir in sorted((p for p in DATA_DIR.iterdir() if p.is_dir()),
                            key=lambda p: int(p.name) if p.name.isdigit() else p.name):
        if not class_dir.name.isdigit():
            print(f"Skipping non-numeric class folder: {class_dir}")
            continue
        class_id = int(class_dir.name)
        files = sorted(p for p in class_dir.iterdir() if p.suffix.lower() in VALID_EXTENSIONS)
        for path in files:
            image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
            if image is None:
                print(f"Skipping unreadable image: {path}")
                continue
            image = cv2.resize(image, IMAGE_SIZE, interpolation=cv2.INTER_AREA)
            samples.append((image, class_id))
    if not samples:
        raise SystemExit("No usable images found. Add JPG/PNG images inside gestures/<class_id>/.")

    X = np.array([s[0] for s in samples], dtype=np.uint8)
    y = np.array([s[1] for s in samples], dtype=np.int32)
    classes, counts = np.unique(y, return_counts=True)
    if len(classes) < 2:
        raise SystemExit("At least two gesture classes are required to train a classifier.")
    too_small = {int(c): int(n) for c, n in zip(classes, counts) if n < 10}
    if too_small:
        raise SystemExit(
            f"Each class needs at least 10 usable images for stratified train/validation/test splits; "
            f"too few: {too_small}"
        )
    # Split indices in two stages; stratification keeps every class represented.
    indices = np.arange(len(y))
    train_idx, remainder_idx = train_test_split(
        indices, test_size=0.20, random_state=SEED, stratify=y)
    val_idx, test_idx = train_test_split(
        remainder_idx, test_size=0.50, random_state=SEED, stratify=y[remainder_idx])
    split = {
        "train_images": X[train_idx], "train_labels": y[train_idx],
        "val_images": X[val_idx], "val_labels": y[val_idx],
        "test_images": X[test_idx], "test_labels": y[test_idx],
    }
    for name, data in split.items():
        with open(OUT_DIR / name, "wb") as f:
            pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
        print(f"{name}: {len(data)}")
    with open(OUT_DIR / "class_ids.json", "w", encoding="utf-8") as f:
        import json
        json.dump([int(c) for c in classes], f, indent=2)
    print(f"Prepared {len(X)} images across {len(classes)} classes: {classes.tolist()}")

if __name__ == "__main__":
    main()
