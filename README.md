# SAHAYAK — Local Training + Current Unified Website

**Lead developer:** Mr. Johan Jyoti Kuli  
**Purpose:** Keep the existing static and continuous datasets, train new signs safely on Windows/Python 3.11, test locally, then copy only the approved model artifact(s) into a separate clone of the GitHub deployment repository.

This package intentionally excludes `.venv`. It preserves the uploaded project's existing datasets, models, legacy folders, and database files, and includes the current website UI/UX and unified Live Studio from the SAHAYAK GitHub deployment. The local `website/config.js` points to `http://127.0.0.1:5000` so the local UI uses this local Flask backend. The separate `deployment/SAHAYAK-Vercel-Deployment/frontend/config.js` points to the production Render API.

## Important: one Studio, two trained models

Live Studio combines both recognition paths in one user experience. Training still has two distinct datasets and model artifacts:

- **Static pose:** `data/landmarks_2hand.csv` → `train_model.py` → `model/sahayak_twohand.joblib`. Each sample has 126 values (2 hands × 21 landmarks × 3 coordinates).
- **Continuous movement:** `continuous_gesture_db.db` → `train_sequence_model.py` → `model/sahayak_sequence.joblib`. Each recorded frame has 132 values; the sequence utility resamples a whole recording into 10 time bins (1,320 model-input values).

The static collector appends rows to the CSV. The continuous collector appends records to the SQLite database. Do not delete either file or train a replacement model on only the new sign. The old samples must stay in the training set so the model can retain previous classes.

## 1. Create the Python environment

Use Python 3.11 on Windows. Open PowerShell in this folder:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
python -c "import cv2, mediapipe, sklearn, flask; print('scikit-learn:', sklearn.__version__)"
```

The installed scikit-learn version should be `1.9.1`, which is pinned for the existing model artifacts. If PowerShell blocks activation, use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and activate again. Do not include the `.venv` folder in ZIPs or GitHub commits.

## 2. Run the local website and check model readiness

```powershell
python web_app.py
```

Open `http://127.0.0.1:5000`. The updated home page and unified Live Studio are served locally. Camera access should be started from a user action in the browser. MediaPipe's browser scripts use CDN assets, so initial setup/testing requires internet access. Backend predictions use the local Flask service.

Check `http://127.0.0.1:5000/api/health` and `http://127.0.0.1:5000/api/status`. The status response lists the class names from each active model. Do not claim an accuracy percentage unless you have a documented evaluation set.

## 3. Add a static sign

Use this pathway only when the sign can primarily be classified from a stable hand pose.

1. Back up `data/landmarks_2hand.csv` and the active static model before collecting.
2. Run `python collect_data.py`.
3. Enter one consistent uppercase label, such as `PLEASE`. Press **S** to toggle collection on/off; press **Q** or **Esc** to exit. The script appends labelled 126-value samples to the existing CSV.
4. Run `python train_model.py`. This trains from the **entire CSV (all old labels plus the new samples)** and creates `model/sahayak_twohand_candidate.joblib`. It does not overwrite the active model.
5. Review the sample counts and holdout report. Confirm that the candidate includes the previous classes and the new one:

   ```powershell
   python -c "import joblib; print(joblib.load('model/sahayak_twohand_candidate.joblib').classes_)"
   ```

6. If results are acceptable, run `python train_model.py --promote`. It backs up the active model and label metadata under `model/backups/<timestamp>/` before replacement.
7. Start/restart `python web_app.py`, then test the new sign and every previous sign in Live Studio. If performance regresses, restore the backed-up active model and `model/labels_twohand.json`.

A label added only to a JSON file is not a trained sign. Collect labelled examples and retrain the model.

## 4. Add a continuous / motion-based sign

Use this pathway when the movement over time is essential to the meaning. A sign can use one hand or two hands and still be continuous. Before collecting a phrase-based sign, confirm a consistent version of the sign with a fluent Indian Sign Language user or qualified source.

1. Back up `continuous_gesture_db.db` and `model/sahayak_sequence.joblib`.
2. Run `python collect_sequences.py`.
3. Enter a label such as `WHAT_IS_YOUR_NAME`. Press **C** to start recording the full movement, then press **C** again to stop and save that sample. Repeat to capture varied examples. Press **Q** or **Esc** when finished.
4. Existing sequence samples stay in `continuous_gesture_db.db`; new records are appended. Verify label counts before training. Aim for 20–50+ varied samples per class as a starting point, not a guarantee; the script requires at least two examples per class to train.
5. Run `python train_sequence_model.py --db`. It reads all samples in the existing database (old and new), prints validation/holdout details when class counts allow it, and writes the candidate `model/sahayak_sequence_candidate.joblib`. It does not replace the active sequence model by default.
6. Check the candidate's classes:

   ```powershell
   python -c "import joblib; print(joblib.load('model/sahayak_sequence_candidate.joblib').classes_)"
   ```

   Confirm that old sequence labels remain alongside `WHAT_IS_YOUR_NAME`. If the new class has fewer than two samples or the script reports invalid frames, collect more samples and correct the dataset before continuing.
