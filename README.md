# Buy or Wait? AI Financial Affordability Agent

A full-stack, AI-powered financial agent that evaluates user affordability requests, forecasts 90-day cash flows, tests against minimum balance constraints, and recommends optimal payment methods.

## Overview

When a user asks **"Can I afford this laptop?"**, the agent evaluates:
1. Current available cash balance
2. Confirmed future recurring income (salary, wages)
3. Essential recurring expenses (rent, utilities, groceries)
4. Flexible recurring spending (subscriptions, entertainment) that can be stopped or reduced
5. Available installment financing offers
6. User financial preferences, risk tolerance, and minimum liquidity buffers

## Key Features

- **90-Day Cash Flow Simulation Engine**: Daily forward balance forecasting ensuring balances never dip below `minimum_balance_to_keep`.
- **Accurate Metric Calculations**:
  - `amount_safe_to_pay`: Largest safe payment today without breaking the 90-day safety check.
  - `earliest_date_for_full_payment`: First date within 90 days when paying the full amount as a single payment passes the safety check.
- **Multimodal & Context Integration**: Extracts amounts and terms from messages, invoices, and payment options.
- **Spending Adjustments**: Automatically identifies flexible expenses that can be paused (`stop:<event_id>`) or reduced (`reduce_to:<event_id>:<amount>`).
- **Gemini AI Advisor**: Real-time natural language reasoning using `@google/genai` (`gemini-3.8-flash`).
- **Export & Submission Ready**: Generates compliant `output.csv`, `evaluation/usage_report.md`, and runnable package.

## Quick Start

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev

# Run build
npm run build
```

## Dataset Files

- `dataset/requests.csv`: 250 evaluation requests (`request_26` through `request_275`).
- `dataset/output.csv`: Complete predicted outputs.
- `dataset/financial_profiles.csv`: User balances, currencies, minimum reserves, and preferences.
- `dataset/financial_events.csv`: Income and expense transactions.
- `dataset/request_payment_options.csv`: Installment schedules.
- `evaluation/usage_report.md`: Model calls, token statistics, and cost analysis.
