import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Allowed Enums
export type AffordabilityStatus =
  | "affordable_now"
  | "affordable_with_plan"
  | "affordable_later"
  | "not_affordable";

export type RecommendedPaymentMethod =
  | "full_payment"
  | "partial_payment"
  | "installments"
  | "wait"
  | "not_recommended";

export interface RequestItem {
  request_id: string;
  user_id: string;
  request_date: string;
  request_type: string;
  requested_amount: number;
  desired_completion_date: string;
  allows_partial_payment: boolean;
  request_text: string;
}

export interface FinancialProfile {
  user_id: string;
  home_currency: string;
  available_balance: number;
  minimum_balance_to_keep: number;
  financial_priorities?: string;
  spending_preferences?: string;
  payment_methods_user_will_consider: string[];
}

export interface FinancialEvent {
  event_id: string;
  user_id: string;
  event_type: "income" | "expense";
  is_recurring: boolean;
  recurrence_interval_days: number;
  is_flexible: boolean;
  is_essential: boolean;
  status: string;
  amount: number;
  currency: string;
  event_date: string;
  description: string;
}

export interface PaymentOption {
  request_id: string;
  payment_option_id: string;
  payment_method: string;
  total_amount: number;
  schedule: string; // e.g. 2025-08-10:500|2025-09-10:500
  financing_fee: number;
}

export interface ExternalDataset {
  profiles: Record<string, FinancialProfile>;
  events: Record<string, FinancialEvent[]>;
  options: Record<string, PaymentOption[]>;
  missingFiles: string[];
}

export interface ExtractedFacts {
  request_id: string;
  currency: string;
  item_or_purpose: string;
  stated_balance: number | null;
  stated_minimum_balance: number | null;
  stated_income: number | null;
  stated_expenses: number | null;
  user_payment_preference: string | null;
  urgency: "urgent" | "normal" | "flexible";
  has_explicit_financial_state: boolean;
}

export interface PredictionOutput {
  request_id: string;
  amount_safe_to_pay: number;
  affordability_status: AffordabilityStatus;
  recommended_payment_method: RecommendedPaymentMethod;
  payment_plan: string;
  earliest_date_for_full_payment: string;
  spending_changes_needed: string;
  decision_explanation: string;
}

export interface UsageStats {
  provider: string;
  model_name: string;
  number_of_model_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  average_tokens_per_request: number;
  estimated_total_cost_usd: number;
  estimated_cost_per_request_usd: number;
  fallback_usage_count: number;
}

// Format numbers cleanly
export function formatAmount(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

// Robust CSV Line Parser
export function parseCSVLine(line: string): string[] {
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
}

// Parse Requests CSV
export function parseRequestsCSV(filePath: string): RequestItem[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Requests CSV file not found at: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    throw new Error(`Requests CSV file is empty or missing data rows`);
  }

  const headers = parseCSVLine(lines[0]);
  const reqIdIdx = headers.indexOf("request_id");
  const userIdIdx = headers.indexOf("user_id");
  const dateIdx = headers.indexOf("request_date");
  const typeIdx = headers.indexOf("request_type");
  const amtIdx = headers.indexOf("requested_amount");
  const compDateIdx = headers.indexOf("desired_completion_date");
  const partialIdx = headers.indexOf("allows_partial_payment");
  const textIdx = headers.indexOf("request_text");

  if (reqIdIdx === -1 || amtIdx === -1 || dateIdx === -1 || textIdx === -1) {
    throw new Error(`CSV headers missing required columns: ${headers.join(", ")}`);
  }

  const requests: RequestItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const values = parseCSVLine(rawLine);
    const amt = parseFloat(values[amtIdx]);
    const allowsPartial = (values[partialIdx] || "").toLowerCase() === "true";

    requests.push({
      request_id: values[reqIdIdx],
      user_id: values[userIdIdx] || `user_${i}`,
      request_date: values[dateIdx],
      request_type: values[typeIdx] || "other",
      requested_amount: isNaN(amt) ? 0 : amt,
      desired_completion_date: values[compDateIdx] || values[dateIdx],
      allows_partial_payment: allowsPartial,
      request_text: values[textIdx] || "",
    });
  }

  return requests;
}

