import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { usePageLoading } from "@/contexts/page-load-context";
import { isClientAuthenticated } from "@/lib/auth";
import { CANDIDATE_SESSION_IDS, purgePersistedCandidateCaches, sessionQueryKey } from "@/lib/query-client";

type SessionQueryOptions<T> = Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">;

const CANDIDATE_FRESH_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
} as const;

/**
 * Fetches once per browser session (until reload). Cached data is reused on route changes.
 * Shows the global page loader only while the first fetch for this key is in flight.
 */
export function usePageDataLoad<T>(
  id: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: SessionQueryOptions<T>,
) {
  const queryKey = sessionQueryKey(id, deps);

  const query = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled: isClientAuthenticated(),
    ...options,
  });

  usePageLoading(id, query.isPending);

  return query;
}

/** Candidate dashboard data — always refetch so admin changes appear without clearing cache. */
export function useCandidateDataLoad<T>(
  id: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: SessionQueryOptions<T>,
) {
  return usePageDataLoad(id, fetcher, deps, {
    ...CANDIDATE_FRESH_QUERY_OPTIONS,
    ...options,
  });
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return (id: string, ...deps: unknown[]) => {
    if (CANDIDATE_SESSION_IDS.has(id)) {
      purgePersistedCandidateCaches();
    }
    void queryClient.invalidateQueries({
      queryKey: sessionQueryKey(id, deps),
      refetchType: "all",
    });
  };
}
