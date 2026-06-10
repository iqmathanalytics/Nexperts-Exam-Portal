import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { usePageLoading } from "@/contexts/page-load-context";
import { isClientAuthenticated } from "@/lib/auth";
import { sessionQueryKey } from "@/lib/query-client";

type SessionQueryOptions<T> = Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">;

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

/** @deprecated Use usePageDataLoad — same behavior after cache removal. */
export const useCandidateDataLoad = usePageDataLoad;

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return (id: string, ...deps: unknown[]) => {
    void queryClient.invalidateQueries({
      queryKey: sessionQueryKey(id, deps),
      refetchType: "all",
    });
  };
}
