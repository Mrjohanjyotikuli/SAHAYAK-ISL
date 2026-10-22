"""Unit tests for variable-length sequence feature extraction and training validation."""
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
from sequence_features import summarize_sequence, SEQUENCE_FEATURES
from train_sequence_model import load_dataset

class SequenceFeatureTests(unittest.TestCase):
    def test_one_frame_is_supported(self):
        frames = np.ones((1, 132), dtype=np.float32)
        out = summarize_sequence(frames)
        self.assertEqual(out.shape, (SEQUENCE_FEATURES,))
        self.assertTrue(np.all(out == 1))

    def test_short_sequences_under_60_are_supported(self):
        for count in (2, 5, 9, 20, 59):
            with self.subTest(count=count):
                frames = np.zeros((count, 132), dtype=np.float32)
                frames[:, 0] = np.arange(count)
                out = summarize_sequence(frames)
                self.assertEqual(out.shape, (1320,))
                self.assertTrue(np.isfinite(out).all())
                self.assertAlmostEqual(float(out[0]), 0.0)
                self.assertAlmostEqual(float(out[9*132]), float(count-1))

    def test_60_frames_preserve_temporal_order(self):
        frames = np.zeros((60, 132), dtype=np.float32)
        frames[:, 0] = np.arange(60)
        out = summarize_sequence(frames)
        self.assertEqual(out.shape, (SEQUENCE_FEATURES,))
        self.assertTrue(np.all(np.diff(out[0::132]) > 0))

    def test_180_frames_are_supported_and_full_recording_used(self):
        frames = np.zeros((180, 132), dtype=np.float32)
        frames[:, 0] = np.arange(180)
        out = summarize_sequence(frames)
        self.assertEqual(out.shape, (1320,))
        self.assertTrue(np.all(np.diff(out[0::132]) > 0))
        self.assertAlmostEqual(float(out[0]), 0.0)
        self.assertAlmostEqual(float(out[9*132]), 179.0)

    def test_rejects_empty_sequence(self):
        with self.assertRaisesRegex(ValueError, "at least one"):
            summarize_sequence(np.zeros((0, 132), dtype=np.float32))

    def test_rejects_wrong_dimensions(self):
        with self.assertRaisesRegex(ValueError, "exactly 132"):
            summarize_sequence(np.zeros((60, 131), dtype=np.float32))

    def test_rejects_non_finite(self):
        frames = np.zeros((2, 132), dtype=np.float32); frames[0, 0] = np.nan
        with self.assertRaisesRegex(ValueError, "NaN"):
            summarize_sequence(frames)

    def test_dataset_needs_two_labels_and_two_samples_each(self):
        samples = []
        for label in ("HELLO", "YES"):
            for count in (5, 80):
                samples.append({"label": label, "frames": np.zeros((count,132)).tolist()})
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"samples.json"; p.write_text(json.dumps(samples), encoding="utf-8")
            X,y,counts=load_dataset(p)
        self.assertEqual(X.shape, (4, 1320)); self.assertEqual(set(y), {"HELLO", "YES"})
        self.assertEqual(counts["HELLO"], 2)

if __name__ == "__main__": unittest.main()
