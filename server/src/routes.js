// The API, written as plain functions.
//
// Each handler receives { ip, headers, params, body } and returns { status, body }
// (or throws an AppError). Express is only used in app.js to connect URLs to these
// functions. Keeping them separate makes the logic easy to read and easy to test.

import { AppError, unauthorized } from './errors.js';
import { createRateLimiter, extractBearerToken } from './security.js';
import { getState, submitReport, supportIssue } from './services/complaints.js';
import {
  getAdminByToken,
  loginAdmin,
  logoutAdmin,
  mergeIssues,
  separateReport,
  updateIssueStatus
} from './services/admin.js';
import { requireUuid, sanitizeText, validateStatusChange, validateTitleOptional } from './validate.js';

const tooManyRequests = (retryAfterSeconds, message) =>
  new AppError(429, 'RATE_LIMIT', message, { retryAfterSeconds });

export function createHandlers({ db, config, limiters } = {}) {
  // General per-IP limits protect the database from floods. They are generous
  // because many students may share one campus Wi-Fi address.
  const write = limiters?.write ?? createRateLimiter({ windowMs: 60_000, max: 40 });
  const read = limiters?.read ?? createRateLimiter({ windowMs: 60_000, max: 600 });
  // Login: only 5 tries per 15 minutes for the same email from the same IP
  const login = limiters?.login ?? createRateLimiter({ windowMs: 15 * 60_000, max: 5 });

  const who = (req) => ({ clientId: req.headers['x-client-id'], ip: req.ip });

  const limit = (limiter, key, message = 'Too many requests. Please slow down and try again shortly.') => {
    const result = limiter.hit(key);
    if (!result.allowed) throw tooManyRequests(result.retryAfterSeconds, message);
  };

  /** Wraps an admin-only handler: checks the Bearer token before running it. */
  const adminOnly = (handler) => async (req) => {
    const token = extractBearerToken(req.headers.authorization);
    const admin = await getAdminByToken(db, token);
    if (!admin) throw unauthorized();
    return handler(req, admin, token);
  };

  return {
    // --- Public ---------------------------------------------------------

    async health() {
      try {
        await db.query('SELECT 1');
        return { status: 200, body: { ok: true, database: true } };
      } catch {
        return { status: 503, body: { ok: false, database: false } };
      }
    },

    async getState(req) {
      limit(read, `read:${req.ip}`);
      return { status: 200, body: await getState(db, config, { clientId: req.headers['x-client-id'] }) };
    },

    async submitReport(req) {
      limit(write, `write:${req.ip}`);
      return { status: 201, body: await submitReport(db, config, req.body, who(req)) };
    },

    async supportIssue(req) {
      limit(write, `write:${req.ip}`);
      return { status: 200, body: await supportIssue(db, config, req.params.id, who(req)) };
    },

    // --- Admin ----------------------------------------------------------

    async adminLogin(req) {
      const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254);
      const key = `login:${req.ip}:${email}`;
      limit(login, key, 'Too many login attempts. Please wait 15 minutes and try again.');
      const session = await loginAdmin(db, config, { email, password: req.body?.password });
      login.reset(key); // a successful login clears the failure count
      return { status: 200, body: session };
    },

    adminMe: adminOnly(async (req, admin) => ({ status: 200, body: { user: admin } })),

    adminLogout: adminOnly(async (req, admin, token) => {
      await logoutAdmin(db, token);
      return { status: 200, body: { ok: true } };
    }),

    updateStatus: adminOnly(async (req, admin) => {
      limit(write, `write:${req.ip}`);
      const change = validateStatusChange(req.body);
      return { status: 200, body: { issue: await updateIssueStatus(db, req.params.id, change, admin) } };
    }),

    mergeIssues: adminOnly(async (req, admin) => {
      limit(write, `write:${req.ip}`);
      const sourceId = requireUuid(req.body?.sourceIssueId, 'source issue id');
      const issue = await mergeIssues(db, req.params.id, sourceId, req.body?.notes, admin);
      return { status: 200, body: { issue } };
    }),

    separateReport: adminOnly(async (req, admin) => {
      limit(write, `write:${req.ip}`);
      const title = validateTitleOptional(req.body?.title);
      const issue = await separateReport(db, req.params.id, title, sanitizeText(req.body?.notes ?? '', { multiline: true }), admin);
      return { status: 200, body: { issue } };
    })
  };
}
