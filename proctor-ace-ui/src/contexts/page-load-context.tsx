import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

type PageLoadContextValue = {
  registerLoading: (id: string, loading: boolean) => void;
};

const PageLoadContext = createContext<PageLoadContextValue | null>(null);

function computeReady(loaders: Map<string, boolean>) {
  if (loaders.size === 0) return true;
  return ![...loaders.values()].some(Boolean);
}

export function PageLoadProvider({ children }: { children: ReactNode }) {
  const [pageReady, setPageReady] = useState(true);
  const [loaders, setLoaders] = useState<Map<string, boolean>>(() => new Map());

  const registerLoading = useCallback((id: string, loading: boolean) => {
    setLoaders((prev) => {
      const next = new Map(prev);
      if (loading) next.set(id, true);
      else next.delete(id);
      setPageReady(computeReady(next));
      return next;
    });
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
