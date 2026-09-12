# AffordAI LLM Token Usage and Evaluation Report

## Model & Execution Metrics
* **Provider**: Google Cloud / Gemini API
* **Model Name**: gemini-3.8-flash
* **Number of Model Calls**: 0
* **Input Tokens**: 0
* **Output Tokens**: 0
* **Total Tokens**: 0
* **Average Tokens / Request**: 0
* **Estimated Total Cost (USD)**: $0.0000
* **Estimated Cost / Request (USD)**: $0.000000
* **Input Pricing Rate**: $0.75 / 1M input tokens (Gemini 3.8 Flash)
* **Output Pricing Rate**: $3.75 / 1M output tokens (Gemini 3.8 Flash)
* **Fallback Usage (Deterministic / Rule-based Engine)**: 0

## Architecture & Cost Optimization
1. **Fact-Extraction Caching**: Extracted facts are persisted in `evaluation/ai_facts_cache.json`. Repeated runs use cached structured extractions, eliminating redundant API token expenditures.
2. **Deterministic Financial Calculation**: Numerical affordability calculations (90-day cash flow simulation, minimum balance preservation, headroom analysis, and payment schedule formatting) are strictly executed by deterministic TypeScript/Python mathematical engines. The LLM is NEVER permitted to hallucinate or invent numerical financial figures.
3. **Conservative Absence Policy**: When financial profiles (bank balances, income streams, and minimum reserve buffers) are absent from the provided dataset, the agent strictly refuses to invent financial data. It assigns a conservative status (`not_affordable` / `not_recommended`) and explains the limitation clearly.
4. **Zero Key Exposure**: All API keys are loaded via secure environment variables (`process.env.GEMINI_API_KEY`) and never logged or included in reports.
