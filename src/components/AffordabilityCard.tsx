import React from "react";
import { CheckCircle2, Clock, CalendarClock, AlertTriangle, ShieldCheck, Calendar, AlertCircle, Sparkles, BrainCircuit } from "lucide-react";
import { RequestItem, PredictionOutput, UserProfile } from "../types";

interface AffordabilityCardProps {
  request?: RequestItem;
  prediction?: PredictionOutput;
  profile?: UserProfile;
}

export const AffordabilityCard: React.FC<AffordabilityCardProps> = ({
  request,
  prediction,
  profile,
}) => {
  if (!request || !prediction) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 text-sm">
        Select an affordability request or ask AffordAI to evaluate a purchase.
      </div>
    );
  }

  const cur = profile?.home_currency || "";
  const requestedAmt = Number(request.requested_amount);
  const safeAmt = Number(prediction.amount_safe_to_pay);
  const minBuffer = profile ? Number(profile.minimum_balance_to_keep) : 0;
  const currBal = profile ? Number(profile.available_balance) : 0;

  // Format payment plan into badges
  const renderPaymentPlan = () => {
    if (!prediction.payment_plan || prediction.payment_plan === "none") {
      return (
        <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
          none (single full payment or waiting for liquidity)
        </span>
      );
    }

    const segments = prediction.payment_plan.split("|");
    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {segments.map((seg, idx) => {
          const [date, amt] = seg.split(":");
          return (
            <div
              key={idx}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900"
            >
              <Calendar className="w-3 h-3 text-indigo-600" />
              <span className="font-mono">{date}:</span>
              <span className="font-mono font-bold text-slate-900">
                {cur} {Number(amt).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const getStatusDisplay = () => {
    switch (prediction.affordability_status) {
      case "affordable_now":
        return {
          title: "Affordable Now — Safe to Pay Full",
          badge: "affordable_now",
          bg: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
          bannerBg: "bg-emerald-50/70 border-emerald-200",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
        };
      case "affordable_with_plan":
        return {
          title: "Affordable with Plan — Structured Schedule Safe",
          badge: "affordable_with_plan",
          bg: "bg-blue-500/10 text-blue-700 border-blue-300",
          bannerBg: "bg-blue-50/70 border-blue-200",
          icon: CalendarClock,
          iconColor: "text-blue-600",
        };
      case "affordable_later":
        return {
          title: "Affordable Later — Cash Recovery Period Required",
          badge: "affordable_later",
          bg: "bg-amber-500/10 text-amber-700 border-amber-300",
          bannerBg: "bg-amber-50/70 border-amber-200",
          icon: Clock,
          iconColor: "text-amber-600",
        };
      default:
        return {
          title: "Not Affordable Within 90-Day Window",
          badge: "not_affordable",
          bg: "bg-rose-500/10 text-rose-700 border-rose-300",
          bannerBg: "bg-rose-50/70 border-rose-200",
          icon: AlertTriangle,
          iconColor: "text-rose-600",
        };
    }
  };

  const status = getStatusDisplay();
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Banner with Decision Status */}
      <div className={`p-4 border-b ${status.bannerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <StatusIcon className={`w-5 h-5 ${status.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                {request.request_id}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border font-mono ${status.bg}`}>
                {status.badge}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                <BrainCircuit className="w-3 h-3 mr-1 text-indigo-600" />
                AffordAI Verified
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight mt-1">
              {status.title}
            </h2>
          </div>
        </div>

        {/* Method pill */}
        <div className="text-left sm:text-right bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            recommended_payment_method
          </span>
          <span className="text-xs font-mono font-bold text-indigo-900">
            {prediction.recommended_payment_method}
          </span>
        </div>
      </div>

      {/* User Inquiry Callout */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Evaluated Request Text
        </span>
        <blockquote className="text-xs sm:text-sm text-slate-900 italic font-medium leading-relaxed">
          "{request.request_text}"
        </blockquote>
        <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>
            <strong>Category:</strong> {request.request_type.replace(/_/g, " ")}
          </span>
          <span>
            <strong>Requested:</strong> {cur} {requestedAmt.toLocaleString()}
          </span>
          <span>
            <strong>Desired by:</strong> {request.desired_completion_date}
          </span>
          <span>
            <strong>Allows Split:</strong> {String(request.allows_partial_payment) === "true" ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* The 7 Core Affordability Determination Metrics */}
      <div className="p-4 bg-slate-900 text-white">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              AffordAI 7-Point Determination System
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Ground Truth Evaluated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. amount_safe_to_pay */}
          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase text-emerald-400 block font-semibold">
              1. amount_safe_to_pay
            </span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {cur} {safeAmt.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">
              Max safe expenditure today
            </span>
          </div>

          {/* 2. affordability_status */}
          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase text-sky-400 block font-semibold">
              2. affordability_status
            </span>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {prediction.affordability_status}
            </div>
            <span className="text-[10px] text-slate-400">
              90-day liquidity classification
            </span>
          </div>

          {/* 3. recommended_payment_method */}
          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase text-purple-400 block font-semibold">
              3. recommended_payment_method
            </span>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {prediction.recommended_payment_method}
            </div>
            <span className="text-[10px] text-slate-400">
              Optimal execution strategy
            </span>
          </div>

          {/* 4. earliest_date_for_full_payment */}
          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase text-amber-400 block font-semibold">
              4. earliest_date_for_full_payment
            </span>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {prediction.earliest_date_for_full_payment || "Beyond 90 days"}
            </div>
            <span className="text-[10px] text-slate-400">
              First calendar date for full payment
            </span>
          </div>

          {/* 5. spending_changes_needed */}
          <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 sm:col-span-2">
            <span className="text-[10px] font-mono uppercase text-rose-400 block font-semibold">
              5. spending_changes_needed
            </span>
            <div className="text-xs font-mono text-slate-200 mt-1">
              {prediction.spending_changes_needed || "none"}
            </div>
            <span className="text-[10px] text-slate-400">
              Flexible non-essential adjustments
            </span>
          </div>
        </div>
      </div>

      {/* 6. payment_plan & 7. decision_explanation */}
      <div className="p-4 space-y-4 bg-white">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
              6. payment_plan
            </span>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recommended Payment Schedule
            </h3>
          </div>
          {renderPaymentPlan()}
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
              7. decision_explanation
            </span>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Rationale Supporting Recommendation
            </h3>
          </div>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            {prediction.decision_explanation}
          </p>
        </div>
      </div>
    </div>
  );
};

