"""SAHAYAK Flask API. Run locally with python web_app.py; deploy API separately from Netlify."""
from pathlib import Path
import os
# Limit native numerical-library thread oversubscription on the small Render instance.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
import base64, json, urllib.parse, urllib.request, urllib.error, threading, time, logging
import cv2, numpy as np, joblib, mediapipe as mp
cv2.setNumThreads(1)
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
# Explicit INFO level is required so inference-stage timings are visible in Render logs.
app.logger.setLevel(logging.INFO)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": os.environ.get("SAHAYAK_FRONTEND_ORIGIN", "*")}})
model = None
sequence_model = None
init_sequence_db()
hands = mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=2, model_complexity=0, min_detection_confidence=.50)
hands_lock = threading.Lock()

# Warm MediaPipe inside the Render worker before the first real camera frame.
try:
    _warm_started = time.monotonic()
    with hands_lock:
        hands.process(np.zeros((240, 320, 3), dtype=np.uint8))
    app.logger.info("[SAHAYAK] MediaPipe warm-up completed in %.0f ms", (time.monotonic() - _warm_started) * 1000)
except Exception:
    app.logger.exception("[SAHAYAK] MediaPipe warm-up failed; live requests will still attempt detection")

@app.before_request
def trace_api_request_start():
    request.environ["sahayak_started_at"] = time.monotonic()
    if request.path.startswith("/api/"):
        app.logger.info("[SAHAYAK] request_start method=%s path=%s bytes=%s", request.method, request.path, request.content_length or 0)

@app.after_request
def trace_api_request_finish(response):
    started = request.environ.get("sahayak_started_at")
    if request.path.startswith("/api/") and started is not None:
        elapsed_ms = (time.monotonic() - started) * 1000
        app.logger.info("[SAHAYAK] request_done method=%s path=%s status=%s elapsed_ms=%.0f", request.method, request.path, response.status_code, elapsed_ms)
    return response
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
@app.post("/api/predict-features")
def predict_features():
    """Classify browser-computed hand landmarks without running MediaPipe on the server."""
    started = time.monotonic()
    app.logger.info("[SAHAYAK] feature_predict_stage=begin bytes=%s", request.content_length or 0)
    try:
        clf = get_model()
    except Exception as exc:
        app.logger.exception("[SAHAYAK] feature_predict_stage=model_load_failed")
        return jsonify({"error": str(exc)}), 500
    if clf is None:
        return jsonify({"error": "Two-hand classifier model is missing."}), 503
    body = request.get_json(force=True, silent=True) or {}
    raw_features = body.get("features")
    if not isinstance(raw_features, list) or len(raw_features) != TOTAL_FEATURES:
        return jsonify({"error": f"Expected exactly {TOTAL_FEATURES} normalized hand features."}), 400
    try:
        values = np.asarray([float(value) for value in raw_features], dtype=np.float32)
    except (TypeError, ValueError, OverflowError):
        return jsonify({"error": "Hand features must contain numeric values."}), 400
    if not np.isfinite(values).all():
        return jsonify({"error": "Hand features contain non-finite values."}), 400
    raw_sequence = body.get("sequence_features", [])
    sequence_values = []
    if isinstance(raw_sequence, list) and len(raw_sequence) == SEQUENCE_FEATURES:
        try:
            parsed_sequence = [float(value) for value in raw_sequence]
            if np.isfinite(parsed_sequence).all():
                sequence_values = parsed_sequence
        except (TypeError, ValueError, OverflowError):
            sequence_values = []
    raw_visible = body.get("landmarks", [])
    visible = []
    if isinstance(raw_visible, list):
        for hand in raw_visible[:2]:
            if not isinstance(hand, dict):
                continue
            points = hand.get("points")
            if not isinstance(points, list) or len(points) != 21:
                continue
            safe_points = []
            try:
                for point in points:
                    if not isinstance(point, (list, tuple)) or len(point) != 2:
                        raise ValueError("Invalid landmark point")
                    x, y = float(point[0]), float(point[1])
                    if not np.isfinite([x, y]).all():
                        raise ValueError("Invalid landmark point")
                    safe_points.append([x, y])
            except (TypeError, ValueError, OverflowError):
                continue
            visible.append({"side": str(hand.get("side", "Detected"))[:16], "points": safe_points})
    app.logger.info("[SAHAYAK] feature_predict_stage=validated hands=%s elapsed_ms=%.0f", len(visible), (time.monotonic() - started) * 1000)
    try:
        probs = clf.predict_proba(values.reshape(1, -1))[0]
        index = int(np.argmax(probs))
        confidence = float(probs[index])
        sign = str(clf.classes_[index])
    except Exception as exc:
        app.logger.exception("[SAHAYAK] feature_predict_stage=classifier_failed")
        return jsonify({"error": "Classifier prediction failed: " + str(exc)}), 500
    accepted = confidence >= .60
    response = {
        "recognized": accepted,
        "sign": sign if accepted else "",
        "confidence": round(confidence * 100, 1),
        "hands": len(visible),
        "landmarks": visible,
        "message": "Sign recognized." if accepted else "Uncertain sign; hold it steady and try again.",
        "valid_features": len(sequence_values) == SEQUENCE_FEATURES,
        "sequence_features": sequence_values
    }
    if body.get("include_features"):
        response["features"] = values.astype(float).tolist()
    app.logger.info("[SAHAYAK] feature_predict_stage=complete status=200 elapsed_ms=%.0f", (time.monotonic() - started) * 1000)
    return jsonify(response)


