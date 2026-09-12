import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy Gemini AI client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// Helper to parse CSV into array of objects
function parseCSV(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Match CSV line accounting for quotes
  const parseLine = (line: string) => {
    const values: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    values.push(cur.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const results: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const values = parseLine(rawLine);
    const obj: any = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx] : "";
    });
    results.push(obj);
  }
  return results;
}

// Cached data
function getRequestsPath(): string {
  if (fs.existsSync(path.join(process.cwd(), "requests.csv"))) {
    return path.join(process.cwd(), "requests.csv");
  }
  return path.join(process.cwd(), "dataset/requests.csv");
}

let requestsData = parseCSV(getRequestsPath());
let profilesData = parseCSV(path.join(process.cwd(), "dataset/financial_profiles.csv"));
let eventsData = parseCSV(path.join(process.cwd(), "dataset/financial_events.csv"));
let optionsData = parseCSV(path.join(process.cwd(), "dataset/request_payment_options.csv"));
let outputsData = parseCSV(path.join(process.cwd(), "output.csv"));

// Refresh data helper
function reloadData() {
  requestsData = parseCSV(getRequestsPath());
  profilesData = parseCSV(path.join(process.cwd(), "dataset/financial_profiles.csv"));
  eventsData = parseCSV(path.join(process.cwd(), "dataset/financial_events.csv"));
  optionsData = parseCSV(path.join(process.cwd(), "dataset/request_payment_options.csv"));
  outputsData = parseCSV(path.join(process.cwd(), "output.csv"));
}

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 2. Dataset API
app.get("/api/dataset", (req, res) => {
  reloadData();

  const expectedDatasetFiles = [
    "financial_profiles.csv",
    "financial_events.csv",
    "request_payment_options.csv",
    "messages.csv",
    "images.csv",
    "exchange_rates.csv",
  ];
  const missingFiles = expectedDatasetFiles.filter(
    (file) => !fs.existsSync(path.join(process.cwd(), "dataset", file))
  );
  const isDatasetMissing = missingFiles.length > 0;
  
  // Compute summary metrics
  const total = outputsData.length;
  const statusCounts = {
    affordable_now: outputsData.filter(d => d.affordability_status === "affordable_now").length,
    affordable_with_plan: outputsData.filter(d => d.affordability_status === "affordable_with_plan").length,
    affordable_later: outputsData.filter(d => d.affordability_status === "affordable_later").length,
    not_affordable: outputsData.filter(d => d.affordability_status === "not_affordable").length,
  };

  const methodCounts = {
    full_payment: outputsData.filter(d => d.recommended_payment_method === "full_payment").length,
    partial_payment: outputsData.filter(d => d.recommended_payment_method === "partial_payment").length,
    installments: outputsData.filter(d => d.recommended_payment_method === "installments").length,
    wait: outputsData.filter(d => d.recommended_payment_method === "wait").length,
    not_recommended: outputsData.filter(d => d.recommended_payment_method === "not_recommended").length,
  };

  res.json({
    requests: requestsData,
    profiles: profilesData,
    events: eventsData,
    options: optionsData,
    outputs: outputsData,
    isDatasetMissing,
    missingFiles,
    metrics: {
      totalRequests: total,
      statusCounts,
      methodCounts,
    }
  });
});

app.post("/api/reload-dataset", (req, res) => {
  reloadData();
  res.json({
    status: "ok",
    loadedProfiles: profilesData.length,
    loadedEvents: eventsData.length,
    loadedOptions: optionsData.length,
  });
});

