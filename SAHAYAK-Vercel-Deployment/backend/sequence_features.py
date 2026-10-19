"""Shared temporal feature extraction for variable-length SAHAYAK sequences.

Each captured frame has 132 features. Samples can contain any positive number of
valid frames. They are linearly resampled along time to 10 ordered temporal bins,
producing a fixed 10 * 132 = 1320 input vector for the classifier.
"""
from __future__ import annotations
import numpy as np
from features import SEQUENCE_FRAME_FEATURES

MIN_SEQUENCE_FRAMES = 1  # variable-length signs: any non-empty valid capture is accepted
TEMPORAL_BINS = 10
SEQUENCE_FEATURES = SEQUENCE_FRAME_FEATURES * TEMPORAL_BINS

def summarize_sequence(frames):
    arr = np.asarray(frames, dtype=np.float32)
    if arr.ndim != 2:
        raise ValueError("Sequence must be a 2D array: frames × 132 temporal features.")
    if arr.shape[0] < MIN_SEQUENCE_FRAMES:
        raise ValueError("Sequence must contain at least one valid frame.")
    if arr.shape[1] != SEQUENCE_FRAME_FEATURES:
        raise ValueError(f"Every frame must contain exactly {SEQUENCE_FRAME_FEATURES} features; got {arr.shape[1]}.")
    if not np.isfinite(arr).all():
        raise ValueError("Sequence contains NaN or infinite feature values.")
    # Interpolate the complete recording to 10 time positions. Unlike array_split,
    # this also works for sequences shorter than 10 frames and never creates empty bins.
    if len(arr) == 1:
        sampled = np.repeat(arr, TEMPORAL_BINS, axis=0)
    else:
        old_t = np.linspace(0.0, 1.0, num=len(arr), dtype=np.float32)
        new_t = np.linspace(0.0, 1.0, num=TEMPORAL_BINS, dtype=np.float32)
        sampled = np.empty((TEMPORAL_BINS, SEQUENCE_FRAME_FEATURES), dtype=np.float32)
        for col in range(SEQUENCE_FRAME_FEATURES):
            sampled[:, col] = np.interp(new_t, old_t, arr[:, col])
    result = sampled.reshape(-1).astype(np.float32)
    if result.shape != (SEQUENCE_FEATURES,):
        raise ValueError(f"Internal temporal feature error: expected {SEQUENCE_FEATURES}, got {result.shape}.")
    return result