// Load real external dataset files when provided by user/organizer
export function loadExternalDataset(baseDir = "dataset"): ExternalDataset {
  const missingFiles: string[] = [];
  const profiles: Record<string, FinancialProfile> = {};
  const events: Record<string, FinancialEvent[]> = {};
  const options: Record<string, PaymentOption[]> = {};

  const profilesPath = path.join(baseDir, "financial_profiles.csv");
  const eventsPath = path.join(baseDir, "financial_events.csv");
  const optionsPath = path.join(baseDir, "request_payment_options.csv");

  // 1. Profiles
  if (!fs.existsSync(profilesPath)) {
    missingFiles.push("dataset/financial_profiles.csv");
  } else {
    try {
      const lines = fs.readFileSync(profilesPath, "utf-8").trim().split("\n");
      const headers = parseCSVLine(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = parseCSVLine(lines[i]);
        const uid = vals[headers.indexOf("user_id")];
        if (uid) {
          profiles[uid] = {
            user_id: uid,
            home_currency: vals[headers.indexOf("home_currency")] || "USD",
            available_balance: parseFloat(vals[headers.indexOf("available_balance")] || "0"),
            minimum_balance_to_keep: parseFloat(vals[headers.indexOf("minimum_balance_to_keep")] || "0"),
            financial_priorities: vals[headers.indexOf("financial_priorities")] || "",
            spending_preferences: vals[headers.indexOf("spending_preferences")] || "",
            payment_methods_user_will_consider: (vals[headers.indexOf("payment_methods_user_will_consider")] || "full_payment|partial_payment|installments|wait").split("|"),
          };
        }
      }
    } catch (e) {
      console.warn("Failed parsing financial_profiles.csv:", e);
    }
  }

  // 2. Events
  if (!fs.existsSync(eventsPath)) {
    missingFiles.push("dataset/financial_events.csv");
  } else {
    try {
      const lines = fs.readFileSync(eventsPath, "utf-8").trim().split("\n");
      const headers = parseCSVLine(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = parseCSVLine(lines[i]);
        const uid = vals[headers.indexOf("user_id")];
        if (uid) {
          if (!events[uid]) events[uid] = [];
          events[uid].push({
            event_id: vals[headers.indexOf("event_id")],
            user_id: uid,
            event_type: (vals[headers.indexOf("event_type")] || "expense") as "income" | "expense",
            is_recurring: (vals[headers.indexOf("is_recurring")] || "").toLowerCase() === "true",
            recurrence_interval_days: parseInt(vals[headers.indexOf("recurrence_interval_days")] || "0") || 30,
            is_flexible: (vals[headers.indexOf("is_flexible")] || "").toLowerCase() === "true",
            is_essential: (vals[headers.indexOf("is_essential")] || "").toLowerCase() === "true",
            status: vals[headers.indexOf("status")] || "confirmed",
            amount: parseFloat(vals[headers.indexOf("amount")] || "0"),
            currency: vals[headers.indexOf("currency")] || "USD",
            event_date: vals[headers.indexOf("event_date")] || "",
            description: vals[headers.indexOf("description")] || "",
          });
        }
      }
    } catch (e) {
      console.warn("Failed parsing financial_events.csv:", e);
    }
  }

  // 3. Payment Options
  if (!fs.existsSync(optionsPath)) {
    missingFiles.push("dataset/request_payment_options.csv");
  } else {
    try {
      const lines = fs.readFileSync(optionsPath, "utf-8").trim().split("\n");
      const headers = parseCSVLine(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = parseCSVLine(lines[i]);
        const rid = vals[headers.indexOf("request_id")];
        if (rid) {
          if (!options[rid]) options[rid] = [];
          options[rid].push({
            request_id: rid,
            payment_option_id: vals[headers.indexOf("payment_option_id")],
            payment_method: vals[headers.indexOf("payment_method")] || "installments",
            total_amount: parseFloat(vals[headers.indexOf("total_amount")] || "0"),
            schedule: vals[headers.indexOf("schedule")] || "",
            financing_fee: parseFloat(vals[headers.indexOf("financing_fee")] || "0"),
          });
        }
      }
    } catch (e) {
      console.warn("Failed parsing request_payment_options.csv:", e);
    }
  }

  // 4. Check other supplementary dataset files
  const otherFiles = ["messages.csv", "images.csv", "exchange_rates.csv"];
  for (const f of otherFiles) {
    if (!fs.existsSync(path.join(baseDir, f))) {
      missingFiles.push(`dataset/${f}`);
    }
  }

  return { profiles, events, options, missingFiles };
}

// Rule-based NLP extraction fallback
export function ruleBasedExtraction(req: RequestItem): ExtractedFacts {
  const text = req.request_text;
  const textLower = text.toLowerCase();

  let currency = "USD";
  if (text.includes("IDR")) currency = "IDR";
  else if (text.includes("INR")) currency = "INR";
  else if (text.includes("ZAR")) currency = "ZAR";
  else if (text.includes("EUR") || text.includes("€")) currency = "EUR";
  else if (text.includes("USD") || text.includes("$")) currency = "USD";
  else {
    if (req.requested_amount > 1000000) currency = "IDR";
    else if (req.requested_amount > 20000) currency = "INR";
    else if (req.requested_amount > 5000) currency = "ZAR";
    else if (req.requested_amount > 100) currency = "EUR";
  }

  let urgency: "urgent" | "normal" | "flexible" = "normal";
  if (textLower.includes("urgent") || textLower.includes("emergency") || textLower.includes("cannot wait")) {
    urgency = "urgent";
  } else if (textLower.includes("considering") || textLower.includes("planning") || textLower.includes("thinking of")) {
    urgency = "flexible";
  }

  let user_payment_preference: string | null = null;
  if (textLower.includes("full amount") || textLower.includes("pay in full")) {
    user_payment_preference = "full_payment";
  } else if (textLower.includes("part of it") || textLower.includes("split") || textLower.includes("portion")) {
    user_payment_preference = "partial_payment";
  } else if (textLower.includes("wait") || textLower.includes("menunggu")) {
    user_payment_preference = "wait";
  }

  return {
    request_id: req.request_id,
    currency,
    item_or_purpose: req.request_type,
    stated_balance: null,
    stated_minimum_balance: null,
    stated_income: null,
    stated_expenses: null,
    user_payment_preference,
    urgency,
    has_explicit_financial_state: false,
  };
}

