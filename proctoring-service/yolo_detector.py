import base64
import os
import urllib.request
import numpy as np
import cv2


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}

# ── OpenCV Haar Cascade (always available, lightweight) ──────────
_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(_cascade_path)

# Heavy ML paths are expensive on small CPU plans.
_heavy_detection_enabled = _env_flag("ENABLE_HEAVY_DETECTION", "false")

# ── Optional: YOLO for person/phone detection ────────────────────
_yolo_available = False
if _heavy_detection_enabled:
    try:
        from ultralytics import YOLO
        yolo_model = YOLO("yolov8n.pt")
        _yolo_available = True
    except Exception:
        yolo_model = None
else:
    yolo_model = None

# ── Optional: MediaPipe for gaze detection ───────────────────────
_mediapipe_available = False
if _heavy_detection_enabled:
    try:
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import (
            FaceLandmarker,
            FaceLandmarkerOptions,
            RunningMode,
        )

        MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")
        _MODEL_URL = (
            "https://storage.googleapis.com/mediapipe-models/"
            "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
        )
        if not os.path.exists(MODEL_PATH):
            urllib.request.urlretrieve(_MODEL_URL, MODEL_PATH)

        _landmarker_options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=RunningMode.IMAGE,
            num_faces=2,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
        )
        face_landmarker = FaceLandmarker.create_from_options(_landmarker_options)
        _mediapipe_available = True
    except Exception:
        face_landmarker = None
else:
    face_landmarker = None

PERSON_CLASS = 0
PHONE_CLASS = 67

LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]
LEFT_EYE_INNER = 133
LEFT_EYE_OUTER = 33
RIGHT_EYE_INNER = 362
RIGHT_EYE_OUTER = 263


def _decode_frame(b64_frame: str) -> np.ndarray:
    img_bytes = base64.b64decode(b64_frame)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _iris_ratio(landmarks, eye_inner, eye_outer, iris_ids):
    inner = np.array([landmarks[eye_inner].x, landmarks[eye_inner].y])
    outer = np.array([landmarks[eye_outer].x, landmarks[eye_outer].y])
    width = np.linalg.norm(inner - outer)
    if width < 1e-6:
        return 0.5
    center = np.mean([[landmarks[i].x, landmarks[i].y] for i in iris_ids], axis=0)
    return np.linalg.norm(center - outer) / width


def _check_gaze(landmarks) -> bool:
    left = _iris_ratio(landmarks, LEFT_EYE_INNER, LEFT_EYE_OUTER, LEFT_IRIS)
    right = _iris_ratio(landmarks, RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_IRIS)
    avg = (left + right) / 2.0
    return avg < 0.30 or avg > 0.70


def _box_iou(a: tuple, b: tuple) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1 = max(ax, bx)
    y1 = max(ay, by)
    x2 = min(ax + aw, bx + bw)
    y2 = min(ay + ah, by + bh)
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _distinct_face_boxes(faces) -> list[tuple[int, int, int, int]]:
    """Merge overlapping Haar hits (same person often detected 2–4 times)."""
    boxes = [tuple(int(v) for v in f) for f in faces]
    if not boxes:
        return []
    boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
    kept: list[tuple[int, int, int, int]] = []
    for box in boxes:
        if all(_box_iou(box, k) < 0.35 for k in kept):
            kept.append(box)
    return kept


def _opencv_face_detect(frame) -> tuple[bool, int]:
    """Returns (any_face, distinct_face_count)."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    h, w = gray.shape[:2]
    min_face = max(32, int(min(h, w) * 0.14))
    raw = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(min_face, min_face),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    distinct = _distinct_face_boxes(raw)
    return len(distinct) >= 1, len(distinct)


def _extract_face_chip(img: np.ndarray) -> "np.ndarray | None":
    """Detect the largest face in *img* and return a 128×128 BGR chip, or None."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    h, w = gray.shape[:2]
    min_face = max(20, int(min(h, w) * 0.08))
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(min_face, min_face),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    if len(faces) == 0:
        return None
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    chip = img[y : y + fh, x : x + fw]
    return cv2.resize(chip, (128, 128))


def _detect_card_region(img: np.ndarray) -> "tuple[np.ndarray, bool]":
    """
    Locate a rectangular card-shaped region (aspect ratio 1.2–2.0) in *img*.
    Uses YOLO bounding boxes when ENABLE_HEAVY_DETECTION=true, otherwise
    falls back to OpenCV contour detection.
    Returns (region, card_found).
    """
    h, w = img.shape[:2]
    frame_area = h * w

    # YOLO path: scan detected-object bounding boxes for card-like shapes
    if _yolo_available and yolo_model is not None:
        results = yolo_model(img, verbose=False)[0]
        best_box = None
        best_area = 0
        for box in results.boxes:
            x1, y1, x2, y2 = (int(v) for v in box.xyxy[0])
            bw, bh = x2 - x1, y2 - y1
            area = bw * bh
            ratio = bw / bh if bh > 0 else 0
            if 1.2 <= ratio <= 2.0 and frame_area * 0.10 <= area <= frame_area * 0.95:
                if area > best_area:
                    best_area = area
                    best_box = (x1, y1, x2, y2)
        if best_box:
            x1, y1, x2, y2 = best_box
            return img[max(0, y1 - 5) : y2 + 5, max(0, x1 - 5) : x2 + 5], True

    # OpenCV contour-based card detection
    gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray_img, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 130)
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_card = None
    best_area = 0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < frame_area * 0.12 or area > frame_area * 0.95:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            cx, cy, cw, ch = cv2.boundingRect(approx)
            ratio = cw / ch if ch > 0 else 0
            if 1.2 <= ratio <= 2.0 and area > best_area:
                best_area = area
                best_card = (cx, cy, cw, ch)

    if best_card:
        cx, cy, cw, ch = best_card
        return img[max(0, cy - 8) : cy + ch + 8, max(0, cx - 8) : cx + cw + 8], True

    return img, False


