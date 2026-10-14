import React, { useState } from 'react';
import { 
  Building2, 
  PlusCircle, 
  ShieldCheck, 
  Search, 
  BarChart3, 
  Menu, 
  X, 
  Radio, 
  LogOut,
  Flame
} from 'lucide-react';
import { AdminUser } from '../types';

interface NavbarProps {
  activeTab: 'dashboard' | 'issues' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'issues' | 'admin') => void;
  onOpenReportModal: () => void;
  onOpenAdminLogin: () => void;
  adminUser: AdminUser | null;
  onLogoutAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenReportModal,
  onOpenAdminLogin,
  adminUser,
  onLogoutAdmin
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-navy-900/95 backdrop-blur-md border-b border-navy-700/80 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Tagline */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform duration-200">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-teal-300 transition-colors">
                  Campus<span className="text-teal-400">Pulse</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  College OS
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block font-medium">Your campus. Your voice.</p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                activeTab === 'issues'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              <Search className="w-4 h-4" />
              Track Issues
            </button>

            <button
              onClick={() => {
                if (adminUser) {
                  setActiveTab('admin');
                } else {
                  onOpenAdminLogin();
                }
              }}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {adminUser ? 'Admin Portal' : 'Admin Login'}
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {adminUser && (
              <div className="flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-medium truncate max-w-[120px]">{adminUser.name}</span>
                <button
                  onClick={onLogoutAdmin}
                  title="Logout Admin"
                  className="ml-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={onOpenReportModal}
              className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-navy-950 font-bold px-4 py-2 rounded-xl text-sm shadow-md hover:shadow-teal-500/25 transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
            >
              <PlusCircle className="w-4 h-4 text-navy-950 stroke-[2.5]" />
              <span>Report an Issue</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={onOpenReportModal}
              className="bg-teal-500 text-navy-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-navy-800 border-b border-navy-700 px-4 pt-2 pb-4 space-y-2">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 ${
              activeTab === 'dashboard' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab('issues');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 ${
              activeTab === 'issues' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            Track Issues
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              if (adminUser) {
                setActiveTab('admin');
              } else {
                onOpenAdminLogin();
              }
            }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 ${
              activeTab === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {adminUser ? 'Admin Portal' : 'Admin Login'}
          </button>

          {adminUser && (
            <div className="pt-2 border-t border-navy-700 flex items-center justify-between">
              <span className="text-xs text-slate-400">Logged in: {adminUser.name}</span>
              <button
                onClick={() => {
                  onLogoutAdmin();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-red-400 font-medium hover:underline flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
