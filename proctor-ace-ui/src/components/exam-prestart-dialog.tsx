import { useEffect, useRef, useState } from "react";
import { Camera, Maximize2, Shield } from "lucide-react";
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

type Props = {
  open: boolean;
  examTitle: string;
  requiresWebcam: boolean;
  onCancel: () => void;
  onReady: () => void;
};

export function ExamPrestartDialog({ open, examTitle, requiresWebcam, onCancel, onReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<"intro" | "preview" | "ready">("intro");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(requiresWebcam ? "intro" : "ready");
      setError("");
      return;
    }
    if (!requiresWebcam) setStep("ready");
  }, [open, requiresWebcam]);

  useEffect(() => {
    if (!open || step !== "preview") return;
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
      setError("Camera permission is required to start this exam. Allow access in your browser settings and try again.");
      releaseExamCamera();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    releaseExamCamera();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display">Before you begin</DialogTitle>
          <DialogDescription>{examTitle}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-accent" /> Proctored session — violations are logged</li>
          {requiresWebcam && (
            <li className="flex items-center gap-2"><Camera className="h-4 w-4 text-accent" /> Webcam must stay on for the full exam</li>
          )}
          <li className="flex items-center gap-2"><Maximize2 className="h-4 w-4 text-accent" /> Exam runs in fullscreen automatically</li>
        </ul>

        {requiresWebcam && (
          <div className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                muted
                playsInline
                autoPlay
              />
              {step === "intro" && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/90 px-4 text-center text-sm text-muted-foreground">
                  Your live camera preview will appear here after you allow access
                </div>
              )}
            </div>
            {step === "preview" && (
              <p className="text-sm text-muted-foreground">
                This is your live camera preview. Make sure your face is clearly visible, then start the exam.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {!requiresWebcam && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            No webcam required for this exam. Click Begin exam when you are ready.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          {requiresWebcam && step === "intro" && (
            <Button className="bg-gradient-emerald text-white" onClick={requestCamera} disabled={loading}>
              {loading ? "Requesting…" : "Allow camera & show preview"}
            </Button>
          )}
          {requiresWebcam && step === "preview" && (
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
