import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { errorToResponse } from './errors.js';
import { createHandlers } from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(here, '../../dist');

export function createApp({ db, config }) {
  const app = express();
  const handlers = createHandlers({ db, config });

  app.disable('x-powered-by');
  if (config.trustProxy) {
    // "1", "2" ... = number of proxies in front of us; "true"/"false" also accepted
    const value = /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy === 'true';
    app.set('trust proxy', value);
  }

  // Basic security headers for every response
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer'
    });
    next();
  });

  // --- API -----------------------------------------------------------------
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); // API answers must never be cached

    // CORS: only the websites listed in CORS_ORIGIN may call the API from a browser.
    const origin = req.get('origin');
    if (origin && config.corsOrigins.includes(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Id',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin'
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api', express.json({ limit: '20kb' }));

  // Connects one URL to one handler function from routes.js
  const mount = (method, route, handler) => {
    app[method](route, async (req, res, next) => {
      try {
        const result = await handler({ ip: req.ip, headers: req.headers, params: req.params, body: req.body });
        res.status(result.status).json(result.body);
      } catch (err) {
        next(err);
      }
    });
  };

  mount('get', '/api/health', handlers.health);
  mount('get', '/api/state', handlers.getState);
  mount('post', '/api/reports', handlers.submitReport);
  mount('post', '/api/issues/:id/support', handlers.supportIssue);
  mount('post', '/api/admin/login', handlers.adminLogin);
  mount('post', '/api/admin/logout', handlers.adminLogout);
  mount('get', '/api/admin/me', handlers.adminMe);
  mount('patch', '/api/issues/:id/status', handlers.updateStatus);
  mount('post', '/api/issues/:id/merge', handlers.mergeIssues);
  mount('post', '/api/reports/:id/separate', handlers.separateReport);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such API route.' } });
  });

  // --- Optional: serve the built website from the same server ----------------
  // After `npm run build`, the "dist" folder exists and one server can host both
  // the website and the API (no CORS needed, one free host instead of two).
  if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    app.use(express.static(DIST_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  // --- Errors ----------------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const { status, body } = errorToResponse(err);
    if (status >= 500) console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err);
    res.status(status).json(body);
  });

  return app;
}
