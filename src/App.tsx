import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Search, 
  Layers, 
  CheckCircle2, 
  Radio, 
  TrendingUp, 
  Building2, 
  Zap,
  HelpCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Issue, Report, CampusStats, AdminUser } from './types';
import { db } from './services/db';
import { auth } from './services/auth';

import { Navbar } from './components/Navbar';
import { DemoBanner } from './components/DemoBanner';
import { StatsCards } from './components/StatsCard';
import { TopIssues } from './components/TopIssues';
import { RecentReports } from './components/RecentReports';
import { CategoryChart } from './components/CategoryChart';
import { ReportModal } from './components/ReportModal';
import { IssueDetailModal } from './components/IssueDetailModal';
import { IssueExplorer } from './components/IssueExplorer';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'issues' | 'admin'>('dashboard');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<CampusStats>({
    totalReports: 0,
    totalIssues: 0,
    awaitingResolution: 0,
    resolvedIssues: 0,
    categoryCounts: {
      'Electrical': 0,
      'Plumbing': 0,
      'Classroom Equipment': 0,
      'Cleanliness': 0,
      'Infrastructure': 0,
      'Safety': 0,
      'Other': 0
    }
  });

  // Active user / auth state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(auth.getCurrentUser());

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Quick prefill when clicking "+1 I have this too"
  const [prefilledBuilding, setPrefilledBuilding] = useState('');
  const [prefilledRoom, setPrefilledRoom] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronize state with DB
  const refreshData = () => {
    const loadedIssues = db.getIssues();
    const loadedReports = db.getReports();
    const loadedStats = db.getStats();

    setIssues(loadedIssues);
    setReports(loadedReports);
    setStats(loadedStats);

    // If currently inspecting an issue, update its reference
    if (selectedIssue) {
      const refreshed = db.getIssueById(selectedIssue.id);
      setSelectedIssue(refreshed);
    }
  };

  useEffect(() => {
    refreshData();

    // Subscribe to DB changes (real-time cross-tab & local updates)
    const unsubscribeDb = db.subscribe(() => {
      refreshData();
    });

    // Subscribe to Auth changes
    const unsubscribeAuth = auth.subscribe((user) => {
      setAdminUser(user);
    });

    return () => {
      unsubscribeDb();
      unsubscribeAuth();
    };
  }, []);

  const handleOpenReportModal = () => {
    setPrefilledBuilding('');
    setPrefilledRoom('');
    setIsReportModalOpen(true);
  };

  const handleAddAnotherReportToIssue = (targetIssue: Issue) => {
    setSelectedIssue(null);
    setPrefilledBuilding(targetIssue.building);
    setPrefilledRoom(targetIssue.room);
    setIsReportModalOpen(true);
  };

  const handleReportSubmitted = (result: { report: Report; issue: Issue; isGrouped: boolean; matchReason: string }) => {
    refreshData();
    if (result.isGrouped) {
      showToast(`Grouped into issue "${result.issue.title}" (Total reports: ${result.issue.reportCount})`);
    } else {
      showToast(`New issue created: "${result.issue.title}"`);
    }
  };

  const handleLogoutAdmin = () => {
    auth.logout();
    setAdminUser(null);
    if (activeTab === 'admin') {
      setActiveTab('dashboard');
    }
    showToast('Admin logged out successfully.');
  };

  const demoCount = reports.filter(r => r.isDemo).length;
  const realCount = reports.filter(r => !r.isDemo).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      
      {/* Demo Banner */}
      <DemoBanner
        demoCount={demoCount}
        realCount={realCount}
        onRefresh={refreshData}
      />

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenReportModal={handleOpenReportModal}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        adminUser={adminUser}
        onLogoutAdmin={handleLogoutAdmin}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-teal-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* --- VIEW 1: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            
            {/* A. Welcome Hero Section */}
            <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl border border-navy-800 relative overflow-hidden">
              {/* Background ambient glow circles */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold tracking-wide">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>College Facilities & Infrastructure System</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Your campus. <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-200">Your voice.</span>
                </h1>

                <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                  Notice a broken ceiling fan, water leaking in the library, or a damaged projector? 
                  Report it anonymously in 30 seconds. CampusPulse groups identical reports automatically, 
                  escalates recurring issues, and gives students direct visibility into campus repairs.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <button
                    onClick={handleOpenReportModal}
                    className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-navy-950 font-extrabold px-6 py-3.5 rounded-2xl text-sm shadow-lg hover:shadow-teal-500/25 transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <PlusCircle className="w-5 h-5 stroke-[2.5]" />
                    <span>Report an Issue Now</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('issues')}
                    className="bg-navy-800/80 hover:bg-navy-800 text-slate-200 hover:text-white font-bold px-5 py-3.5 rounded-2xl text-sm border border-navy-700 transition-all flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>Track Existing Issues</span>
                  </button>
                </div>
              </div>

              {/* 3-Step "How Platform Works" cards */}
              <div className="mt-10 pt-8 border-t border-navy-800/90 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-navy-900/60 p-4 rounded-2xl border border-navy-800/80">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-extrabold mb-2.5">
                    1
                  </div>
                  <h4 className="font-bold text-white text-sm">Report Anonymously</h4>
                  <p className="text-slate-400 mt-1">
                    No sign-up barrier. Describe the problem, pick the classroom or building, and submit with zero fear.
                  </p>
                </div>

                <div className="bg-navy-900/60 p-4 rounded-2xl border border-navy-800/80">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-extrabold mb-2.5">
                    2
                  </div>
                  <h4 className="font-bold text-white text-sm">Smart Grouping Engine</h4>
                  <p className="text-slate-400 mt-1">
                    Multiple students reporting the same room fan or water leak get clustered into one prioritized ticket.
                  </p>
                </div>

                <div className="bg-navy-900/60 p-4 rounded-2xl border border-navy-800/80">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-extrabold mb-2.5">
                    3
                  </div>
                  <h4 className="font-bold text-white text-sm">Transparent Resolution</h4>
                  <p className="text-slate-400 mt-1">
                    Campus administrators post live notes and update statuses (Pending $\rightarrow$ Review $\rightarrow$ In Progress $\rightarrow$ Resolved).
                  </p>
                </div>
              </div>
            </section>

            {/* B. Statistics Cards */}
            <StatsCards stats={stats} />

            {/* C. Top 5 Most Reported Issues & Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top 5 Recurring Issues (Takes 2 cols on lg) */}
              <div className="lg:col-span-2">
                <TopIssues
                  issues={issues}
                  onSelectIssue={(issue) => setSelectedIssue(issue)}
                  onOpenReportModal={handleOpenReportModal}
                />
              </div>

              {/* Category Breakdown (Takes 1 col on lg) */}
              <div className="lg:col-span-1">
                <CategoryChart
                  categoryCounts={stats.categoryCounts}
                  totalReports={stats.totalReports}
                  onFilterByCategory={(category) => {
                    setActiveTab('issues');
                  }}
                />
              </div>
            </div>

            {/* D. Recent Activity Stream */}
            <RecentReports
              reports={reports}
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
            />
          </div>
        )}

        {/* --- VIEW 2: ISSUE EXPLORER & TRACKING --- */}
        {activeTab === 'issues' && (
          <IssueExplorer
            issues={issues}
            onSelectIssue={(issue) => setSelectedIssue(issue)}
            onOpenReportModal={handleOpenReportModal}
          />
        )}

        {/* --- VIEW 3: ADMIN PORTAL --- */}
        {activeTab === 'admin' && (
          adminUser ? (
            <AdminPanel
              issues={issues}
              adminUser={adminUser}
              onRefresh={refreshData}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
            />
          ) : (
            <div className="bg-white rounded-3xl p-10 text-center max-w-md mx-auto border border-slate-200 shadow-card">
              <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-navy-950 mb-1">Admin Portal Locked</h3>
              <p className="text-xs text-slate-500 mb-6">
                Please authenticate with authorized campus facility credentials to access administrative status updates, issue merges, and clustering audits.
              </p>
              <button
                onClick={() => setIsAdminLoginOpen(true)}
                className="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-sm"
              >
                Open Admin Login
              </button>
            </div>
          )
        )}
      </main>

      {/* --- MODALS --- */}

      {/* 1. Report Issue Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={handleReportSubmitted}
        prefilledBuilding={prefilledBuilding}
        prefilledRoom={prefilledRoom}
      />

      {/* 2. Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onAddAnotherReport={handleAddAnotherReportToIssue}
        onRefresh={refreshData}
      />

      {/* 3. Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={(user) => {
          setAdminUser(user);
          setActiveTab('admin');
          showToast(`Welcome back, ${user.name}`);
        }}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
};
