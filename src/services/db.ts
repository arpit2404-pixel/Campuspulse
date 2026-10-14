import { Issue, Report, StatusHistory, CampusStats, IssueCategory, IssueStatus } from '../types';
import { INITIAL_DEMO_ISSUES, INITIAL_DEMO_REPORTS, INITIAL_DEMO_HISTORY } from '../data/demoData';
import { findMatchingIssue } from './groupingEngine';

const STORAGE_KEYS = {
  ISSUES: 'campuspulse_issues_v3',
  REPORTS: 'campuspulse_reports_v3',
  HISTORY: 'campuspulse_history_v3',
  CLIENT_ID: 'campuspulse_client_id_v3',
  DEVICE_SUBMISSIONS: 'campuspulse_device_submissions_v3'
};

export interface SubmitReportResult {
  success: boolean;
  error?: 'ALREADY_REPORTED' | 'RATE_LIMIT' | 'VALIDATION_ERROR';
  message?: string;
  report?: Report;
  issue?: Issue;
  isGrouped?: boolean;
  matchConfidence?: number;
  matchReason?: string;
}

class DatabaseService {
  private issues: Issue[] = [];
  private reports: Report[] = [];
  private history: StatusHistory[] = [];
  private listeners: (() => void)[] = [];
  private clientId: string = '';

