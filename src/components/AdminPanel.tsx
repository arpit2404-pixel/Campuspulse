import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Edit3, 
  GitMerge, 
  Scissors, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  FileText, 
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  Building2,
  MapPin,
  X
} from 'lucide-react';
import { Issue, IssueStatus, Report, AdminUser } from '../types';
import { db } from '../services/db';
import { CATEGORIES } from '../data/demoData';

interface AdminPanelProps {
  issues: Issue[];
  adminUser: AdminUser;
  onRefresh: () => void;
  onSelectIssue: (issue: Issue) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  issues,
  adminUser,
  onRefresh,
  onSelectIssue
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  // Status Change Modal State
  const [statusModalIssue, setStatusModalIssue] = useState<Issue | null>(null);
  const [newStatus, setNewStatus] = useState<IssueStatus>('In Progress');
  const [adminNote, setAdminNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Merge Issues Modal State
  const [mergeSourceIssue, setMergeSourceIssue] = useState<Issue | null>(null);
  const [mergeTargetIssueId, setMergeTargetIssueId] = useState<string>('');
  const [mergeNotes, setMergeNotes] = useState('');

  // Separate Report Modal State
  const [separateReportItem, setSeparateReportItem] = useState<{ report: Report; parentIssue: Issue } | null>(null);
  const [separateNewTitle, setSeparateNewTitle] = useState('');
  const [separateNotes, setSeparateNotes] = useState('');

  // Notification message
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      issue.title.toLowerCase().includes(query) ||
      issue.locationDisplay.toLowerCase().includes(query);

    const matchesStatus = selectedStatus === 'All' || issue.status === selectedStatus;
    const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  }).sort((a, b) => b.reportCount - a.reportCount);

  // Open status modal
  const handleOpenStatusModal = (issue: Issue) => {
    setStatusModalIssue(issue);
    setNewStatus(issue.status);
    setAdminNote('');
  };

  // Submit status update
  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalIssue) return;
    setIsUpdatingStatus(true);

    const success = db.updateIssueStatus(
      statusModalIssue.id,
      newStatus,
      adminNote || `Status changed from ${statusModalIssue.status} to ${newStatus}.`,
      adminUser.name
    );

    if (success) {
      showNotice(`Successfully updated "${statusModalIssue.title}" to ${newStatus}!`);
      setStatusModalIssue(null);
      onRefresh();
    }
    setIsUpdatingStatus(false);
  };

  // Open merge modal
  const handleOpenMergeModal = (issue: Issue) => {
    setMergeSourceIssue(issue);
    // Default to the first different issue
    const otherIssues = issues.filter(i => i.id !== issue.id);
    setMergeTargetIssueId(otherIssues.length > 0 ? otherIssues[0].id : '');
    setMergeNotes('');
  };

  // Execute merge
  const handleExecuteMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceIssue || !mergeTargetIssueId) return;

    const success = db.mergeIssues(
      mergeTargetIssueId,
      mergeSourceIssue.id,
      mergeNotes || 'Merged duplicates by administrative review.',
      adminUser.name
    );

    if (success) {
      showNotice(`Merged issue reports into target ticket successfully.`);
      setMergeSourceIssue(null);
      onRefresh();
    }
  };

  // Open separate modal
  const handleOpenSeparateModal = (report: Report, parentIssue: Issue) => {
    setSeparateReportItem({ report, parentIssue });
    setSeparateNewTitle(report.title);
    setSeparateNotes('');
  };

  // Execute separate
  const handleExecuteSeparate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!separateReportItem) return;

    const newIssue = db.separateReport(
      separateReportItem.report.id,
      separateNewTitle || separateReportItem.report.title,
      separateNotes || 'Separated misgrouped report into individual ticket.',
      adminUser.name
    );

    if (newIssue) {
      showNotice(`Separated report into new ticket: "${newIssue.title}"`);
      setSeparateReportItem(null);
      onRefresh();
    }
  };

  // Demo dataset reset/seed
  const handleResetDemoData = () => {
    if (window.confirm('Reset demo dataset? Real student-submitted reports will be safely preserved.')) {
      db.resetDemoData();
      showNotice('Demo dataset cleared. Real student reports preserved.');
      onRefresh();
    }
  };

  const handleSeedDemoData = () => {
    db.seedDemoData();
    showNotice('Loaded 15+ realistic campus demo reports.');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-navy-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-navy-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Administrative Control Deck
              </span>
              <span className="text-xs text-slate-400">
                Logged in as <strong className="text-white">{adminUser.name}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Campus Facilities & Issue Management
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Inspect grouped incident reports, update resolution states, audit similarity clusters, and execute issue merges.
            </p>
          </div>

          {/* Quick Demo Data Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
            <button
              onClick={handleSeedDemoData}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-navy-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              title="Ensure all 15+ demo campus reports are populated"
            >
              <Plus className="w-3.5 h-3.5" />
              Seed 15+ Demo Data
            </button>

            <button
              onClick={handleResetDemoData}
              className="px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              title="Safely remove demo data without losing real user reports"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by issue title or room location..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-amber-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-medium focus:ring-amber-500"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Management Table / Accordion */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-navy-950 text-sm">
            All Tracked Issues ({filteredIssues.length})
          </h3>
          <span className="text-xs text-slate-500">
            Sorted by aggregated report urgency
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredIssues.map((issue) => {
            const isExpanded = expandedIssueId === issue.id;
            const reports = issue.reports || [];

            return (
              <div key={issue.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Issue Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {issue.category}
                      </span>

                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                        issue.status === 'Resolved' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : issue.status === 'In Progress'
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : issue.status === 'Under Review'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {issue.status}
                      </span>

                      <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        {issue.reportCount} {issue.reportCount === 1 ? 'report' : 'reports aggregated'}
                      </span>

                      {issue.isDemo && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                          Demo Data
                        </span>
                      )}
                    </div>

                    <h4 
                      onClick={() => onSelectIssue(issue)}
                      className="text-base font-bold text-navy-950 hover:text-teal-600 transition-colors cursor-pointer"
                    >
                      {issue.title}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{issue.locationDisplay}</span>
                      <span>•</span>
                      <span>Last updated: {new Date(issue.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenStatusModal(issue)}
                      className="px-3 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Update Status
                    </button>

                    <button
                      onClick={() => handleOpenMergeModal(issue)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
                      title="Merge this issue into another duplicate"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Merge
                    </button>

                    <button
                      onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>Reports ({reports.length})</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Reports View to inspect and separate misgrouped items */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3 bg-slate-50 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Aggregated Student Reports in this Ticket
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Review clustering accuracy • Separate any misgrouped problem
                      </span>
                    </div>

                    {reports.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No detailed report records attached.</p>
                    ) : (
                      <div className="space-y-2">
                        {reports.map((rep) => (
                          <div 
                            key={rep.id} 
                            className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono font-bold text-teal-700">{rep.referenceNo}</span>
                                <span className="text-slate-400">•</span>
                                <span className="font-semibold text-slate-800">{rep.title}</span>
                              </div>
                              <p className="text-slate-600 line-clamp-1">{rep.description}</p>
                            </div>

                            <button
                              onClick={() => handleOpenSeparateModal(rep, issue)}
                              className="self-start sm:self-auto px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                            >
                              <Scissors className="w-3 h-3 text-amber-600" />
                              Separate Issue
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODAL 1: STATUS CHANGE & ADMIN NOTE --- */}
      {statusModalIssue && (
        <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-navy-900 px-6 py-4 text-white flex items-center justify-between border-b border-navy-700">
              <h4 className="font-bold text-base">Update Status & Post Admin Note</h4>
              <button onClick={() => setStatusModalIssue(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 uppercase font-semibold">Issue:</span>
                <p className="text-sm font-bold text-navy-900 mt-0.5">{statusModalIssue.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{statusModalIssue.locationDisplay}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resolution Status <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Pending', 'Under Review', 'In Progress', 'Resolved'] as IssueStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setNewStatus(status)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        newStatus === status
                          ? 'bg-teal-500/10 border-teal-500 text-teal-800 ring-2 ring-teal-500'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Administrative Note <span className="text-slate-400 font-normal">(Visible on public timeline)</span>
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Electrician dispatched with new capacitor. Part replacement scheduled for 3 PM."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalIssue(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-1/2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Save & Publish Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: MERGE ISSUES --- */}
      {mergeSourceIssue && (
        <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-navy-900 px-6 py-4 text-white flex items-center justify-between border-b border-navy-700">
              <h4 className="font-bold text-base flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-amber-400" />
                Merge Duplicate Issue Tickets
              </h4>
              <button onClick={() => setMergeSourceIssue(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteMerge} className="p-6 space-y-4">
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900">
                <span className="font-bold">Merging Source:</span> "{mergeSourceIssue.title}" ({mergeSourceIssue.reportCount} reports). All reports will be transferred into the selected target issue.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Destination Issue
                </label>
                <select
                  value={mergeTargetIssueId}
                  onChange={(e) => setMergeTargetIssueId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                >
                  {issues
                    .filter(i => i.id !== mergeSourceIssue.id)
                    .map(i => (
                      <option key={i.id} value={i.id}>
                        {i.title} ({i.locationDisplay}) - [{i.reportCount} reports]
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Merge Reason / Notes
                </label>
                <input
                  type="text"
                  value={mergeNotes}
                  onChange={(e) => setMergeNotes(e.target.value)}
                  placeholder="e.g. Confirmed duplicate reports for the same classroom ceiling fan."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMergeSourceIssue(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-navy-950 text-xs font-bold transition-colors shadow-sm"
                >
                  Confirm & Merge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SEPARATE REPORT --- */}
      {separateReportItem && (
        <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-navy-900 px-6 py-4 text-white flex items-center justify-between border-b border-navy-700">
              <h4 className="font-bold text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-teal-400" />
                Separate Misgrouped Report
              </h4>
              <button onClick={() => setSeparateReportItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSeparate} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                If an incoming report was clustered into this issue incorrectly, you can split it out into its own standalone issue ticket.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Issue Title
                </label>
                <input
                  type="text"
                  value={separateNewTitle}
                  onChange={(e) => setSeparateNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Separation Reason / Note
                </label>
                <input
                  type="text"
                  value={separateNotes}
                  onChange={(e) => setSeparateNotes(e.target.value)}
                  placeholder="e.g. This is a separate wall switch issue, not the ceiling fan."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSeparateReportItem(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Create Standalone Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
