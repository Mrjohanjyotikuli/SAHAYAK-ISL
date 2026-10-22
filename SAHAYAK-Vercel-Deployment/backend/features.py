"""Shared feature extraction for SAHAYAK two-hand training and inference."""
import numpy as np

FEATURES_PER_HAND = 63
TOTAL_FEATURES = FEATURES_PER_HAND * 2
# Continuous mode adds each hand wrist position (x, y, z) to the 126 pose features.
SEQUENCE_FRAME_FEATURES = TOTAL_FEATURES + 6

def normalized_hand(landmarks):
    pts = [(float(p.x), float(p.y), float(p.z)) for p in landmarks.landmark]
    ox, oy, oz = pts[0]
    pts = [(x-ox, y-oy, z-oz) for x,y,z in pts]
    scale = max((abs(v) for p in pts for v in p), default=0.0)
    scale = max(scale, 1e-6)
    return [v/scale for p in pts for v in p]

def two_hand_features(result):
    """Return (126 float features, visible landmark points). Missing hand slot is zeros."""
    slots = {"Left": [0.0]*FEATURES_PER_HAND, "Right": [0.0]*FEATURES_PER_HAND}
    visible = []
    hands = result.multi_hand_landmarks or []
    handedness = result.multi_handedness or []
    for i, hand in enumerate(hands):
        label = "Unknown"
        if i < len(handedness) and handedness[i].classification:
            label = handedness[i].classification[0].label
        # If handedness is unavailable/duplicated, deterministically fill the first empty slot.
        if label not in slots or any(slots[label]):
            label = next((side for side in ("Left", "Right") if not any(slots[side])), None)
        if label is None:
            continue
        slots[label] = normalized_hand(hand)
        visible.append({
    "side": label,
    "points": [
        [float(p.x), float(p.y)]
        for p in hand.landmark
    ]
})
    if not visible:
        return None, []
    return np.asarray([slots["Left"] + slots["Right"]], dtype=np.float32), visible


def landmarks_for_preview(visible):
    """Map inference landmarks back to raw camera-frame coordinates for display.

    The backend mirrors frames before MediaPipe to preserve the existing model's
    preprocessing. Therefore all returned x coordinates must be unmirrored. The
    browser then mirrors the overlay together with the front-camera preview only.
    """
    output = []
    for hand in visible or []:
        item = {**hand, "points": []}
        for point in hand.get("points", []):
            if not isinstance(point, (list, tuple)) or len(point) < 2:
                continue
            x, y = float(point[0]), float(point[1])
            item["points"].append([1.0 - x, y])
        output.append(item)
    return output


def two_hand_sequence_features(result):
    """Return 132 features for temporal recognition: 126 pose + 6 wrist-position values.

    The existing 126-feature single-sign vector remains unchanged. Wrist positions retain
    movement across the camera frame, which per-frame wrist-relative pose normalization
    intentionally removes and therefore cannot provide to a temporal model.
    """
    pose, _ = two_hand_features(result)
    if pose is None:
        return None
    wrists = {"Left": [0.0, 0.0, 0.0], "Right": [0.0, 0.0, 0.0]}
    hands = result.multi_hand_landmarks or []
    handedness = result.multi_handedness or []
    for i, hand in enumerate(hands):
        label = "Unknown"
        if i < len(handedness) and handedness[i].classification:
            label = handedness[i].classification[0].label
        if label not in wrists or any(wrists[label]):
            label = next((side for side in ("Left", "Right") if not any(wrists[side])), None)
        if label is None or not hand.landmark:
            continue
        wrist = hand.landmark[0]
        wrists[label] = [float(wrist.x), float(wrist.y), float(wrist.z)]
    return np.concatenate([pose[0], np.asarray(wrists["Left"] + wrists["Right"], dtype=np.float32)]).astype(np.float32).reshape(1, -1)
