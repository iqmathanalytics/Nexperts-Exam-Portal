import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, CreditCard, Loader2, Maximize2, RefreshCw, Shield, UserCheck, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { acquireExamCamera, getExamCameraStream, releaseExamCamera } from "@/lib/exam-media-stream";
import { apiAuth } from "@/lib/api-auth";

type Step = "intro" | "preview" | "selfie" | "mykad" | "verifying" | "verified" | "id-failed";

type VerifyResult = {
  id_detected: boolean;
  selfie_face_detected: boolean;
  id_face_detected: boolean;
  match_score: number;
  verified: boolean;
  reason: string;
};

type Props = {
  open: boolean;
  examTitle: string;
  requiresWebcam: boolean;
  onCancel: () => void;
  onReady: () => void;
};

// Step indicator labels for the identity check flow
const ID_STEPS: { key: Step; label: string }[] = [
  { key: "selfie", label: "Selfie" },
  { key: "mykad", label: "MyKad" },
  { key: "verifying", label: "Verify" },
  { key: "verified", label: "Done" },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = ID_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex w-full items-center">
      {ID_STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center">
          {/* Circle + label */}
          <div className="flex flex-col items-center gap-1">
            <span
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < idx
                  ? "bg-accent text-white"
                  : i === idx
                  ? "bg-accent text-white ring-2 ring-accent/30 ring-offset-1"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {i < idx ? "✓" : i + 1}
            </span>
            <span
              className={[
                "whitespace-nowrap text-[11px] font-medium",
                i < idx ? "text-accent" : i === idx ? "text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              {s.label}
            </span>
          </div>
          {/* Connector line */}
          {i < ID_STEPS.length - 1 && (
            <div className={["mx-1.5 mb-4 h-px flex-1", i < idx ? "bg-accent" : "bg-border"].join(" ")} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ExamPrestartDialog({ open, examTitle, requiresWebcam, onCancel, onReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mykadInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selfieB64, setSelfieB64] = useState<string | null>(null);
  const [mykadB64, setMykadB64] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(requiresWebcam ? "intro" : "ready" as Step);
      setError("");
      setSelfieB64(null);
      setMykadB64(null);
      setVerifyResult(null);
      return;
    }
    if (!requiresWebcam) setStep("ready" as Step);
  }, [open, requiresWebcam]);

  // Attach live stream whenever we're on a video step
  useEffect(() => {
    const videoSteps: Step[] = ["preview", "selfie", "mykad"];
    if (!open || !videoSteps.includes(step)) return;
    const stream = getExamCameraStream();
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [open, step]);

  const requestCamera = async () => {
    setLoading(true);
    setError("");
    try {
      await acquireExamCamera();
      setStep("preview");
    } catch {
      setError("Camera permission is required. Allow access in your browser settings and try again.");
      releaseExamCamera();
    } finally {
      setLoading(false);
    }
  };

  /** Capture a JPEG base64 frame from the live video element. */
  const captureFrame = (): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Mirror matches the UI (scaleX(-1))
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
  };

  const captureSelfie = () => {
    const b64 = captureFrame();
    if (!b64) { setError("Could not capture image. Please wait for the camera to load."); return; }
    setSelfieB64(b64);
    setError("");
    setStep("mykad");
  };

  const captureMykadFromCamera = () => {
    const b64 = captureFrame();
    if (!b64) { setError("Could not capture image. Please wait for the camera to load."); return; }
    setMykadB64(b64);
    setError("");
    void runVerification(selfieB64!, b64);
  };

  const handleMykadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const b64 = result.split(",")[1];
      setMykadB64(b64);
      setError("");
      void runVerification(selfieB64!, b64);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const runVerification = async (selfie: string, idImage: string) => {
    setStep("verifying");
    setError("");
    try {
      const result = await apiAuth<VerifyResult>("/api/attempts/verify-identity", {
        method: "POST",
        body: JSON.stringify({ selfie, idImage }),
      });
      setVerifyResult(result);
      setStep(result.verified ? "verified" : "id-failed");
    } catch {
      setError("Verification failed. Please check your connection and try again.");
      setStep("id-failed");
    }
  };

  const retryVerification = () => {
    setSelfieB64(null);
    setMykadB64(null);
    setVerifyResult(null);
    setError("");
    setStep("selfie");
  };

  const handleCancel = () => {
    releaseExamCamera();
    onCancel();
  };

  // Non-webcam exams skip identity check entirely
  const isIdStep = ["selfie", "mykad", "verifying", "verified", "id-failed"].includes(step);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Before you begin</DialogTitle>
          <DialogDescription>{examTitle}</DialogDescription>
        </DialogHeader>

        {/* Rules list — shown on intro/preview steps */}
        {!isIdStep && (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-accent" /> Proctored session — violations are logged</li>
            {requiresWebcam && (
              <li className="flex items-center gap-2"><Camera className="h-4 w-4 text-accent" /> Webcam must stay on for the full exam</li>
            )}
            <li className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-accent" /> Identity verified using MyKad before exam starts</li>
            <li className="flex items-center gap-2"><Maximize2 className="h-4 w-4 text-accent" /> Exam runs in fullscreen automatically</li>
          </ul>
        )}

        {/* Step indicator for identity check steps */}
        {isIdStep && <StepIndicator current={step} />}

        {/* ── Camera preview (intro / preview) ── */}
        {requiresWebcam && (step === "intro" || step === "preview") && (
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
              <video ref={videoRef} className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} muted playsInline autoPlay />
              {step === "intro" && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/90 px-4 text-center text-sm text-muted-foreground">
                  Your live camera preview will appear here after you allow access
                </div>
              )}
            </div>
            {step === "preview" && (
              <p className="text-sm text-muted-foreground">Camera is ready. Next you'll take a quick selfie and photo of your MyKad for identity verification.</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {/* ── Selfie step ── */}
        {step === "selfie" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Position your face inside the oval and click <strong>Capture Selfie</strong>.</p>
            <div style={{ position:"relative", width:"100%", paddingBottom:"56.25%", borderRadius:"10px", overflow:"hidden", background:"#000" }}>
              <video ref={videoRef} style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)" }} muted playsInline autoPlay />
              {/* Oval face guide — margin:auto centering, works in all browsers */}
              <div style={{ position:"absolute", top:0, right:0, bottom:0, left:0, margin:"auto", width:"32%", height:"76%", border:"2.5px solid rgba(255,255,255,0.9)", borderRadius:"50%", pointerEvents:"none" }} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {/* ── MyKad step ── */}
        {step === "mykad" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Hold your <strong>MyKad</strong> flat inside the frame, then click <strong>Capture</strong>. Or upload a photo.</p>
            <div style={{ position:"relative", width:"100%", paddingBottom:"56.25%", borderRadius:"10px", overflow:"hidden", background:"#000" }}>
              <video ref={videoRef} style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", objectFit:"cover" }} muted playsInline autoPlay />
              {/* Card guide — margin:auto centering, guaranteed symmetric */}
              <div style={{ position:"absolute", top:0, right:0, bottom:0, left:0, margin:"auto", width:"62%", height:"58%", border:"2.5px solid rgba(255,255,255,0.9)", borderRadius:"8px", pointerEvents:"none" }} />
            </div>
            <input ref={mykadInputRef} type="file" accept="image/*" className="hidden" onChange={handleMykadFile} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {/* ── Verifying ── */}
        {step === "verifying" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-12 w-12 animate-spin text-accent" />
            <div className="text-center">
              <p className="font-medium">Verifying your identity…</p>
              <p className="text-sm text-muted-foreground">Comparing your selfie with your MyKad photo.</p>
            </div>
          </div>
        )}

        {/* ── Verified ── */}
        {step === "verified" && verifyResult && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-green-600">Identity Verified</p>
              <p className="mt-1 text-sm text-muted-foreground">{verifyResult.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Match score: <span className="font-medium text-foreground">{Math.round(verifyResult.match_score * 100)}%</span>
              </p>
            </div>
          </div>
        )}

        {/* ── ID Failed ── */}
        {step === "id-failed" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <XCircle className="h-14 w-14 text-destructive" />
            <div className="text-center">
              <p className="font-semibold text-destructive">Verification Failed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {verifyResult?.reason ?? error ?? "Identity check did not pass."}
              </p>
              {verifyResult && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Match score: <span className="font-medium">{Math.round(verifyResult.match_score * 100)}%</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── No webcam ── */}
        {!requiresWebcam && step !== "ready" as Step && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            No webcam required for this exam. Click Begin exam when you are ready.
          </p>
        )}

        {/* ── Footer buttons ── */}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>

          {requiresWebcam && step === "intro" && (
            <Button className="bg-gradient-emerald text-white" onClick={requestCamera} disabled={loading}>
              {loading ? "Requesting…" : "Allow camera & show preview"}
            </Button>
          )}

          {requiresWebcam && step === "preview" && (
            <Button className="bg-gradient-emerald text-white" onClick={() => setStep("selfie")}>
              <UserCheck className="mr-2 h-4 w-4" /> Start Identity Check
            </Button>
          )}

          {step === "selfie" && (
            <Button className="bg-gradient-emerald text-white" onClick={captureSelfie}>
              <Camera className="mr-2 h-4 w-4" /> Capture Selfie
            </Button>
          )}

          {step === "mykad" && (
            <>
              <Button variant="outline" onClick={() => mykadInputRef.current?.click()}>
                <CreditCard className="mr-2 h-4 w-4" /> Upload Photo
              </Button>
              <Button className="bg-gradient-emerald text-white" onClick={captureMykadFromCamera}>
                <Camera className="mr-2 h-4 w-4" /> Capture MyKad
              </Button>
            </>
          )}

          {step === "id-failed" && (
            <Button className="bg-gradient-emerald text-white" onClick={retryVerification}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
          )}

          {step === "verified" && (
            <Button className="bg-gradient-emerald text-white" onClick={onReady}>
              Begin exam
            </Button>
          )}

          {!requiresWebcam && (
            <Button className="bg-gradient-emerald text-white" onClick={onReady}>
              Begin exam
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
