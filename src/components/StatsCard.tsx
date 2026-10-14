import React from 'react';
import { FileText, Layers, Clock, CheckCircle2 } from 'lucide-react';
import { CampusStats } from '../types';

interface StatsProps {
  stats: CampusStats;
}

export const StatsCards: React.FC<StatsProps> = ({ stats }) => {
  const resolutionRate = stats.totalIssues > 0 
    ? Math.round((stats.resolvedIssues / stats.totalIssues) * 100) 
    : 0;

  const cards = [
    {
      title: 'Total Reports Submitted',
      value: stats.totalReports,
      subtitle: 'From students & faculty',
      icon: FileText,
      color: 'from-blue-600 to-indigo-600',
      badge: 'Aggregated Voice',
      badgeBg: 'bg-blue-100 text-blue-800'
    },
    {
      title: 'Unique Campus Issues',
      value: stats.totalIssues,
      subtitle: 'Grouped & deduplicated',
      icon: Layers,
      color: 'from-teal-600 to-teal-500',
      badge: 'Smart Clustered',
      badgeBg: 'bg-teal-100 text-teal-800'
    },
    {
      title: 'Awaiting Resolution',
      value: stats.awaitingResolution,
      subtitle: 'Pending & in-progress',
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      badge: 'Active Priority',
      badgeBg: 'bg-amber-100 text-amber-800'
    },
    {
      title: 'Issues Resolved',
      value: stats.resolvedIssues,
      subtitle: `${resolutionRate}% campus fix rate`,
      icon: CheckCircle2,
      color: 'from-emerald-600 to-green-500',
      badge: `${resolutionRate}% Fixed`,
      badgeBg: 'bg-emerald-100 text-emerald-800'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card hover:shadow-card-hover transition-all duration-200 group relative overflow-hidden"
          >
            {/* Subtle top accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color}`} />
            
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${card.badgeBg}`}>
                {card.badge}
              </span>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-extrabold text-navy-900 tracking-tight">
                {card.value}
              </h3>
              <p className="text-sm font-semibold text-slate-700">
                {card.title}
              </p>
              <p className="text-xs text-slate-500">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
