"""SAHAYAK Flask API. Run locally with python web_app.py; deploy API separately from Netlify."""
from pathlib import Path
import base64, os, json, urllib.parse, urllib.request, urllib.error, threading
import cv2, numpy as np, joblib, mediapipe as mp
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from features import two_hand_features, two_hand_sequence_features, landmarks_for_preview, TOTAL_FEATURES
from sequence_features import summarize_sequence, MIN_SEQUENCE_FRAMES, SEQUENCE_FEATURES
from sequence_db import DB_PATH as SEQUENCE_DB_PATH, add_sample as add_sequence_sample, summary as sequence_db_summary, load_samples as load_sequence_samples, init_db as init_sequence_db
ROOT = Path(__file__).resolve().parent
WEB = ROOT / "website"
MODEL_PATH = ROOT / "model" / "sahayak_twohand.joblib"
SEQUENCE_MODEL_PATH = ROOT / "model" / "sahayak_sequence.joblib"
app = Flask(__name__, static_folder=str(WEB), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": os.environ.get("SAHAYAK_FRONTEND_ORIGIN", "*")}})
model = None
sequence_model = None
init_sequence_db()
hands = mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=2, model_complexity=0, min_detection_confidence=.55)
hands_lock = threading.Lock()
def get_sequence_model():
    global sequence_model
    if sequence_model is None and SEQUENCE_MODEL_PATH.exists():
        candidate = joblib.load(SEQUENCE_MODEL_PATH)
        if getattr(candidate, "n_features_in_", None) != SEQUENCE_FEATURES:
            raise ValueError(f"Sequence model must accept {SEQUENCE_FEATURES} ordered temporal features.")
        sequence_model = candidate
    return sequence_model

def sequence_summary(frames):
    """Shared ordered temporal summary used by both training and inference."""
    return summarize_sequence(frames).reshape(1, -1)

def get_model():
    global model
    if model is None and MODEL_PATH.exists():
        candidate = joblib.load(MODEL_PATH)
        if getattr(candidate, "n_features_in_", None) != TOTAL_FEATURES:
            raise ValueError("The saved model is not a compatible two-hand model. Train it with the updated train_model.py.")
        model = candidate
    return model
@app.get("/")
def home(): return send_from_directory(WEB, "index.html")
@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "service": "SAHAYAK",
        "message": "Backend is responding"
    })
@app.get("/api/status")
def status():
    model_error = None
    try:
        ready = get_model() is not None
    except Exception as exc:
        ready = False
        model_error = str(exc)
    sequence_ready = False
    sequence_error = None
    if SEQUENCE_MODEL_PATH.exists():
        try:
            sequence_ready = get_sequence_model() is not None
        except Exception as exc:
            sequence_error = str(exc)
    return jsonify({"project":"SAHAYAK", "developer":"Mr. Johan Jyoti Kuli", "model_ready":ready, "ready":ready, "mode":"two-hand", "sequence_model_ready":sequence_ready, "sequence_input_frames":MIN_SEQUENCE_FRAMES, "sequence_features":SEQUENCE_FEATURES, "model_error":model_error, "sequence_error":sequence_error, "sequence_database":sequence_db_summary(), "message":"Two-hand recognition model ready." if ready else (model_error or "Single-sign model missing. Restore the original model before recognition.")})
@app.post("/api/predict")
def predict():
    try: clf = get_model()
    except Exception as e: return jsonify({"error":str(e)}), 500
    if clf is None: return jsonify({"error":"Two-hand model not trained yet. Collect data and run python train_model.py; use --promote only when ready to replace the live model."}), 503
    body = request.get_json(silent=True) or {}
    data_url = body.get("image", "")
    if not isinstance(data_url, str) or "," not in data_url: return jsonify({"error":"No camera frame received."}), 400
    try:
        encoded = data_url.split(",", 1)[1]
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 1_500_000: return jsonify({"error":"Frame too large; lower camera resolution."}), 413
        frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    except Exception: frame = None
    if frame is None: return jsonify({"error":"Could not decode camera frame."}), 400
    # Always mirror the inference frame to preserve the original model's preprocessing.
    # Convert returned landmarks back to raw camera coordinates for both cameras. The
    # frontend mirrors the preview AND overlay together for the front camera only.
    frame = cv2.flip(frame, 1)
    with hands_lock:
        result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    features, visible = two_hand_features(result)
    temporal_features = two_hand_sequence_features(result)
    visible = landmarks_for_preview(visible)
    if features is None:
        response = {"recognized":False,"sign":"","confidence":0,"hands":0,"landmarks":[],"message":"No hand detected. Show one or both hands clearly."}
        if body.get("include_features"):
            response["features"] = [0.0] * TOTAL_FEATURES
            response["sequence_features"] = []
            response["valid_features"] = False
        return jsonify(response)
    probs = clf.predict_proba(features)[0]
    idx = int(np.argmax(probs)); confidence = float(probs[idx]); sign = str(clf.classes_[idx])
    accepted = confidence >= .60
    response = {"recognized":accepted,"sign":sign if accepted else "","confidence":round(confidence*100,1),"hands":len(visible),"landmarks":visible,"message":"Sign recognized." if accepted else "Uncertain sign; hold it steady and try again."}
    if body.get("include_features"):
        response["features"] = features[0].astype(float).tolist()
        response["sequence_features"] = temporal_features[0].astype(float).tolist() if temporal_features is not None else []
        response["valid_features"] = temporal_features is not None
    return jsonify(response)


