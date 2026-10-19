            "confidence": 0,
            "hands": 0,
            "landmarks": [],
            "message": "No hand detected. Show one or both hands clearly."
        }
        if body.get("include_features"):
            response["features"] = [0.0] * TOTAL_FEATURES
            response["sequence_features"] = []
            response["valid_features"] = False
        print("PREDICT: no hand detected; returning response", flush=True)
        return jsonify(response)

    try:
        print("PREDICT: starting classifier", flush=True)
        probs = clf.predict_proba(features)[0]
        print("PREDICT: classifier finished", flush=True)
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        sign = str(clf.classes_[idx])
        accepted = confidence >= 0.60
    except Exception as exc:
        app.logger.exception("PREDICT: classifier failed")
        return jsonify({"error": "Sign classification failed", "details": str(exc)}), 500

    response = {
        "recognized": accepted,
        "sign": sign if accepted else "",
        "confidence": round(confidence * 100, 1),
        "hands": len(visible),
        "landmarks": visible,
        "message": "Sign recognized." if accepted else "Uncertain sign; hold it steady and try again."
    }
    if body.get("include_features"):
        response["features"] = features[0].astype(float).tolist()
        response["sequence_features"] = (
            temporal_features[0].astype(float).tolist()
            if temporal_features is not None else []
        )
        response["valid_features"] = temporal_features is not None

    print("PREDICT: returning successful response", flush=True)
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
