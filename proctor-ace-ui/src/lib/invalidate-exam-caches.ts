import type { QueryClient } from "@tanstack/react-query";
import { CANDIDATE_CACHE_IDS, sessionQueryKey } from "@/lib/query-client";

export function invalidateExamCaches(queryClient: QueryClient) {
  for (const id of CANDIDATE_CACHE_IDS) {
    void queryClient.invalidateQueries({
      queryKey: sessionQueryKey(id),
      refetchType: "all",
    });
  }
}
