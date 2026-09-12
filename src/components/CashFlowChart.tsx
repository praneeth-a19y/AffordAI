import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Area,
} from "recharts";
import { TrendingUp, Layers, Info } from "lucide-react";
import { SimulationResult } from "../types";

interface CashFlowChartProps {
  simulation?: SimulationResult | null;
  currency: string;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ simulation, currency }) => {
  const [showFullPayment, setShowFullPayment] = useState(true);
  const [showInstallments, setShowInstallments] = useState(true);

  if (!simulation || !simulation.baselineBalances || simulation.baselineBalances.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-500 text-sm h-72 flex flex-col items-center justify-center space-y-2">
        <TrendingUp className="w-8 h-8 text-slate-300" />
        <p className="font-semibold text-slate-700">90-Day Simulation Requires Financial Balance State</p>
        <p className="text-xs text-slate-400 max-w-md">
          Bank balance and recurring expenses are not provided for this row in <code>requests.csv</code>. AffordAI strictly enforces a zero-fabrication policy. Click <strong>Simulate Custom Scenario</strong> in the top bar to test custom balances and see live 90-day cash flow trajectories.
        </p>
      </div>
    );
  }

  const { baselineBalances, fullPaymentTrajectory, installmentTrajectory, minHeadroom } = simulation;
  const minRequired = baselineBalances[0]?.minRequired || 0;

  // Combine into chart dataset
  const chartData = baselineBalances.map((dayItem, idx) => {
    return {
      day: `D${dayItem.day}`,
      date: dayItem.date,
      dayNum: dayItem.day,
      baselineBalance: dayItem.balance,
      minReserve: dayItem.minRequired,
      fullPaymentBalance: fullPaymentTrajectory ? fullPaymentTrajectory[idx] : undefined,
      installmentBalance: installmentTrajectory ? installmentTrajectory[idx] : undefined,
    };
  });

  // Sample data to keep chart clean (take every 2nd day or all 90 days)
  const sampledData = chartData.filter((_, i) => i % 2 === 0 || i === chartData.length - 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              90-Day Cash Flow Trajectory & Minimum Buffer Test
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Daily Forecast
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluates safety margin relative to minimum reserve requirement ({currency} {minRequired.toLocaleString()})
          </p>
        </div>

        {/* Trajectory Toggles */}
        <div className="flex items-center space-x-3 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showFullPayment}
              onChange={(e) => setShowFullPayment(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span className="font-medium text-slate-600">Full Payment</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showInstallments}
              onChange={(e) => setShowInstallments(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span className="font-medium text-slate-600">Installments</span>
          </label>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sampledData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                const parts = d.split("-");
                return `${parts[1]}/${parts[2]}`;
              }}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tickFormatter={(v: number) => {
                if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return `${v}`;
              }}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg space-y-1">
                      <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                        Date: {label}
                      </div>
                      {payload.map((entry: any, i: number) => (
                        <div key={i} className="flex justify-between space-x-4">
                          <span style={{ color: entry.color }}>{entry.name}:</span>
                          <span className="font-mono font-bold">
                            {currency} {Number(entry.value).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        Min Reserve: {currency} {minRequired.toLocaleString()}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              iconType="plainline"
            />

            {/* Baseline without purchase */}
            <Line
              type="monotone"
              dataKey="baselineBalance"
              name="Baseline (No Purchase)"
              stroke="#64748b"
              strokeWidth={2}
              dot={false}
            />

            {/* Full Payment Trajectory */}
            {showFullPayment && (
              <Line
                type="monotone"
                dataKey="fullPaymentBalance"
                name="With Full Payment"
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
            )}

            {/* Installments Trajectory */}
            {showInstallments && (
              <Line
                type="monotone"
                dataKey="installmentBalance"
                name="With Installments"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            )}

            {/* Minimum reserve threshold line */}
            <ReferenceLine
              y={minRequired}
              label={{
                value: `Min Reserve Buffer (${currency} ${minRequired.toLocaleString()})`,
                fill: "#dc2626",
                fontSize: 10,
                position: "insideTopRight",
              }}
              stroke="#dc2626"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart footer insights */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>
            90-day minimum balance buffer: <strong>{currency} {minRequired.toLocaleString()}</strong>
          </span>
        </div>
        <div>
          Lowest simulated headroom:{" "}
          <span
            className={`font-mono font-bold ${
              minHeadroom >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {currency} {minHeadroom.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
