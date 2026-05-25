"""NExperts proctoring microservice — frame analysis from nexpert-quiz-backend."""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from yolo_detector import analyze_frame

app = FastAPI(title="NExperts Proctoring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FrameBody(BaseModel):
    frame: str


@app.get("/health")
def health():
    return {"ok": True, "heavy_detection": os.getenv("ENABLE_HEAVY_DETECTION", "false")}


@app.post("/analyze-frame")
def analyze(body: FrameBody):
    if not body.frame:
        raise HTTPException(status_code=400, detail="Missing frame")
    return analyze_frame(body.frame)
