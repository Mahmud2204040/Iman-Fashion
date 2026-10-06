import type { Request, Response, NextFunction } from 'express';
import { l4Cache } from './cache.js';
import { l5Cache } from './l5-cache.js';

export function invalidatePath(pathPrefix: string) {
  // Clear from L4
  const keys = Array.from((l4Cache as any).cache.keys()) as string[];
  for (const key of keys) {
    if (key.includes(pathPrefix)) {
      l4Cache.delete(key);
      l5Cache.delete(key).catch(() => {});
    }
  }
}

export function centralMutationEffectsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Hook into response finish to clear caches downstream
  res.on('finish', () => {
    // Only if it was successful committed mutation
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const endpoint = req.path;
      // Invalidate the endpoint family itself
      invalidatePath(endpoint);

      // Financial cascades
      if (endpoint.startsWith('/api/v1/sales') || 
          endpoint.startsWith('/api/v1/custom-orders') || 
          endpoint.startsWith('/api/v1/purchases') || 
          endpoint.startsWith('/api/v1/expenses') || 
          endpoint.startsWith('/api/v1/raw-materials') ||
          endpoint.startsWith('/api/v1/cash')) {
        invalidatePath('/api/v1/dashboard');
        invalidatePath('/api/v1/reports');
        invalidatePath('/api/v1/cash'); // Some of these modify cash
      }
      
      // Stock cascades
      if (endpoint.startsWith('/api/v1/sales') || 
          endpoint.startsWith('/api/v1/purchases')) {
        invalidatePath('/api/v1/products');
        invalidatePath('/api/v1/catalog/products');
      }

      // People cascades
      if (endpoint.startsWith('/api/v1/sales') || endpoint.startsWith('/api/v1/custom-orders')) {
         invalidatePath('/api/v1/customers');
      }
      if (endpoint.startsWith('/api/v1/purchases')) {
         invalidatePath('/api/v1/suppliers');
      }
    }
  });

  next();
}
