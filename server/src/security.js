import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

/** Keyed hash (HMAC). Used to turn a browser id or IP address into an opaque value. */
export const hmac = (secret, value) =>
  crypto.createHmac('sha256', secret).update(String(value)).digest('hex');

/** Plain SHA-256. Used for session tokens (which are already long random strings). */
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

// ---------------------------------------------------------------------------
// Passwords (scrypt = slow on purpose, so guessing passwords is expensive)
// Stored as:  scrypt$N$r$p$salt$hash   (salt and hash are base64)
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * Number(N) * Number(r) * 2 };
  const actual = await scrypt(String(password), salt, expected.length, params);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

let dummyHashPromise = null;
/** A fake hash used when the email is unknown, so login takes the same time either way. */
export function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

/** Returns an error message, or null when the password is acceptable. */
export function checkPasswordStrength(password, email = '') {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters long.';
  }
  if (password.length > 200) return 'Password is too long.';
  if (email && password.toLowerCase() === String(email).toLowerCase()) {
    return 'Password must not be the same as the email address.';
  }
  if (/^(.)\1+$/.test(password)) return 'Password is too simple.';
  return null;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter (sliding window)
//
// Counts requests per key (usually an IP address) inside a time window.
// It lives in the server's memory, so it resets when the server restarts and is
// per-server-instance. That is fine for a single free-tier server. The
// per-student report limits are stored in the database instead (see
// services/complaints.js), so they survive restarts.
// ---------------------------------------------------------------------------

export function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> array of timestamps

  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, stamps] of hits) {
      const fresh = stamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, Math.max(windowMs, 60_000));
  if (typeof timer.unref === 'function') timer.unref(); // don't keep the process alive

  return {
    /** Records one attempt. Returns { allowed, retryAfterSeconds }. */
    hit(key, now = Date.now()) {
      const stamps = (hits.get(key) || []).filter((t) => t > now - windowMs);
      if (stamps.length >= max) {
        hits.set(key, stamps);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000)) };
      }
      stamps.push(now);
      hits.set(key, stamps);
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset(key) {
      hits.delete(key);
    },
    stop() {
      clearInterval(timer);
    }
  };
}

/** Pulls the token out of an "Authorization: Bearer <token>" header. */
export function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return '';
  const match = headerValue.match(/^Bearer\s+([A-Za-z0-9_-]{20,200})$/);
  return match ? match[1] : '';
}
