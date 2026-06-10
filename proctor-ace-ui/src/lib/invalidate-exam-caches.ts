import type { QueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "@/lib/query-client";

/** Refresh candidate views after an attempt ends so used-attempt counts stay accurate. */
export function invalidateExamCaches(queryClient: QueryClient) {
  const keys = ["my-exams", "dashboard-home", "dashboard-history", "available-exams"] as const;
  for (const id of keys) {
    void queryClient.invalidateQueries({
      queryKey: sessionQueryKey(id),
      refetchType: "all",
    });
  }
}
