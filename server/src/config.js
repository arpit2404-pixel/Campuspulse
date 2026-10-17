import { randomBytes } from 'node:crypto';

/**
 * Reads settings from environment variables (see .env.example).
 * Secrets such as DATABASE_URL and SERVER_SECRET only ever live on the server.
 */
export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';

  const databaseUrl = (env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.'
    );
  }

  let serverSecret = (env.SERVER_SECRET || '').trim();
  if (!serverSecret) {
    if (isProduction) {
      throw new Error('SERVER_SECRET is required in production (use at least 32 random characters).');
    }
    // Development only: a throwaway secret. It changes every restart, which just
    // means the "already reported" memory resets when you restart the server.
    serverSecret = randomBytes(32).toString('hex');
    console.warn('SERVER_SECRET is not set - using a temporary one for this run (development only).');
  }
  if (isProduction && serverSecret.length < 32) {
    throw new Error('SERVER_SECRET must be at least 32 characters in production.');
  }

  const int = (name, fallback) => {
    const n = Number.parseInt(env[name] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const corsOrigins = (env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000'))
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return {
    isProduction,
    port: int('PORT', 3001),
    databaseUrl,
    serverSecret,
    corsOrigins,
    // Render, Railway etc. put a proxy in front of the app. "1" means: trust the
    // first proxy so req.ip is the visitor's address and not the proxy's.
    trustProxy: env.TRUST_PROXY !== undefined ? env.TRUST_PROXY : isProduction ? '1' : '',
    sessionHours: int('ADMIN_SESSION_HOURS', 8),
    // Spam limits (see README "Spam prevention")
    limits: {
      reportsPerClient: int('LIMIT_REPORTS_PER_CLIENT', 3),
      clientWindowSeconds: int('LIMIT_CLIENT_WINDOW_SECONDS', 180),
      reportsPerIp: int('LIMIT_REPORTS_PER_IP', 30),
      ipWindowSeconds: int('LIMIT_IP_WINDOW_SECONDS', 600)
    }
  };
}
