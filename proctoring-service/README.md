# NExperts Proctoring Service

Python frame analyzer ported from [nexpert-quiz-backend](https://github.com/eneeya-n/nexpert-quiz-backend).

## Setup

```bash
cd proctoring-service
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8765
```

## Detection (default: OpenCV Haar)

Matches [nexpert-quiz-backend](https://github.com/eneeya-n/nexpert-quiz-backend) with light Haar tuning for webcam frames (contrast + proportional min face size).

- Multiple persons (multiple faces)
- No face detected
- Phone detected (requires `ENABLE_HEAVY_DETECTION=true` + YOLO)
- Looking away (requires `ENABLE_HEAVY_DETECTION=true` + MediaPipe)

```bash
set ENABLE_HEAVY_DETECTION=true
uvicorn server:app --port 8765
```

The Node API proxies frames to `PROCTORING_SERVICE_URL` (default `http://127.0.0.1:8765`).
