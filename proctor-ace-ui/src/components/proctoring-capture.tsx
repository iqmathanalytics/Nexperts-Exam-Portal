import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Shield } from "lucide-react";
import { apiAuth } from "@/lib/api-auth";
import { Badge } from "@/components/ui/badge";
import { getExamCameraStream } from "@/lib/exam-media-stream";

const FRAME_INTERVAL_MS = 1200;
const JPEG_QUALITY = 0.55;

type ProctorSettings = {
  proctoring: boolean;
  fullscreen: boolean;
  tabDetection: boolean;
  webcam: boolean;
};

type Props = {
  attemptId: string;
  settings: ProctorSettings;
  mediaStream: MediaStream | null;
  paused?: boolean;
  onWarningsChange: (n: number) => void;
  onViolation?: (type: string) => void;
  onFaceStatus?: (ok: boolean) => void;
  onFlagged?: () => void;
};

const ProctorVideoPreview = memo(function ProctorVideoPreview({
  stream,
}: {
  stream: MediaStream | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (video.srcObject === stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className="h-full w-full object-cover"
      muted
      playsInline
      autoPlay
      style={{ transform: "scaleX(-1) translateZ(0)", backfaceVisibility: "hidden" }}
    />
  );
});

export function ProctoringCapture({
  attemptId,
  settings,
  mediaStream,
  paused = false,
  onWarningsChange,
  onViolation,
  onFaceStatus,
  onFlagged,
}: Props) {
  const flaggedRef = useRef(false);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastViolationRef = useRef<Record<string, number>>({});
  const analyzingRef = useRef(false);
  const faceOkRef = useRef(true);
  const [cameraOk, setCameraOk] = useState(false);
  const [faceOk, setFaceOk] = useState(true);

  const stream = mediaStream ?? getExamCameraStream();

  const setFaceDetected = (ok: boolean) => {
    if (faceOkRef.current === ok) return;
    faceOkRef.current = ok;
    setFaceOk(ok);
    onFaceStatus?.(ok);
  };

  const logViolation = useCallback(
    async (type: string, detail?: string) => {
      const now = Date.now();
      const last = lastViolationRef.current[type] ?? 0;
      if (now - last < 12000) return;
      lastViolationRef.current[type] = now;

      try {
        const res = await apiAuth<{ warnings: number; flagged: boolean }>(
          `/api/attempts/${attemptId}/violations`,
          { method: "POST", body: JSON.stringify({ type, detail }) },
        );
        onWarningsChange(res.warnings);
        if (res.flagged && !flaggedRef.current) {
          flaggedRef.current = true;
          onFlagged?.();
        }
        onViolation?.(type);
      } catch {
        /* ignore */
      }
    },
    [attemptId, onWarningsChange, onViolation, onFlagged],
  );

  const captureAndAnalyze = useCallback(async () => {
    if (paused || !settings.proctoring || !settings.webcam || analyzingRef.current) return;
    const video = captureVideoRef.current;
    if (!video || video.readyState < 2) return;

    analyzingRef.current = true;
    try {
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = Math.min(480, video.videoWidth || 480);
      canvas.height = Math.min(360, video.videoHeight || 360);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];

      const res = await apiAuth<{
        violations: string[];
        face_detected: boolean;
        warnings?: number;
        flagged?: boolean;
      }>(`/api/attempts/${attemptId}/analyze-frame`, {
        method: "POST",
        body: JSON.stringify({ frame }),
      });

      setFaceDetected(res.face_detected);
      if (res.warnings != null) onWarningsChange(res.warnings);
      if (res.flagged && !flaggedRef.current) {
        flaggedRef.current = true;
        onFlagged?.();
      }

      for (const v of res.violations) {
        await logViolation(v);
      }
    } catch {
      /* ignore */
    } finally {
      analyzingRef.current = false;
    }
  }, [attemptId, settings.proctoring, settings.webcam, paused, logViolation, onWarningsChange, onFlagged]);

  useEffect(() => {
    if (!settings.webcam || !stream) {
      setCameraOk(false);
      return;
    }

    const video = captureVideoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    void video.play().then(() => {
      setCameraOk(true);
      void captureAndAnalyze();
    }).catch(() => setCameraOk(false));
  }, [stream, settings.webcam, captureAndAnalyze]);

  useEffect(() => {
    if (!settings.proctoring || paused) return;
    const t = setInterval(() => void captureAndAnalyze(), FRAME_INTERVAL_MS);
    return () => clearInterval(t);
  }, [captureAndAnalyze, settings.proctoring, paused]);

  useEffect(() => {
    if (!settings.tabDetection || paused) return;
    const onVisibility = () => {
      if (document.hidden) logViolation("Tab switch");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [settings.tabDetection, paused, logViolation]);

  if (!settings.proctoring) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-48 rounded-xl border border-border bg-card/95 p-2 shadow-elevated backdrop-blur select-none">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="flex items-center gap-1 text-xs font-medium">
          <Shield className="h-3 w-3 text-accent" /> Proctoring
        </span>
        <Badge variant={faceOk && cameraOk ? "secondary" : "destructive"} className="text-[10px]">
          {cameraOk ? (faceOk ? "FACE OK" : "NO FACE") : "NO CAM"}
        </Badge>
      </div>
      <div
        className="relative aspect-video overflow-hidden rounded-lg bg-muted"
        style={{ contain: "strict", isolation: "isolate" }}
      >
        <ProctorVideoPreview stream={stream} />
        <video
          ref={captureVideoRef}
          className="pointer-events-none absolute h-px w-px opacity-0"
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
        />
        {!cameraOk && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Camera className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-destructive/90 px-1.5 py-0.5 text-[9px] text-white">
          <span className="h-1 w-1 rounded-full bg-white" /> REC
        </div>
      </div>
    </div>
  );
}
