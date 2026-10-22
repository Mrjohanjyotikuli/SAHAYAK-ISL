# Windows quick start — SAHAYAK local training project

1. Extract this ZIP to a folder you control. `.venv` is intentionally not included.
2. Open PowerShell in that folder and run:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   python -m pip install -r requirements.txt
   python -m pip check
   ```

3. Start the current UI and API together: `python web_app.py`; open `http://127.0.0.1:5000`.
4. Add a static sign with `python collect_data.py`, then train a candidate using `python train_model.py`. Only run `python train_model.py --promote` after you review the report and class list.
5. Add a moving sign with `python collect_sequences.py`, record the full sign with C start/C stop, then train a candidate using `python train_sequence_model.py --db`. Only run `python train_sequence_model.py --db --promote` after review.
6. The static CSV and continuous SQLite database are separate and both keep the older samples. Back them up before recording. Do not replace either file with an empty copy.
7. Test old and new signs in the unified Live Studio before deployment.
8. Follow `DEPLOY_NEW_MODELS_TO_GITHUB.md` to copy only the promoted model to a separate Git clone and redeploy.

Python 3.11 and the pinned scikit-learn version 1.9.1 are expected for the serialized models. Camera access on the same computer is supported on `localhost`; remote phone access over plain HTTP may not have camera permission.
