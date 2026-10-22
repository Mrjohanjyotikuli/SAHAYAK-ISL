"""Regression checks for the current unified SAHAYAK website + local Flask API."""
from pathlib import Path
import re
import unittest
import json

ROOT = Path(__file__).resolve().parent
WEBSITE = ROOT / "website"
HOME = (WEBSITE / "index.html").read_text(encoding="utf-8")
STUDIO = (WEBSITE / "studio.html").read_text(encoding="utf-8")
CONFIG = (WEBSITE / "config.js").read_text(encoding="utf-8")
SERVICE_WORKER = (WEBSITE / "service-worker.js").read_text(encoding="utf-8")
BACKEND = (ROOT / "web_app.py").read_text(encoding="utf-8")


def html_ids(text):
    return re.findall(r'\bid=["\']([^"\']+)["\']', text)


class CurrentWebsiteRegressionTests(unittest.TestCase):
    def test_home_and_studio_have_no_duplicate_ids(self):
        for label, source in (("home", HOME), ("studio", STUDIO)):
            ids = html_ids(source)
            duplicates = sorted({item for item in ids if ids.count(item) > 1})
            self.assertEqual(duplicates, [], f"Duplicate IDs on {label}: {duplicates}")

    def test_simple_studio_javascript_id_references_exist(self):
        ids = set(html_ids(STUDIO))
        refs = set(re.findall(r"\$\(['\"]([^'\"]+)['\"]\)", STUDIO))
        refs |= set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", STUDIO))
        missing = sorted(ref for ref in refs if ref not in ids)
        self.assertEqual(missing, [], f"Studio JS references missing IDs: {missing}")

    def test_team_cards_show_role_specific_responsibilities(self):
        for role in (
            "Lead Developer · Full-System Design &amp; Integration",
            "Introduction, Problem &amp; Project Purpose",
            "System Design, Technology &amp; Workflow",
            "Live Demo, Testing &amp; Conclusion",
        ):
            self.assertIn(role, HOME)
        self.assertNotIn("Project team member", HOME)

    def test_studio_is_the_unified_single_and_motion_experience(self):
        self.assertIn("Single and motion-based signs are combined automatically", STUDIO)
        self.assertIn("/api/predict-features", STUDIO)
        self.assertIn("/api/sequence/predict", STUDIO)
        self.assertIn("/api/status", STUDIO)
        self.assertIn("new Hands(", STUDIO)

    def test_sequence_sample_api_and_export_are_present_in_studio(self):
        self.assertIn("/api/sequence/samples", STUDIO)
        self.assertIn("/api/sequence/export", STUDIO)
        self.assertIn("saveSequence", STUDIO)
        self.assertIn("exportSequences", STUDIO)

    def test_local_config_points_to_local_flask_api(self):
        self.assertIn('window.SAHAYAK_API_BASE = "http://127.0.0.1:5000"', CONFIG)

    def test_backend_exposes_the_studio_prediction_routes(self):
        for route in (
            '/api/health', '/api/status', '/api/predict-features', '/api/predict',
            '/api/sequence/samples', '/api/sequence/export', '/api/sequence/predict',
            '/api/translate', '/api/speech'
        ):
            self.assertIn(route, BACKEND)

    def test_cache_version_is_bumped_for_synced_ui(self):
        self.assertRegex(SERVICE_WORKER, r"const CACHE = 'sahayak-shell-v22-[^']+';")

    def test_static_metadata_preserves_original_classes(self):
        labels = json.loads((ROOT / "model" / "labels_twohand.json").read_text(encoding="utf-8"))
        self.assertTrue({"HELLO", "YES", "NO", "THANK_YOU", "I_LOVE_YOU"}.issubset(set(labels)))


if __name__ == "__main__":
    unittest.main()
