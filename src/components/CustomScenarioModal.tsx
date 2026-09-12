import React, { useState } from "react";
import { X, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { SimulationResult } from "../types";

interface CustomScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSimulation: (scenario: any) => void;
}

export const CustomScenarioModal: React.FC<CustomScenarioModalProps> = ({
  isOpen,
  onClose,
  onRunSimulation,
}) => {
  const [amount, setAmount] = useState<number>(1500);
  const [currency, setCurrency] = useState<string>("USD");
  const [description, setDescription] = useState<string>("New flagship developer laptop");
  const [balance, setBalance] = useState<number>(3200);
  const [minReserve, setMinReserve] = useState<number>(800);
  const [daysToComplete, setDaysToComplete] = useState<number>(45);
  const [allowsSplit, setAllowsSplit] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reqDate = new Date().toISOString().split("T")[0];
    const compDate = new Date(Date.now() + daysToComplete * 86400000).toISOString().split("T")[0];

    onRunSimulation({
      isCustom: true,
      requestText: description,
      requestedAmount: amount,
      requestDate: reqDate,
      desiredCompletionDate: compDate,
      allowsPartialPayment: allowsSplit,
      availableBalance: balance,
      minimumBalanceToKeep: minReserve,
      homeCurrency: currency,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Custom Affordability Simulation</h2>
              <p className="text-xs text-slate-500">Test any purchase against 90-day cash flow rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Expense Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Requested Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                required
                min={1}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
                <option value="IDR">IDR (Rp)</option>
                <option value="ZAR">ZAR (R)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Available Balance</label>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Minimum Reserve to Keep</label>
              <input
                type="number"
                value={minReserve}
                onChange={(e) => setMinReserve(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Desired Completion (Days)</label>
              <input
                type="number"
                value={daysToComplete}
                onChange={(e) => setDaysToComplete(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                min={1}
                max={90}
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsSplit}
                  onChange={(e) => setAllowsSplit(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Allow partial/split payments</span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs"
            >
              <span>Simulate 90 Days</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
