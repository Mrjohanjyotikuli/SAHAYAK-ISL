"""Collect continuous-sign samples into continuous_gesture_db.db using a visible webcam.

Run: python collect_sequences.py
Enter one label. Press C to START recording a sample, then press C again to STOP and save it.
Samples may be any positive length; press C once to start and C again to stop and save.
Repeat for varied examples of the same label. Q/Esc/window close exits.
"""
from __future__ import annotations
import os
from pathlib import Path
import cv2
import mediapipe as mp
from features import two_hand_sequence_features
from sequence_db import add_sample, summary
from sequence_features import MIN_SEQUENCE_FRAMES

ROOT = Path(__file__).resolve().parent
label = input("Continuous sign label (e.g. WHAT_IS_YOUR_NAME, HELLO, THANK_YOU, WAVE): ").strip().upper().replace(" ", "_")
if not label or not label.replace("_", "").isalnum():
    raise SystemExit("Use a simple label with letters/numbers, e.g. THANK_YOU.")
preferred = int(os.environ.get("SAHAYAK_CAMERA_INDEX", "1"))
cap = None
for idx in [preferred] + [i for i in (0, 1, 2, 3, 4, 5) if i != preferred]:
    candidate = cv2.VideoCapture(idx, cv2.CAP_DSHOW) if os.name == "nt" else cv2.VideoCapture(idx)
    if candidate.isOpened():
        ok, _ = candidate.read()
        if ok:
            cap = candidate
            print(f"Using camera index {idx}")
            break
    candidate.release()
if cap is None:
    raise SystemExit("No webcam opened. Close other camera apps or set SAHAYAK_CAMERA_INDEX=0/1.")

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
frames, capturing, saved = [], False, 0
limit_notified = False
MAX_SEQUENCE_FRAMES = 600  # keep the desktop collector consistent with the browser collector
window = "SAHAYAK - Continuous sequence collection"
try:
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    with mp_hands.Hands(static_image_mode=False, max_num_hands=2, model_complexity=0,
                        min_detection_confidence=0.55, min_tracking_confidence=0.5) as hands:
        while True:
            try:
                if cv2.getWindowProperty(window, cv2.WND_PROP_VISIBLE) < 1:
                    break
            except cv2.error:
                break
            ok, frame = cap.read()
            if not ok:
                print("Webcam frame unavailable; stopping safely.")
                break
            frame = cv2.flip(frame, 1)
            result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            features = two_hand_sequence_features(result)
            if result.multi_hand_landmarks:
                for hand in result.multi_hand_landmarks:
                    mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)
            if capturing and features is not None:
                if len(frames) < MAX_SEQUENCE_FRAMES:
                    frames.append(features[0].astype(float).tolist())
                elif not limit_notified:
                    print(f"Reached the safety limit of {MAX_SEQUENCE_FRAMES} valid frames. Press C to save this sample.")
                    limit_notified = True
            h, w = frame.shape[:2]
            cv2.rectangle(frame, (8, 8), (min(w-8, 760), 112), (18, 28, 45), -1)
            hand_count = len(result.multi_hand_landmarks or [])
            cv2.putText(frame, f"SAHAYAK CONTINUOUS | {label} | hands: {hand_count}", (20, 34), cv2.FONT_HERSHEY_SIMPLEX, .62, (255,255,255), 2)
            frame_text = f"Valid frames: {len(frames)} (any length) | C: {'STOP & SAVE' if capturing else 'START'} | Q/Esc: quit"
            cv2.putText(frame, frame_text[:105], (20, 64), cv2.FONT_HERSHEY_SIMPLEX, .45, (80,255,180), 1)
            cv2.putText(frame, f"Saved this session: {saved} | {'CAPTURING' if capturing else 'READY'}", (20, 90), cv2.FONT_HERSHEY_SIMPLEX, .5, (210,220,235), 1)
            cv2.imshow(window, frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('c'), ord('C')):
                if not capturing:
                    frames = []
                    limit_notified = False
                    capturing = True
                    print(f"Recording {label}. Perform the COMPLETE movement, then press C again to save. Any non-empty sample is accepted; longer samples are retained.")
                else:
                    capturing = False
                    if len(frames) < 1:
                        print(f"Sample not saved: no valid hand frames were collected. Press C to start again and keep your hand visible.")
                    else:
                        try:
                            sample_id = add_sample(label, frames, source="desktop-webcam")
                            saved += 1
                            print(f"Saved sample #{sample_id} for {label}: {len(frames)} frames; {summary()['total_samples']} total database samples.")
                        except Exception as exc:
                            print(f"Sample rejected: {exc}")
                    frames = []
            elif key in (ord('q'), ord('Q'), 27):
                break
finally:
    cap.release()
    cv2.destroyAllWindows()
    for _ in range(3):
        cv2.waitKey(1)
print(f"Finished. Saved {saved} new samples. Database summary: {summary()}")
