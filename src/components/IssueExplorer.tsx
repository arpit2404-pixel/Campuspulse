import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  MapPin, 
  Building2, 
  ChevronRight, 
  Layers, 
  PlusCircle,
  Zap,
  Droplets,
  Tv,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Issue, IssueCategory, IssueStatus } from '../types';
import { CATEGORIES, CAMPUS_BUILDINGS } from '../data/demoData';

interface IssueExplorerProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onOpenReportModal: () => void;
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

const STATUS_BADGES: Record<IssueStatus, { label: string; bg: string; text: string; dot: string }> = {
  'Pending': { label: 'Pending', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
  'Under Review': { label: 'Under Review', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' },
  'In Progress': { label: 'In Progress', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', dot: 'bg-teal-500' },
  'Resolved': { label: 'Resolved', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' }
};

export const IssueExplorer: React.FC<IssueExplorerProps> = ({
  issues,
  onSelectIssue,
  onOpenReportModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'most_reported' | 'newest' | 'recently_updated'>('most_reported');

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Search text match (title, description, location)
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        issue.title.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.locationDisplay.toLowerCase().includes(query);

      // Category filter
      const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;

      // Status filter
      const matchesStatus = selectedStatus === 'All' || issue.status === selectedStatus;

      // Building filter
      const matchesBuilding = selectedBuilding === 'All' || issue.building === selectedBuilding;

      return matchesSearch && matchesCategory && matchesStatus && matchesBuilding;
    }).sort((a, b) => {
      if (sortBy === 'most_reported') {
        return b.reportCount - a.reportCount;
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'recently_updated') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });
  }, [issues, searchTerm, selectedCategory, selectedStatus, selectedBuilding, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-navy-950">Campus Issue Directory</h2>
            <p className="text-xs text-slate-500">
              Browse, filter, and track resolution status across all campus departments.
            </p>
          </div>

          <button
            onClick={onOpenReportModal}
            className="self-start md:self-auto bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Report New Issue
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by issue title, classroom, or building..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Building */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Building
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="All">All Buildings</option>
              {CAMPUS_BUILDINGS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-teal-500 focus:border-teal-500 font-medium"
            >
              <option value="most_reported">🔥 Most Reported</option>
              <option value="newest">🕒 Newest First</option>
              <option value="recently_updated">⚡ Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues Grid / List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Showing {filteredIssues.length} of {issues.length} issues</span>
          {(searchTerm || selectedCategory !== 'All' || selectedStatus !== 'All' || selectedBuilding !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedStatus('All');
                setSelectedBuilding('All');
              }}
              className="text-teal-600 font-semibold hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {filteredIssues.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-navy-900 mb-1">No matching issues found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Try adjusting your search query, location filter, or category.
            </p>
            <button
              onClick={onOpenReportModal}
              className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-xl text-xs hover:bg-teal-700 transition-colors"
            >
              Report this problem
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIssues.map((issue) => {
              const CategoryIcon = CATEGORY_ICONS[issue.category] || HelpCircle;
              const statusConfig = STATUS_BADGES[issue.status] || STATUS_BADGES.Pending;

              return (
                <div
                  key={issue.id}
                  onClick={() => onSelectIssue(issue)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card hover:shadow-card-hover hover:border-teal-400 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Meta Bar */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        <CategoryIcon className="w-3.5 h-3.5 text-teal-600" />
                        {issue.category}
                      </span>

                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-bold text-navy-900 group-hover:text-teal-600 transition-colors line-clamp-2">
                      {issue.title}
                    </h4>

                    {/* Description preview */}
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {issue.description}
                    </p>
                  </div>

                  {/* Bottom info */}
                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[180px] font-medium text-slate-700">{issue.locationDisplay}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-extrabold text-xs border border-teal-200">
                        <span>{issue.reportCount}</span>
                        <span className="font-normal text-[11px] text-teal-600">
                          {issue.reportCount === 1 ? 'report' : 'reports'}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
