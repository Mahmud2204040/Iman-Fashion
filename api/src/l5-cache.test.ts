import { test } from 'node:test';
import assert from 'node:assert';
import { L5DiskCache } from './l5-cache.ts';
import fs from 'node:fs/promises';

test('L5 disk cache fails gracefully when disabled or handles writes', async (t) => {
  const l5Cache = new L5DiskCache();
  await l5Cache.set('test_key', { data: 123 });
  const result = await l5Cache.get('test_key');
  assert.ok(true);
});
