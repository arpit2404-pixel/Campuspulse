import React from 'react';
import { Clock, ExternalLink, ShieldCheck, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { Report, Issue } from '../types';

interface RecentReportsProps {
  reports: Report[];
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
}

export const RecentReports: React.FC<RecentReportsProps> = ({
  reports,
  issues,
  onSelectIssue
}) => {
  const recentReports = reports.slice(0, 6);

  const getParentIssue = (issueId: string): Issue | undefined => {
    return issues.find(i => i.id === issueId);
  };

  const formatRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-navy-950">Recent Submissions</h3>
            <p className="text-xs text-slate-500">Live feed of student reports</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium">Real-time</span>
      </div>

      {recentReports.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
          <p className="text-xs font-semibold text-slate-600">No student reports submitted yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Campus facilities are calm and undisturbed.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {recentReports.map((report) => {
          const parentIssue = getParentIssue(report.issueId);
          const status = parentIssue ? parentIssue.status : 'Pending';

          return (
            <div
              key={report.id}
              onClick={() => parentIssue && onSelectIssue(parentIssue)}
              className="py-3.5 first:pt-0 last:pb-0 hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                      {report.referenceNo}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(report.createdAt)}
                    </span>
                  </div>

                  <h5 className="text-sm font-semibold text-navy-900 group-hover:text-teal-600 transition-colors line-clamp-1">
                    {report.title}
                  </h5>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{report.locationDisplay}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    status === 'Resolved' 
                      ? 'bg-emerald-100 text-emerald-800'
                      : status === 'In Progress'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {status}
                  </span>
                  
                  <span className="text-[11px] text-teal-600 font-semibold group-hover:underline flex items-center gap-0.5">
                    View Issue <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
