import { AdminUser } from '../types';
import { ApiError, api, getAdminToken, onUnauthorized, setAdminToken } from './api';

// Administrator login.
//
// The password is checked on the SERVER (Express + PostgreSQL). Nothing secret is
// stored in this website's code: no passwords, no hashes. After a successful login
// the server gives us a random session token, which we keep in sessionStorage and
// send with every admin request. It expires on its own and on logout.
//
// Admin accounts are created from the command line with `npm run create-admin`.

const USER_KEY = 'campuspulse_admin_user';

interface LoginResponse {
  token: string;
  user: AdminUser;
  expiresInHours: number;
}

class AuthService {
  private currentUser: AdminUser | null = null;
  private listeners: ((user: AdminUser | null) => void)[] = [];

  constructor() {
    if (typeof window === 'undefined') return;

    // Handle "your session expired" answers coming from any admin request
    onUnauthorized(() => this.clearSession());

    // Restore the login shown after a page refresh, then double-check it with the server
    try {
      const saved = sessionStorage.getItem(USER_KEY);
      if (saved && getAdminToken()) {
        this.currentUser = JSON.parse(saved) as AdminUser;
        void this.verifySession();
      }
    } catch {
      this.currentUser = null;
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

  private clearSession() {
    this.currentUser = null;
    setAdminToken('');
    try {
      sessionStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    this.notify();
  }

  private async verifySession() {
    try {
      await api.get<{ user: AdminUser }>('/api/admin/me');
    } catch (err) {
      // A 401 already cleared the session. A network error keeps the login for now.
      if (err instanceof ApiError && err.status === 401) this.clearSession();
    }
  }

  public async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await api.post<LoginResponse>('/api/admin/login', {
        email: username.trim(),
        password
      });
      setAdminToken(session.token);
      this.currentUser = session.user;
      try {
        sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
      } catch {
        // ignore
      }
      this.notify();
      return { success: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      return { success: false, error: message };
    }
  }

  public logout(): void {
    const hadToken = Boolean(getAdminToken());
    if (hadToken) {
      // Tell the server to forget the token. If this fails the token still expires on its own.
      void api.post('/api/admin/logout').catch(() => undefined);
    }
    this.clearSession();
  }

  public getCurrentUser(): AdminUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const auth = new AuthService();
