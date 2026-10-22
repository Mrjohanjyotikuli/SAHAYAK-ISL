# SAHAYAK
**A Real-Time Sign Language Recognition System for Differently-Abled Persons**  
Developed by **Mr. Johan Jyoti Kuli**

## Important architecture note
Netlify serves the phone-friendly website. The Flask + MediaPipe recognition API must run separately on Render (or another Python host) for live recognition. Phone camera access requires HTTPS. A web page cannot guarantee zero latency; live predictions depend on the phone, network and server. The phrase pad is local/offline after the website has been cached. Text-to-speech offline works only if the device/browser has an offline voice installed.

## Keep your existing Python environment
The preserved model was serialized with scikit-learn 1.9.1, so `requirements.txt` pins that version. Use your existing Python 3.11 `.venv`; verify `python -c "import cv2, mediapipe, sklearn, flask; print(sklearn.__version__)"` reports 1.9.1 before running the backend.

## Collect and train a two-hand model
1. Activate the existing environment.
2. Run `python collect_data.py`.
3. Type a label, e.g. `HELLO`. Press **S** to toggle sample capture and **Q** or **Esc** to quit. The window-close button also exits. It tries camera index 1 first, then 0 and other indexes; set `SAHAYAK_CAMERA_INDEX=0` if needed.
4. Repeat for every sign, using the same label spelling. Collect about 150–300 samples per sign. For two-hand signs, show both hands; for one-hand signs, keep the same framing. Dataset is saved separately to `data/landmarks_2hand.csv`, so the older 63-feature dataset is not overwritten.
5. Run `python train_model.py` to build `model/sahayak_twohand_candidate.joblib`; this does not replace the working model. Check the holdout report. Only when you intentionally want to replace the live model, run `python train_model.py --promote`. The script backs up the previous model and label file under `model/backups/<timestamp>/` before promotion.
6. Run `python web_app.py`, then open `http://127.0.0.1:5000` to test locally.

## Continuous-sign collection, database and separate training
This is a separate pipeline. It never overwrites `model/sahayak_twohand.joblib`, `model/labels_twohand.json`, `data/landmarks_2hand.csv`, or either legacy `gesture_db.db`.

### Option A — visible desktop webcam collector
1. Activate the existing Python 3.11 virtual environment.
2. Run `python collect_sequences.py`.
3. Enter one sequence label, such as `WAVE` or `THANK_YOU`.
4. In the visible webcam window, press **C** and perform the complete sign movement. The collector stores a complete variable-length sample (one or more valid temporal frames) (132 values: the original 126 pose values plus six wrist-position values); frames without a detected hand do not count. Press **C** again to collect another varied example, and **Q/Esc** to exit.
5. Repeat the collector for each label. Aim for 20–50+ varied samples per label; two samples per label is only a technical minimum, not enough for dependable recognition.

Samples are stored in the separate SQLite file `continuous_gesture_db.db`, table `sequence_samples`. The original root `gesture_db.db` and legacy `Code/gesture_db.db` are not used or modified by this pipeline.

### Option B — website collector
1. Run `python web_app.py` and open `http://127.0.0.1:5000`.
2. Start the camera and choose **Continuous Sign** mode (or use the continuous collection controls).
3. Enter a label and collect the complete sign and click **Save captured sample**; any non-empty sample is accepted. The website posts the labelled features to the API, which validates and stores them in `continuous_gesture_db.db`.
4. Use **Export samples JSON** for a portable backup if needed.

### Train the continuous model
Run `python train_sequence_model.py --db` (this is also the default if no argument is given). To train from an exported JSON backup instead, run `python train_sequence_model.py sahayak-sequences.json`.

The script validates each sample and label, then writes only `model/sahayak_sequence.joblib`. `/api/status` reports whether the separate sequence model is available. Restart the backend if needed. The website mode selector routes output: **Single Sign** uses the existing model; **Continuous Sign** uses the sequence model after a rolling window of 60 valid frames. This temporal baseline classifies complete labelled movement patterns; it is not a universal sentence-level sign-language translator and only recognizes labels represented in training data.

Run automated checks with `python -m pytest -q` (or `python -m unittest test_sahayak.py test_sequence.py test_sequence_db.py -v`). See `TEST_REPORT.md` for what was and was not verified.

## Deploy
- Deploy this project's root as a Python web service on Render; start command: `gunicorn web_app:app`. Ensure the model file is included in the deployed service (train locally, then include `model/sahayak_twohand.joblib` and `model/labels_twohand.json` in the deploy source; never commit private data).
- Set `website/config.js` to `window.SAHAYAK_API_BASE = "https://YOUR-API-SERVICE.onrender.com";` using the real URL supplied by Render.
- Deploy the `website` folder to Netlify. Netlify alone cannot run the Python API.
- Open the Netlify HTTPS URL on the phone, grant camera permission, select a camera, then Start camera. If the API is sleeping or offline, live recognition pauses but phrase typing still works after the page has been cached.

## Offline phrase pad, translation and speech
The phrase field is stored locally in the same browser and has speak/stop controls. The built-in offline phrasebook includes a curated set of English phrases with saved Hindi, Assamese and Bengali translations; choose **Offline translation** to use those without internet. This is not a general offline machine translator. Arbitrary typed text can be translated with the online MyMemory provider, which receives text only (never images or landmarks). Original and translated text have separate speech controls. Offline speech requires a compatible voice installed/downloaded on the device; browser speech APIs cannot guarantee every language voice is available. Cache the site once while online for offline phrase-pad assets.

## Tests and limitations
The project includes a small API smoke-test script. Automated checks can validate syntax, feature dimensions and API error paths, but cannot validate real hand recognition without your collected dataset, physical camera, deployed backend and phone browser. Recognition is a trained classifier, not a universal sign-language translator; only the signs represented in your training data can be recognized.


## Multilingual phrase input upgrade
- The phrase pad has an input-language selector (English, Hindi, Assamese, Bengali, Nepali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Urdu, French, Spanish, German, Italian, Portuguese, Arabic, Chinese, Japanese, Korean, Russian).
- Choose a target language and select **Translate typed phrase** to translate custom text. Arbitrary text translation uses the online MyMemory provider; text is still saved locally and can be typed/edited offline.
- Built-in phrasebook translations remain available offline only for the languages/phrases included in the dictionary. Speech selects a matching installed browser voice when available.


## Mobile camera and responsiveness
- The website requests a modest 320×240 camera stream and sends compressed JPEG frames to reduce mobile upload time. It processes one request at a time and aborts stale requests when the camera is switched or stopped.
- Use HTTPS for Netlify and set `window.SAHAYAK_API_BASE` in `website/config.js` to the HTTPS URL of the separately hosted Flask backend. Recognition latency still depends on phone performance, internet connection, and backend region/load; a remote API cannot guarantee zero delay.
- The camera switch control is shared by Single Sign and Continuous Sign modes. Front-camera preview and annotations are mirrored together; rear-camera preview and annotations are unmirrored. The backend preserves the old mirrored preprocessing by default for older clients.
- Mobile browsers must grant camera permission. On iOS Safari, keep `playsinline` and `autoplay` enabled and start the camera from a user tap.
