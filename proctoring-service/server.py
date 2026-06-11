"""Ventrix Global proctoring microservice — frame analysis."""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from yolo_detector import analyze_frame, verify_identity

app = FastAPI(title="Ventrix Global Proctoring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FrameBody(BaseModel):
    frame: str


class IdentityBody(BaseModel):
    selfie: str
    id_image: str


@app.get("/health")
def health():
    return {"ok": True, "heavy_detection": os.getenv("ENABLE_HEAVY_DETECTION", "false")}


@app.post("/analyze-frame")
def analyze(body: FrameBody):
    if not body.frame:
        raise HTTPException(status_code=400, detail="Missing frame")
    return analyze_frame(body.frame)


@app.post("/verify-identity")
def identity_verify(body: IdentityBody):
    if not body.selfie or not body.id_image:
        raise HTTPException(status_code=400, detail="Missing selfie or id_image")
    return verify_identity(body.selfie, body.id_image)