@app.get("/api/sequence/samples")
def sequence_samples_status():
    """Return counts only; raw landmark sequences are not exposed by GET."""
    try:
        return jsonify(sequence_db_summary())
    except Exception as exc:
        return jsonify({"error": "Could not read continuous-sign database: " + str(exc)}), 500

@app.post("/api/sequence/samples")
def save_sequence_sample():
    """Validate and persist one labelled variable-length sample (one or more valid frames) to its own SQLite DB."""
    body = request.get_json(silent=True) or {}
    try:
        label = body.get("label", "")
        frames = body.get("frames", [])
        sample_id = add_sequence_sample(label, frames)
        return jsonify({"saved": True, "id": sample_id, "label": str(label).strip().upper().replace(" ", "_"),
                        "frames": len(frames), "database": SEQUENCE_DB_PATH.name,
                        "summary": sequence_db_summary()}), 201
    except (ValueError, TypeError) as exc:
        return jsonify({"saved": False, "error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Could not save continuous-sign sample")
        return jsonify({"saved": False, "error": "Could not save sample to continuous database: " + str(exc)}), 500

@app.get("/api/sequence/export")
def export_sequence_samples():
    """Download validated database samples as JSON for portable backup/training."""
    try:
        return jsonify(load_sequence_samples())
    except Exception as exc:
        return jsonify({"error": "Could not export continuous-sign samples: " + str(exc)}), 500

@app.post("/api/sequence/predict")
def predict_sequence():
    try:
        body = request.get_json(silent=True) or {}
        frames = body.get("frames")
        summary = sequence_summary(frames)
        clf = get_sequence_model()
        if clf is None:
            return jsonify({"ready":False,"error":"No trained sequence model installed. Collect at least two samples for each of two or more labels, then run python train_sequence_model.py --db."}), 503
        probs = clf.predict_proba(summary)[0] if hasattr(clf, "predict_proba") else None
        if probs is not None:
            idx = int(np.argmax(probs)); label = str(clf.classes_[idx]); confidence = float(probs[idx])
            accepted = confidence >= 0.60
        else:
            label = str(clf.predict(summary)[0]); confidence = None; accepted = True
        return jsonify({"ready":True,"recognized":accepted,"sign":label if accepted else "","confidence":round(confidence*100,1) if confidence is not None else None,"frames":len(frames),"message":"Sequence recognized." if accepted else "Sequence uncertain; perform the complete sign clearly and try again."})
    except ValueError as e:
        return jsonify({"ready":False,"error":str(e)}), 400
    except Exception as e:
        return jsonify({"ready":False,"error":"Sequence model unavailable: " + str(e)}), 500

@app.post("/api/translate")
def translate_text():
    body = request.get_json(silent=True) or {}
    source_text = body.get("text", "")
    source_lang = body.get("source", "en")
    target_lang = body.get("target", "hi")
    if not isinstance(source_text, str) or not source_text.strip():
        return jsonify({"error":"Enter text to translate."}), 400
    if len(source_text) > 5000:
        return jsonify({"error":"Text is too long (maximum 5000 characters)."}), 400
    allowed = {"en","hi","as","bn","ne","ta","te","mr","gu","pa","ur","fr","es","de","it","pt","ar","zh","ja","ko","ru"}
    if source_lang not in allowed or target_lang not in allowed:
        return jsonify({"error":"Unsupported language selection."}), 400
    if source_lang == target_lang:
        return jsonify({"original":source_text,"translated":source_text,"source":source_lang,"target":target_lang,"provider":"same-language"})
    # MyMemory is an online service; only text is sent, never frames or landmarks.
    query = urllib.parse.urlencode({"q":source_text, "langpair":f"{source_lang}|{target_lang}"})
    req = urllib.request.Request("https://api.mymemory.translated.net/get?" + query, headers={"User-Agent":"SAHAYAK/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
        translated = payload.get("responseData", {}).get("translatedText", "")
        if payload.get("responseStatus") != 200 or not translated:
            raise RuntimeError(payload.get("responseDetails") or "Translation provider returned no translation.")
        return jsonify({"original":source_text,"translated":translated,"source":source_lang,"target":target_lang,"provider":"MyMemory (online)"})
    except Exception as e:
        return jsonify({"error":"Online translation failed. Original text is preserved.","detail":str(e)}), 502

@app.errorhandler(413)
def too_large(_): return jsonify({"error":"Request too large. Reduce camera resolution."}), 413
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000")); host = os.environ.get("HOST", "0.0.0.0")
    print(f"SAHAYAK API listening on {host}:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)
