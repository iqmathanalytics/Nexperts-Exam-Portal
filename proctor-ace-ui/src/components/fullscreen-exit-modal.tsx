import { useEffect, useState } from "react";
import { AlertTriangle, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enterFullscreen } from "@/lib/exam-media-stream";

const RESUME_SECONDS = 15;

type Props = {
  open: boolean;
  onResumed: () => void;
  onExitExam: () => void;
};

export function FullscreenExitModal({ open, onResumed, onExitExam }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(RESUME_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(RESUME_SECONDS);
      return;
    }
    setSecondsLeft(RESUME_SECONDS);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          onExitExam();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, onExitExam]);

  const resume = async () => {
    const ok = await enterFullscreen();
    if (ok) onResumed();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated select-none">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-8 w-8 shrink-0" />
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Fullscreen required</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You left fullscreen mode. Return within <strong>{secondsLeft}s</strong> or the exam will end automatically.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Button className="w-full bg-gradient-emerald text-white" onClick={resume}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Go fullscreen to resume exam
          </Button>
          <Button variant="destructive" className="w-full" onClick={onExitExam}>
            Exit exam
          </Button>
        </div>
      </div>
    </div>
  );
}
