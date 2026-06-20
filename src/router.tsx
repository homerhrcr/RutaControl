import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep cached data around long enough to survive offline reloads.
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        staleTime: 1000 * 60 * 5, // 5 min
        retry: 2,
        // Don't error when offline; serve cached data instead.
        networkMode: "offlineFirst",
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
