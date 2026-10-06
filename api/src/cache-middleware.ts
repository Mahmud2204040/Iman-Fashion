import type { Request, Response, NextFunction } from 'express';
import { l4Cache, buildCacheKey, isCacheableL4, getTtlFromResource } from './cache.js';

export function l4CacheMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only cache GET
  if (req.method !== 'GET') {
    return next();
  }

  // Handle explicitly timed bypass
  if (req.header('x-cache-bypass') === '1') {
    return next();
  }

  const endpoint = req.path;
  if (!isCacheableL4(endpoint)) {
    return next();
  }

  const ttl = getTtlFromResource(endpoint);
  if (ttl <= 0) {
    return next();
  }

  // Generate key components
  // Reconstruct sorted query string for normalization
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  urlObj.searchParams.sort();
  const normalizedQuery = urlObj.searchParams.toString();
  
  const role = (req as any).user?.role || '';
  // Owner display uses shared cache, only diff is per-employee if varying or if isolated data is required
  const includeUserId = endpoint.startsWith('/api/v1/sales'); 
  const userId = includeUserId ? ((req as any).user?.id || '') : '';
  
  const cacheKey = buildCacheKey({
    resource: endpoint,
    normalizedQuery,
    role,
    userId,
  });

  const cached = l4Cache.get(cacheKey);
  
  if (cached) {
    // Check TTL
    if (Date.now() <= cached.expiresAt) {
      if (!res.headersSent) {
        res.setHeader('X-Cache', 'HIT');
        // IMPORTANT: Set no-store again explicitly just in case it was missing
        res.setHeader('Cache-Control', 'no-store');
        return res.json(cached.payload);
      }
    } else {
      // Evict expired inline
      l4Cache.delete(cacheKey);
    }
  }

  // No hit or expired, patch json() to capture response
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Determine byte size safely
    let bodyBytes = 0;
    try {
      bodyBytes = Buffer.byteLength(JSON.stringify(body));
    } catch {
      bodyBytes = Infinity;
    }
    
    // Only cache successes under 2MiB
    if (res.statusCode >= 200 && res.statusCode < 300 && body && !body.error && bodyBytes < 2 * 1024 * 1024) {
      l4Cache.set(cacheKey, {
        payload: body,
        expiresAt: Date.now() + ttl,
        createdAt: Date.now(),
      });
      res.setHeader('X-Cache', 'MISS');
    } else {
      res.setHeader('X-Cache', 'BYPASS');
    }
    return originalJson(body);
  };
  
  next();
}
