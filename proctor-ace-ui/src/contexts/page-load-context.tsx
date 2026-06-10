import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";

type PageLoadContextValue = {
  registerLoading: (id: string, loading: boolean) => void;
};

const PageLoadContext = createContext<PageLoadContextValue | null>(null);

function computeReady(loaders: Map<string, boolean>) {
  if (loaders.size === 0) return true;
  return ![...loaders.values()].some(Boolean);
}

export function PageLoadProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pageReady, setPageReady] = useState(true);
  const loadersRef = useRef<Map<string, boolean>>(new Map());
  const epochRef = useRef(0);

  useLayoutEffect(() => {
    epochRef.current += 1;
    const epoch = epochRef.current;
    loadersRef.current.clear();
    setPageReady(false);

    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (epoch !== epochRef.current) return;
        setPageReady(computeReady(loadersRef.current));
      });
    });

    return () => cancelAnimationFrame(outer);
  }, [pathname]);

  const registerLoading = useCallback((id: string, loading: boolean) => {
    if (loading) {
      loadersRef.current.set(id, true);
    } else {
      loadersRef.current.delete(id);
    }
    setPageReady(computeReady(loadersRef.current));
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

export { usePageDataLoad, useCandidateDataLoad, useInvalidateSession } from "@/hooks/use-session-query";
