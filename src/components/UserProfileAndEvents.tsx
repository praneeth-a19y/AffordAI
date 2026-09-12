import React from "react";
import { User, Wallet, ShieldAlert, ArrowDownRight, ArrowUpRight, CheckCircle2, PauseCircle, PlayCircle, Clock } from "lucide-react";
import { UserProfile, FinancialEvent, PaymentOption } from "../types";

interface UserProfileAndEventsProps {
  profile?: UserProfile;
  events: FinancialEvent[];
  options: PaymentOption[];
  pausedEventIds: Set<string>;
  onTogglePauseEvent: (eventId: string) => void;
}

export const UserProfileAndEvents: React.FC<UserProfileAndEventsProps> = ({
  profile,
  events,
  options,
  pausedEventIds,
  onTogglePauseEvent,
}) => {
  if (!profile) {
    return (
      <div id="no-profile-banner" className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
        <div className="flex items-center space-x-2 text-slate-800 font-semibold mb-1">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>No External Financial Profile Attached (Pure Dataset Mode)</span>
        </div>
        <p className="text-slate-500 leading-relaxed">
          In strict compliance with AffordAI financial directives, bank balances, salaries, and recurring commitments are <strong>never invented or fabricated</strong> when absent from the dataset. A conservative safe recommendation is enforced. You can test custom balances and cash flows using the <em>Simulate Custom Scenario</em> tool.
        </p>
      </div>
    );
  }

  const cur = profile.home_currency;
  const methods = profile.payment_methods_user_will_consider.split("|");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Profile & Priorities Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                User Profile: {profile.user_id}
              </h3>
              <p className="text-xs text-slate-500">
                Primary Currency: {cur} • Min Reserve: {cur}{" "}
                {Number(profile.minimum_balance_to_keep).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 my-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[11px] text-slate-400 font-semibold block uppercase">
                Available Balance
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {cur} {Number(profile.available_balance).toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[11px] text-slate-400 font-semibold block uppercase">
                Reserve Buffer
              </span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {cur} {Number(profile.minimum_balance_to_keep).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div>
              <strong className="text-slate-800">Financial Priorities:</strong>{" "}
              {profile.financial_priorities}
            </div>
            <div>
              <strong className="text-slate-800">Spending Style:</strong>{" "}
              {profile.spending_preferences}
            </div>
            <div>
              <strong className="text-slate-800">Allowed Methods:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {methods.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-700 uppercase"
                  >
                    {m.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Payment options for this request if any */}
        {options.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Available Installment Offers ({options.length})
            </span>
            <div className="space-y-1.5">
              {options.map((opt) => (
                <div
                  key={opt.payment_option_id}
                  className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-800">
                      {opt.payment_option_id}
                    </span>
                    <span className="text-slate-500 ml-1.5">
                      {opt.number_of_payments} payments of {cur}{" "}
                      {Number(opt.payment_amount).toLocaleString()} (every{" "}
                      {opt.days_between_payments}d)
                    </span>
                  </div>
                  <span className="font-semibold text-slate-700">
                    Total: {cur} {Number(opt.total_payable).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Financial Commitments & Spending Adjustment Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Recurring Financial Events & Commitments
            </h3>
            <p className="text-xs text-slate-500">
              Toggle flexible expenses to simulate spending adjustments
            </p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
            {events.length} tracked
          </span>
        </div>

        <div className="mt-3 overflow-y-auto max-h-72 space-y-2 pr-1">
          {events.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              No financial events recorded for this user.
            </div>
          ) : (
            events.map((ev) => {
              const isIncome = ev.event_type === "income";
              const isFlexible = String(ev.is_flexible) === "true";
              const isPaused = pausedEventIds.has(ev.event_id);

              return (
                <div
                  key={ev.event_id}
                  className={`p-2.5 rounded-lg border transition-all text-xs flex items-center justify-between ${
                    isPaused
                      ? "bg-slate-50 border-dashed border-slate-300 opacity-60"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <div
                      className={`p-1.5 rounded-md mt-0.5 ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-slate-800">
                          {ev.description}
                        </span>
                        {isFlexible && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200">
                            Flexible
                          </span>
                        )}
                        {isPaused && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {ev.is_recurring ? `Every ${ev.recurrence_interval_days} days` : "One-time"} • Date: {ev.event_date}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-mono font-bold text-xs ${
                        isIncome ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {isIncome ? "+" : "-"} {cur} {Number(ev.amount).toLocaleString()}
                    </span>

                    {isFlexible && (
                      <button
                        onClick={() => onTogglePauseEvent(ev.event_id)}
                        title={isPaused ? "Resume this expense" : "Pause this expense to free cash flow"}
                        className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                          isPaused ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {isPaused ? (
                          <PlayCircle className="w-4 h-4" />
                        ) : (
                          <PauseCircle className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
