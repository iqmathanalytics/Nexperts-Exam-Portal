import { useCallback, useEffect, useRef, useState } from "react";

export function useExamReloadGuard(
  enabled: boolean,
  onAbandon?: () => void,
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
      onAbandon?.();
      return "";
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, onAbandon]);

  const stayOnExam = useCallback(() => {
    setReloadOpen(false);
  }, []);

  const confirmReload = useCallback(() => {
    onAbandon?.();
    setReloadOpen(false);
    window.location.reload();
  }, [onAbandon]);

  return { reloadOpen, stayOnExam, confirmReload };
}