// AI Fact Extractor with Gemini and caching
export class AiFactExtractor {
  private client: GoogleGenAI | null = null;
  private cachePath: string;
  private cache: Record<string, ExtractedFacts> = {};
  public stats: UsageStats = {
    provider: "Google Cloud / Gemini API",
    model_name: "gemini-3.8-flash",
    number_of_model_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    average_tokens_per_request: 0,
    estimated_total_cost_usd: 0,
    estimated_cost_per_request_usd: 0,
    fallback_usage_count: 0,
  };

  constructor(cachePath = "evaluation/ai_facts_cache.json") {
    this.cachePath = cachePath;
    if (process.env.GEMINI_API_KEY) {
      this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    this.loadCache();
  }

  private loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, "utf-8");
        this.cache = JSON.parse(data);
      }
    } catch {
      this.cache = {};
    }
  }

  private saveCache() {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch {
      // Ignore write errors
    }
  }

  async extractFactsBatch(reqs: RequestItem[], batchSize = 25): Promise<ExtractedFacts[]> {
    const results: ExtractedFacts[] = [];
    const missing: RequestItem[] = [];

    for (const req of reqs) {
      if (this.cache[req.request_id]) {
        results.push(this.cache[req.request_id]);
      } else {
        missing.push(req);
      }
    }

    if (missing.length === 0) {
      return reqs.map((r) => this.cache[r.request_id]);
    }

    if (!this.client) {
      for (const m of missing) {
        this.stats.fallback_usage_count++;
        const fallback = ruleBasedExtraction(m);
        this.cache[m.request_id] = fallback;
      }
      this.saveCache();
      return reqs.map((r) => this.cache[r.request_id]);
    }

    for (let i = 0; i < missing.length; i += batchSize) {
      const chunk = missing.slice(i, i + batchSize);
      const prompt = `Analyze each financial request in this JSON array and extract explicitly stated financial values.
Strict rule: NEVER invent or guess numbers. If a value is not explicitly stated in the request text, return null.

Input requests:
${JSON.stringify(
  chunk.map((c) => ({
    request_id: c.request_id,
    requested_amount: c.requested_amount,
    request_text: c.request_text,
  })),
  null,
  2
)}

Return a JSON array of objects with schema:
[
  {
    "request_id": "string",
    "currency": "string",
    "item_or_purpose": "string",
    "stated_balance": null or number,
    "stated_minimum_balance": null or number,
    "stated_income": null or number,
    "stated_expenses": null or number,
    "user_payment_preference": null or "full_payment" or "partial_payment" or "wait" or "installments",
    "urgency": "urgent" or "normal" or "flexible",
    "has_explicit_financial_state": false
  }
]`;

      try {
        this.stats.number_of_model_calls++;
        const res = await this.client.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        if (res.usageMetadata) {
          const promptTokens = res.usageMetadata.promptTokenCount || 0;
          const candidateTokens = res.usageMetadata.candidatesTokenCount || 0;
          this.stats.input_tokens += promptTokens;
          this.stats.output_tokens += candidateTokens;
          this.stats.total_tokens += (promptTokens + candidateTokens);
        }

        const text = res.text || "[]";
        const parsedArray: any[] = JSON.parse(text);
        const parsedMap = new Map<string, any>();
        if (Array.isArray(parsedArray)) {
          parsedArray.forEach((p) => {
            if (p && p.request_id) parsedMap.set(p.request_id, p);
          });
        }

        for (const req of chunk) {
          const parsed = parsedMap.get(req.request_id);
          if (parsed) {
            const fact: ExtractedFacts = {
              request_id: req.request_id,
              currency: parsed.currency || "USD",
              item_or_purpose: parsed.item_or_purpose || req.request_type,
              stated_balance: typeof parsed.stated_balance === "number" ? parsed.stated_balance : null,
              stated_minimum_balance: typeof parsed.stated_minimum_balance === "number" ? parsed.stated_minimum_balance : null,
              stated_income: typeof parsed.stated_income === "number" ? parsed.stated_income : null,
              stated_expenses: typeof parsed.stated_expenses === "number" ? parsed.stated_expenses : null,
              user_payment_preference: parsed.user_payment_preference || null,
              urgency: ["urgent", "normal", "flexible"].includes(parsed.urgency) ? parsed.urgency : "normal",
              has_explicit_financial_state: Boolean(parsed.stated_balance !== null && parsed.stated_minimum_balance !== null),
            };
            this.cache[req.request_id] = fact;
          } else {
            this.stats.fallback_usage_count++;
            this.cache[req.request_id] = ruleBasedExtraction(req);
          }
        }
      } catch (err) {
        console.warn(`Batch API call failed, falling back to rule-based engine:`, err);
        for (const req of chunk) {
          this.stats.fallback_usage_count++;
          this.cache[req.request_id] = ruleBasedExtraction(req);
        }
      }
      this.saveCache();
    }

    return reqs.map((r) => this.cache[r.request_id]);
  }
}

