import React from 'react';
import { ShieldCheck } from 'lucide-react';

// A slim information bar at the top of the page. (It used to hold sample-data
// buttons; the app now reads real complaints from the database instead.)
export const DemoBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 border-b border-navy-800 py-2.5 px-4 text-xs text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Fair-Ranking Protection Active
          </div>
          <span className="text-slate-400 text-xs hidden sm:inline">
            Each browser counts once per issue, and repeated submissions are rate-limited, to keep campus rankings honest.
          </span>
        </div>
      </div>
    </div>
  );
};
