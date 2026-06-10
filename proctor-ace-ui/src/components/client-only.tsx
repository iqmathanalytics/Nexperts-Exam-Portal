import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/** Avoid SSR/client markup mismatches for browser-only screens (exam, overlays). */
export function ClientOnly({
  children,
  fallback = (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-accent" />
    </div>
  ),
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return fallback;
  return children;
}