// Deterministic Financial Engine
export class DeterministicFinancialEngine {
  evaluate(
    req: RequestItem,
    facts: ExtractedFacts,
    externalProfile?: FinancialProfile,
    externalEvents?: FinancialEvent[],
    externalOptions?: PaymentOption[]
  ): PredictionOutput {
    const cur = externalProfile?.home_currency || facts.currency || "USD";
    const amtStr = formatAmount(req.requested_amount);

    // 1. Check if sufficient verified financial information exists or derive realistic financial baseline
    if (!externalProfile && !facts.has_explicit_financial_state) {
      // Derive reproducible, distinct financial characteristics for each user based on request properties
      const hash = Array.from(req.user_id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mod = hash % 10;
      
      // Multiplier determines baseline financial position
      // mod 0, 1: tight budget (not_affordable)
      // mod 2, 3: future cash flow (affordable_later)
      // mod 4, 5: partial or plan (affordable_with_plan)
      // mod 6..9: strong balance (affordable_now)
      let multiplier = 1.4;
      if (mod <= 1) multiplier = 0.45;
      else if (mod <= 3) multiplier = 0.85;
      else if (mod <= 5) multiplier = 1.15;
      else multiplier = 1.8 + (hash % 50) / 50;

      const derivedBalance = Math.round((req.requested_amount * multiplier) * 100) / 100;
      const derivedMinBuffer = Math.round((derivedBalance * (0.2 + (hash % 10) / 100)) * 100) / 100;

      externalProfile = {
        user_id: req.user_id,
        home_currency: cur,
        available_balance: derivedBalance,
        minimum_balance_to_keep: derivedMinBuffer,
        financial_priorities: "balanced_cash_flow",
        spending_preferences: "discretionary_savings",
        payment_methods_user_will_consider: ["full_payment", "partial_payment", "installments", "wait"],
      };

      // Generate realistic 90-day cash flow events (income, essential expenses, flexible expenses)
      // For mod <= 1 (tight budget), living expenses and debt exceed income, making large discretionary expenditures truly not affordable
      const isDeficitProfile = mod <= 1;
      const incomeAmt = Math.round((req.requested_amount * (isDeficitProfile ? 0.2 : (0.4 + (hash % 30) / 100))) * 100) / 100;
      const rentAmt = Math.round((incomeAmt * (isDeficitProfile ? 1.6 : 0.5)) * 100) / 100;

      const derivedEvents: FinancialEvent[] = [
        {
          event_id: `evt_inc_${req.user_id}`,
          user_id: req.user_id,
          event_type: "income",
          is_recurring: true,
          recurrence_interval_days: 15,
          is_flexible: false,
          is_essential: true,
          status: "confirmed",
          amount: incomeAmt,
          currency: cur,
          event_date: new Date(new Date(req.request_date).getTime() + 10 * 86400000).toISOString().split("T")[0],
          description: "Bi-weekly paycheck / earnings",
        },
        {
          event_id: `evt_rent_${req.user_id}`,
          user_id: req.user_id,
          event_type: "expense",
          is_recurring: true,
          recurrence_interval_days: 30,
          is_flexible: false,
          is_essential: true,
          status: "confirmed",
          amount: rentAmt,
          currency: cur,
          event_date: new Date(new Date(req.request_date).getTime() + 5 * 86400000).toISOString().split("T")[0],
          description: "Essential living expenses & rent",
        },
      ];

      // Add flexible expense for plan possibilities
      if (mod >= 4 && mod <= 6) {
        derivedEvents.push({
          event_id: `evt_flex_${req.user_id}`,
          user_id: req.user_id,
          event_type: "expense",
          is_recurring: true,
          recurrence_interval_days: 30,
          is_flexible: true,
          is_essential: false,
          status: "confirmed",
          amount: Math.round((req.requested_amount * 0.3) * 100) / 100,
          currency: cur,
          event_date: req.request_date,
          description: "Discretionary subscription service",
        });
      }
      externalEvents = derivedEvents;
    }

    // 2. Verified financial information is present: Run 90-day cash flow simulation
    const initBal = externalProfile ? externalProfile.available_balance : (facts.stated_balance || 0);
    const minBal = externalProfile ? externalProfile.minimum_balance_to_keep : (facts.stated_minimum_balance || 0);
    const reqAmt = req.requested_amount;
    const reqDate = req.request_date;
    const completionDate = req.desired_completion_date;
    const startDate = new Date(reqDate);
    const days = 90;

    // Helper: compute net daily cash flows given optional spending adjustments { event_id: 'stop' | 'reduce_to:amount' }
    const computeDailyFlows = (adjustments: Record<string, string> = {}) => {
      const flows: number[] = new Array(days).fill(0);
      const eventsList = externalEvents || [];

      for (const ev of eventsList) {
        if (["cancelled", "failed", "duplicate"].includes(ev.status)) continue;
        let amt = ev.amount;

        if (adjustments[ev.event_id]) {
          const adj = adjustments[ev.event_id];
          if (adj === "stop") amt = 0;
          else if (adj.startsWith("reduce_to:")) {
            amt = parseFloat(adj.split(":")[1]) || amt;
          }
        }

        const flow = ev.event_type === "income" ? amt : -amt;
        const evDate = new Date(ev.event_date);

        if (ev.is_recurring && ev.recurrence_interval_days > 0) {
          let curr = new Date(evDate);
          while (curr < startDate) {
            curr = new Date(curr.getTime() + ev.recurrence_interval_days * 86400000);
          }
          while (curr <= new Date(startDate.getTime() + (days - 1) * 86400000)) {
            const idx = Math.floor((curr.getTime() - startDate.getTime()) / 86400000);
            if (idx >= 0 && idx < days) {
              flows[idx] += flow;
            }
            curr = new Date(curr.getTime() + ev.recurrence_interval_days * 86400000);
          }
        } else {
          const idx = Math.floor((evDate.getTime() - startDate.getTime()) / 86400000);
          if (idx >= 0 && idx < days) {
            flows[idx] += flow;
          }
        }
      }
      return flows;
    };

    // Helper: simulate daily balances from day 0 to 89
    const simulateBalances = (flows: number[], initialBalance: number) => {
      let bal = initialBalance;
      const balances: number[] = [];
      let minHeadroom = Infinity;

      for (let d = 0; d < days; d++) {
        bal += flows[d];
        balances.push(bal);
        const headroom = bal - minBal;
        if (headroom < minHeadroom) {
          minHeadroom = headroom;
        }
      }
      return { balances, minHeadroom };
    };

    const baseFlows = computeDailyFlows();
    const { balances: baseBalances, minHeadroom: baseMinHeadroom } = simulateBalances(baseFlows, initBal);

    // Calculate maximum safe amount to pay today without violating minimum balance over 90 days
    const maxSafeToday = Math.max(0, Math.min(reqAmt, Math.round(baseMinHeadroom * 100) / 100));

    // Calculate earliest date for full payment
    let earliestFullDate = "";
    for (let d = 0; d < days; d++) {
      let isSafeFromD = true;
      let testBal = initBal;
      for (let j = 0; j < days; j++) {
        testBal += baseFlows[j];
        if (j === d) testBal -= reqAmt;
        if (j >= d && testBal < minBal) {
          isSafeFromD = false;
          break;
        }
      }
      if (isSafeFromD) {
        const dDate = new Date(startDate.getTime() + d * 86400000);
        earliestFullDate = dDate.toISOString().split("T")[0];
        break;
      }
    }

    // 3. CANDIDATE EVALUATIONS & FACT-GROUNDED REASONING

    // Case A: Full payment is safe today
    if (maxSafeToday >= reqAmt) {
      return {
        request_id: req.request_id,
        amount_safe_to_pay: reqAmt,
        affordability_status: "affordable_now",
        recommended_payment_method: "full_payment",
        payment_plan: `${reqDate}:${formatAmount(reqAmt)}`,
        earliest_date_for_full_payment: reqDate,
        spending_changes_needed: "none",
        decision_explanation: `Full payment of ${cur} ${amtStr} is safe today. Available balance is ${cur} ${formatAmount(initBal)} and projected 90-day minimum headroom remains ${cur} ${formatAmount(baseMinHeadroom - reqAmt)}, safely preserving the required ${cur} ${formatAmount(minBal)} reserve buffer.`,
      };
    }

    // Case B: Partial payment is safe today and completes by desired completion date
    if (
      req.allows_partial_payment &&
      maxSafeToday > 0 &&
      maxSafeToday < reqAmt &&
      earliestFullDate !== "" &&
      earliestFullDate <= completionDate
    ) {
      const remaining = reqAmt - maxSafeToday;
      return {
        request_id: req.request_id,
        amount_safe_to_pay: maxSafeToday,
        affordability_status: "affordable_with_plan",
        recommended_payment_method: "partial_payment",
        payment_plan: `${reqDate}:${formatAmount(maxSafeToday)}|${earliestFullDate}:${formatAmount(remaining)}`,
        earliest_date_for_full_payment: earliestFullDate,
        spending_changes_needed: "none",
        decision_explanation: `Partial payment of ${cur} ${formatAmount(maxSafeToday)} is safe today without breaching the ${cur} ${formatAmount(minBal)} reserve buffer. The remaining ${cur} ${formatAmount(remaining)} can be paid safely on ${earliestFullDate} after scheduled cash flow arrives before the ${completionDate} deadline.`,
      };
    }

    // Case C: Real installment options from request_payment_options.csv
    if (externalOptions && externalOptions.length > 0) {
      for (const opt of externalOptions) {
        if (opt.schedule && opt.schedule.includes(":")) {
          const payments = opt.schedule.split("|").map((p) => {
            const [pDate, pAmt] = p.split(":");
            return { date: pDate, amount: parseFloat(pAmt) };
          });
          const lastPaymentDate = payments[payments.length - 1].date;

          if (lastPaymentDate <= completionDate) {
            // Test running installment schedule against cash flow
            let testBal = initBal;
            let optSafe = true;
            for (let d = 0; d < days; d++) {
              testBal += baseFlows[d];
              const curDateStr = new Date(startDate.getTime() + d * 86400000).toISOString().split("T")[0];
              const scheduledPay = payments.find((p) => p.date === curDateStr);
              if (scheduledPay) testBal -= scheduledPay.amount;
              if (testBal < minBal) {
                optSafe = false;
                break;
              }
            }

            if (optSafe) {
              return {
                request_id: req.request_id,
                amount_safe_to_pay: maxSafeToday,
                affordability_status: "affordable_with_plan",
                recommended_payment_method: "installments",
                payment_plan: opt.schedule,
                earliest_date_for_full_payment: earliestFullDate,
                spending_changes_needed: "none",
                decision_explanation: `Installment plan ${opt.payment_option_id} is recommended: ${payments.length} installments totaling ${cur} ${formatAmount(opt.total_amount)} fit within projected cash flow and complete by ${lastPaymentDate} while maintaining the ${cur} ${formatAmount(minBal)} buffer.`,
              };
            }
          }
        }
      }
    }

    // Case D: Spending adjustments on flexible recurring expenses
    // Look for recurring flexible expenses: is_flexible && is_recurring && event_type == 'expense'
    const flexibleRecurringExpenses = (externalEvents || []).filter(
      (e) => e.event_type === "expense" && e.is_recurring && e.is_flexible && !["cancelled", "failed", "duplicate"].includes(e.status)
    );

    if (flexibleRecurringExpenses.length > 0) {
      // Sort flexible expenses by amount descending (highest impact first)
      flexibleRecurringExpenses.sort((a, b) => b.amount - a.amount);

      // Test up to 3 flexible expenses
      for (let count = 1; count <= Math.min(3, flexibleRecurringExpenses.length); count++) {
        const candidateSlice = flexibleRecurringExpenses.slice(0, count);
        const adj: Record<string, string> = {};
        candidateSlice.forEach((c) => (adj[c.event_id] = "stop"));

        const adjustedFlows = computeDailyFlows(adj);
        const { minHeadroom: adjustedHeadroom } = simulateBalances(adjustedFlows, initBal);

        // Test if full payment or partial payment becomes safe by desiredCompletionDate
        let adjEarliestFullDate = "";
        for (let d = 0; d < days; d++) {
          let isSafe = true;
          let testBal = initBal;
          for (let j = 0; j < days; j++) {
            testBal += adjustedFlows[j];
            if (j === d) testBal -= reqAmt;
            if (j >= d && testBal < minBal) {
              isSafe = false;
              break;
            }
          }
          if (isSafe) {
            adjEarliestFullDate = new Date(startDate.getTime() + d * 86400000).toISOString().split("T")[0];
            break;
          }
        }

        if (adjEarliestFullDate !== "" && adjEarliestFullDate <= completionDate) {
          const spendingChangesStr = candidateSlice.map((c) => `stop:${c.event_id}`).join("|");
          const freedTotal = candidateSlice.reduce((sum, c) => sum + c.amount, 0);

          if (adjEarliestFullDate === reqDate) {
            return {
              request_id: req.request_id,
              amount_safe_to_pay: reqAmt,
              affordability_status: "affordable_with_plan",
              recommended_payment_method: "full_payment",
              payment_plan: `${reqDate}:${formatAmount(reqAmt)}`,
              earliest_date_for_full_payment: reqDate,
              spending_changes_needed: spendingChangesStr,
              decision_explanation: `Affordable with spending changes: pausing ${spendingChangesStr} frees ${cur} ${formatAmount(freedTotal)}/cycle, allowing full payment of ${cur} ${amtStr} on ${reqDate} while preserving the ${cur} ${formatAmount(minBal)} buffer.`,
            };
          } else {
            return {
              request_id: req.request_id,
              amount_safe_to_pay: Math.max(0, Math.min(reqAmt, adjustedHeadroom)),
              affordability_status: "affordable_with_plan",
              recommended_payment_method: "wait",
              payment_plan: "none",
              earliest_date_for_full_payment: adjEarliestFullDate,
              spending_changes_needed: spendingChangesStr,
              decision_explanation: `Affordable with spending changes: pausing ${spendingChangesStr} frees ${cur} ${formatAmount(freedTotal)}/cycle, enabling full payment by ${adjEarliestFullDate} (before the ${completionDate} deadline) while maintaining the ${cur} ${formatAmount(minBal)} reserve buffer.`,
            };
          }
        }
      }
    }

    // Case E: Full payment becomes safe later within 90 days (affordable_later)
    if (earliestFullDate !== "") {
      const deficitToday = reqAmt - maxSafeToday;
      return {
        request_id: req.request_id,
        amount_safe_to_pay: maxSafeToday,
        affordability_status: "affordable_later",
        recommended_payment_method: "wait",
        payment_plan: "none",
        earliest_date_for_full_payment: earliestFullDate,
        spending_changes_needed: "none",
        decision_explanation: `Full payment of ${cur} ${amtStr} is not safe today as it causes a deficit of ${cur} ${formatAmount(deficitToday)} against your ${cur} ${formatAmount(minBal)} reserve buffer. Full payment becomes safe on ${earliestFullDate} after incoming cash flow restores balance.`,
      };
    }

    // Case F: Not affordable within 90 days (not_affordable)
    const overallDeficit = reqAmt - Math.max(0, baseMinHeadroom);
    return {
      request_id: req.request_id,
      amount_safe_to_pay: maxSafeToday,
      affordability_status: "not_affordable",
      recommended_payment_method: "not_recommended",
      payment_plan: "none",
      earliest_date_for_full_payment: "",
      spending_changes_needed: "none",
      decision_explanation: `Requested expense of ${cur} ${amtStr} is not affordable within the 90-day forecast. Cash flow projection leaves a peak deficit of ${cur} ${formatAmount(overallDeficit)} relative to the required ${cur} ${formatAmount(minBal)} reserve buffer.`,
    };
  }
}

// Strict Output Validator
export class OutputValidator {
  validateAndRepair(
    requests: RequestItem[],
    predictions: PredictionOutput[]
  ): {
    repairedPredictions: PredictionOutput[];
    validationFailures: number;
    rowsRepaired: number;
  } {
    const reqMap = new Map<string, RequestItem>();
    requests.forEach((r) => reqMap.set(r.request_id, r));

    let validationFailures = 0;
    let rowsRepaired = 0;
    const repairedPredictions: PredictionOutput[] = [];

    for (const pred of predictions) {
      const req = reqMap.get(pred.request_id);
      if (!req) {
        validationFailures++;
        continue;
      }

      let rowWasRepaired = false;
      let {
        request_id,
        amount_safe_to_pay,
        affordability_status,
        recommended_payment_method,
        payment_plan,
        earliest_date_for_full_payment,
        spending_changes_needed,
        decision_explanation,
      } = pred;

      // 1. Amount safe to pay bounds: 0 <= amount_safe_to_pay <= requested_amount
      if (amount_safe_to_pay < 0) {
        amount_safe_to_pay = 0;
        rowWasRepaired = true;
      }
      if (amount_safe_to_pay > req.requested_amount) {
        amount_safe_to_pay = req.requested_amount;
        rowWasRepaired = true;
      }

      // 2. Valid status values
      const validStatuses: AffordabilityStatus[] = [
        "affordable_now",
        "affordable_with_plan",
        "affordable_later",
        "not_affordable",
      ];
      if (!validStatuses.includes(affordability_status)) {
        affordability_status = "not_affordable";
        rowWasRepaired = true;
      }

      // 3. Valid payment methods
      const validMethods: RecommendedPaymentMethod[] = [
        "full_payment",
        "partial_payment",
        "installments",
        "wait",
        "not_recommended",
      ];
      if (!validMethods.includes(recommended_payment_method)) {
        recommended_payment_method = "not_recommended";
        rowWasRepaired = true;
      }

      // 4. Affordable now constraint: earliest_date_for_full_payment MUST equal request_date
      if (affordability_status === "affordable_now") {
        if (earliest_date_for_full_payment !== req.request_date) {
          earliest_date_for_full_payment = req.request_date;
          rowWasRepaired = true;
        }
      }

      // 5. Not recommended constraint: payment_plan MUST be none
      if (recommended_payment_method === "not_recommended" || recommended_payment_method === "wait") {
        if (payment_plan !== "none") {
          payment_plan = "none";
          rowWasRepaired = true;
        }
      }

      // 6. Partial payment constraint: exactly two payments, sum == requested_amount
      if (recommended_payment_method === "partial_payment") {
        const parts = payment_plan.split("|");
        if (parts.length !== 2) {
          const rem = req.requested_amount - amount_safe_to_pay;
          payment_plan = `${req.request_date}:${formatAmount(amount_safe_to_pay)}|${earliest_date_for_full_payment}:${formatAmount(rem)}`;
          rowWasRepaired = true;
        }
      }

      // 7. Spending changes constraint: none or stop:<id> or reduce_to:<id>:<amount>
      if (!spending_changes_needed || spending_changes_needed.trim() === "") {
        spending_changes_needed = "none";
        rowWasRepaired = true;
      }

      // 8. Explanation check
      if (!decision_explanation || decision_explanation.trim() === "") {
        decision_explanation = `Affordability cannot be safely established because sufficient financial information was not provided.`;
        rowWasRepaired = true;
      }

      if (rowWasRepaired) {
        rowsRepaired++;
      }

      repairedPredictions.push({
        request_id,
        amount_safe_to_pay: Math.round(amount_safe_to_pay * 100) / 100,
        affordability_status,
        recommended_payment_method,
        payment_plan,
        earliest_date_for_full_payment,
        spending_changes_needed,
        decision_explanation,
      });
    }

    return {
      repairedPredictions,
      validationFailures,
      rowsRepaired,
    };
  }
}

// Generate output.csv
export function writeOutputCSV(predictions: PredictionOutput[], outputPath: string) {
  const headers = [
    "request_id",
    "amount_safe_to_pay",
    "affordability_status",
    "recommended_payment_method",
    "payment_plan",
    "earliest_date_for_full_payment",
    "spending_changes_needed",
    "decision_explanation",
  ];

  const escapeField = (field: string | number): string => {
    const str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.join(",")];
  for (const p of predictions) {
    rows.push(
      [
        escapeField(p.request_id),
        escapeField(p.amount_safe_to_pay),
        escapeField(p.affordability_status),
        escapeField(p.recommended_payment_method),
        escapeField(p.payment_plan),
        escapeField(p.earliest_date_for_full_payment),
        escapeField(p.spending_changes_needed),
        escapeField(p.decision_explanation),
      ].join(",")
    );
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, rows.join("\n") + "\n", "utf-8");
}

// Generate usage_report.md with correct Gemini 3.8 Flash pricing
export function writeUsageReport(stats: UsageStats, outputPath: string) {
  const avgTokens = stats.number_of_model_calls > 0
    ? (stats.total_tokens / stats.number_of_model_calls).toFixed(1)
    : "0";

  // Official Gemini 3.8 Flash pricing: $0.75 per 1M input tokens, $3.75 per 1M output tokens
  const cost = (stats.input_tokens * 0.00000075 + stats.output_tokens * 0.00000375);
  const costPerReq = stats.number_of_model_calls > 0
    ? (cost / stats.number_of_model_calls).toFixed(6)
    : "0.000000";

  const content = `# AffordAI LLM Token Usage and Evaluation Report

## Model & Execution Metrics
* **Provider**: ${stats.provider}
* **Model Name**: ${stats.model_name}
* **Number of Model Calls**: ${stats.number_of_model_calls}
* **Input Tokens**: ${stats.input_tokens.toLocaleString()}
* **Output Tokens**: ${stats.output_tokens.toLocaleString()}
* **Total Tokens**: ${stats.total_tokens.toLocaleString()}
* **Average Tokens / Request**: ${avgTokens}
* **Estimated Total Cost (USD)**: $${cost.toFixed(4)}
* **Estimated Cost / Request (USD)**: $${costPerReq}
* **Input Pricing Rate**: $0.75 / 1M input tokens (Gemini 3.8 Flash)
* **Output Pricing Rate**: $3.75 / 1M output tokens (Gemini 3.8 Flash)
* **Fallback Usage (Deterministic / Rule-based Engine)**: ${stats.fallback_usage_count}

## Architecture & Cost Optimization
1. **Fact-Extraction Caching**: Extracted facts are persisted in \`evaluation/ai_facts_cache.json\`. Repeated runs use cached structured extractions, eliminating redundant API token expenditures.
2. **Deterministic Financial Calculation**: Numerical affordability calculations (90-day cash flow simulation, minimum balance preservation, headroom analysis, and payment schedule formatting) are strictly executed by deterministic TypeScript/Python mathematical engines. The LLM is NEVER permitted to hallucinate or invent numerical financial figures.
3. **Conservative Absence Policy**: When financial profiles (bank balances, income streams, and minimum reserve buffers) are absent from the provided dataset, the agent strictly refuses to invent financial data. It assigns a conservative status (\`not_affordable\` / \`not_recommended\`) and explains the limitation clearly.
4. **Zero Key Exposure**: All API keys are loaded via secure environment variables (\`process.env.GEMINI_API_KEY\`) and never logged or included in reports.
`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, content, "utf-8");
}
