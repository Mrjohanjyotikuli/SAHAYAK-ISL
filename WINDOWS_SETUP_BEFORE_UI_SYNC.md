# Windows setup

1. Use Python 3.11.
2. In PowerShell at the project root: `py -3.11 -m venv .venv`
3. Activate: ` .\.venv\Scripts\Activate.ps1` (remove the leading space when typing).
4. Install: `python -m pip install --upgrade pip` then `python -m pip install -r requirements.txt`.
5. Run tests: `python -m unittest test_sahayak.py`; check dependencies with `python -m pip check`.
6. Run locally: `python web_app.py`; open `http://127.0.0.1:5000`.
7. Translation uses online MyMemory through the Flask backend. Local phrase speech remains browser-based.
8. Sequence collection: start camera, start continuous, enter a label, record the complete sign (any non-empty number of valid frames), then save the sample, repeat for multiple labels, export JSON. Then run `python train_sequence_model.py sahayak-sequences.json` from the project root (use the exported file path). The sequence model is separate from the original single-sign model. Collect at least two samples per label for script validation; dozens per label are recommended for useful performance.
9. Netlify hosts the frontend only; deploy Flask API separately and set `website/config.js` to its HTTPS URL. Configure CORS via `SAHAYAK_FRONTEND_ORIGIN`.
