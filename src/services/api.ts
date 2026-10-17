// A tiny client for the CampusPulse backend (the Express server in /server).
//
// - The API address comes from VITE_API_URL. Leave it empty when the website and the
//   API are served from the same place (production on one host) or while developing
//   locally (Vite forwards /api to the backend, see vite.config.ts).
// - Every request carries an anonymous random browser id (X-Client-Id). The server
//   only stores a keyed hash of it, so one browser can't count twice on an issue.
// - Admin requests also carry the login token. The token is kept in sessionStorage,
//   so it disappears when the browser tab is closed.

const API_BASE: string = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

// Free hosts (Render, Neon) sleep when idle, and waking up can take about a minute.
const REQUEST_TIMEOUT_MS = 75_000;

const CLIENT_ID_KEY = 'campuspulse_client_id_v3';
const ADMIN_TOKEN_KEY = 'campuspulse_admin_token';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface FieldError {
  field: string;
  message: string;
}

/** An error whose message is safe and helpful to show to the user. */
export class ApiError extends Error {
  status: number;
  code: string;
  fields: FieldError[];
  retryAfterSeconds?: number;

  constructor(status: number, code: string, message: string, extra: { fields?: FieldError[]; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = extra.fields ?? [];
    this.retryAfterSeconds = extra.retryAfterSeconds;
  }
}

// ---------------------------------------------------------------------------
// Anonymous browser id
// ---------------------------------------------------------------------------

let memoryClientId = '';

function makeClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'client_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      id = makeClientId();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode): keep an id for this page visit only
    if (!memoryClientId) memoryClientId = makeClientId();
    return memoryClientId;
  }
}

// ---------------------------------------------------------------------------
// Admin token
// ---------------------------------------------------------------------------

export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore: storage is blocked
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** auth.ts registers a function here that runs when the server says the admin login expired. */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Client-Id': getClientId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      'Cannot reach the server. Free hosting can take up to a minute to wake up, so please try again shortly.'
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // not JSON (for example an HTML error page from a proxy)
  }

  if (!response.ok) {
    const err = data?.error;
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(
      response.status,
      err?.code ?? 'SERVER_ERROR',
      err?.message ?? 'Something went wrong. Please try again.',
      { fields: err?.fields, retryAfterSeconds: err?.retryAfterSeconds }
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown = {}) => request<T>('PATCH', path, body)
};
