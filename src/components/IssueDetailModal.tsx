import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  History, 
  Users, 
  ShieldCheck, 
  Zap, 
  Droplets, 
  Tv, 
  Sparkles, 
  Building2, 
  ShieldAlert, 
  HelpCircle,
  PlusCircle,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Issue, IssueCategory, IssueStatus, Report } from '../types';
import { db } from '../services/db';

interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onAddAnotherReport: (issue: Issue) => void;
  onRefresh: () => void;
}

const CATEGORY_ICONS: Record<IssueCategory, React.ElementType> = {
  'Electrical': Zap,
  'Plumbing': Droplets,
  'Classroom Equipment': Tv,
  'Cleanliness': Sparkles,
  'Infrastructure': Building2,
  'Safety': ShieldAlert,
  'Other': HelpCircle
};

const STATUS_CONFIG: Record<IssueStatus, { label: string; bg: string; text: string; dot: string; description: string }> = {
  'Pending': { 
    label: 'Pending', 
    bg: 'bg-amber-50 border-amber-200', 
    text: 'text-amber-800', 
    dot: 'bg-amber-500',
    description: 'Awaiting initial maintenance assessment and verification.' 
  },
  'Under Review': { 
    label: 'Under Review', 
    bg: 'bg-blue-50 border-blue-200', 
    text: 'text-blue-800', 
    dot: 'bg-blue-500',
    description: 'Assigned to campus facility team for inspection.' 
  },
  'In Progress': { 
    label: 'In Progress', 
    bg: 'bg-teal-50 border-teal-200', 
    text: 'text-teal-800', 
    dot: 'bg-teal-500',
    description: 'Work order dispatched; active maintenance or parts replacement underway.' 
  },
  'Resolved': { 
    label: 'Resolved', 
    bg: 'bg-emerald-50 border-emerald-200', 
    text: 'text-emerald-800', 
    dot: 'bg-emerald-500',
    description: 'Work completed, tested, and marked resolved by administration.' 
  }
};

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  onClose,
  onAddAnotherReport,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'reports'>('timeline');

  if (!issue) return null;

  const CategoryIcon = CATEGORY_ICONS[issue.category] || HelpCircle;
  const statusInfo = STATUS_CONFIG[issue.status] || STATUS_CONFIG.Pending;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-navy-900 px-6 py-5 text-white flex items-start justify-between border-b border-navy-700">
          <div className="space-y-1.5 min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <CategoryIcon className="w-3.5 h-3.5" />
                {issue.category}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
              {issue.title}
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              <span>{issue.locationDisplay}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-navy-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Issue Overview & Report count highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Issue Description
              </h5>
              <p className="text-sm text-slate-700 leading-relaxed">
                {issue.description}
              </p>
            </div>

            <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block">
                  Report Volume
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-teal-900">
                    {issue.reportCount}
                  </span>
                  <span className="text-xs font-semibold text-teal-700">
                    {issue.reportCount === 1 ? 'student report' : 'student reports'}
                  </span>
                </div>
              </div>

              {issue.status !== 'Resolved' && (
                db.hasUserReportedIssue(issue.id) ? (
                  <div className="mt-3 w-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-1.5 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>You verified this (1 vote per student)</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const res = db.upvoteIssue(issue.id);
                      if (res.success) {
                        onRefresh();
                      } else {
                        alert(res.message);
                      }
                    }}
                    className="mt-3 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+1 I have this too</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Status info explanation */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shrink-0 ${statusInfo.dot}`} />
            <div>
              <span className="font-bold text-navy-900">Status note: </span>
              <span className="text-slate-600">{statusInfo.description}</span>
            </div>
          </div>

          {/* Tabs: Timeline vs Grouped Reports */}
          <div>
            <div className="flex border-b border-slate-200 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
                  activeTab === 'timeline'
                    ? 'text-teal-700 border-b-2 border-teal-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                Status Timeline ({issue.history?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
                  activeTab === 'reports'
                    ? 'text-teal-700 border-b-2 border-teal-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Associated Reports ({issue.reports?.length || issue.reportCount})
              </button>
            </div>

            {/* Timeline View */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {issue.history && issue.history.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {issue.history.map((hist, idx) => (
                      <div key={hist.id || idx} className="relative group">
                        {/* Dot on line */}
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-teal-500 shadow-sm" />
                        
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-navy-900">
                              Status: {hist.toStatus}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatDate(hist.createdAt)}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {hist.notes}
                          </p>

                          <div className="mt-1.5 text-[10px] text-slate-400 font-medium">
                            Updated by: <span className="text-slate-600">{hist.changedBy}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    No status history recorded yet.
                  </p>
                )}
              </div>
            )}

            {/* Associated Reports View */}
            {activeTab === 'reports' && (
              <div className="space-y-3">
                {issue.reports && issue.reports.length > 0 ? (
                  issue.reports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded">
                            {report.referenceNo}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDate(report.createdAt)}
                          </span>
                        </div>
                        {report.isAnonymous ? (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-slate-500" />
                            Anonymous Student
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            Verified Student
                          </span>
                        )}
                      </div>

                      <h6 className="text-xs font-bold text-slate-800 mt-1">
                        "{report.title}"
                      </h6>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {report.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    {issue.reportCount} reports aggregated for this problem.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
