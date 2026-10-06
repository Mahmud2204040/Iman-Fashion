import { QueryClient } from '@tanstack/react-query';

export function createIsolatedQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes standard freshness for non-critical
        gcTime: 10 * 60 * 1000,   // 10 minutes retention
        retry: 1,
        refetchOnWindowFocus: false, // Override on specific critical queries
      },
      mutations: {
        retry: 0,
      }
    },
  });
}
