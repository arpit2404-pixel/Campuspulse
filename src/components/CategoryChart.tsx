import React from 'react';
import { 
  Zap, 
  Droplets, 
  Tv, 
  Sparkles, 
  Building2, 
  Wifi, 
  HelpCircle,
  PieChart
} from 'lucide-react';
import { IssueCategory } from '../types';

interface CategoryChartProps {
  categoryCounts: Record<IssueCategory, number>;
  totalReports: number;
  onFilterByCategory?: (category: string) => void;
}

const CATEGORY_META: Record<IssueCategory, { icon: React.ElementType; color: string; barColor: string }> = {
  'Electricity': { icon: Zap, color: 'text-amber-500 bg-amber-50', barColor: 'bg-amber-500' },
  'Water': { icon: Droplets, color: 'text-sky-500 bg-sky-50', barColor: 'bg-sky-500' },
  'Classroom Equipment': { icon: Tv, color: 'text-purple-500 bg-purple-50', barColor: 'bg-purple-500' },
  'Cleanliness': { icon: Sparkles, color: 'text-emerald-500 bg-emerald-50', barColor: 'bg-emerald-500' },
  'Infrastructure': { icon: Building2, color: 'text-indigo-500 bg-indigo-50', barColor: 'bg-indigo-500' },
  'Internet': { icon: Wifi, color: 'text-rose-500 bg-rose-50', barColor: 'bg-rose-500' },
  'Other': { icon: HelpCircle, color: 'text-slate-500 bg-slate-50', barColor: 'bg-slate-500' }
};

export const CategoryChart: React.FC<CategoryChartProps> = ({
  categoryCounts,
  totalReports,
  onFilterByCategory
}) => {
  const categories = Object.keys(categoryCounts) as IssueCategory[];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-navy-950">Category Distribution</h3>
            <p className="text-xs text-slate-500">Distribution across campus facilities</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          {totalReports} total reports
        </span>
      </div>

      {totalReports === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <PieChart className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
          <p className="text-xs font-semibold text-slate-600">No reports categorized yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Campus facilities are in good standing.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {categories.map((category) => {
            const count = categoryCounts[category] || 0;
            const percentage = totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
            const meta = CATEGORY_META[category] || CATEGORY_META.Other;
            const Icon = meta.icon;

            return (
              <div 
                key={category} 
                className="space-y-1.5 cursor-pointer group"
                onClick={() => onFilterByCategory && onFilterByCategory(category)}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="font-semibold text-slate-700 group-hover:text-teal-600 transition-colors">
                      {category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <span>{count} {count === 1 ? 'report' : 'reports'}</span>
                    <span className="text-slate-400 font-normal">({percentage}%)</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.barColor} transition-all duration-500 group-hover:opacity-90`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
