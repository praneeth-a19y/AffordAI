import React from "react";
import { Download, ShieldCheck, Sparkles, FileSpreadsheet, Archive, FileText, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  onOpenSubmissionModal: () => void;
  onOpenScenarioModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSubmissionModal, onOpenScenarioModal }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Purpose */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Buy or Wait?</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                90-Day Cash Flow Engine
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Predicting financial affordability, safe payment methods & cash flow impact
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto justify-end">
          <button
            id="btn-custom-scenario"
            onClick={onOpenScenarioModal}
            className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-300"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Simulate Custom Expense
          </button>

          <button
            id="btn-view-submission"
            onClick={onOpenSubmissionModal}
            className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Submission Files (4)
          </button>
        </div>

      </div>
    </header>
  );
};
