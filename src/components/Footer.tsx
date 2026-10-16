import React from 'react';
import { Radio, Heart, Shield, PhoneCall } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-navy-950 text-slate-400 border-t border-navy-800 text-xs py-10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <span className="font-extrabold text-lg text-white tracking-tight">
                Campus<span className="text-teal-400">Pulse</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
              Real-time campus issue reporting and resolution platform for college students. Empowering students with anonymous reporting, intelligent issue clustering, and transparent resolution timelines.
            </p>
          </div>

          {/* Core Categories */}
          <div>
            <h4 className="text-slate-200 font-bold uppercase tracking-wider text-xs mb-3">
              Common Categories
            </h4>
            <ul className="space-y-1.5">
              <li>Classroom Fans & Electrical</li>
              <li>Washrooms & Sanitation</li>
              <li>Projector & HDMI AV Systems</li>
              <li>Plumbing & Water Coolers</li>
              <li>Benches & Desks Repair</li>
            </ul>
          </div>

          {/* Quick Help & Emergency */}
          <div>
            <h4 className="text-slate-200 font-bold uppercase tracking-wider text-xs mb-3">
              Campus Security & Estate
            </h4>
            <div className="space-y-2 text-slate-400">
              <p className="flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
                Estate Control Room: Ext 4022
              </p>
              <p className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Campus Safety Helpline: 1800-CAMPUS
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                For life safety or electrical fire hazards, contact security immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-navy-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© 2026 CampusPulse Platform. All student anonymous reports are strictly confidential.</p>
          <p className="flex items-center gap-1">
            Built for college students with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> & React
          </p>
        </div>
      </div>
    </footer>
  );
};
