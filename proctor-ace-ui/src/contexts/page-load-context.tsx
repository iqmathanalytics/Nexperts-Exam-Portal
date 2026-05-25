import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

type PageLoadContextValue = {
  registerLoading: (id: string, loading: boolean) => void;
};

const PageLoadContext = createContext<PageLoadContextValue | null>(null);

export function PageLoadProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pageReady, setPageReady] = useState(true);
  const loadersRef = useRef<Map<string, boolean>>(new Map());

  useLayoutEffect(() => {
    loadersRef.current.clear();
    setPageReady(false);
    let cancelled = false;
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled && loadersRef.current.size === 0) setPageReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outer);
    };
  }, [pathname]);

  const registerLoading = useCallback((id: string, loading: boolean) => {
    loadersRef.current.set(id, loading);
    const values = [...loadersRef.current.values()];
    if (values.length === 0) {
      setPageReady(true);
      return;
    }
    setPageReady(!values.some(Boolean));
  }, []);

  return (
    <PageLoadContext.Provider value={{ registerLoading }}>
      <PageLoadStateContext.Provider value={pageReady}>{children}</PageLoadStateContext.Provider>
    </PageLoadContext.Provider>
  );
}

const PageLoadStateContext = createContext(true);

export function usePageReady() {
  return useContext(PageLoadStateContext);
}

export function usePageLoading(id: string, loading: boolean) {
  const ctx = useContext(PageLoadContext);
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.registerLoading(id, loading);
  }, [id, loading, ctx]);

  useEffect(() => {
    return () => {
      if (ctx) ctx.registerLoading(id, false);
    };
  }, [id, ctx]);
}

export function usePageDataLoad(id: string, loadFn: () => Promise<void>, deps: unknown[]) {
  const ctx = useContext(PageLoadContext);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.registerLoading(id, true);
  }, [id, ctx, ...deps]);

  useEffect(() => {
    if (!ctx) return;
    let cancelled = false;
    void loadFn()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) ctx.registerLoading(id, false);
      });
    return () => {
      cancelled = true;
      ctx.registerLoading(id, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ctx, ...deps]);
}
