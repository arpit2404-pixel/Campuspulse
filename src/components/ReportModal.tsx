import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Upload, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  MapPin, 
  Building2, 
  Image as ImageIcon,
  Copy,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { IssueCategory, Report, Issue, Urgency } from '../types';
import { CAMPUS_BUILDINGS, CATEGORIES } from '../data/demoData';
import { db } from '../services/db';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { report: Report; issue: Issue; isGrouped: boolean; matchReason: string }) => void;
  prefilledBuilding?: string;
  prefilledRoom?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  prefilledBuilding = '',
  prefilledRoom = ''
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('Electricity');
  const [building, setBuilding] = useState(prefilledBuilding || CAMPUS_BUILDINGS[0]);
  const [room, setRoom] = useState(prefilledRoom || '');
  const [urgency, setUrgency] = useState<Urgency | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Submission success view state
  const [submissionResult, setSubmissionResult] = useState<{
    report: Report;
    issue: Issue;
    isGrouped: boolean;
    matchConfidence: number;
    matchReason: string;
  } | null>(null);

  const [copiedRef, setCopiedRef] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Friendly checks here. The server checks everything again, so these are only
    // for convenience: they are never the only protection.
    if (!title.trim()) {
      setErrorMsg('Please enter an issue title.');
      return;
    }
    if (title.trim().length < 5) {
      setErrorMsg('Title must be at least 5 characters long.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please enter a brief description of the problem.');
      return;
    }
    if (description.trim().length < 10) {
      setErrorMsg('Description must be at least 10 characters long.');
      return;
    }
    if (!building) {
      setErrorMsg('Please select a campus building.');
      return;
    }

    setIsSubmitting(true);

    const result = await db.submitReport({
      title: title.trim(),
      description: description.trim(),
      category,
      building,
      room: room.trim(),
      urgency: urgency || undefined
    });

    if (!result.success || !result.report || !result.issue) {
      setErrorMsg(result.message || 'Your report could not be sent. Please try again.');
      setIsSubmitting(false);
      return;
    }

    // Fire celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    setSubmissionResult({
      report: result.report,
      issue: result.issue,
      isGrouped: !!result.isGrouped,
      matchConfidence: result.matchConfidence || 0,
      matchReason: result.matchReason || ''
    });
    setIsSubmitting(false);
    onSuccess({
      report: result.report,
      issue: result.issue,
      isGrouped: !!result.isGrouped,
      matchReason: result.matchReason || ''
    });
  };

  const handleCopyReference = () => {
    if (submissionResult) {
      navigator.clipboard.writeText(submissionResult.report.referenceNo);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setCategory('Electricity');
    setRoom('');
    setUrgency('');
    setSubmissionResult(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-navy-900 px-6 py-5 text-white flex items-center justify-between border-b border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Report a Campus Issue</h3>
              <p className="text-xs text-slate-300">No sign-up needed • Smart duplicate grouping</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {submissionResult ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-2xl font-extrabold text-navy-900">
                Report Successfully Filed!
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                Your report has been securely registered in the campus maintenance system.
              </p>
            </div>

            {/* Reference Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Your Unique Tracking Reference
              </span>
              <div className="flex items-center justify-center gap-3 mt-1.5">
                <span className="font-mono text-2xl font-extrabold text-teal-700 tracking-wider">
                  {submissionResult.report.referenceNo}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReference}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                  title="Copy Reference Number"
                >
                  {copiedRef ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Save this reference code to track the resolution timeline anytime.
              </p>
            </div>

            {/* Grouping Engine Result Banner */}
            <div className={`rounded-2xl p-4 border text-left ${
              submissionResult.isGrouped 
                ? 'bg-teal-50/80 border-teal-200 text-teal-900' 
                : 'bg-blue-50/80 border-blue-200 text-blue-900'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl mt-0.5 ${
                  submissionResult.isGrouped ? 'bg-teal-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-sm font-bold">
                    {submissionResult.isGrouped 
                      ? 'Smart Grouping Applied' 
                      : 'New Unique Campus Issue Created'}
                  </h5>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">
                    {submissionResult.isGrouped ? (
                      <>
                        Your report was automatically grouped with existing issue: <br />
                        <strong className="underline">{submissionResult.issue.title}</strong>. <br />
                        This increased its priority count to <strong>{submissionResult.issue.reportCount} reports</strong>!
                      </>
                    ) : (
                      <>
                        No duplicate issue exists for this location and category. A new standalone campus ticket was opened.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md"
              >
                Done & Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Issue Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ceiling fan not working in Room 204"
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left flex items-center gap-2 transition-all ${
                      category === cat.name
                        ? 'bg-teal-500/10 border-teal-500 text-teal-800 ring-1 ring-teal-500 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Campus Building & Room */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Building / Zone <span className="text-red-500">*</span>
                </label>
                <select
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                >
                  {CAMPUS_BUILDINGS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Room / Specific Location
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Room 204 or 2nd Floor Corridor"
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                />
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Detailed Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Describe what's wrong (e.g. rattling sound, leak size, hazards, how long it has been broken)..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white resize-none"
                required
              />
            </div>

            {/* Urgency (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Urgency <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {([['', 'Not sure'], ['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High']] as [Urgency | '', string][]).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setUrgency(value)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                      urgency === value
                        ? 'bg-teal-500/10 border-teal-500 text-teal-800 ring-1 ring-teal-500 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy note (honest about what is and is not collected) */}
            <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-navy-950">No name, email or phone number is collected.</span>{' '}
                  To stop repeat submissions, the server keeps only a scrambled (hashed) code of your browser and network
                  address. Reports are not guaranteed to be untraceable.
                </p>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 disabled:opacity-50 text-navy-950 font-extrabold py-3 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-teal-500/20"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing & Grouping Report...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
