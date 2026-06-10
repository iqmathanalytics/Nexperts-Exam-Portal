import { useCallback, useEffect, useRef, useState } from "react";
import { abandonExamAttemptKeepalive } from "@/lib/exam-attempt-api";

export function useExamReloadGuard(
  enabled: boolean,
  attemptId: string,
  onAbandon?: () => void | Promise<void>,
) {
  const [reloadOpen, setReloadOpen] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const isReload =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (!isReload) return;
      e.preventDefault();
      setReloadOpen(true);
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      e.returnValue = "";
      abandonExamAttemptKeepalive(attemptId);
      onAbandon?.();
      return "";
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, attemptId, onAbandon]);

  const stayOnExam = useCallback(() => {
    setReloadOpen(false);
  }, []);

  const confirmReload = useCallback(async () => {
    setReloadOpen(false);
    await onAbandon?.();
    window.location.reload();
  }, [onAbandon]);

  return { reloadOpen, stayOnExam, confirmReload };
}
