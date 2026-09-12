import React, { useState } from "react";
import { Sparkles, Shield, AlertTriangle, Lightbulb, RefreshCw, CheckCircle2 } from "lucide-react";
import { AIAdvisorResponse, RequestItem, PredictionOutput, UserProfile, SimulationResult } from "../types";

interface AiAdvisorPanelProps {
  request?: RequestItem;
  prediction?: PredictionOutput;
  profile?: UserProfile;
  simulation?: SimulationResult | null;
  aiData: AIAdvisorResponse | null;
  isLoadingAi: boolean;
  onRefreshAi: () => void;
}

export const AiAdvisorPanel: React.FC<AiAdvisorPanelProps> = ({
  request,
  prediction,
  profile,
  simulation,
  aiData,
  isLoadingAi,
  onRefreshAi,
}) => {
  if (!request) return null;

  const getRiskBadge = (risk?: string) => {
    switch (risk?.toLowerCase()) {
      case "low":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "high":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">Gemini AI Financial Reasoning</h3>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                gemini-3.8-flash
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Personalized rationale & risk evaluation grounded in your 90-day cash forecast
            </p>
          </div>
        </div>

        <button
          id="btn-refresh-ai-advice"
          onClick={onRefreshAi}
          disabled={isLoadingAi}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingAi ? "animate-spin" : ""}`} />
          {isLoadingAi ? "Analyzing..." : "Re-evaluate"}
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {isLoadingAi ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-xs font-medium text-slate-500">
              Gemini is evaluating 90-day liquidity and risk factors...
            </span>
          </div>
        ) : aiData ? (
          <>
            {/* Score and Risk banner */}
            <div className="flex flex-wrap items-center gap-3">
              {aiData.riskLevel && (
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRiskBadge(aiData.riskLevel)}`}>
                  Risk Level: {aiData.riskLevel}
                </div>
              )}
              {aiData.financialScore !== undefined && (
                <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  Affordability Index: {aiData.financialScore}/100
                </div>
              )}
            </div>

            {/* AI Core Advice */}
            <div className="p-3.5 rounded-lg bg-indigo-50/40 border border-indigo-100 text-xs text-slate-800 leading-relaxed">
              <strong className="text-indigo-950 block mb-1">Strategic Advice:</strong>
              {aiData.advice}
            </div>

            {/* Key Risk Factors and Budgeting Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {aiData.keyFactors && aiData.keyFactors.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center space-x-1.5 text-slate-700 font-bold mb-2">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Key Liquidity Factors</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600">
                    {aiData.keyFactors.map((factor, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-indigo-500">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiData.budgetingTips && aiData.budgetingTips.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center space-x-1.5 text-slate-700 font-bold mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Actionable Budgeting Steps</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600">
                    {aiData.budgetingTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-amber-500">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500 py-4 text-center">
            Click "Re-evaluate" to generate detailed Gemini AI recommendations.
          </div>
        )}
      </div>
    </div>
  );
};
