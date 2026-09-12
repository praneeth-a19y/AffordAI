# AffordAI: AI-Powered Financial Affordability Decision Agent

An enterprise-grade, AI-powered financial affordability decision system and interactive dashboard. The system evaluates financial requests (purchases, trips, investments, emergency repairs, debt payments, and family transfers) to determine the safest and most prudent course of action for each user.

---

## 1. Project Overview & Problem Statement

When evaluating whether an expense is affordable, a naive comparison between requested price and current bank balance fails because it ignores:
- Minimum reserve buffers required for emergencies and liquidity
- Essential recurring expenses (housing, utilities, groceries)
- Recurring income cycles (bi-weekly/monthly payroll)
- Financial deadlines and desired completion dates
- Stated user preferences (full payment, split/partial, installments, or waiting)

**AffordAI** bridges language understanding and strict deterministic mathematics:
- **LLM / AI Layer (`gemini-3.8-flash`)**: Extracts explicitly stated facts, currencies, and payment preferences from unstructured request text.
- **Deterministic Financial Engine**: Computes exact 90-day cash flow trajectories, verifies that balances never breach minimum reserve buffers, calculates safe headroom, evaluates candidate payment plans, and ranks options according to explicit priority rules.

---

## 2. Dataset Constraints & Pure Dataset Mode

> **CRITICAL DIRECTIVE**: The provided dataset contains **ONLY `requests.csv`**.
> Files such as `financial_profiles.csv`, `financial_events.csv`, `request_payment_options.csv`, `messages.csv`, and `images.csv` are **not present** in the primary evaluation workspace.

In strict compliance with the core directives:
- **Zero Fabrication Policy**: AffordAI **never** invents or fabricates bank balances, salaries, recurring expenses, minimum buffers, payment options, installment fees, or transaction/event IDs.
- **Conservative Decision Enforcement**: When verified financial profile data (balance, income, reserve requirements) is absent from the input data, AffordAI enforces the conservative decision:
  - `amount_safe_to_pay`: `0.0`
  - `affordability_status`: `not_affordable`
  - `recommended_payment_method`: `not_recommended`
  - `payment_plan`: `none`
  - `earliest_date_for_full_payment`: `""` (empty)
  - `spending_changes_needed`: `none`
  - `decision_explanation`: `"Affordability cannot be safely established because sufficient financial information was not provided."`
- **Interactive Custom Simulation**: The included web dashboard features an interactive **Custom Scenario Simulator** where users can input custom liquidity profiles, reserve limits, and recurring events to test live 90-day forecast trajectories in real time.

---

## 3. Required Architecture

```text
requests.csv
    │
    ▼
Data Validation
    │
    ▼
Request Parsing
    │
    ▼
AI/NLP Financial Fact Extraction (Gemini 3.8 Flash + Caching)
    │
    ▼
Structured Financial State
    │
    ▼
Deterministic Financial Engine (90-Day Safety Forecast)
    │
    ▼
Safe Payment & Earliest Date Calculation
    │
    ▼
Payment-Plan Evaluation & Priority Ranking
    │
    ▼
Strict Output Validation Layer (Auto-Repair)
    │
    ▼
output.csv + evaluation/usage_report.md
```

---

## 4. Output Schema

The output CSV (`output.csv`) strictly adheres to the 8 required columns in exact order:

| Column | Type | Allowed Values / Format | Description |
|---|---|---|---|
| `request_id` | String | Non-empty string (e.g., `request_26`) | Input request identifier |
| `amount_safe_to_pay` | Number | `0 <= value <= requested_amount` | Maximum safe amount today |
| `affordability_status` | Enum | `affordable_now`, `affordable_with_plan`, `affordable_later`, `not_affordable` | Overall affordability category |
| `recommended_payment_method` | Enum | `full_payment`, `partial_payment`, `installments`, `wait`, `not_recommended` | Safest recommendation |
| `payment_plan` | String | `YYYY-MM-DD:amount\|...` or `none` | Chronological payment schedule |
| `earliest_date_for_full_payment` | String | `YYYY-MM-DD` or empty `""` | Earliest safe date for full amount |
| `spending_changes_needed` | String | `none`, `stop:<id>`, `reduce_to:<id>:<amt>` | Flexible expense adjustments (max 3) |
| `decision_explanation` | String | Concise, factual text | Supporting explanation without hallucinated facts |

---

## 5. Decision Logic & Priority Ranking Rules

1. **Safety Standard**: A plan is safe if and only if:
   - Every scheduled payment can be met
   - The entire request completes on or before `desired_completion_date`
   - Essential living expenses remain fully covered
   - Account balance never breaches `minimum_balance_to_keep` throughout the 90-day horizon
2. **Partial Payment Rules**:
   - Only permitted if `allows_partial_payment` is `true`
   - Requires `0 < amount_safe_to_pay < requested_amount`
   - Earliest full-payment date must be on or before `desired_completion_date`
   - Format: exactly two payments summing to `requested_amount`
3. **Multi-Plan Ranking Tie-Breakers**:
   - 1st: Complete by `desired_completion_date`
   - 2nd: Require no spending changes
   - 3rd: Minimize total amount paid
   - 4th: Start payment earlier
   - 5th: Use fewer payments
   - 6th: Lowest `payment_option_id`

---

## 6. Installation & Execution

### Prerequisites
- Node.js 18+ (tested on Node v22)
- Python 3.8+

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure Gemini API Key (optional, rule-based fallback active if omitted)
# In .env:
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run Batch Evaluation Pipeline
```bash
# Runs fact extraction, deterministic engine, validator, and regenerates output.csv
npx tsx scripts/run_pipeline.ts
```

### Run Validation Suite
```bash
# Validates output.csv against all schema, range, date, and math constraints
python3 scripts/validate_output.py
```

### Run Edge Case Test Suite
```bash
# Tests partial payment math, large amounts, bounds, and date parsers
python3 scripts/test_edge_cases.py
```

### Run Web Application Dashboard
```bash
# Start local development server (Express + Vite on port 3000)
npm run dev

# Build for production
npm run build
npm run start
```

---

## 7. Token Usage and Cost Reporting

All model interactions, token consumption, and cost estimates are tracked and documented in `evaluation/usage_report.md`.
- **Model**: `gemini-3.8-flash`
- **Batching & Caching**: Requests are processed in structured batches and cached in `evaluation/ai_facts_cache.json` to prevent redundant API token costs.
- **Deterministic Mathematical Execution**: All monetary values, balance projections, and schedules are computed locally in TypeScript/Python without letting the LLM hallucinate numerical values.
