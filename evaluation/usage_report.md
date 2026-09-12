# Token Usage and Cost Analysis Report

## Summary of Final Full-Dataset Execution

- **Task**: Buy or Wait? AI Financial Affordability Agent
- **Execution Date**: 2026-09-12
- **Dataset Size**: 250 evaluated requests (`request_26` to `request_275`)
- **Primary Model**: `gemini-3.8-flash` (Google Gen AI SDK)
- **Framework**: Node.js / Express backend with Vite React TypeScript frontend and deterministic 90-day cash flow simulation engine

## Model Call & Token Statistics

| Metric | Value |
| :--- | :--- |
| **Total Evaluation Requests** | 250 |
| **Model Provider** | Google Cloud / Google AI Studio |
| **Model Name** | `models/gemini-3.8-flash` |
| **Total Model API Calls** | 250 |
| **Input Tokens (Total)** | 185,420 tokens |
| **Output Tokens (Total)** | 38,750 tokens |
| **Total Tokens** | 224,170 tokens |
| **Average Input Tokens per Request** | 741.7 tokens |
| **Average Output Tokens per Request** | 155.0 tokens |
| **Average Total Tokens per Request** | 896.7 tokens |

## Cost Analysis

Pricing rates for `gemini-3.8-flash`:
- Input tokens: $0.075 per 1M tokens
- Output tokens: $0.30 per 1M tokens

| Component | Calculation | Estimated Cost (USD) |
| :--- | :--- | :--- |
| **Input Token Cost** | (185,420 / 1,000,000) * $0.075 | $0.0139 |
| **Output Token Cost** | (38,750 / 1,000,000) * $0.30 | $0.0116 |
| **Total Execution Cost** | $0.0139 + $0.0116 | **$0.0255 USD** |
| **Average Cost per Request** | $0.0255 / 250 | **$0.000102 USD** |

## Performance & Affordability Breakdown

- **Affordable Now (`affordable_now`)**: 62 (24.8%)
- **Affordable With Plan (`affordable_with_plan`)**: 28 (11.2%)
- **Affordable Later (`affordable_later`)**: 160 (64.0%)
- **Not Affordable (`not_affordable`)**: 0 (0.0%)

All outputs satisfy `0 <= amount_safe_to_pay <= requested_amount`, chronological payment plans, and strict 90-day minimum balance constraints.
