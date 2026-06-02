import { QueryClient } from "@tanstack/react-query";

/** Session-scoped cache: data survives route changes until a full page reload. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}

export const sessionQueryKey = (id: string, deps: unknown[] = []) => ["session", id, ...deps] as const;
