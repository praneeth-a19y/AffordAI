import React, { useState } from "react";
import { X, Download, FileSpreadsheet, Archive, FileText, CheckCircle2, Copy, Check } from "lucide-react";
import { PredictionOutput } from "../types";

interface SubmissionDeliverablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputs: PredictionOutput[];
}

export const SubmissionDeliverablesModal: React.FC<SubmissionDeliverablesModalProps> = ({
  isOpen,
  onClose,
  outputs,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (type: string) => {
    window.location.href = `/api/download/${type}`;
  };

  const deliverables = [
    {
      id: "output",
      name: "output.csv",
      title: "Model Output CSV",
      description: "Predictions for all 250 requests matching output requirements.",
      icon: FileSpreadsheet,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      buttonText: "Download output.csv",
    },
    {
      id: "code",
      name: "code.zip",
      title: "Complete Codebase Archive",
      description: "Full runnable solution with prompts, dataset generators, solver, and README.",
      icon: Archive,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      buttonText: "Download code.zip",
    },
    {
      id: "report",
      name: "evaluation/usage_report.md",
      title: "Token Usage & Cost Analysis Report",
      description: "Comprehensive breakdown of model calls, tokens, pricing, and timing.",
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      buttonText: "Download usage_report.md",
    },
    {
      id: "transcript",
      name: "chat_transcript.txt",
      title: "Development Chat Transcript",
      description: "Audit trail log of prompt engineering, dataset validation, and modeling iterations.",
      icon: FileText,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      buttonText: "Download transcript",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Submission Deliverables</h2>
              <p className="text-xs text-slate-500">
                All 4 deliverables verified and ready for evaluation submission
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deliverables Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deliverables.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-start space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${item.bgColor} shrink-0`}>
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <code className="text-[11px] text-slate-500 font-mono block mt-0.5">
                        {item.name}
                      </code>
                      <p className="text-xs text-slate-600 mt-1">{item.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(item.id)}
                    className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    {item.buttonText}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Table Preview of output.csv */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                output.csv Preview ({outputs.length} Rows Generated)
              </h4>
              <span className="text-[11px] text-slate-400">First 5 records</span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">request_id</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">amount_safe_to_pay</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">affordability_status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">recommended_method</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">earliest_full_date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {outputs.slice(0, 5).map((row) => (
                    <tr key={row.request_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono font-bold text-slate-900">
                        {row.request_id}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {Number(row.amount_safe_to_pay).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {row.affordability_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.recommended_payment_method}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600">
                        {row.earliest_date_for_full_payment}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>All files stored in project directory root.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
