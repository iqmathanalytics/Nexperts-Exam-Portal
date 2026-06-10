import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enterFullscreen } from "@/lib/exam-media-stream";

type Props = {
  examTitle: string;
  onEntered: () => void;
};

export function ExamFullscreenGate({ examTitle, onEntered }: Props) {
  const enter = async () => {
    const ok = await enterFullscreen();
    if (ok) onEntered();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Maximize2 className="h-7 w-7" />
      </div>
      <h1 className="mt-6 font-display text-xl font-bold">Enter fullscreen</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        <strong>{examTitle}</strong> requires fullscreen. Click below to continue your exam.
      </p>
      <Button className="mt-8 bg-gradient-emerald text-white" onClick={() => void enter()}>
        Continue in fullscreen
      </Button>
    </div>
  );
}
