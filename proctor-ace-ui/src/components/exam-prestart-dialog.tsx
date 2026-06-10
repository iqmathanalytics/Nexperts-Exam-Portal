import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, IdCard, Maximize2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  acquireExamCamera,
  getExamCameraStream,
  releaseExamCamera,
  requestFullscreenFromGesture,
} from "@/lib/exam-media-stream";
import { ExamStartingOverlay } from "@/components/exam-starting-overlay";
import { captureVideoFrame } from "@/lib/capture-video-frame";

type Props = {
  open: boolean;
  examTitle: string;
  requiresWebcam: boolean;
  requiresFullscreen?: boolean;
  starting?: boolean;
  onCancel: () => void;
  onReady: (identityPhoto?: string) => void;
};

export function ExamPrestartDialog({
  open,
  examTitle,
  requiresWebcam,
  requiresFullscreen = true,
  starting = false,
  onCancel,
  onReady,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<"intro" | "verify">("intro");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [identityPhoto, setIdentityPhoto] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setStep(requiresWebcam ? "intro" : "verify");
      setError("");
      setIdentityPhoto(null);
      return;
    }
    if (!requiresWebcam) setStep("verify");
  }, [open, requiresWebcam]);

  useEffect(() => {
    if (!open || step !== "verify" || !requiresWebcam) return;
    const stream = getExamCameraStream();
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [open, step, requiresWebcam, identityPhoto]);

  const requestCamera = async () => {
    setLoading(true);
    setError("");
    try {
      await acquireExamCamera();
      setStep("verify");
    } catch {
      setError("Camera permission is required to start this exam. Allow access in your browser settings and try again.");
      releaseExamCamera();
    } finally {
      setLoading(false);
    }
  };

  const captureIdentityPhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const frame = captureVideoFrame(video);
    if (!frame) {
      setError("Could not capture photo. Wait for the camera preview to load and try again.");
      return;
    }
    setIdentityPhoto(frame);
    setError("");
  };

  const handleCancel = () => {
    releaseExamCamera();
    onCancel();
  };

  const handleBegin = () => {
    if (starting) return;
    if (requiresWebcam && !identityPhoto) {
      setError("Capture a photo with your face and ID card before starting.");
      return;
    }
    if (requiresFullscreen) {
      requestFullscreenFromGesture();
    }
    onReady(identityPhoto ?? undefined);
  };

  const startingOverlay =
    starting && portalReady ? createPortal(<ExamStartingOverlay />, document.body) : null;

  return (
    <>
    {startingOverlay}
    <Dialog open={open} onOpenChange={(v) => { if (!v && !starting) handleCancel(); }}>
      <DialogContent
        className="max-w-3xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Before you begin</DialogTitle>
          <DialogDescription>{examTitle}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-accent" /> Proctored session — violations are logged</li>
          {requiresWebcam && (
            <>
              <li className="flex items-center gap-2"><Camera className="h-4 w-4 text-accent" /> Webcam must stay on for the full exam</li>
              <li className="flex items-center gap-2"><IdCard className="h-4 w-4 text-accent" /> Hold your ID next to your face — both must be clearly visible</li>
            </>
          )}
          <li className="flex items-center gap-2"><Maximize2 className="h-4 w-4 text-accent" /> Exam runs in fullscreen automatically</li>
        </ul>

        {requiresWebcam && step === "verify" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Live camera</p>
              <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                  muted
                  playsInline
                  autoPlay
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Position your face and ID in frame, then capture on the right.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Identity verification photo</p>
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {identityPhoto ? (
                  <img src={identityPhoto} alt="Captured identity verification" className="h-full w-full object-cover" />
                ) : (
                  <div className="px-4 text-center text-sm text-muted-foreground">
                    Your captured photo will appear here
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={captureIdentityPhoto}>
                  {identityPhoto ? "Retake photo" : "Capture photo"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Hold your government ID beside your face. Ensure your name, photo, and ID details are readable.
              </p>
            </div>
          </div>
        )}

        {requiresWebcam && step === "intro" && (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Allow camera access to continue with identity verification.
          </div>
        )}

        {!requiresWebcam && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            No webcam required for this exam. Click Begin exam when you are ready.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          {requiresWebcam && step === "intro" && (
            <Button className="bg-gradient-emerald text-white" onClick={requestCamera} disabled={loading}>
              {loading ? "Requesting…" : "Allow camera & continue"}
            </Button>
          )}
          {requiresWebcam && step === "verify" && (
            <Button className="bg-gradient-emerald text-white" onClick={handleBegin} disabled={!identityPhoto || starting}>
              {starting ? "Starting…" : "Begin exam"}
            </Button>
          )}
          {!requiresWebcam && (
            <Button className="bg-gradient-emerald text-white" onClick={handleBegin} disabled={starting}>
              {starting ? "Starting…" : "Begin exam"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
