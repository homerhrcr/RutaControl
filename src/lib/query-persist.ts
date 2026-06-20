import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { QueryClient } from "@tanstack/react-query";

let started = false;

/**
 * Persist the React Query cache to localStorage so cached data
 * (productos, clientes, créditos, etc.) stays available without internet.
 * Client-only: must run inside a browser (useEffect).
 */
export function enableQueryPersistence(queryClient: QueryClient) {
  if (started || typeof window === "undefined") return;
  started = true;

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "lr_query_cache",
    throttleTime: 1000,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
}
