import React from "react";
import { Download, Sparkles, BrainCircuit, ShieldCheck, Zap } from "lucide-react";

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-900 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <BrainCircuit className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">AffordAI</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-600" />
                Autonomous Financial Agent
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                90-Day Cash Flow Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Determining safe payment limits, optimal methods, and payment schedules from user financial datasheets
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto justify-end">
          <button
            id="btn-custom-scenario"
            onClick={onOpenScenarioModal}
            className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors border border-indigo-200"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Custom Expense Test
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

