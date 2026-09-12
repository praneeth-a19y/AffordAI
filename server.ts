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
let requestsData = parseCSV(path.join(process.cwd(), "dataset/requests.csv"));
let profilesData = parseCSV(path.join(process.cwd(), "dataset/financial_profiles.csv"));
let eventsData = parseCSV(path.join(process.cwd(), "dataset/financial_events.csv"));
let optionsData = parseCSV(path.join(process.cwd(), "dataset/request_payment_options.csv"));
let outputsData = parseCSV(path.join(process.cwd(), "output.csv"));

// Refresh data helper
function reloadData() {
  requestsData = parseCSV(path.join(process.cwd(), "dataset/requests.csv"));
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
    metrics: {
      totalRequests: total,
      statusCounts,
      methodCounts,
    }
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

  const profile = profilesData.find(p => p.user_id === userId) || {
    home_currency: homeCurrency,
    available_balance: availableBalance !== undefined ? availableBalance : requestedAmount * 1.5,
    minimum_balance_to_keep: minimumBalanceToKeep !== undefined ? minimumBalanceToKeep : requestedAmount * 0.25,
    payment_methods_user_will_consider: userAllowedMethods || "full_payment|partial_payment|installments|wait",
  };

  const userEvents = eventsData.filter(e => e.user_id === userId);
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

// 4. AI Advisor Endpoint using Gemini 3.8 Flash
app.post("/api/ai-advisor", async (req, res) => {
  try {
    const { requestText, requestedAmount, userProfile, simulationData, currentRecommendation } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        advice: `Based on deterministic 90-day cash flow analysis, your current headroom permits paying up to ${userProfile?.home_currency || '$'} ${simulationData?.amountSafeToPay || 0} today. Maintaining a safety reserve of ${userProfile?.home_currency || '$'} ${userProfile?.minimum_balance_to_keep || 0} is essential to weather upcoming recurring obligations.`,
        financialScore: 82,
        riskLevel: simulationData?.amountSafeToPay >= requestedAmount ? "Low" : "Moderate",
        keyFactors: [
          `90-day reserve floor protected at ${userProfile?.home_currency || '$'} ${userProfile?.minimum_balance_to_keep || 0}`,
          `Safe expenditure ceiling calculated from verified cash flow headroom`,
          `Essential recurring expenses accounted for in timeline`
        ],
        budgetingTips: [
          "Preserve emergency buffer above minimum liquidity threshold.",
          "Prioritize interest-free installments if immediate cash flow is required for upcoming obligations.",
          "Review flexible entertainment subscriptions if advancing full payment date is desired."
        ]
      });
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
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini advisor error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI advice" });
  }
});

// 4b. Conversational AffordAI Chat Endpoint
app.post("/api/afford-ai/chat", async (req, res) => {
  try {
    const {
      message,
      currentRequest,
      userProfile,
      simulationData,
      currentRecommendation,
    } = req.body;

    const ai = getGeminiClient();
    const cur = userProfile?.home_currency || "$";

    if (!ai) {
      // Fallback deterministic response
      return res.json({
        reply: `Hello! I am AffordAI. Looking at your financial profile, you have an available balance of ${cur} ${Number(userProfile?.available_balance || 0).toLocaleString()} with a required minimum buffer of ${cur} ${Number(userProfile?.minimum_balance_to_keep || 0).toLocaleString()}. For this request (${cur} ${Number(currentRequest?.requested_amount || 0).toLocaleString()}), you can safely spend up to ${cur} ${Number(simulationData?.amountSafeToPay || 0).toLocaleString()} today. The recommendation is "${currentRecommendation?.recommended_payment_method?.replace(/_/g, ' ') || 'wait'}". Let me know if you want to explore pausing flexible expenses!`,
      });
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

    const replyText = response.text || "I am analyzing your cash flow projection to ensure your reserve buffer remains safe.";
    res.json({ reply: replyText });
  } catch (error: any) {
    console.error("AffordAI chat error:", error);
    res.status(500).json({ error: error.message || "Failed to process AffordAI chat" });
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
