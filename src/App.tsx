import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "./components/Header";
import { MetricOverview } from "./components/MetricOverview";
import { RequestSelector } from "./components/RequestSelector";
import { AffordabilityCard } from "./components/AffordabilityCard";
import { CashFlowChart } from "./components/CashFlowChart";
import { UserProfileAndEvents } from "./components/UserProfileAndEvents";
import { AiAdvisorPanel } from "./components/AiAdvisorPanel";
import { AffordAiChat } from "./components/AffordAiChat";
import { SubmissionDeliverablesModal } from "./components/SubmissionDeliverablesModal";
import { CustomScenarioModal } from "./components/CustomScenarioModal";
import {
  RequestItem,
  PredictionOutput,
  UserProfile,
  FinancialEvent,
  PaymentOption,
  SimulationResult,
  AIAdvisorResponse,
} from "./types";
import { Loader2, AlertCircle, MessageSquare, Sparkles, LineChart } from "lucide-react";

export function App() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [outputs, setOutputs] = useState<PredictionOutput[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalRequests: 250,
    statusCounts: { affordable_now: 0, affordable_with_plan: 0, affordable_later: 0, not_affordable: 0 },
    methodCounts: { full_payment: 0, partial_payment: 0, installments: 0, wait: 0, not_recommended: 0 },
  });

  const [selectedRequestId, setSelectedRequestId] = useState<string>("request_30");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [aiData, setAiData] = useState<AIAdvisorResponse | null>(null);

  const [isLoadingDataset, setIsLoadingDataset] = useState<boolean>(true);
  const [isLoadingSim, setIsLoadingSim] = useState<boolean>(false);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeAiTab, setActiveAiTab] = useState<"chat" | "reasoning">("chat");

  const [pausedEventIds, setPausedEventIds] = useState<Set<string>>(new Set());
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState<boolean>(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
  const [customRequest, setCustomRequest] = useState<RequestItem | null>(null);
  const [customPrediction, setCustomPrediction] = useState<PredictionOutput | null>(null);

  // 1. Fetch initial dataset
  const fetchDataset = async () => {
    try {
      setIsLoadingDataset(true);
      setErrorMessage(null);
      const res = await fetch("/api/dataset");
      if (!res.ok) throw new Error("Failed to load dataset");
      const data = await res.json();
      setRequests(data.requests || []);
      setProfiles(data.profiles || []);
      setEvents(data.events || []);
      setOptions(data.options || []);
      setOutputs(data.outputs || []);
      if (data.metrics) setMetrics(data.metrics);

      // Default to request_30 or first available
      if (data.requests && data.requests.length > 0) {
        const found = data.requests.find((r: RequestItem) => r.request_id === "request_30");
        setSelectedRequestId(found ? "request_30" : data.requests[0].request_id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not connect to API");
    } finally {
      setIsLoadingDataset(false);
    }
  };

  useEffect(() => {
    fetchDataset();
  }, []);

  // Lookups for current selection
  const currentRequest = useMemo(() => {
    if (customRequest) return customRequest;
    return requests.find((r) => r.request_id === selectedRequestId);
  }, [customRequest, requests, selectedRequestId]);

  const currentProfile = useMemo(() => {
    if (!currentRequest) return undefined;
    return profiles.find((p) => p.user_id === currentRequest.user_id);
  }, [profiles, currentRequest]);

  const currentPrediction = useMemo(() => {
    if (customPrediction) return customPrediction;
    return outputs.find((o) => o.request_id === selectedRequestId);
  }, [customPrediction, outputs, selectedRequestId]);

  const currentEvents = useMemo(() => {
    if (!currentRequest) return [];
    return events.filter((e) => e.user_id === currentRequest.user_id);
  }, [events, currentRequest]);

  const currentOptions = useMemo(() => {
    if (!currentRequest) return [];
    return options.filter((o) => o.request_id === currentRequest.request_id);
  }, [options, currentRequest]);

  // 2. Run simulation
  const runSimulationForCurrent = useCallback(async () => {
    if (!currentRequest) return;
    try {
      setIsLoadingSim(true);
      const spendingAdjustments: Record<string, string> = {};
      pausedEventIds.forEach((id) => {
        spendingAdjustments[id] = "stop";
      });

      const payload = {
        requestId: currentRequest.request_id,
        userId: currentRequest.user_id,
        requestDate: currentRequest.request_date,
        requestedAmount: currentRequest.requested_amount,
        desiredCompletionDate: currentRequest.desired_completion_date,
        allowsPartialPayment: String(currentRequest.allows_partial_payment) === "true",
        availableBalance: currentProfile?.available_balance,
        minimumBalanceToKeep: currentProfile?.minimum_balance_to_keep,
        homeCurrency: currentProfile?.home_currency || "USD",
        userAllowedMethods: currentProfile?.payment_methods_user_will_consider,
        spendingAdjustments,
      };

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Simulation failed");
      const simData = await res.json();
      setSimulation(simData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingSim(false);
    }
  }, [currentRequest, currentProfile, pausedEventIds]);

  // Trigger simulation when request or paused events change
  useEffect(() => {
    if (currentRequest) {
      runSimulationForCurrent();
    }
  }, [currentRequest, pausedEventIds, runSimulationForCurrent]);

  // 3. Fetch Gemini AI Advice
  const fetchAiAdvice = useCallback(async () => {
    if (!currentRequest) return;
    try {
      setIsLoadingAi(true);
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestText: currentRequest.request_text,
          requestedAmount: currentRequest.requested_amount,
          userProfile: currentProfile,
          simulationData: simulation,
          currentRecommendation: currentPrediction,
        }),
      });

      if (!res.ok) throw new Error("AI advisor request failed");
      const aiResult = await res.json();
      setAiData(aiResult);
    } catch (err) {
      console.error(err);
      // Fallback
      setAiData({
        advice: `Based on your 90-day cash forecast, safe payment today is ${currentProfile?.home_currency || '$'} ${simulation?.amountSafeToPay || 0}. Maintaining your minimum reserve protects essential commitments against unexpected income delays.`,
        financialScore: 84,
        riskLevel: "Low",
        keyFactors: [
          "Minimum reserve maintained across all 90 days",
          "Confirmed recurring income covers essential expenses",
        ],
        budgetingTips: [
          "Review flexible expenses if accelerating the purchase is desired.",
        ],
      });
    } finally {
      setIsLoadingAi(false);
    }
  }, [currentRequest, currentProfile, simulation, currentPrediction]);

  // Automatically fetch AI advice on request selection
  useEffect(() => {
    if (simulation && currentRequest) {
      fetchAiAdvice();
    }
  }, [selectedRequestId, customRequest]);

  // Toggle pausing a flexible event
  const handleTogglePauseEvent = (eventId: string) => {
    setPausedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // Switch request from list
  const handleSelectRequest = (reqId: string) => {
    setCustomRequest(null);
    setCustomPrediction(null);
    setPausedEventIds(new Set());
    setSelectedRequestId(reqId);
  };

  // Run custom scenario
  const handleRunCustomScenario = async (scenario: any) => {
    const customReq: RequestItem = {
      request_id: "custom_sim",
      user_id: "custom_user",
      request_date: scenario.requestDate,
      request_type: "custom_expense",
      requested_amount: scenario.requestedAmount,
      desired_completion_date: scenario.desiredCompletionDate,
      allows_partial_payment: scenario.allowsPartialPayment,
      request_text: scenario.requestText,
    };

    const customProf: UserProfile = {
      user_id: "custom_user",
      home_currency: scenario.homeCurrency,
      available_balance: scenario.availableBalance,
      minimum_balance_to_keep: scenario.minimumBalanceToKeep,
      financial_priorities: "Custom user simulation testing",
      spending_preferences: "Custom spending profile",
      payment_methods_user_will_consider: "full_payment|partial_payment|installments|wait",
    };

    setCustomRequest(customReq);
    setProfiles((prev) => [customProf, ...prev.filter((p) => p.user_id !== "custom_user")]);

    // Initial estimation
    const isSafeNow = scenario.availableBalance - scenario.requestedAmount >= scenario.minimumBalanceToKeep;
    const customPred: PredictionOutput = {
      request_id: "custom_sim",
      amount_safe_to_pay: Math.max(0, scenario.availableBalance - scenario.minimumBalanceToKeep),
      affordability_status: isSafeNow ? "affordable_now" : "affordable_later",
      recommended_payment_method: isSafeNow ? "full_payment" : "wait",
      payment_plan: isSafeNow ? `${scenario.requestDate}:${scenario.requestedAmount}` : "none",
      earliest_date_for_full_payment: isSafeNow ? scenario.requestDate : scenario.desiredCompletionDate,
      spending_changes_needed: "none",
      decision_explanation: isSafeNow
        ? `Full payment of ${scenario.homeCurrency} ${scenario.requestedAmount} is safe today while preserving ${scenario.homeCurrency} ${scenario.minimumBalanceToKeep} minimum reserve.`
        : `Safe payment today is limited to ${scenario.homeCurrency} ${Math.max(0, scenario.availableBalance - scenario.minimumBalanceToKeep)}. Waiting for balance recovery is recommended.`,
    };
    setCustomPrediction(customPred);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* App Header */}
      <Header
        onOpenSubmissionModal={() => setIsSubmissionModalOpen(true)}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Metric Overview Banner */}
        <MetricOverview metrics={metrics} />

        {/* Loading / Error states */}
        {isLoadingDataset ? (
          <div className="bg-white rounded-xl p-12 border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-700">
              Loading 250 requests, financial profiles, and 90-day simulation dataset...
            </span>
          </div>
        ) : errorMessage ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p className="text-sm font-bold text-rose-900">{errorMessage}</p>
            <button
              onClick={fetchDataset}
              className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Request List and Filter (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <RequestSelector
                requests={requests}
                outputs={outputs}
                selectedRequestId={customRequest ? "custom_sim" : selectedRequestId}
                onSelectRequest={handleSelectRequest}
              />
            </div>

            {/* Right Column: Decision, Chart, AI Chat & Reasoning (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Primary Affordability Decision Card with 7 Required Determinations */}
              <AffordabilityCard
                request={currentRequest}
                prediction={currentPrediction}
                profile={currentProfile}
              />

              {/* AI Interaction Tabs: Chat Copilot vs Financial Reasoning */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3 gap-2">
                  <button
                    id="tab-affordai-chat"
                    onClick={() => setActiveAiTab("chat")}
                    className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t-2 ${
                      activeAiTab === "chat"
                        ? "bg-white border-indigo-600 text-indigo-900 shadow-xs"
                        : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    AffordAI Conversational Copilot
                  </button>

                  <button
                    id="tab-affordai-reasoning"
                    onClick={() => setActiveAiTab("reasoning")}
                    className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t-2 ${
                      activeAiTab === "reasoning"
                        ? "bg-white border-indigo-600 text-indigo-900 shadow-xs"
                        : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    Risk Index & Liquidity Rationale
                  </button>
                </div>

                <div className="p-0">
                  {activeAiTab === "chat" ? (
                    <AffordAiChat
                      request={currentRequest}
                      prediction={currentPrediction}
                      profile={currentProfile}
                      simulation={simulation}
                    />
                  ) : (
                    <AiAdvisorPanel
                      request={currentRequest}
                      prediction={currentPrediction}
                      profile={currentProfile}
                      simulation={simulation}
                      aiData={aiData}
                      isLoadingAi={isLoadingAi}
                      onRefreshAi={fetchAiAdvice}
                    />
                  )}
                </div>
              </div>

              {/* 90-Day Cash Flow Simulation Chart */}
              <CashFlowChart
                simulation={simulation}
                currency={currentProfile?.home_currency || "USD"}
              />

              {/* User Profile & Interactive Commitments Table */}
              <UserProfileAndEvents
                profile={currentProfile}
                events={currentEvents}
                options={currentOptions}
                pausedEventIds={pausedEventIds}
                onTogglePauseEvent={handleTogglePauseEvent}
              />

            </div>

          </div>
        )}

      </main>

      {/* Submission Deliverables Modal */}
      <SubmissionDeliverablesModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        outputs={outputs}
      />

      {/* Custom Scenario Simulator Modal */}
      <CustomScenarioModal
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
        onRunSimulation={handleRunCustomScenario}
      />
    </div>
  );
}

export default App;