  constructor() {
    this.initClientId();
    this.init();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
          this.loadFromStorage();
          this.notify();
        }
      });
    }
  }

  private initClientId() {
    if (typeof window === 'undefined') {
      this.clientId = 'node_client_runner';
      return;
    }
    let id = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
    if (!id) {
      id = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
    }
    this.clientId = id;
  }

  public getClientId(): string {
    return this.clientId;
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Purge any legacy demo keys from v1 and v2 to remove pre-existing unregistered issues!
    try {
      localStorage.removeItem('campuspulse_issues_v1');
      localStorage.removeItem('campuspulse_reports_v1');
      localStorage.removeItem('campuspulse_history_v1');
      localStorage.removeItem('campuspulse_initialized_v1');

      localStorage.removeItem('campuspulse_issues_v2');
      localStorage.removeItem('campuspulse_reports_v2');
      localStorage.removeItem('campuspulse_history_v2');
      localStorage.removeItem('campuspulse_initialized_v2');
    } catch {
      // Ignore
    }

    const rawIssues = localStorage.getItem(STORAGE_KEYS.ISSUES);
    if (rawIssues) {
      this.loadFromStorage();
    } else {
      // START COMPLETELY CLEAN: Zero fake issues!
      this.issues = [];
      this.reports = [];
      this.history = [];
      this.saveToStorage();
    }
  }

  private loadFromStorage() {
    try {
      const rawIssues = localStorage.getItem(STORAGE_KEYS.ISSUES);
      const rawReports = localStorage.getItem(STORAGE_KEYS.REPORTS);
      const rawHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);

      this.issues = rawIssues ? JSON.parse(rawIssues) : [];
      this.reports = rawReports ? JSON.parse(rawReports) : [];
      this.history = rawHistory ? JSON.parse(rawHistory) : [];
    } catch (e) {
      console.error('Failed to load CampusPulse data from storage:', e);
      this.issues = [];
      this.reports = [];
      this.history = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(this.issues));
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports));
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history));
      this.notify();
    } catch (e) {
      console.error('Failed to persist CampusPulse data:', e);
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // --- Anti-Spam Tracking Methods ---

  private getDeviceSubmissions(): { timestamp: number; issueId: string; clientId: string }[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DEVICE_SUBMISSIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private recordDeviceSubmission(issueId: string, clientId: string) {
    if (typeof window === 'undefined') return;
    try {
      const submissions = this.getDeviceSubmissions();
      submissions.push({ timestamp: Date.now(), issueId, clientId });
      // Keep only last 24 hours of logs
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = submissions.filter(s => s.timestamp > cutoff);
      localStorage.setItem(STORAGE_KEYS.DEVICE_SUBMISSIONS, JSON.stringify(recent));
    } catch {
      // Ignore
    }
  }

  public hasUserReportedIssue(issueId: string, checkClientId?: string): boolean {
    const issue = this.issues.find(i => i.id === issueId);
    if (!issue) return false;

    const clientId = checkClientId || this.clientId;

    // Check if client is in the uniqueReporterIds list
    if (issue.uniqueReporterIds && issue.uniqueReporterIds.includes(clientId)) {
      return true;
    }

    // Also check device submission log for this specific client
    const submissions = this.getDeviceSubmissions();
    return submissions.some(s => s.issueId === issueId && s.clientId === clientId);
  }

  // --- Read Methods ---

  public getIssues(): Issue[] {
    return [...this.issues].map(issue => {
      const issueReports = this.reports.filter(r => r.issueId === issue.id);
      const issueHistory = this.history
        .filter(h => h.issueId === issue.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Calculate true unique count of student reporters to prevent spam
      const uniqueReporters = new Set(
        issue.uniqueReporterIds && issue.uniqueReporterIds.length > 0
          ? issue.uniqueReporterIds
          : issueReports.map(r => r.reporterId || r.id)
      );
      const reportCount = Math.max(1, uniqueReporters.size);

      return {
        ...issue,
        reportCount,
        reports: issueReports,
        history: issueHistory
      };
    });
  }

  public getIssueById(id: string): Issue | null {
    const issue = this.issues.find(i => i.id === id);
    if (!issue) return null;

    const issueReports = this.reports.filter(r => r.issueId === id);
    const issueHistory = this.history
      .filter(h => h.issueId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const uniqueReporters = new Set(
      issue.uniqueReporterIds && issue.uniqueReporterIds.length > 0
        ? issue.uniqueReporterIds
        : issueReports.map(r => r.reporterId || r.id)
    );
    const reportCount = Math.max(1, uniqueReporters.size);

    return {
      ...issue,
      reportCount,
      reports: issueReports,
      history: issueHistory
    };
  }

  public getReports(): Report[] {
    return [...this.reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getTopIssues(limit = 5): Issue[] {
    const all = this.getIssues();
    // Sort descending by reportCount, then newest
    return all.sort((a, b) => {
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }).slice(0, limit);
  }

  public getStats(): CampusStats {
    const issues = this.getIssues();
    const reports = this.reports;

    const categoryCounts: Record<IssueCategory, number> = {
      'Electrical': 0,
      'Plumbing': 0,
      'Classroom Equipment': 0,
      'Cleanliness': 0,
      'Infrastructure': 0,
      'Safety': 0,
      'Other': 0
    };

    reports.forEach(r => {
      if (categoryCounts[r.category] !== undefined) {
        categoryCounts[r.category]++;
      }
    });

    const awaitingResolution = issues.filter(i => i.status !== 'Resolved').length;
    const resolvedIssues = issues.filter(i => i.status === 'Resolved').length;

    return {
      totalReports: reports.length,
      totalIssues: issues.length,
      awaitingResolution,
      resolvedIssues,
      categoryCounts
    };
  }

  // --- Write / Mutation Methods with Anti-Spam Protection ---

  public submitReport(input: {
    title: string;
    description: string;
    category: IssueCategory;
    building: string;
    room: string;
    imageUrl?: string;
    isAnonymous?: boolean;
    reporterContact?: string;
    overrideClientId?: string; // for testing
  }): SubmitReportResult {
    const clientId = input.overrideClientId || this.clientId;
    const now = new Date().toISOString();
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    const referenceNo = `CP-${new Date().getFullYear()}-${randomHex}`;
    const reportId = `rep-${Date.now()}-${randomHex}`;

    // 1. ANTI-SPAM CHECK 1: Rate Limiting
    // Prevent more than 3 submissions in 3 minutes from the same client
    const recentSubmissions = this.getDeviceSubmissions();
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    const rapidCount = recentSubmissions.filter(s => s.timestamp > threeMinutesAgo).length;

    if (rapidCount >= 3) {
      return {
        success: false,
        error: 'RATE_LIMIT',
        message: 'Spam prevention: You have submitted multiple reports recently. Please wait a few moments before filing another report.'
      };
    }

    const locationDisplay = `${input.building}${input.room ? `, ${input.room}` : ''}`;

    // 2. Run Intelligent Grouping Engine
    const { matchedIssue, confidence, reason } = findMatchingIssue(input, this.issues);

    let targetIssue: Issue;
    let isGrouped = false;

    if (matchedIssue) {
      // 3. ANTI-SPAM CHECK 2: Duplicate Issue Reporting from Same Student
      // If student has already reported this exact issue, prevent spamming the count!
      const alreadyReported = (matchedIssue.uniqueReporterIds && matchedIssue.uniqueReporterIds.includes(clientId)) ||
                              this.hasUserReportedIssue(matchedIssue.id, clientId);

      if (alreadyReported) {
        return {
          success: false,
          error: 'ALREADY_REPORTED',
          message: `Spam prevention: You have already reported this problem (${matchedIssue.title}). Each student may only contribute once to an issue's priority ranking.`
        };
      }

      // Legitimate separate student reporting the same problem: Group and increment count
      isGrouped = true;
      targetIssue = matchedIssue;
      if (!targetIssue.uniqueReporterIds) {
        targetIssue.uniqueReporterIds = [];
      }
      targetIssue.uniqueReporterIds.push(clientId);
      targetIssue.reportCount = targetIssue.uniqueReporterIds.length;
      targetIssue.updatedAt = now;

      // Add a note in history that another student report was aggregated
      const newHistoryEntry: StatusHistory = {
        id: `hist-${Date.now()}-${randomHex}`,
        issueId: targetIssue.id,
        toStatus: targetIssue.status,
        notes: `Aggregated verified report (${referenceNo}) from another student. Issue priority escalated to ${targetIssue.reportCount} reports.`,
        changedBy: 'CampusPulse Fair-Ranking Engine',
        createdAt: now
      };
      this.history.unshift(newHistoryEntry);
    } else {
      // Create new unique issue with this student as unique reporter #1
      const issueId = `issue-${Date.now()}-${randomHex}`;
      targetIssue = {
        id: issueId,
        title: input.title,
        description: input.description,
        category: input.category,
        building: input.building,
        room: input.room,
        locationDisplay,
        reportCount: 1,
        uniqueReporterIds: [clientId],
        status: 'Pending',
        createdAt: now,
        updatedAt: now,
        isDemo: false
      };
      this.issues.unshift(targetIssue);

      // Create initial history log
      const initialHistory: StatusHistory = {
        id: `hist-${Date.now()}-${randomHex}`,
        issueId,
        toStatus: 'Pending',
        notes: `Issue registered with reference ${referenceNo}. Pending administrative review.`,
        changedBy: 'System',
        createdAt: now
      };
      this.history.unshift(initialHistory);
    }

    // 4. Create the Report record
    const newReport: Report = {
      id: reportId,
      referenceNo,
      issueId: targetIssue.id,
      reporterId: clientId,
      title: input.title,
      description: input.description,
      category: input.category,
      building: input.building,
      room: input.room,
      locationDisplay,
      imageUrl: input.imageUrl,
      isAnonymous: input.isAnonymous ?? true,
      reporterContact: input.isAnonymous ? undefined : input.reporterContact,
      createdAt: now,
      isDemo: false
    };

    this.reports.unshift(newReport);
    this.recordDeviceSubmission(targetIssue.id, clientId);
    this.saveToStorage();

    return {
      success: true,
      report: newReport,
      issue: targetIssue,
      isGrouped,
      matchConfidence: confidence,
      matchReason: reason
    };
  }

  public upvoteIssue(issueId: string, overrideClientId?: string): { success: boolean; message: string } {
    const clientId = overrideClientId || this.clientId;
    const issue = this.issues.find(i => i.id === issueId);
    if (!issue) return { success: false, message: 'Issue not found.' };

    if (!issue.uniqueReporterIds) {
      issue.uniqueReporterIds = [];
    }

    // Anti-spam check: Can only support once per student!
    if (issue.uniqueReporterIds.includes(clientId) || this.hasUserReportedIssue(issueId, clientId)) {
      return {
        success: false,
        message: 'You have already added your support to this issue. Multiple votes from the same student are blocked to keep rankings fair.'
      };
    }

    issue.uniqueReporterIds.push(clientId);
    issue.reportCount = issue.uniqueReporterIds.length;
    issue.updatedAt = new Date().toISOString();

    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    const referenceNo = `CP-${new Date().getFullYear()}-${randomHex}`;

    // Add +1 report
    this.reports.unshift({
      id: `rep-${Date.now()}-${randomHex}`,
      referenceNo,
      issueId: issue.id,
      reporterId: clientId,
      title: `+1 Student verified: ${issue.title}`,
      description: 'Another campus student confirmed experiencing this facility problem.',
      category: issue.category,
      building: issue.building,
      room: issue.room,
      locationDisplay: issue.locationDisplay,
      isAnonymous: true,
      createdAt: new Date().toISOString(),
      isDemo: false
    });

    this.history.unshift({
      id: `hist-${Date.now()}-${randomHex}`,
      issueId: issue.id,
      toStatus: issue.status,
      notes: `Verified student support added (${referenceNo}). Priority count increased to ${issue.reportCount}.`,
      changedBy: 'Student Verification',
      createdAt: new Date().toISOString()
    });

    this.recordDeviceSubmission(issue.id);
    this.saveToStorage();

    return { success: true, message: `Added your voice! Issue priority is now ${issue.reportCount}.` };
  }

  public updateIssueStatus(
    issueId: string,
    newStatus: IssueStatus,
    notes: string,
    changedBy = 'Campus Facilities Officer'
  ): boolean {
    const issueIndex = this.issues.findIndex(i => i.id === issueId);
    if (issueIndex === -1) return false;

    const oldStatus = this.issues[issueIndex].status;
    const now = new Date().toISOString();

    this.issues[issueIndex].status = newStatus;
    this.issues[issueIndex].updatedAt = now;

    // Create history entry
    const historyEntry: StatusHistory = {
      id: `hist-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      issueId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      notes: notes || `Status updated from ${oldStatus} to ${newStatus}.`,
      changedBy,
      createdAt: now
    };

    this.history.unshift(historyEntry);
    this.saveToStorage();
    return true;
  }

  public mergeIssues(
    targetIssueId: string,
    sourceIssueId: string,
    adminNotes: string,
    adminName = 'Super Admin'
  ): boolean {
    if (targetIssueId === sourceIssueId) return false;

    const targetIssue = this.issues.find(i => i.id === targetIssueId);
    const sourceIssue = this.issues.find(i => i.id === sourceIssueId);

    if (!targetIssue || !sourceIssue) return false;

    const now = new Date().toISOString();

    // Re-link all reports from source issue to target issue
    const movedReports = this.reports.filter(r => r.issueId === sourceIssueId);
    movedReports.forEach(r => {
      r.issueId = targetIssueId;
    });

    // Merge unique reporter IDs
    const mergedReporters = new Set([
      ...(targetIssue.uniqueReporterIds || []),
      ...(sourceIssue.uniqueReporterIds || []),
      ...movedReports.map(r => r.reporterId || r.id)
    ]);
    targetIssue.uniqueReporterIds = Array.from(mergedReporters);
    targetIssue.reportCount = Math.max(1, targetIssue.uniqueReporterIds.length);
    targetIssue.updatedAt = now;

    // Log in history
    const historyEntry: StatusHistory = {
      id: `hist-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      issueId: targetIssueId,
      toStatus: targetIssue.status,
      notes: `Merged issue "${sourceIssue.title}" into this ticket. Combined ${targetIssue.reportCount} unique student reports. Admin notes: ${adminNotes}`,
      changedBy: adminName,
      createdAt: now
    };
    this.history.unshift(historyEntry);

    // Remove source issue
    this.issues = this.issues.filter(i => i.id !== sourceIssueId);

    this.saveToStorage();
    return true;
  }

  public separateReport(
    reportId: string,
    newTitle: string,
    adminNotes: string,
    adminName = 'Super Admin'
  ): Issue | null {
    const reportIndex = this.reports.findIndex(r => r.id === reportId);
    if (reportIndex === -1) return null;

    const report = this.reports[reportIndex];
    const oldIssue = this.issues.find(i => i.id === report.issueId);
    const now = new Date().toISOString();
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();

    // Create a new separate issue
    const newIssueId = `issue-${Date.now()}-${randomHex}`;
    const newIssue: Issue = {
      id: newIssueId,
      title: newTitle || report.title,
      description: report.description,
      category: report.category,
      building: report.building,
      room: report.room,
      locationDisplay: report.locationDisplay,
      reportCount: 1,
      uniqueReporterIds: report.reporterId ? [report.reporterId] : [this.clientId],
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
      isDemo: report.isDemo
    };

    // Reassign report
    report.issueId = newIssueId;
    this.issues.unshift(newIssue);

    // Update old issue report count
    if (oldIssue) {
      if (oldIssue.uniqueReporterIds && report.reporterId) {
        oldIssue.uniqueReporterIds = oldIssue.uniqueReporterIds.filter(id => id !== report.reporterId);
      }
      oldIssue.reportCount = Math.max(1, (oldIssue.uniqueReporterIds || []).length);
      oldIssue.updatedAt = now;

      // History log on old issue
      this.history.unshift({
        id: `hist-${Date.now()}-sep-old`,
        issueId: oldIssue.id,
        toStatus: oldIssue.status,
        notes: `Report ${report.referenceNo} was separated out into a new standalone issue. Admin note: ${adminNotes}`,
        changedBy: adminName,
        createdAt: now
      });
    }

    // History log on new issue
    this.history.unshift({
      id: `hist-${Date.now()}-sep-new`,
      issueId: newIssueId,
      toStatus: 'Pending',
      notes: `Separated from previous issue. Reason: ${adminNotes}`,
      changedBy: adminName,
      createdAt: now
    });

    this.saveToStorage();
    return newIssue;
  }

  // --- Reset & Optional Seeding ---

  public clearAllIssues(): void {
    this.issues = [];
    this.reports = [];
    this.history = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.DEVICE_SUBMISSIONS);
    }
    this.saveToStorage();
  }

  public seedDemoData(): void {
    this.issues = [...INITIAL_DEMO_ISSUES];
    this.reports = [...INITIAL_DEMO_REPORTS];
    this.history = [...INITIAL_DEMO_HISTORY];
    this.saveToStorage();
  }

  public resetDemoData(): void {
    this.issues = this.issues.filter(i => !i.isDemo);
    this.reports = this.reports.filter(r => !r.isDemo);
    this.history = this.history.filter(h => !h.id.includes('demo'));
    this.saveToStorage();
  }
}

export const db = new DatabaseService();