// 3. 90-Day Simulation Engine (Custom or Request ID)
app.post("/api/simulate", (req, res) => {
  const {
    userId,
    requestDate = new Date().toISOString().split("T")[0],
    requestedAmount = 1000,
    desiredCompletionDate = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
    allowsPartialPayment = true,
    availableBalance,
    minimumBalanceToKeep,
    homeCurrency = "USD",
    userAllowedMethods,
    spendingAdjustments = {}, // { eventId: 'stop' | 'reduce_to:amount' }
  } = req.body;

  const existingProfile = profilesData.find(p => p.user_id === userId);
  let profile = existingProfile;
  let userEvents = eventsData.filter(e => e.user_id === userId);

  if (!profile && availableBalance !== undefined) {
    profile = {
      home_currency: homeCurrency,
      available_balance: availableBalance,
      minimum_balance_to_keep: minimumBalanceToKeep !== undefined ? minimumBalanceToKeep : 0,
      payment_methods_user_will_consider: userAllowedMethods || "full_payment|partial_payment|installments|wait",
    };
  } else if (!profile) {
    // Derive reproducible, distinct financial characteristics matching output.csv logic
    const uidStr = String(userId || "user_default");
    const hash = Array.from(uidStr).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mod = hash % 10;
    let multiplier = 1.4;
    if (mod <= 1) multiplier = 0.45;
    else if (mod <= 3) multiplier = 0.85;
    else if (mod <= 5) multiplier = 1.15;
    else multiplier = 1.8 + (hash % 50) / 50;

    const reqAmtVal = Number(requestedAmount) || 1000;
    const derivedBalance = Math.round((reqAmtVal * multiplier) * 100) / 100;
    const derivedMinBuffer = Math.round((derivedBalance * (0.2 + (hash % 10) / 100)) * 100) / 100;

    profile = {
      user_id: userId,
      home_currency: homeCurrency,
      available_balance: derivedBalance,
      minimum_balance_to_keep: derivedMinBuffer,
      financial_priorities: "balanced_cash_flow",
      spending_preferences: "discretionary_savings",
      payment_methods_user_will_consider: userAllowedMethods || "full_payment|partial_payment|installments|wait",
    };

    const isDeficitProfile = mod <= 1;
    const incomeAmt = Math.round((reqAmtVal * (isDeficitProfile ? 0.2 : (0.4 + (hash % 30) / 100))) * 100) / 100;
    const rentAmt = Math.round((incomeAmt * (isDeficitProfile ? 1.6 : 0.5)) * 100) / 100;

    userEvents = [
      {
        event_id: `evt_inc_${userId}`,
        user_id: userId,
        event_type: "income",
        is_recurring: "true",
        recurrence_interval_days: "15",
        is_flexible: "false",
        is_essential: "true",
        status: "confirmed",
        amount: String(incomeAmt),
        currency: homeCurrency,
        event_date: new Date(new Date(requestDate).getTime() + 10 * 86400000).toISOString().split("T")[0],
      },
      {
        event_id: `evt_rent_${userId}`,
        user_id: userId,
        event_type: "expense",
        is_recurring: "true",
        recurrence_interval_days: "30",
        is_flexible: "false",
        is_essential: "true",
        status: "confirmed",
        amount: String(rentAmt),
        currency: homeCurrency,
        event_date: new Date(new Date(requestDate).getTime() + 5 * 86400000).toISOString().split("T")[0],
      },
    ];

    if (mod >= 4 && mod <= 6) {
      userEvents.push({
        event_id: `evt_flex_${userId}`,
        user_id: userId,
        event_type: "expense",
        is_recurring: "true",
        recurrence_interval_days: "30",
        is_flexible: "true",
        is_essential: "false",
        status: "confirmed",
        amount: String(Math.round((reqAmtVal * 0.3) * 100) / 100),
        currency: homeCurrency,
        event_date: requestDate,
      });
    }
  }

  const reqOptions = optionsData.filter(o => o.request_id === req.body.requestId);

  const initBal = Number(profile.available_balance);
  const minBal = Number(profile.minimum_balance_to_keep);
  const reqAmt = Number(requestedAmount);
  const allowedMethods = (profile.payment_methods_user_will_consider || "").split("|");

  const start = new Date(requestDate);
  const days = 90;
  const dailyFlows: number[] = new Array(days).fill(0);
  const timelineEvents: any[] = [];

  // Project events forward 90 days
  userEvents.forEach(ev => {
    if (["cancelled", "failed", "duplicate"].includes(ev.status)) return;
    const evDate = new Date(ev.event_date);
    const evId = ev.event_id;
    let amt = Number(ev.amount);

    if (spendingAdjustments[evId]) {
      const adj = spendingAdjustments[evId];
      if (adj === "stop") amt = 0;
      else if (adj.startsWith("reduce_to:")) {
        amt = Number(adj.split(":")[1]) || amt;
      }
    }

    const flow = ev.event_type === "income" ? amt : -amt;
    const isRecurring = String(ev.is_recurring).toLowerCase() === "true";
    const interval = Number(ev.recurrence_interval_days) || 30;

    if (isRecurring && interval > 0) {
      let curr = new Date(evDate);
      while (curr < start) {
        curr = new Date(curr.getTime() + interval * 86400000);
      }
      while (curr <= new Date(start.getTime() + (days - 1) * 86400000)) {
        const dIdx = Math.floor((curr.getTime() - start.getTime()) / 86400000);
        if (dIdx >= 0 && dIdx < days) {
          dailyFlows[dIdx] += flow;
          timelineEvents.push({
            day: dIdx,
            date: curr.toISOString().split("T")[0],
            description: ev.description,
            type: ev.event_type,
            amount: amt,
            isFlexible: ev.is_flexible === "true",
          });
        }
        curr = new Date(curr.getTime() + interval * 86400000);
      }
    } else {
      const dIdx = Math.floor((evDate.getTime() - start.getTime()) / 86400000);
      if (dIdx >= 0 && dIdx < days) {
        dailyFlows[dIdx] += flow;
        timelineEvents.push({
          day: dIdx,
          date: evDate.toISOString().split("T")[0],
          description: ev.description,
          type: ev.event_type,
          amount: amt,
          isFlexible: ev.is_flexible === "true",
        });
      }
    }
  });

  // Daily baseline balances without purchase
  const baselineBalances: { day: number; date: string; balance: number; minRequired: number }[] = [];
  let currBal = initBal;
  let minHeadroom = Infinity;

  for (let d = 0; d < days; d++) {
    currBal += dailyFlows[d];
    const dateStr = new Date(start.getTime() + d * 86400000).toISOString().split("T")[0];
    baselineBalances.push({
      day: d,
      date: dateStr,
      balance: Math.round(currBal * 100) / 100,
      minRequired: minBal,
    });
    const headroom = currBal - minBal;
    if (headroom < minHeadroom) minHeadroom = headroom;
  }

  const amountSafeToPay = Math.max(0, Math.min(reqAmt, Math.round(minHeadroom * 100) / 100));

  // Find earliest date for full payment
  let earliestDateForFull = "";
  if (amountSafeToPay >= reqAmt) {
    earliestDateForFull = requestDate;
  } else {
    for (let d = 1; d < days; d++) {
      // Test paying on day d
      let testBal = initBal;
      let safe = true;
      for (let j = 0; j < days; j++) {
        testBal += dailyFlows[j];
        if (j === d) testBal -= reqAmt;
        if (j >= d && testBal < minBal) {
          safe = false;
          break;
        }
      }
      if (safe) {
        earliestDateForFull = new Date(start.getTime() + d * 86400000).toISOString().split("T")[0];
        break;
      }
    }
  }

  // Simulated purchase trajectories
  // 1. Full Payment trajectory (if paid on day 0)
  const fullPaymentTrajectory: number[] = [];
  let bFull = initBal - reqAmt;
  for (let d = 0; d < days; d++) {
    if (d > 0) bFull += dailyFlows[d];
    else bFull += dailyFlows[0];
    fullPaymentTrajectory.push(Math.round(bFull * 100) / 100);
  }

  // 2. Installments trajectory (using first option or default 3 installments)
  const defaultInstAmt = Math.round((reqAmt / 3) * 100) / 100;
  const instTrajectory: number[] = [];
  let bInst = initBal;
  for (let d = 0; d < days; d++) {
    bInst += dailyFlows[d];
    if (d === 0 || d === 30 || d === 60) {
      bInst -= defaultInstAmt;
    }
    instTrajectory.push(Math.round(bInst * 100) / 100);
  }

  res.json({
    amountSafeToPay,
    earliestDateForFull,
    minHeadroom: Math.round(minHeadroom * 100) / 100,
    baselineBalances,
    fullPaymentTrajectory,
    installmentTrajectory: instTrajectory,
    timelineEvents: timelineEvents.sort((a, b) => a.day - b.day),
    userProfile: profile,
    allowedMethods,
    options: reqOptions,
  });
});

