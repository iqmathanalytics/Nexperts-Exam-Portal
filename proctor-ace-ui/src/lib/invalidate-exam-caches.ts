import type { QueryClient } from "@tanstack/react-query";
import { CANDIDATE_SESSION_IDS, purgePersistedCandidateCaches, sessionQueryKey } from "@/lib/query-client";

/** Refresh candidate views after an attempt ends so used-attempt counts stay accurate. */
export function invalidateExamCaches(queryClient: QueryClient) {
  purgePersistedCandidateCaches();
  for (const id of CANDIDATE_SESSION_IDS) {
    void queryClient.invalidateQueries({
      queryKey: sessionQueryKey(id),
      refetchType: "all",
    });
  }
}