7. After reviewing the report and confirming the candidate's classes, run `python train_sequence_model.py --db --promote`. This creates a backup in `model/backups/<timestamp>/` and replaces only `model/sahayak_sequence.joblib`. It never replaces the static model or either database.
8. Restart `python web_app.py`; test the new continuous sign and every previously supported continuous sign in Live Studio.

Note: the `--promote` run trains again from the current database and then promotes the resulting candidate. Do not change the database between your candidate review and promotion.

## 5. Keep the UI, API, and local config aligned

The local project now uses the latest website files in `website/` and the current compatible Flask API in `web_app.py`. Keep the local config at `http://127.0.0.1:5000` for local runs. The deployment source copy in `deployment/SAHAYAK-Vercel-Deployment/frontend/config.js` points to Render. Do not copy the local config into the production frontend.

The browser-based Studio calls `/api/predict-features` for static features and `/api/sequence/predict` for motion sequences. `web_app.py` implements these endpoints, along with status, sequence database, translation, and speech endpoints.

## 6. Deploy a tested new model to GitHub/Render

Do **not** upload your whole local training folder or overwrite the whole deployment directory. Keep the training project separate from a clean clone of `https://github.com/Mrjohanjyotikuli/SAHAYAK-ISL`.

1. Clone or update the GitHub repo in a separate folder. Its path must contain `SAHAYAK-Vercel-Deployment/backend/`.
2. From this training-project root, stage only the approved model using the helper script. For a static model:

   ```powershell
   .\sync_model_to_github.ps1 -RepoPath "C:\PATH\TO\SAHAYAK-ISL" -ModelType Static
   ```

   For a continuous model:

   ```powershell
   .\sync_model_to_github.ps1 -RepoPath "C:\PATH\TO\SAHAYAK-ISL" -ModelType Continuous
   ```

   Replace the placeholder with the actual cloned repository folder. The script copies only the selected active model; static updates also copy the corresponding `labels_twohand.json` metadata. It never copies the CSV, sequence database, `.venv`, candidate model, or backups.
3. In a terminal opened inside that **Git clone**, inspect `git status --short`. For static: `git add SAHAYAK-Vercel-Deployment/backend/model/sahayak_twohand.joblib SAHAYAK-Vercel-Deployment/backend/labels_twohand.json`. For continuous: `git add SAHAYAK-Vercel-Deployment/backend/model/sahayak_sequence.joblib`.
4. Commit and push, for example:

   ```powershell
   git commit -m "Update continuous sign recognition model"
   git push origin main
   ```

   Use an appropriate commit message for static updates. If updating both models, stage both files and the static label metadata in the same commit.
5. If Render is connected to the correct branch and automatic deployment is enabled, it should redeploy the backend after the push. Vercel normally does not need a new build for a model-only change because the frontend has not changed.
6. After deployment completes, check `https://sahayak-backend-krh1.onrender.com/api/status`. Confirm the appropriate `single_sign_labels` or `sequence_sign_labels` contains the new label and that both models report ready. Then test the new and previous signs at `https://sahayak-eight-lac.vercel.app/studio.html`.

If the online model fails to load or older signs regress, roll back the model artifact in the Git clone to the previous known-good version and push again. Never delete your local backups.

## Existing data and legacy files preserved

- Static samples: `data/landmarks_2hand.csv` (CSV rows are appended by `collect_data.py`).
- Continuous samples: `continuous_gesture_db.db` (records are appended by `collect_sequences.py`).
- Active models and backups: `model/`.
- Legacy databases `gesture_db.db` and `Code/gesture_db.db` plus the `Code/` folder are kept as provided; the new collectors/trainers do not use them.
- Previous READMEs are retained as `README_BEFORE_UI_SYNC.md` and `WINDOWS_SETUP_BEFORE_UI_SYNC.md` for reference.

## Limits

This remains a limited-vocabulary prototype, not a complete Indian Sign Language translator. Predictions depend on signer, lighting, camera angle, segmentation, data quality, and the model. The updated website does not automatically increase model accuracy. Some online functions and browser-loaded assets need internet access. Runtime databases on a hosting platform may be ephemeral unless persistent storage is configured.
