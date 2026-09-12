import React from "react";
import { CheckCircle2, Clock, CalendarClock, AlertTriangle, ShieldCheck, ArrowRight, Wallet, Calendar, AlertCircle } from "lucide-react";
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
        Select an affordability request to view the financial decision.
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
        <span className="text-xs text-slate-500 italic">No installment schedule required</span>
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
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800"
            >
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{date}:</span>
              <span className="font-bold text-slate-900">
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
          title: "Affordable Now — Safe to Buy",
          badge: "Buy Now",
          bg: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
          bannerBg: "bg-emerald-50/50 border-emerald-200",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
        };
      case "affordable_with_plan":
        return {
          title: "Affordable with Structured Plan",
          badge: "Split / Plan Safe",
          bg: "bg-blue-500/10 text-blue-700 border-blue-300",
          bannerBg: "bg-blue-50/50 border-blue-200",
          icon: CalendarClock,
          iconColor: "text-blue-600",
        };
      case "affordable_later":
        return {
          title: "Affordable Later — Wait Recommended",
          badge: "Wait for Replenishment",
          bg: "bg-amber-500/10 text-amber-700 border-amber-300",
          bannerBg: "bg-amber-50/50 border-amber-200",
          icon: Clock,
          iconColor: "text-amber-600",
        };
      default:
        return {
          title: "Not Affordable Within 90 Days",
          badge: "Not Recommended",
          bg: "bg-rose-500/10 text-rose-700 border-rose-300",
          bannerBg: "bg-rose-50/50 border-rose-200",
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
          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <StatusIcon className={`w-5 h-5 ${status.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-slate-500">{request.request_id}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${status.bg}`}>
                {status.badge}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
              {status.title}
            </h2>
          </div>
        </div>

        {/* Method pill */}
        <div className="text-left sm:text-right">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Recommended Strategy
          </span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            {prediction.recommended_payment_method.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* User Inquiry Callout */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          User Request & Goal
        </span>
        <blockquote className="text-xs sm:text-sm text-slate-800 italic font-medium leading-relaxed">
          "{request.request_text}"
        </blockquote>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
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

      {/* Key Metric Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100">
        <div className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Amount Safe to Pay Today
          </span>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-bold text-slate-900 font-mono">
              {cur} {safeAmt.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">
              / {cur} {requestedAmt.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${safeAmt >= requestedAmt ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{
                width: `${requestedAmt > 0 ? Math.min(100, Math.round((safeAmt / requestedAmt) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Earliest Date for Full Payment
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-base font-bold text-slate-900 font-mono">
              {prediction.earliest_date_for_full_payment || "Beyond 90 days"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {prediction.earliest_date_for_full_payment === request.request_date
              ? "Immediately available today"
              : `Waiting ~${Math.max(0, Math.round((new Date(prediction.earliest_date_for_full_payment).getTime() - new Date(request.request_date).getTime()) / 86400000))} days for cash recovery`}
          </p>
        </div>

        <div className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Protected Minimum Reserve
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-base font-bold text-slate-900 font-mono">
              {cur} {minBuffer.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Current balance: {cur} {currBal.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Decision Explanation & Payment Plan */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Decision Explanation
          </h3>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/70">
            {prediction.decision_explanation}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Scheduled Payment Plan
          </h3>
          {renderPaymentPlan()}
        </div>

        {prediction.spending_changes_needed && prediction.spending_changes_needed !== "none" && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start space-x-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Spending Adjustment Required: </span>
              {prediction.spending_changes_needed}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
