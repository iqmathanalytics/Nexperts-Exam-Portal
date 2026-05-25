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
