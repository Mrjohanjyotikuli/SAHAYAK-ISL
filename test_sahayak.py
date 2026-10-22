"""Offline smoke tests; run python -m unittest test_sahayak.py"""
import unittest
import numpy as np
from types import SimpleNamespace
from features import two_hand_features, two_hand_sequence_features, landmarks_for_preview, TOTAL_FEATURES, SEQUENCE_FRAME_FEATURES
class FeatureTests(unittest.TestCase):
    def make_hand(self, shift=0.0):
        pts=[SimpleNamespace(x=(i%5)*.01+shift,y=(i//5)*.01,z=i*.001) for i in range(21)]
        pts[0]=SimpleNamespace(x=shift,y=0.0,z=0.0)
        return SimpleNamespace(landmark=pts)
    def test_single_hand_has_fixed_126_features(self):
        h=self.make_hand()
        result=SimpleNamespace(multi_hand_landmarks=[h],multi_handedness=[SimpleNamespace(classification=[SimpleNamespace(label='Left')])])
        x,visible=two_hand_features(result)
        self.assertEqual(x.shape,(1,TOTAL_FEATURES));self.assertEqual(len(visible),1);self.assertTrue(np.all(x[0,63:]==0))
    def test_two_hands_fill_both_slots(self):
        result=SimpleNamespace(multi_hand_landmarks=[self.make_hand(),self.make_hand(.2)],multi_handedness=[SimpleNamespace(classification=[SimpleNamespace(label='Left')]),SimpleNamespace(classification=[SimpleNamespace(label='Right')])])
        x,visible=two_hand_features(result)
        self.assertEqual(x.shape,(1,126));self.assertEqual(len(visible),2);self.assertTrue(np.any(x[0,:63]));self.assertTrue(np.any(x[0,63:]))

    def test_annotation_points_keep_processed_frame_coordinates(self):
        hand = self.make_hand()
        # A known x coordinate must be returned unchanged for overlay placement.
        hand.landmark[0].x = 0.25
        result = SimpleNamespace(multi_hand_landmarks=[hand], multi_handedness=[SimpleNamespace(classification=[SimpleNamespace(label='Left')])])
        _, visible = two_hand_features(result)
        self.assertAlmostEqual(visible[0]['points'][0][0], 0.25)

    def test_no_hands(self):
        x,visible=two_hand_features(SimpleNamespace(multi_hand_landmarks=[],multi_handedness=[]))
        self.assertIsNone(x);self.assertEqual(visible,[])

    def test_sequence_features_add_wrist_motion_without_changing_single_features(self):
        h = self.make_hand(shift=0.35)
        result = SimpleNamespace(multi_hand_landmarks=[h], multi_handedness=[SimpleNamespace(classification=[SimpleNamespace(label='Left')])])
        single, _ = two_hand_features(result)
        temporal = two_hand_sequence_features(result)
        self.assertEqual(single.shape, (1, 126))
        self.assertEqual(temporal.shape, (1, SEQUENCE_FRAME_FEATURES))
        self.assertAlmostEqual(float(temporal[0, 126]), 0.35)
        self.assertTrue(np.all(temporal[0, 129:132] == 0))

    def test_preview_coordinates_are_unmirrored_for_both_camera_modes(self):
        visible=[{"side":"Left","points":[[0.8,0.25],[0.2,0.75]]}]
        mapped=landmarks_for_preview(visible)
        self.assertAlmostEqual(mapped[0]["points"][0][0], 0.2)
        self.assertAlmostEqual(mapped[0]["points"][0][1], 0.25)
        self.assertAlmostEqual(mapped[0]["points"][1][0], 0.8)
        self.assertAlmostEqual(mapped[0]["points"][1][1], 0.75)
        # Input is not mutated, which protects the model/display separation.
        self.assertEqual(visible[0]["points"], [[0.8,0.25],[0.2,0.75]])
if __name__=='__main__': unittest.main()
