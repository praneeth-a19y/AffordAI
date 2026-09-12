import React, { useState, useMemo } from "react";
import { Search, Filter, Tag, CheckCircle2, Clock, CalendarClock, AlertTriangle } from "lucide-react";
import { RequestItem, PredictionOutput } from "../types";

interface RequestSelectorProps {
  requests: RequestItem[];
  outputs: PredictionOutput[];
  selectedRequestId: string;
  onSelectRequest: (reqId: string) => void;
}

export const RequestSelector: React.FC<RequestSelectorProps> = ({
  requests,
  outputs,
  selectedRequestId,
  onSelectRequest,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Output lookup map
  const outputMap = useMemo(() => {
    const map = new Map<string, PredictionOutput>();
    outputs.forEach((o) => map.set(o.request_id, o));
    return map;
  }, [outputs]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.request_type) set.add(r.request_type);
    });
    return Array.from(set).sort();
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const out = outputMap.get(req.request_id);
      // Category match
      if (categoryFilter !== "all" && req.request_type !== categoryFilter) {
        return false;
      }
      // Status match
      if (statusFilter !== "all" && out?.affordability_status !== statusFilter) {
        return false;
      }
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesId = req.request_id.toLowerCase().includes(q);
        const matchesUser = req.user_id.toLowerCase().includes(q);
        const matchesText = req.request_text.toLowerCase().includes(q);
        const matchesType = req.request_type.toLowerCase().includes(q);
        return matchesId || matchesUser || matchesText || matchesType;
      }
      return true;
    });
  }, [requests, outputMap, categoryFilter, statusFilter, searchTerm]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "affordable_now":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Buy Now
          </span>
        );
      case "affordable_with_plan":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <CalendarClock className="w-3 h-3 mr-1 text-blue-600" />
            Plan Safe
          </span>
        );
      case "affordable_later":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            Wait
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
            Not Safe
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[640px]">
      {/* Search and Filters Header */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900">Affordability Requests</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {filteredRequests.length} / {requests.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Click to inspect</span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="input-search-requests"
            type="text"
            placeholder="Search request ID, user, or text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <select
            id="select-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Categories ({requests.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <select
            id="select-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="affordable_now">Affordable Now</option>
            <option value="affordable_with_plan">Affordable with Plan</option>
            <option value="affordable_later">Affordable Later</option>
            <option value="not_affordable">Not Affordable</option>
          </select>
        </div>
      </div>

      {/* List items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No matching requests found. Try resetting filters.
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isSelected = req.request_id === selectedRequestId;
            const out = outputMap.get(req.request_id);
            return (
              <button
                key={req.request_id}
                id={`request-item-${req.request_id}`}
                onClick={() => onSelectRequest(req.request_id)}
                className={`w-full text-left p-3 rounded-lg transition-all text-xs flex flex-col gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "hover:bg-slate-50 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        isSelected ? "text-emerald-400" : "text-slate-900"
                      }`}
                    >
                      {req.request_id}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? "bg-slate-800 text-slate-300"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {req.request_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  {getStatusBadge(out?.affordability_status)}
                </div>

                <p
                  className={`text-[11px] line-clamp-2 leading-relaxed ${
                    isSelected ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  "{req.request_text}"
                </p>

                <div
                  className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                    isSelected ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-400"
                  }`}
                >
                  <span>Req Date: {req.request_date}</span>
                  <span className="font-semibold">
                    Amt: {Number(req.requested_amount).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
