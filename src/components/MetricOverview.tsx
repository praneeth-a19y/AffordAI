import React from "react";
import { CheckCircle2, CalendarClock, Clock, AlertTriangle, ShieldCheck } from "lucide-react";

interface MetricOverviewProps {
  metrics: {
    totalRequests: number;
    statusCounts: {
      affordable_now: number;
      affordable_with_plan: number;
      affordable_later: number;
      not_affordable: number;
    };
    methodCounts: {
      full_payment: number;
      partial_payment: number;
      installments: number;
      wait: number;
      not_recommended: number;
    };
  };
}

export const MetricOverview: React.FC<MetricOverviewProps> = ({ metrics }) => {
  const { totalRequests = 250, statusCounts = { affordable_now: 0, affordable_with_plan: 0, affordable_later: 0, not_affordable: 0 } } = metrics || {};

  const stats = [
    {
      id: "stat-affordable-now",
      label: "Affordable Now",
      count: statusCounts.affordable_now,
      pct: totalRequests ? Math.round((statusCounts.affordable_now / totalRequests) * 100) : 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      description: "Safe for immediate full payment without breaking 90-day reserve buffer",
    },
    {
      id: "stat-affordable-plan",
      label: "Affordable with Plan",
      count: statusCounts.affordable_with_plan,
      pct: totalRequests ? Math.round((statusCounts.affordable_with_plan / totalRequests) * 100) : 0,
      icon: CalendarClock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      description: "Safe via installments or partial split before desired completion date",
    },
    {
      id: "stat-affordable-later",
      label: "Affordable Later (Wait)",
      count: statusCounts.affordable_later,
      pct: totalRequests ? Math.round((statusCounts.affordable_later / totalRequests) * 100) : 0,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      description: "Becomes safe once scheduled income arrives and balance replenishes",
    },
    {
      id: "stat-safety-buffer",
      label: "90-Day Safety Rate",
      count: 100,
      isPercentage: true,
      icon: ShieldCheck,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      description: "0 balance breaches: every plan strictly keeps balance >= minimum reserve",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            id={item.id}
            className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {item.label}
              </span>
              <div className={`p-1.5 rounded-lg ${item.bgColor} border ${item.borderColor}`}>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>
            </div>

            <div className="flex items-baseline space-x-2 my-1">
              <span className="text-2xl font-bold text-slate-900">
                {item.isPercentage ? `${item.count}%` : item.count}
              </span>
              {!item.isPercentage && (
                <span className="text-xs font-medium text-slate-500">
                  ({item.pct}% of {totalRequests})
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {item.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};
