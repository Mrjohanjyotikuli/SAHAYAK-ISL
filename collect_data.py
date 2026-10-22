"""Collect 2-hand landmark samples. S toggles capture; Q/Esc/window-close quits."""
from pathlib import Path
import csv, os, time
import cv2
import mediapipe as mp
from features import two_hand_features, TOTAL_FEATURES

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "landmarks_2hand.csv"
DATA.parent.mkdir(parents=True, exist_ok=True)
label = input("Sign label (example HELLO, YES, NO, THANK_YOU): ").strip().upper().replace(" ", "_").replace(",", "_")
if not label or not label.replace("_", "").isalnum():
    raise SystemExit("Enter a simple label using letters/numbers, e.g. THANK_YOU.")
print("\nSAHAYAK two-hand collection: S = start/stop saving, Q or Esc = quit.")
print("Collect 150-300 samples per sign, varying position/lighting naturally. For two-hand signs, show both hands.")
preferred = int(os.environ.get("SAHAYAK_CAMERA_INDEX", "1"))
indices = [preferred] + [i for i in (0,1,2,3,4,5) if i != preferred]
cap = None
for idx in indices:
    candidate = cv2.VideoCapture(idx, cv2.CAP_DSHOW) if os.name == "nt" else cv2.VideoCapture(idx)
    if candidate.isOpened():
        ok, _ = candidate.read()
        if ok:
            cap = candidate
            print(f"Using camera index {idx}")
            break
        candidate.release()
    else:
        candidate.release()
if cap is None:
    raise SystemExit("No webcam opened. Close other camera apps, check Windows camera permission, or set SAHAYAK_CAMERA_INDEX=0 (or 1).")
new_file = not DATA.exists() or DATA.stat().st_size == 0
if not new_file:
    with DATA.open(newline="", encoding="utf-8-sig") as existing:
        header = next(csv.reader(existing), [])
    expected = ["label"] + [f"v{i}" for i in range(TOTAL_FEATURES)]
    if header != expected:
        raise SystemExit("Existing data/landmarks_2hand.csv has an unexpected header. It was not modified; back it up and inspect it before collecting.")
count = 0
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
try:
    cv2.namedWindow("SAHAYAK - Two-hand data collection", cv2.WINDOW_NORMAL)
    with DATA.open("a", newline="", encoding="utf-8") as f, mp_hands.Hands(
        static_image_mode=False, max_num_hands=2, model_complexity=0,
        min_detection_confidence=0.55, min_tracking_confidence=0.5
    ) as hands:
        writer = csv.writer(f)
        if new_file:
            writer.writerow(["label"] + [f"v{i}" for i in range(TOTAL_FEATURES)])
            f.flush()
        capturing = False
        while True:
            try:
                if cv2.getWindowProperty("SAHAYAK - Two-hand data collection", cv2.WND_PROP_VISIBLE) < 1:
                    break
            except cv2.error:
                break
            ok, frame = cap.read()
            if not ok:
                print("Webcam frame unavailable; quitting safely.")
                break
            frame = cv2.flip(frame, 1)
            result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            features, _ = two_hand_features(result)
            if result.multi_hand_landmarks:
                for hand in result.multi_hand_landmarks:
                    mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)
            if capturing and features is not None:
                writer.writerow([label] + features[0].tolist())
                count += 1
                if count % 10 == 0:
                    f.flush()
            cv2.rectangle(frame, (8, 8), (min(frame.shape[1]-8, 620), 94), (18,28,45), -1)
            hand_count = len(result.multi_hand_landmarks or [])
            cv2.putText(frame, f"SAHAYAK | {label} | hands: {hand_count}/2", (20, 34), cv2.FONT_HERSHEY_SIMPLEX, .65, (255,255,255), 2)
            cv2.putText(frame, f"Saved: {count} | S: {'CAPTURING' if capturing else 'paused'} | Q/Esc: quit", (20, 63), cv2.FONT_HERSHEY_SIMPLEX, .48, (80,255,180), 1)
            cv2.putText(frame, "Keep signs consistent; missing hand is zero-filled", (20, 84), cv2.FONT_HERSHEY_SIMPLEX, .42, (210,220,235), 1)
            cv2.imshow("SAHAYAK - Two-hand data collection", frame)
            key = cv2.waitKeyEx(1)
            if key != -1:
                key &= 0xFF
                if key in (ord('s'), ord('S')):
                    capturing = not capturing
                    print("Capture", "ON" if capturing else "OFF", "— saved", count, "new samples for", label)
                elif key in (ord('q'), ord('Q'), 27):
                    break
finally:
    cap.release()
    cv2.destroyAllWindows()
    for _ in range(3):
        cv2.waitKey(1)
print(f"Saved {count} new samples for {label} to {DATA}")
