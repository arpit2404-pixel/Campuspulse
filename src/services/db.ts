import { CampusStats, Issue, IssueCategory, IssueStatus, Report, Urgency } from '../types';
import { ApiError, FieldError, api } from './api';

// The website's data store.
//
// All complaints live in the PostgreSQL database behind the Express server. This
// class keeps a copy of the latest data in memory ("cache") so the screens can read
// it instantly, and refreshes that copy:
//   - when the page opens,
//   - right after every change made from this browser,
//   - every 30 seconds,
//   - when you come back to the tab.
// Everyone who opens the website sees the same data because it comes from the server.

const REFRESH_EVERY_MS = 30_000;

export interface SubmitReportInput {
  title: string;
  description: string;
  category: IssueCategory;
  building: string;
  room: string;
  urgency?: Urgency;
}

export interface SubmitReportResult {
  success: boolean;
  error?: string;
  message?: string;
  fields?: FieldError[];
  report?: Report;
  issue?: Issue;
  isGrouped?: boolean;
  matchConfidence?: number;
  matchReason?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  issue?: Issue;
}

export interface ConnectionState {
  isLoading: boolean; // true until the first answer from the server arrives
  error: string | null; // set while the server can't be reached
}

interface StateResponse {
  issues: Issue[];
  reports: Report[];
  stats: CampusStats;
}

const CATEGORY_NAMES: IssueCategory[] = [
  'Infrastructure',
  'Electricity',
  'Water',
  'Cleanliness',
  'Internet',
  'Classroom Equipment',
  'Other'
];

function emptyStats(): CampusStats {
  return {
    totalReports: 0,
    totalIssues: 0,
    awaitingResolution: 0,
    resolvedIssues: 0,
    categoryCounts: Object.fromEntries(CATEGORY_NAMES.map((c) => [c, 0])) as Record<IssueCategory, number>
  };
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

class DatabaseService {
  private issues: Issue[] = [];
  private reports: Report[] = [];
  private stats: CampusStats = emptyStats();
  private listeners: (() => void)[] = [];
  private connection: ConnectionState = { isLoading: true, error: null };
  private inFlight: Promise<void> | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    void this.refresh();
    window.setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, REFRESH_EVERY_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.refresh();
    });
    window.addEventListener('online', () => void this.refresh());
  }

  // --- Subscriptions --------------------------------------------------------

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // --- Loading data from the server ----------------------------------------

  /**
   * Fetches the latest data. Calls made while a fetch is already running share it,
   * unless `force` is set (used after a change, so the new data is never skipped).
   */
  public async refresh(force = false): Promise<void> {
    if (this.inFlight) {
      if (!force) return this.inFlight;
      await this.inFlight.catch(() => undefined);
    }
    this.inFlight = this.load().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async load(): Promise<void> {
    try {
      const data = await api.get<StateResponse>('/api/state');
      this.issues = data.issues;
      this.reports = data.reports;
      this.stats = data.stats;
      this.connection = { isLoading: false, error: null };
    } catch (err) {
      // Keep showing the last data we had; just report the problem
      this.connection = { isLoading: false, error: errorMessage(err) };
    }
    this.notify();
  }

  public getConnection(): ConnectionState {
    return this.connection;
  }

  // --- Reading (instant, from the cache) -----------------------------------

  public getIssues(): Issue[] {
    return [...this.issues];
  }

  public getIssueById(id: string): Issue | null {
    return this.issues.find(i => i.id === id) ?? null;
  }

  public getReports(): Report[] {
    return [...this.reports];
  }

  public getTopIssues(limit = 5): Issue[] {
    return [...this.issues]
      .sort((a, b) => {
        if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, limit);
  }

  public getStats(): CampusStats {
    return this.stats;
  }

  // --- Changes (sent to the server) ----------------------------------------

  /** Sends a new complaint. The server validates it again and groups similar ones. */
  public async submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
    try {
      const result = await api.post<Omit<SubmitReportResult, 'success'>>('/api/reports', input);
      await this.refresh(true);
      return { success: true, ...result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof ApiError ? err.code : 'ERROR',
        message: errorMessage(err),
        fields: err instanceof ApiError ? err.fields : undefined
      };
    }
  }

  /** "+1 I have this too" */
  public async supportIssue(issueId: string): Promise<ActionResult> {
    try {
      const result = await api.post<{ message: string; issue: Issue }>(`/api/issues/${issueId}/support`);
      await this.refresh(true);
      return { success: true, message: result.message, issue: result.issue };
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }
  }

  // --- Admin actions (the server checks the admin login on each one) --------

  public async updateIssueStatus(issueId: string, status: IssueStatus, notes: string): Promise<ActionResult> {
    try {
      const result = await api.patch<{ issue: Issue }>(`/api/issues/${issueId}/status`, { status, notes });
      await this.refresh(true);
      return { success: true, issue: result.issue };
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }
  }

  public async mergeIssues(targetIssueId: string, sourceIssueId: string, notes: string): Promise<ActionResult> {
    try {
      const result = await api.post<{ issue: Issue }>(`/api/issues/${targetIssueId}/merge`, {
        sourceIssueId,
        notes
      });
      await this.refresh(true);
      return { success: true, issue: result.issue };
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }
  }

  public async separateReport(reportId: string, title: string, notes: string): Promise<ActionResult> {
    try {
      const result = await api.post<{ issue: Issue }>(`/api/reports/${reportId}/separate`, { title, notes });
      await this.refresh(true);
      return { success: true, issue: result.issue };
    } catch (err) {
      return { success: false, message: errorMessage(err) };
    }
  }
}

export const db = new DatabaseService();
