import { Loader2 } from "lucide-react";

export function ExamStartingOverlay({ label = "Starting your exam…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-accent" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Preparing your session. Please do not close this tab.
      </p>
    </div>
  );
}
