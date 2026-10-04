import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, hashToken, randomToken, safeEqualHex, validPassword, verifyPassword } from './security.js';

test('passwords are salted, verified and bounded', async () => {
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('long-enough'), true);
  const first = await hashPassword('correct horse battery staple');
  const second = await hashPassword('correct horse battery staple');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('correct horse battery staple', first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  assert.equal(await verifyPassword('wrong', 'malformed'), false);
});

test('session tokens are random and hashes compare safely', () => {
  const a = randomToken();
  const b = randomToken();
  assert.notEqual(a, b);
  assert.equal(safeEqualHex(hashToken(a), hashToken(a)), true);
  assert.equal(safeEqualHex(hashToken(a), hashToken(b)), false);
});