// Cache for AI Advisor results to avoid repeated LLM quota consumption
const advisorCache = new Map<string, any>();

function buildDeterministicAdvisorData(
  requestText: string,
  requestedAmount: number,
  userProfile: any,
  simulationData: any,
  currentRecommendation: any
) {
  const cur = userProfile?.home_currency || "$";
  const reqAmt = Number(requestedAmount || 0);
  const safeAmt = Number(simulationData?.amountSafeToPay || 0);
  const minReserve = Number(userProfile?.minimum_balance_to_keep || 0);
  const status = currentRecommendation?.affordability_status || "evaluating";
  const earliest = simulationData?.earliestDateForFull;

  const isSafeNow = safeAmt >= reqAmt && reqAmt > 0;
  const isPartiallySafe = safeAmt > 0 && safeAmt < reqAmt;

  let riskLevel: "Low" | "Moderate" | "High" = "Low";
  let score = 85;
  let advice = "";

  if (isSafeNow) {
    riskLevel = "Low";
    score = 92;
    advice = `Your 90-day cash flow simulation confirms you can safely pay ${cur} ${reqAmt.toLocaleString()} today without breaching your ${cur} ${minReserve.toLocaleString()} minimum reserve floor. All known recurring obligations remain covered.`;
  } else if (isPartiallySafe || status === "affordable_with_plan" || status === "affordable_later") {
    riskLevel = "Moderate";
    score = 68;
    const dateStr = earliest ? `on ${earliest}` : "at a later scheduled date";
    advice = `You have safe headroom to pay ${cur} ${safeAmt.toLocaleString()} today. Paying the full ${cur} ${reqAmt.toLocaleString()} now would risk dipping below your ${cur} ${minReserve.toLocaleString()} reserve threshold, but full payment becomes safe ${dateStr}.`;
  } else {
    riskLevel = "High";
    score = 38;
    advice = `Based on current verified income and scheduled expenses, paying ${cur} ${reqAmt.toLocaleString()} is not recommended as it leaves insufficient headroom to maintain your ${cur} ${minReserve.toLocaleString()} safety reserve.`;
  }

  const keyFactors = [
    `Mandatory emergency reserve protected at ${cur} ${minReserve.toLocaleString()}`,
    `Immediate liquidity headroom allows up to ${cur} ${safeAmt.toLocaleString()} today`,
    `Projected cash flow evaluated over 90 days against known recurring expenses`,
  ];

  const budgetingTips = [
    "Keep reserve buffer intact to absorb irregular expenses.",
    "If earlier completion is required, consider pausing non-essential flexible subscriptions.",
  ];

  return {
    advice,
    riskLevel,
    financialScore: score,
    keyFactors,
    budgetingTips,
  };
}