def _compare_faces(chip_a: np.ndarray, chip_b: np.ndarray) -> float:
    """
    Return a similarity score [0, 1] between two face chips.
    Combines grayscale histogram correlation (35 %) and
    normalised cross-correlation (65 %) for a balanced descriptor.
    """
    size = (128, 128)
    a = cv2.resize(chip_a, size)
    b = cv2.resize(chip_b, size)

    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)

    ha = cv2.calcHist([ga], [0], None, [64], [0, 256])
    hb = cv2.calcHist([gb], [0], None, [64], [0, 256])
    cv2.normalize(ha, ha)
    cv2.normalize(hb, hb)
    hist_score = float(cv2.compareHist(ha, hb, cv2.HISTCMP_CORREL))

    na = cv2.normalize(ga.astype(np.float32), None, 0, 1, cv2.NORM_MINMAX)
    nb = cv2.normalize(gb.astype(np.float32), None, 0, 1, cv2.NORM_MINMAX)
    ncc_score = float(cv2.matchTemplate(na, nb, cv2.TM_CCOEFF_NORMED)[0][0])

    combined = 0.35 * hist_score + 0.65 * max(0.0, ncc_score)
    return float(np.clip(combined, 0.0, 1.0))


def verify_identity(selfie_b64: str, id_b64: str) -> dict:
    """
    Compare a live selfie with the face on a Malaysian MyKad (or any government ID).

    Steps:
      1. Extract face chip from the selfie via Haar cascade.
      2. Locate the ID card region using YOLO (heavy mode) or OpenCV contours.
      3. Extract face chip from the card region.
      4. Compare chips using histogram + NCC; threshold at 0.40.

    Returns a dict with keys:
      id_detected, selfie_face_detected, id_face_detected,
      match_score, verified, reason
    """
    MATCH_THRESHOLD = 0.40

    selfie_img = _decode_frame(selfie_b64)
    id_img = _decode_frame(id_b64)

    selfie_chip = _extract_face_chip(selfie_img)
    if selfie_chip is None:
        return {
            "id_detected": False,
            "selfie_face_detected": False,
            "id_face_detected": False,
            "match_score": 0.0,
            "verified": False,
            "reason": "No face detected in selfie. Look directly at the camera with good lighting.",
        }

    card_region, id_detected = _detect_card_region(id_img)

    id_chip = _extract_face_chip(card_region)
    if id_chip is None and id_detected:
        id_chip = _extract_face_chip(id_img)

    if id_chip is None:
        return {
            "id_detected": id_detected,
            "selfie_face_detected": True,
            "id_face_detected": False,
            "match_score": 0.0,
            "verified": False,
            "reason": "Could not detect a face on the MyKad. Ensure the card is well-lit, flat, and fully visible.",
        }

    score = _compare_faces(selfie_chip, id_chip)
    verified = score >= MATCH_THRESHOLD

    return {
        "id_detected": id_detected,
        "selfie_face_detected": True,
        "id_face_detected": True,
        "match_score": round(score, 3),
        "verified": verified,
        "reason": (
            "Identity verified — face matches MyKad."
            if verified
            else "Face does not match the MyKad photo. Ensure good lighting and try again."
        ),
    }


def analyze_frame(b64_frame: str) -> dict:
    frame = _decode_frame(b64_frame)
    violations = []

    person_count = 0
    phone_detected = False
    face_detected = True
    looking_away = False

    # ── YOLO path (local dev with full ML stack) ─────────────────
    if _yolo_available:
        yolo_results = yolo_model(frame, verbose=False)[0]
        for box in yolo_results.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            if cls_id == PERSON_CLASS and conf > 0.55:
                person_count += 1
            if cls_id == PHONE_CLASS and conf > 0.35:
                phone_detected = True

    if _mediapipe_available:
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result = face_landmarker.detect(mp_image)
        face_detected = len(result.face_landmarks) > 0
        if face_detected and len(result.face_landmarks[0]) >= 478:
            looking_away = _check_gaze(result.face_landmarks[0])
        if len(result.face_landmarks) >= 2:
            person_count = max(person_count, 2)
    else:
        # OpenCV Haar (default deploy) — face presence only; do not use Haar for multi-person
        face_detected, _ = _opencv_face_detect(frame)

    # ── Build violations ─────────────────────────────────────────
    if person_count > 1:
        violations.append("Multiple persons detected")
    if phone_detected:
        violations.append("Phone detected")
    if not face_detected:
        violations.append("No face detected")
    elif looking_away:
        violations.append("Looking away from screen")

    return {
        "person_count": person_count,
        "phone_detected": phone_detected,
        "face_detected": face_detected,
        "violations": violations,
        "violation_count": len(violations),
    }
