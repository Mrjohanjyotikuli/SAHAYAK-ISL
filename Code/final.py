"""Launch the SAHAYAK web interface.

From the project root, run `python web_app.py`.
If you run this file directly from Code/, it starts the same local website.
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from web_app import app

if __name__ == "__main__":
    print("SAHAYAK is starting at http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
