import { l4Cache, buildCacheKey } from './cache.js';

// Cache invalidation functions
export function invalidatePath(pathPrefix: string) {
  const keys = Array.from((l4Cache as any).cache.keys()) as string[];
  for (const key of keys) {
    if (key.includes(pathPrefix)) {
      l4Cache.delete(key);
    }
  }
}
