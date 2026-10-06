import { DOMAIN, CACHE_SCHEMA_VERSION } from './queryKeys.js';

const channel = new BroadcastChannel('ni-fashion:cache-invalidation');

export function notifyMutationSuccess(queryClient, user, domain) {
  const userId = user?.id || 'anonymous';
  const role = user?.role || 'anonymous';

  // Invalidate local queries matching the domain
  queryClient.invalidateQueries({
    predicate: (query) => {
      const [schema, qUserId, qRole, qDomain] = query.queryKey;
      return schema === CACHE_SCHEMA_VERSION && qUserId === userId && qDomain === domain;
    }
  });

  // Notify other tabs
  channel.postMessage({ type: 'INVALIDATE', domain, userId });
}

export function setupCrossTabInvalidation(queryClient) {
  channel.onmessage = (event) => {
    if (event.data?.type === 'INVALIDATE') {
      const { domain, userId } = event.data;
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [schema, qUserId, qRole, qDomain] = query.queryKey;
          return schema === CACHE_SCHEMA_VERSION && qUserId === userId && qDomain === domain;
        }
      });
    }
  };
}
