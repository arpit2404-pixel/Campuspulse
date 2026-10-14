import { AdminUser } from '../types';

/**
 * DEMO-ONLY authentication.
 *
 * CampusPulse is a front-end-only project, so this check runs in the browser and
 * can be bypassed by anyone with dev tools. It exists to demonstrate role-based
 * UI flows (status updates, merge/split tools). A production deployment must
 * verify credentials on a server (e.g. an API with hashed + salted passwords,
 * rate limiting and signed session tokens).
 *
 * Only SHA-256 hashes are stored here, never plaintext passwords.
 * To use your own password, set VITE_ADMIN_PASSWORD_SHA256 in a local `.env`
 * file (see `.env.example`); it overrides the demo hash below.
 */

// SHA-256 of the documented demo password (see README).
const DEMO_PASSWORD_SHA256 =
  '3efa3e0f4dcdfbe97afc666d92055cb3b9965b9b624e32eecf93ba2acdccb6ab';

const PASSWORD_HASH: string =
  (import.meta as any).env?.VITE_ADMIN_PASSWORD_SHA256?.trim().toLowerCase() ||
  DEMO_PASSWORD_SHA256;

const ADMIN_ACCOUNTS: Record<string, AdminUser> = {
  'admin@campuspulse.edu': {
    id: 'admin-01',
    username: 'admin@campuspulse.edu',
    name: 'Chief Facilities Administrator',
    role: 'superadmin'
  },
  'estate@campuspulse.edu': {
    id: 'admin-02',
    username: 'estate@campuspulse.edu',
    name: 'Estate Maintenance Desk',
    role: 'campus_officer'
  }
};

const SESSION_KEY = 'campuspulse_admin_session';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

class AuthService {
  private currentUser: AdminUser | null = null;
  private listeners: ((user: AdminUser | null) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          this.currentUser = JSON.parse(saved);
        } catch {
          this.currentUser = null;
        }
      }
    }
  }

  public subscribe(callback: (user: AdminUser | null) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  public async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    const account = ADMIN_ACCOUNTS[username.trim().toLowerCase()];
    const inputHash = await sha256(password);

    if (account && inputHash === PASSWORD_HASH) {
      this.currentUser = account;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(account));
      this.notify();
      return { success: true };
    }

    return { success: false, error: 'Invalid administrator email or password.' };
  }

  public logout(): void {
    this.currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
    this.notify();
  }

  public getCurrentUser(): AdminUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const auth = new AuthService();
