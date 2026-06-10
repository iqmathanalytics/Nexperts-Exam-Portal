import { QueryClient } from "@tanstack/react-query";

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCacheKey(): string | null {
  try {
    const raw = localStorage.getItem("nx-auth");
    if (!raw) return null;
    const auth = JSON.parse(raw) as { email?: string };
    return auth?.email ? `nx-qcache-${auth.email}` : null;
  } catch {
    return null;
  }
}

function hydrateCache(client: QueryClient) {
  if (typeof localStorage === "undefined") return;
  try {
    const key = getCacheKey();
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const { entries, savedAt } = JSON.parse(raw) as {
      entries: { queryKey: unknown[]; data: unknown }[];
      savedAt: number;
    };
    if (Date.now() - savedAt > CACHE_TTL) {
      localStorage.removeItem(key);
      return;
    }
    for (const { queryKey, data } of entries) {
      client.setQueryData(queryKey as readonly unknown[], data);
    }
  } catch {
    try { localStorage.removeItem(getCacheKey() ?? ""); } catch {}
  }
}

function persistCache(client: QueryClient) {
  if (typeof localStorage === "undefined") return;
  try {
    const key = getCacheKey();
    if (!key) return;
    const entries = client
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.status === "success" && q.state.data !== undefined)
      .map((q) => ({ queryKey: q.queryKey, data: q.state.data }));
    localStorage.setItem(key, JSON.stringify({ entries, savedAt: Date.now() }));
  } catch {}
}

export function clearPersistedCache() {
  if (typeof localStorage === "undefined") return;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("nx-qcache-") || k.startsWith("nx-qb-cache-")) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
}

/** Session-scoped cache: data survives route changes and page reloads (10-min TTL). */
export function createQueryClient() {
  const client = new QueryClient({
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

  client.getQueryCache().subscribe(() => persistCache(client));

  return client;
}

/** Call once on the client after mount so SSR markup matches the first client render. */
export function hydratePersistedQueryCache(client: QueryClient) {
  hydrateCache(client);
}

export const sessionQueryKey = (id: string, deps: unknown[] = []) => ["session", id, ...deps] as const;
