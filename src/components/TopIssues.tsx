import React from 'react';
import { 
  Flame, 
  MapPin, 
  ChevronRight, 
  AlertCircle, 
  Zap, 
  Droplets, 
  Tv, 
  Sparkles, 
  Building2, 
  Wifi, 
  HelpCircle,
  TrendingUp
} from 'lucide-react';
import { Issue, IssueCategory, IssueStatus } from '../types';

interface TopIssuesProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onOpenReportModal: () => void;
}

const CATEGORY_ICONS: Record<IssueCategory, React.ElementType> = {
  'Electricity': Zap,
  'Water': Droplets,
  'Classroom Equipment': Tv,
  'Cleanliness': Sparkles,
  'Infrastructure': Building2,
  'Internet': Wifi,
  'Other': HelpCircle
};

const STATUS_BADGES: Record<IssueStatus, { label: string; bg: string; text: string; dot: string }> = {
  'Pending': { label: 'Pending', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  'In Progress': { label: 'In Progress', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  'Resolved': { label: 'Resolved', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' }
};

export const TopIssues: React.FC<TopIssuesProps> = ({
  issues,
  onSelectIssue,
  onOpenReportModal
}) => {
  // Sort descending by report count
  const sortedIssues = [...issues]
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 5);

  const highestCount = sortedIssues.length > 0 ? sortedIssues[0].reportCount : 1;

  if (sortedIssues.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center shadow-card">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-teal-600">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-navy-900 mb-1">No Recurring Issues Yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          Campus is running smooth! Be the first to report any facility or classroom maintenance problem.
        </p>
        <button
          onClick={onOpenReportModal}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
        >
          Submit First Report
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <Flame className="w-5 h-5 fill-orange-500 text-orange-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-navy-950 tracking-tight">
              Top 5 Recurring Campus Issues
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prioritized by aggregated student report volume. Updates automatically as new reports are clustered.
          </p>
        </div>
        <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
          Live Ranking
        </span>
      </div>

      <div className="space-y-4">
        {sortedIssues.map((issue, index) => {
          const CategoryIcon = CATEGORY_ICONS[issue.category] || HelpCircle;
          const statusConfig = STATUS_BADGES[issue.status] || STATUS_BADGES.Pending;
          
          // Relative percentage bar relative to the #1 most reported issue
          const relativePercent = Math.min(100, Math.round((issue.reportCount / highestCount) * 100));

          return (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue)}
              className="group p-4 rounded-xl border border-slate-200 hover:border-teal-400/80 bg-slate-50/50 hover:bg-white hover:shadow-card-hover transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Rank Badge */}
                  <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-extrabold text-sm ${
                    index === 0
                      ? 'bg-amber-500 text-white shadow-sm'
                      : index === 1
                      ? 'bg-slate-300 text-slate-800'
                      : index === 2
                      ? 'bg-amber-700/80 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    #{index + 1}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-navy-900 group-hover:text-teal-600 transition-colors truncate">
                      {issue.title}
                    </h4>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{issue.locationDisplay}</span>
                      </span>

                      <span className="text-slate-300 text-xs">•</span>

                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <CategoryIcon className="w-3.5 h-3.5 text-teal-600" />
                        <span>{issue.category}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Report count & Status badge */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-extrabold text-xs">
                      <span>{issue.reportCount}</span>
                      <span className="font-medium text-[11px] text-teal-600">
                        {issue.reportCount === 1 ? 'report' : 'reports'}
                      </span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                    {statusConfig.label}
                  </span>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all hidden sm:block" />
                </div>
              </div>

              {/* Relative Report Volume Bar */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${relativePercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-400 shrink-0">
                  {relativePercent}% of max urgency
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