@app.post("/api/predict")
def predict():
    predict_started = time.monotonic()
    app.logger.info("[SAHAYAK] predict_stage=begin bytes=%s", request.content_length or 0)
    try: clf = get_model()
    except Exception as e:
        app.logger.exception("[SAHAYAK] predict_stage=model_load_failed")
        return jsonify({"error":str(e)}), 500
    if clf is None: return jsonify({"error":"Two-hand model not trained yet. Collect data and run python train_model.py; use --promote only when ready to replace the live model."}), 503
    body = request.get_json(force=True, silent=True) or {}
    data_url = body.get("image", "")
    if not isinstance(data_url, str) or "," not in data_url: return jsonify({"error":"No camera frame received."}), 400
    try:
        encoded = data_url.split(",", 1)[1]
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 1_500_000: return jsonify({"error":"Frame too large; lower camera resolution."}), 413
        frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    except Exception: frame = None
    if frame is None:
        app.logger.warning("[SAHAYAK] predict_stage=decode_failed elapsed_ms=%.0f", (time.monotonic() - predict_started) * 1000)
        return jsonify({"error":"Could not decode camera frame."}), 400
    app.logger.info("[SAHAYAK] predict_stage=decoded width=%s height=%s elapsed_ms=%.0f", frame.shape[1], frame.shape[0], (time.monotonic() - predict_started) * 1000)
    # Always mirror the inference frame to preserve the original model's preprocessing.
    # Convert returned landmarks back to raw camera coordinates for both cameras. The
    # frontend mirrors the preview AND overlay together for the front camera only.
    frame = cv2.flip(frame, 1)
    app.logger.info("[SAHAYAK] predict_stage=mediapipe_start width=%s height=%s dtype=%s", frame.shape[1], frame.shape[0], frame.dtype)
    # Each HTTP request supplies an independent still frame, not a persistent video stream.
    # Use a contiguous RGB buffer and static-image detection so MediaPipe does not depend on
    # state/tracking history from a prior request or a different camera session.
    rgb_frame = np.ascontiguousarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    with hands_lock:
        result = hands.process(rgb_frame)
    app.logger.info("[SAHAYAK] predict_stage=mediapipe_done hands=%s elapsed_ms=%.0f", len(result.multi_hand_landmarks or []), (time.monotonic() - predict_started) * 1000)
    features, visible = two_hand_features(result)
    temporal_features = two_hand_sequence_features(result)
    visible = landmarks_for_preview(visible)
    app.logger.info("[SAHAYAK] predict_stage=features_done visible_hands=%s elapsed_ms=%.0f", len(visible), (time.monotonic() - predict_started) * 1000)
    if features is None:
        response = {"recognized":False,"sign":"","confidence":0,"hands":0,"landmarks":[],"message":"No hand detected. Show one or both hands clearly."}
        if body.get("include_features"):
            response["features"] = [0.0] * TOTAL_FEATURES
            response["sequence_features"] = []
            response["valid_features"] = False
        return jsonify(response)
    app.logger.info("[SAHAYAK] predict_stage=classifier_start")
    probs = clf.predict_proba(features)[0]
    idx = int(np.argmax(probs)); confidence = float(probs[idx]); sign = str(clf.classes_[idx])
    app.logger.info("[SAHAYAK] predict_stage=classifier_done elapsed_ms=%.0f", (time.monotonic() - predict_started) * 1000)
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
    body = request.get_json(force=True, silent=True) or {}
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
        body = request.get_json(force=True, silent=True) or {}
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
    body = request.get_json(force=True, silent=True) or {}
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
    # Online translation sends text only, never camera frames or hand landmarks.
    # Try MyMemory first; if that public endpoint is unavailable, use Google's
    # lightweight translation endpoint as a fallback. Neither requires an app API key.
    errors = []
    query = urllib.parse.urlencode({"q":source_text, "langpair":f"{source_lang}|{target_lang}"})
    req = urllib.request.Request(
        "https://api.mymemory.translated.net/get?" + query,
        headers={"User-Agent":"SAHAYAK/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
        translated = payload.get("responseData", {}).get("translatedText", "")
        if payload.get("responseStatus") == 200 and isinstance(translated, str) and translated.strip():
            return jsonify({"original":source_text,"translated":translated,"source":source_lang,"target":target_lang,"provider":"MyMemory (online)"})
        raise RuntimeError(payload.get("responseDetails") or "MyMemory returned no translation.")
    except Exception as exc:
        errors.append("MyMemory: " + str(exc))

    google_query = urllib.parse.urlencode({
        "client":"gtx", "sl":source_lang, "tl":target_lang, "dt":"t", "q":source_text
    })
    google_req = urllib.request.Request(
        "https://translate.googleapis.com/translate_a/single?" + google_query,
        headers={"User-Agent":"Mozilla/5.0 (compatible; SAHAYAK/1.0)"}
    )
    try:
        with urllib.request.urlopen(google_req, timeout=8) as response:
            google_payload = json.loads(response.read().decode("utf-8"))
        segments = google_payload[0] if isinstance(google_payload, list) and google_payload else []
        translated = "".join(
            segment[0] for segment in segments
            if isinstance(segment, list) and segment and isinstance(segment[0], str)
        )
        if not translated.strip():
            raise RuntimeError("Google fallback returned no translation.")
        return jsonify({"original":source_text,"translated":translated,"source":source_lang,"target":target_lang,"provider":"Google Translate fallback (online)"})
    except Exception as exc:
        errors.append("Google fallback: " + str(exc))

    return jsonify({
        "error":"Online translation is currently unavailable. Your original text is preserved.",
        "detail":"; ".join(errors)
    }), 502

@app.errorhandler(413)
def too_large(_): return jsonify({"error":"Request too large. Reduce camera resolution."}), 413
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000")); host = os.environ.get("HOST", "0.0.0.0")
    print(f"SAHAYAK API listening on {host}:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)