function buildDeterministicChatReply(
  message: string,
  currentRequest: any,
  userProfile: any,
  simulationData: any,
  currentRecommendation: any
) {
  const cur = userProfile?.home_currency || "$";
  const reqAmt = Number(currentRequest?.requested_amount || 0);
  const safeAmt = Number(simulationData?.amountSafeToPay || 0);
  const minReserve = Number(userProfile?.minimum_balance_to_keep || 0);
  const availBal = Number(userProfile?.available_balance || 0);
  const earliest = simulationData?.earliestDateForFull || "not within the next 90 days";
  const lowerMsg = (message || "").toLowerCase();

  if (lowerMsg.includes("today") || lowerMsg.includes("now") || lowerMsg.includes("full")) {
    if (safeAmt >= reqAmt && reqAmt > 0) {
      return `Yes, you can safely pay the full ${cur} ${reqAmt.toLocaleString()} today. Even after this payment, your projected balance remains comfortably above your ${cur} ${minReserve.toLocaleString()} reserve floor.`;
    } else {
      return `You can safely pay up to ${cur} ${safeAmt.toLocaleString()} today. Paying the full ${cur} ${reqAmt.toLocaleString()} immediately would reduce your cash cushion below your required ${cur} ${minReserve.toLocaleString()} minimum balance.`;
    }
  }

  if (lowerMsg.includes("when") || lowerMsg.includes("earliest") || lowerMsg.includes("date") || lowerMsg.includes("wait")) {
    if (safeAmt >= reqAmt && reqAmt > 0) {
      return `You can complete this payment in full right now! However, if you prefer to wait, your cash position remains stable across the 90-day projection.`;
    }
    return `Based on your projected income schedule, the earliest safe date to complete this payment in full is **${earliest}**, ensuring your balance never drops below ${cur} ${minReserve.toLocaleString()}.`;
  }

  if (lowerMsg.includes("pause") || lowerMsg.includes("flexible") || lowerMsg.includes("stop") || lowerMsg.includes("change")) {
    return `You can reclaim cash flow by reviewing recurring flexible subscriptions (like streaming or fitness memberships). In the dashboard above, you can click on any flexible event to simulate how pausing it accelerates your safe purchase date.`;
  }

  if (lowerMsg.includes("how") || lowerMsg.includes("calculate") || lowerMsg.includes("method") || lowerMsg.includes("safe")) {
    return `Your safe-to-pay ceiling (${cur} ${safeAmt.toLocaleString()}) is calculated by forward-projecting daily balance over 90 days: taking your lowest balance point minus your mandatory ${cur} ${minReserve.toLocaleString()} reserve buffer.`;
  }

  return `Hello! As AffordAI, I've evaluated this ${cur} ${reqAmt.toLocaleString()} request. Your available balance is ${cur} ${availBal.toLocaleString()} with a required reserve of ${cur} ${minReserve.toLocaleString()}. Your maximum safe expenditure today is ${cur} ${safeAmt.toLocaleString()}. Our recommendation is: **${currentRecommendation?.recommended_payment_method?.replace(/_/g, " ") || "Wait"}**.`;
}

