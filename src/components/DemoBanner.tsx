import React from 'react';
import { ShieldCheck, RotateCcw, PlusCircle, Trash2 } from 'lucide-react';
import { db } from '../services/db';

interface DemoBannerProps {
  demoCount: number;
  realCount: number;
  onRefresh: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({
  demoCount,
  realCount,
  onRefresh
}) => {
  const handleClearAll = () => {
    if (window.confirm('Clear all issues and reports from the database? This returns the campus to a clean slate with 0 issues.')) {
      db.clearAllIssues();
      onRefresh();
    }
  };

  const handleSeedDemo = () => {
    db.seedDemoData();
    onRefresh();
  };

  const totalCount = demoCount + realCount;

  return (
    <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 border-b border-navy-800 py-2.5 px-4 text-xs text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Anti-Spam Protection Active
          </div>
          <span className="text-slate-400 text-xs hidden sm:inline">
            Each student device is limited to 1 count per issue to guarantee honest campus rankings.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {totalCount > 0 ? (
            <button
              onClick={handleClearAll}
              className="text-[11px] font-semibold text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-navy-800"
              title="Remove all issues and start with a clean zero-issue slate"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
              Clear All Issues ({totalCount})
            </button>
          ) : (
            <button
              onClick={handleSeedDemo}
              className="text-[11px] font-semibold text-teal-300 hover:text-teal-200 transition-colors flex items-center gap-1 px-2.5 py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30"
              title="Optionally populate sample reports for demonstration"
            >
              <PlusCircle className="w-3 h-3" />
              Load Sample Demo Data (Optional)
            </button>
          )}

        </div>
      </div>
    </div>
  );
};
