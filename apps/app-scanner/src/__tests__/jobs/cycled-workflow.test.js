import { describe, it, expect } from "vitest";
import { CycledListInitializer } from "../../init/CycledListInitializer.js";

const EXPECTED_JOB_FUNCTIONS_IN_ORDER = [
  "syncAllExchangesAndSymbols",
  "syncFundamentalsLargeCap",
  "findAndMarkLargeCapStocks",
  "syncDividendsLargeCap",
  "syncTechnicalsLargeCap",
  "syncMetricsLargeCap",
  "syncMetricsValuationLargeCap",
  "syncPricePerformanceLargeCap",
  "syncSectorPercentiles",
  "syncIndustryPercentiles",
];

function createInitializer() {
  const noopAsync = async () => false;
  const limitManagerStub = {
    checkEODHDLimit: noopAsync,
    checkDailyReset: noopAsync,
    cancelExternalOperations: async () => {},
    isLimitReached: false,
  };

  return new CycledListInitializer(limitManagerStub);
}

describe("CycledListInitializer orchestration coverage", () => {
  it("exposes every job function required by the cycled workflow", () => {
    const initializer = createInitializer();
    const jobFunctionMap = initializer.getJobFunctionMap();
    const functionNames = Object.keys(jobFunctionMap).sort();

    expect(functionNames).toEqual([...EXPECTED_JOB_FUNCTIONS_IN_ORDER].sort());

    for (const name of EXPECTED_JOB_FUNCTIONS_IN_ORDER) {
      expect(typeof jobFunctionMap[name]).toBe("function");
    }
  });

  it("includes every job in the workflow order (including skipped ones)", () => {
    const initializer = createInitializer();
    const workflow = initializer.createWorkflow();
    const functionNames = workflow.map((entry) => entry.functionName);

    expect(functionNames).toEqual(EXPECTED_JOB_FUNCTIONS_IN_ORDER);

    const technicalsEntry = workflow.find(
      (entry) => entry.functionName === "syncTechnicalsLargeCap"
    );

    expect(technicalsEntry).toBeDefined();
    expect(technicalsEntry?.skipped).toBe(true);
  });
});