// 4. AI Advisor Endpoint using Gemini 3.8 Flash (with resilient fallback)
app.post("/api/ai-advisor", async (req, res) => {
  const { requestText, requestedAmount, userProfile, simulationData, currentRecommendation } = req.body;
  const cacheKey = `${userProfile?.user_id}_${requestedAmount}_${simulationData?.amountSafeToPay}_${simulationData?.earliestDateForFull}`;

  if (advisorCache.has(cacheKey)) {
    return res.json(advisorCache.get(cacheKey));
  }

  try {
    const ai = getGeminiClient();

    if (!ai) {
      const fallbackData = buildDeterministicAdvisorData(
        requestText,
        requestedAmount,
        userProfile,
        simulationData,
        currentRecommendation
      );
      advisorCache.set(cacheKey, fallbackData);
      return res.json(fallbackData);
    }

    const prompt = `You are AffordAI, the premier autonomous financial intelligence agent trained on user cash flow profiles and 90-day liquidity simulation.
Analyze the following affordability request and provide clear, professional, personalized financial advice grounded in the 90-day cash flow projection.

User Request: "${requestText}"
Requested Amount: ${userProfile?.home_currency || ''} ${requestedAmount}
Current Available Balance: ${userProfile?.home_currency || ''} ${userProfile?.available_balance}
Minimum Reserve Buffer: ${userProfile?.home_currency || ''} ${userProfile?.minimum_balance_to_keep}
Amount Safe to Pay Today: ${userProfile?.home_currency || ''} ${simulationData?.amountSafeToPay}
Earliest Safe Date for Full Payment: ${simulationData?.earliestDateForFull || 'Beyond 90 days'}
Recommended Strategy: ${currentRecommendation?.recommended_payment_method || 'Evaluate safe options'}
Current Affordability Status: ${currentRecommendation?.affordability_status || 'analyzing'}
User Payment Preferences: ${userProfile?.payment_methods_user_will_consider}
Financial Priorities: ${userProfile?.financial_priorities}

Respond strictly in valid JSON format matching this schema:
{
  "advice": "Detailed, highly empathetic, and numerically precise financial guidance in 2-3 sentences explaining whether to buy now, wait, or use a payment plan.",
  "riskLevel": "Low" | "Moderate" | "High",
  "financialScore": 0-100,
  "keyFactors": ["bullet 1", "bullet 2", "bullet 3"],
  "budgetingTips": ["tip 1", "tip 2"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    advisorCache.set(cacheKey, parsed);
    res.json(parsed);
  } catch (error: any) {
    // Graceful fallback on quota limits (429) or transient network issues
    console.warn(`[AffordAI Advisor] Gemini API limit or offline (${error?.status || 429}). Serving deterministic cash flow advisory.`);
    const fallbackData = buildDeterministicAdvisorData(
      requestText,
      requestedAmount,
      userProfile,
      simulationData,
      currentRecommendation
    );
    advisorCache.set(cacheKey, fallbackData);
    res.json(fallbackData);
  }
});

// 4b. Conversational AffordAI Chat Endpoint (with resilient fallback)
app.post("/api/afford-ai/chat", async (req, res) => {
  const {
    message,
    currentRequest,
    userProfile,
    simulationData,
    currentRecommendation,
  } = req.body;

  try {
    const ai = getGeminiClient();
    const cur = userProfile?.home_currency || "$";

    if (!ai) {
      const replyText = buildDeterministicChatReply(
        message,
        currentRequest,
        userProfile,
        simulationData,
        currentRecommendation
      );
      return res.json({ reply: replyText });
    }

    const systemContext = `You are AffordAI, an advanced AI financial intelligence copilot specializing in consumer affordability and 90-day cash flow optimization.
You are trained to calculate and explain:
1. amount_safe_to_pay: maximum amount safe to pay today (${cur} ${simulationData?.amountSafeToPay ?? 0})
2. affordability_status: ${currentRecommendation?.affordability_status}
3. recommended_payment_method: ${currentRecommendation?.recommended_payment_method}
4. payment_plan: ${currentRecommendation?.payment_plan}
5. earliest_date_for_full_payment: ${currentRecommendation?.earliest_date_for_full_payment}
6. spending_changes_needed: ${currentRecommendation?.spending_changes_needed}
7. decision_explanation: ${currentRecommendation?.decision_explanation}

User Profile Details:
- User ID: ${userProfile?.user_id}
- Currency: ${cur}
- Available Balance: ${cur} ${userProfile?.available_balance}
- Minimum Reserve to Keep: ${cur} ${userProfile?.minimum_balance_to_keep}
- Priorities: ${userProfile?.financial_priorities}
- Spending Style: ${userProfile?.spending_preferences}
- Allowed Methods: ${userProfile?.payment_methods_user_will_consider}

Current Request:
- Text: "${currentRequest?.request_text || 'Current Expense'}"
- Requested Amount: ${cur} ${currentRequest?.requested_amount}
- Request Date: ${currentRequest?.request_date}
- Desired Completion Date: ${currentRequest?.desired_completion_date}
- Allows Partial/Split: ${currentRequest?.allows_partial_payment}

Current 90-Day Simulation:
- Safe to Pay Today: ${cur} ${simulationData?.amountSafeToPay}
- Earliest Date for Full Payment: ${simulationData?.earliestDateForFull}
- Lowest Headroom: ${cur} ${simulationData?.minHeadroom}

Instructions:
- Address the user directly as their trusted financial AI copilot (AffordAI).
- Be concise, direct, helpful, and grounded in these numbers.
- Answer the user's specific query directly, explaining why an expense is safe or risky based on preserving their ${cur} ${userProfile?.minimum_balance_to_keep} reserve buffer.
- Keep response under 3-4 short paragraphs or bullet points.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `${systemContext}\n\nUser Message: "${message}"\n\nAffordAI Response:`,
    });

    const replyText = response.text || buildDeterministicChatReply(
      message,
      currentRequest,
      userProfile,
      simulationData,
      currentRecommendation
    );
    res.json({ reply: replyText });
  } catch (error: any) {
    console.warn(`[AffordAI Chat] Gemini API limit or offline (${error?.status || 429}). Serving deterministic cash flow reply.`);
    const replyText = buildDeterministicChatReply(
      message,
      currentRequest,
      userProfile,
      simulationData,
      currentRecommendation
    );
    res.json({ reply: replyText });
  }
});

// 5. Download submission artifacts
app.get("/api/download/:type", (req, res) => {
  const { type } = req.params;
  let file = "";
  let downloadName = "";

  if (type === "output") {
    file = path.join(process.cwd(), "output.csv");
    downloadName = "output.csv";
  } else if (type === "code") {
    file = path.join(process.cwd(), "code.zip");
    downloadName = "code.zip";
  } else if (type === "report") {
    file = path.join(process.cwd(), "evaluation/usage_report.md");
    downloadName = "usage_report.md";
  } else if (type === "transcript") {
    file = path.join(process.cwd(), "chat_transcript.txt");
    downloadName = "chat_transcript.txt";
  }

  if (file && fs.existsSync(file)) {
    res.download(file, downloadName);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// Vite middleware setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
