import { test } from 'node:test';
import assert from 'node:assert';
import { NodeLRUCache, buildCacheKey } from './cache.ts';

test('NodeLRUCache evicts properly', (t) => {
  const cache = new NodeLRUCache<string, any>({
    maxSize: 100, // tiny limit
    sizeCalculation: (v, k) => Buffer.byteLength(JSON.stringify(v)) + Buffer.byteLength(k),
  });
  
  cache.set('a', { data: 'a quick' });
  const val = cache.get('a');
  assert.equal(val.data, 'a quick');
  
  // push it over the limit
  cache.set('b', { data: 'long string that consumes most space' });
  cache.set('c', { data: 'even longer string that definitely causes eviction' });
  
  assert.equal(cache.get('a'), undefined);
});

test('buildCacheKey', (t) => {
  assert.equal(
    buildCacheKey({ resource: '/api/v1/test' }),
    'v1:shop1:/api/v1/test:'
  );
  assert.equal(
    buildCacheKey({ resource: '/api/v1/test', role: 'OWNER' }),
    'v1:shop1:/api/v1/test::OWNER'
  );
});
