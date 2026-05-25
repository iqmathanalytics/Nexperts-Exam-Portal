import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  overlay?: boolean;
  inline?: boolean;
  className?: string;
};

export function PageLoader({ label = "Loading…", overlay, inline, className }: Props) {
  if (inline) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        overlay
          ? "absolute inset-0 z-30 rounded-xl bg-background/80 backdrop-blur-sm"
          : "min-h-[40vh] w-full py-20",
        className,
      )}
    >
      <Loader2 className="h-9 w-9 animate-spin text-accent" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
