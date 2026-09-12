import path from "path";
import fs from "fs";
import {
  parseRequestsCSV,
  loadExternalDataset,
  AiFactExtractor,
  DeterministicFinancialEngine,
  OutputValidator,
  writeOutputCSV,
  writeUsageReport,
  PredictionOutput,
} from "./solve_and_generate_output";

async function main() {
  console.log("==================================================");
  console.log("AffordAI Financial Decision Agent - Pipeline Run");
  console.log("==================================================");

  // 1. Locate requests.csv
  let requestsPath = path.join(process.cwd(), "requests.csv");
  if (!fs.existsSync(requestsPath)) {
    requestsPath = path.join(process.cwd(), "dataset/requests.csv");
  }

  if (!fs.existsSync(requestsPath)) {
    console.error(`ERROR: requests.csv not found at ./requests.csv or ./dataset/requests.csv`);
    process.exit(1);
  }

  console.log(`Loading requests from: ${requestsPath}`);
  const requests = parseRequestsCSV(requestsPath);
  const totalRequests = requests.length;
  console.log(`Loaded ${totalRequests} requests.`);

  // 2. Load external dataset (if real files provided)
  const extDataset = loadExternalDataset(path.join(process.cwd(), "dataset"));
  if (extDataset.missingFiles.length > 0) {
    console.log(`[Dataset Notice] The following dataset files are currently missing from dataset/:`);
    extDataset.missingFiles.forEach((f) => console.log(`  - ${f}`));
    console.log(`Pure requests.csv mode: never fabricating placeholder profiles, events, or balances.`);
  } else {
    console.log(`[Dataset Verified] Real financial profiles, events, and payment options loaded successfully.`);
  }

  // 3. Fact Extraction
  const extractor = new AiFactExtractor(path.join(process.cwd(), "evaluation/ai_facts_cache.json"));
  const engine = new DeterministicFinancialEngine();
  const rawPredictions: PredictionOutput[] = [];

  console.log("Running NLP extraction & deterministic evaluation...");
  const allFacts = await extractor.extractFactsBatch(requests, 25);
  
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const facts = allFacts[i];
    const profile = extDataset.profiles[req.user_id];
    const events = extDataset.events[req.user_id];
    const options = extDataset.options[req.request_id];
    const pred = engine.evaluate(req, facts, profile, events, options);
    rawPredictions.push(pred);
  }

  // 3. Strict Output Validation Layer
  const validator = new OutputValidator();
  const { repairedPredictions, validationFailures, rowsRepaired } =
    validator.validateAndRepair(requests, rawPredictions);

  // 4. Save output.csv to root and dataset/
  const rootOutputPath = path.join(process.cwd(), "output.csv");
  const datasetOutputPath = path.join(process.cwd(), "dataset/output.csv");

  writeOutputCSV(repairedPredictions, rootOutputPath);
  writeOutputCSV(repairedPredictions, datasetOutputPath);

  // 5. Generate evaluation/usage_report.md
  const usageReportPath = path.join(process.cwd(), "evaluation/usage_report.md");
  writeUsageReport(extractor.stats, usageReportPath);

  // 6. Print required benchmark test results
  console.log("==================================================");
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Predictions generated: ${repairedPredictions.length}`);
  console.log(`Validation failures: ${validationFailures}`);
  console.log(`Rows repaired: ${rowsRepaired}`);
  console.log(`AI/LLM calls: ${extractor.stats.number_of_model_calls}`);
  console.log(`Fallback decisions: ${extractor.stats.fallback_usage_count}`);
  console.log(`Output path: ${rootOutputPath}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Pipeline failed with error:", err);
  process.exit(1);
});
