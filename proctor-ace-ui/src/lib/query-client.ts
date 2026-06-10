import { QueryClient } from "@tanstack/react-query";

/** Candidate query keys invalidated after exam lifecycle events. */
export const CANDIDATE_CACHE_IDS = [
  "my-exams",
  "dashboard-home",
  "dashboard-history",
  "available-exams",
  "dashboard-payments",
  "dashboard-certificates",
  "dashboard-profile",
] as const;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}

/** Remove legacy persisted query caches (no longer used). */
export function clearPersistedCache() {
  if (typeof localStorage === "undefined") return;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("nx-qcache-") || k.startsWith("nx-qb-cache-")) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export const sessionQueryKey = (id: string, deps: unknown[] = []) => ["session", id, ...deps] as const;
