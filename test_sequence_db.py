import tempfile
import unittest
from pathlib import Path
import numpy as np
from sequence_db import add_sample, load_samples, summary

class SequenceDatabaseTests(unittest.TestCase):
    def test_separate_database_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'continuous_gesture_db.db'
            sample_id = add_sample('thank you', np.zeros((5, 132), dtype=float).tolist(), db)
            self.assertGreater(sample_id, 0)
            samples = load_samples(db)
            self.assertEqual(len(samples), 1)
            self.assertEqual(samples[0]['label'], 'THANK_YOU')
            self.assertEqual(len(samples[0]['frames']), 5)
            self.assertEqual(summary(db)['total_samples'], 1)

    def test_preserves_more_than_60_frames_in_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'continuous_gesture_db.db'
            frames = np.arange(180 * 132, dtype=float).reshape(180, 132).tolist()
            add_sample('LONG_SIGN', frames, db)
            samples = load_samples(db)
            self.assertEqual(len(samples[0]['frames']), 180)
            self.assertEqual(samples[0]['frames'][179][0], frames[179][0])

    def test_accepts_single_frame_sample(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'continuous_gesture_db.db'
            add_sample('SHORT', [[0.0] * 132], db)
            self.assertEqual(len(load_samples(db)[0]['frames']), 1)

    def test_rejects_empty_sample_without_persisting(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'continuous_gesture_db.db'
            with self.assertRaises(ValueError):
                add_sample('WAVE', [], db)
            self.assertEqual(summary(db)['total_samples'], 0)

if __name__ == '__main__': unittest.main()
