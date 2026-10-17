import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, errorToResponse } from '../src/errors.js';
import {
  checkPasswordStrength,
  createRateLimiter,
  extractBearerToken,
  hashPassword,
  hmac,
  randomToken,
  sha256,
  verifyPassword
} from '../src/security.js';
import { loadConfig } from '../src/config.js';

test('passwords are salted and verified', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!hash.includes('correct horse'));
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password here', hash), false);
  // same password, different salt -> different hash
  assert.notEqual(hash, await hashPassword('correct horse battery staple'));
});

test('garbage stored hashes never verify', async () => {
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', ''), false);
});

test('password strength rules', () => {
  assert.match(checkPasswordStrength('short'), /at least 12/);
  assert.match(checkPasswordStrength('aaaaaaaaaaaaaaaa'), /too simple/);
  assert.match(checkPasswordStrength('admin@campus.edu', 'admin@campus.edu'), /same as the email/);
  assert.equal(checkPasswordStrength('a-long-enough-passphrase'), null);
});

test('hashes are stable, keyed and different per input', () => {
  assert.equal(hmac('k', 'a'), hmac('k', 'a'));
  assert.notEqual(hmac('k', 'a'), hmac('k2', 'a'));
  assert.notEqual(hmac('k', 'a'), hmac('k', 'b'));
  assert.equal(sha256('abc').length, 64);
  assert.notEqual(randomToken(), randomToken());
  assert.equal(randomToken(32).length, 64);
});

test('rate limiter blocks after the limit and recovers after the window', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
  const t0 = 1_000_000;
  assert.equal(limiter.hit('a', t0).allowed, true);
  assert.equal(limiter.hit('a', t0 + 10).allowed, true);
  assert.equal(limiter.hit('a', t0 + 20).allowed, true);
  const blocked = limiter.hit('a', t0 + 30);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
  assert.equal(limiter.hit('b', t0 + 30).allowed, true, 'other keys are independent');
  assert.equal(limiter.hit('a', t0 + 1500).allowed, true, 'allowed again after the window');
  limiter.reset('a');
  limiter.stop();
});

test('bearer tokens are parsed strictly', () => {
  const token = 'a'.repeat(64);
  assert.equal(extractBearerToken(`Bearer ${token}`), token);
  assert.equal(extractBearerToken('Basic abc'), '');
  assert.equal(extractBearerToken(undefined), '');
  assert.equal(extractBearerToken('Bearer short'), '');
});

test('errors become safe responses', () => {
  const known = errorToResponse(new AppError(409, 'ALREADY_REPORTED', 'Already reported.'));
  assert.deepEqual(known, { status: 409, body: { error: { code: 'ALREADY_REPORTED', message: 'Already reported.' } } });

  const secret = new Error('password authentication failed for user "neondb_owner" at ep-secret-host');
  const unknown = errorToResponse(secret);
  assert.equal(unknown.status, 500);
  assert.ok(!JSON.stringify(unknown.body).includes('neondb_owner'), 'internal details must not leak');

  assert.equal(errorToResponse({ type: 'entity.parse.failed' }).status, 400);
  assert.equal(errorToResponse({ type: 'entity.too.large' }).status, 413);
  assert.equal(errorToResponse({ code: '23505' }).status, 409);
});

test('config: refuses to start without DATABASE_URL, and is strict in production', () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL/);
  assert.throws(() => loadConfig({ DATABASE_URL: 'postgres://x', NODE_ENV: 'production' }), /SERVER_SECRET/);
  assert.throws(
    () => loadConfig({ DATABASE_URL: 'postgres://x', NODE_ENV: 'production', SERVER_SECRET: 'too-short' }),
    /at least 32/
  );
  const ok = loadConfig({
    DATABASE_URL: 'postgres://x',
    NODE_ENV: 'production',
    SERVER_SECRET: 's'.repeat(40),
    CORS_ORIGIN: 'https://a.example.com/, https://b.example.com'
  });
  assert.deepEqual(ok.corsOrigins, ['https://a.example.com', 'https://b.example.com']);
  assert.equal(ok.trustProxy, '1');
  assert.equal(ok.port, 3001);
});
