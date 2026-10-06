import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Minimal LRU without external dependencies for L4 initial phase
export class NodeLRUCache<K, V> {
  private maxSize: number;
  private currentSize: number = 0;
  private sizeCalculation: (value: V, key: K) => number;
  private cache = new Map<K, { value: V, size: number }>();
  
  constructor({ maxSize, sizeCalculation }: { maxSize: number, sizeCalculation: (value: V, key: K) => number }) {
    this.maxSize = maxSize;
    this.sizeCalculation = sizeCalculation;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item) {
      // LRU refresh
      this.cache.delete(key);
      this.cache.set(key, item);
      return item.value;
    }
    return undefined;
  }

  set(key: K, value: V) {
    const itemSize = this.sizeCalculation(value, key);
    
    // Check if replacing
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }
    
    // Evict if at capacity
    while (this.currentSize + itemSize > this.maxSize && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestItem = this.cache.get(oldestKey);
        if (oldestItem) this.currentSize -= oldestItem.size;
        this.cache.delete(oldestKey);
      }
    }
    
    // Only cache if it fits alone
    if (itemSize <= this.maxSize) {
      this.cache.set(key, { value, size: itemSize });
      this.currentSize += itemSize;
    }
  }
  
  delete(key: K) {
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }
  }
  
  clear() {
    this.cache.clear();
    this.currentSize = 0;
  }
  
  // Expose status metrics
  getStats() {
    return { size: this.currentSize, count: this.cache.size };
  }
}

// L4 RAM Cache (LRU) - 75 MiB limit
export const l4Cache = new NodeLRUCache<string, any>({
  maxSize: 75 * 1024 * 1024,
  sizeCalculation: (value, key) => {
    try {
      return Buffer.byteLength(JSON.stringify(value)) + Buffer.byteLength(key);
    } catch {
      return 1024; // fallback safe size if can't serialize
    }
  },
});

export const CACHE_SCHEMA_VERSION = 'v1';
export const CACHE_NAMESPACE = 'shop1';

export function buildCacheKey({
  resource,
  normalizedQuery = '',
  role = '',
  userId = ''
}: {
  resource: string;
  normalizedQuery?: string;
  role?: string;
  userId?: string;
}) {
  const parts = [
    CACHE_SCHEMA_VERSION,
    CACHE_NAMESPACE,
    resource,
    normalizedQuery,
  ];
  if (role) parts.push(role);
  if (userId) parts.push(userId);
  return parts.join(':');
}

export function isCacheableL4(resource: string): boolean {
  if (process.env.API_RESPONSE_CACHE_ENABLED !== 'true') return false;
  
  // Do not cache API root resources when exact logic is required; implement exactly as documented
  const allowlist = [
    '/api/v1/expense-categories',
    '/api/v1/products',
    '/api/v1/catalog/products',
    '/api/v1/raw-materials',
    '/api/v1/customers',
    '/api/v1/suppliers',
    '/dashboard'
  ];
  
  const exactMatch = ['/api/v1/dashboard', '/api/v1/dashboard/summary'];
  
  return allowlist.some(prefix => resource.startsWith(prefix)) || 
         exactMatch.includes(resource);
}

export function getTtlFromResource(resource: string): number {
  if (resource.startsWith('/api/v1/expense-categories')) return 60 * 1000;
  if (resource.startsWith('/api/v1/products') || resource.startsWith('/api/v1/catalog') || resource.startsWith('/api/v1/raw-materials')) return 10 * 1000;
  if (resource.startsWith('/api/v1/customers') || resource.startsWith('/api/v1/suppliers')) return 20 * 1000;
  if (resource.startsWith('/api/v1/sales')) return 30 * 1000;
  if (resource.includes('dashboard')) return 5 * 1000;
  
  return 0; // Default uncached
}
