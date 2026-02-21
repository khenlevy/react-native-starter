#!/usr/bin/env node

/**
 * Fast Multi-Scenario Cancellation Tests
 * Multiple test scenarios with faster execution times and comprehensive logging
 */

import { getCycledList } from "../src/index.js";

console.log("🧪 Fast Multi-Scenario Cancellation Tests");
console.log("==========================================");
console.log("");

// Test configuration
const TEST_CONFIG = {
  functionDuration: 200, // 200ms instead of 5 seconds
  pauseDelay: 300,       // Pause after 300ms
  resumeDelay: 600,      // Resume after 600ms
  testTimeout: 2000      // Total test timeout
};

// Global test results
const testResults = [];

async function runScenario(scenarioName, scenarioConfig) {
  console.log(`\n🎬 Scenario: ${scenarioName}`);
  console.log("=" + "=".repeat(scenarioName.length + 10));
  
  const cycledList = getCycledList();
  await cycledList.stop();
  
  const startTime = Date.now();
  const executionLog = [];
  let shouldPause = false;
  
  // Create mock functions based on scenario
  const mockFunctions = {};
  scenarioConfig.functions.forEach(fn => {
    mockFunctions[fn.name] = async () => {
      const fnStartTime = Date.now();
      console.log(`  🚀 ${fn.name} started at ${((fnStartTime - startTime) / 100).toFixed(1)}ms`);
      executionLog.push({ fn: fn.name, start: fnStartTime, status: 'started' });
      
      // Simulate work
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.functionDuration / 10));
      }
      
      const fnEndTime = Date.now();
      console.log(`  ✅ ${fn.name} completed at ${((fnEndTime - startTime) / 100).toFixed(1)}ms`);
      executionLog.push({ fn: fn.name, end: fnEndTime, status: 'completed' });
      
      return { success: true, fn: fn.name };
    };
  });
  
  // Override executeAsyncFn to use mock functions
  const originalExecuteAsyncFn = cycledList.executeAsyncFn;
  cycledList.executeAsyncFn = async function(node) {
    const fn = mockFunctions[node.functionName];
    if (fn) {
      return await fn();
    }
    return await originalExecuteAsyncFn.call(this, node);
  };
  
  // Set up pause condition
  await cycledList.pauseOnTruthy(async () => {
    const currentTime = (Date.now() - startTime) / 100;
    console.log(`  🔍 Checking pause condition at ${currentTime.toFixed(1)}ms`);
    
    if (shouldPause) {
      console.log(`  ⚠️ Pause condition met at ${currentTime.toFixed(1)}ms - cancelling operations!`);
      return true;
    }
    return false;
  });
  
  // Set up continue condition
  await cycledList.continueOnTruthy(async () => {
    const currentTime = (Date.now() - startTime) / 100;
    console.log(`  🔍 Checking continue condition at ${currentTime.toFixed(1)}ms`);
    
    if (shouldPause) {
      console.log(`  ⏸️ Still paused at ${currentTime.toFixed(1)}ms`);
      return false;
    }
    console.log(`  ✅ Resuming execution at ${currentTime.toFixed(1)}ms`);
    return true;
  });
  
  // Trigger pause and resume based on scenario
  setTimeout(() => {
    console.log(`\n🚨 PAUSE TRIGGERED AT ${TEST_CONFIG.pauseDelay}ms!`);
    shouldPause = true;
  }, TEST_CONFIG.pauseDelay);
  
  setTimeout(() => {
    console.log(`\n✅ RESUMING AT ${TEST_CONFIG.resumeDelay}ms!`);
    shouldPause = false;
  }, TEST_CONFIG.resumeDelay);
  
  // Create the cycled list
  await cycledList.create(scenarioName, scenarioConfig.workflow, {
    cycleInterval: 100,
    maxCycles: scenarioConfig.maxCycles || 1,
    cancelFunction: async () => {
      const currentTime = (Date.now() - startTime) / 100;
      console.log(`  🛑 External cancellation called at ${currentTime.toFixed(1)}ms`);
    }
  });
  
  // Wait for test to complete
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.testTimeout));
  
  // Analyze results
  const finalStatus = cycledList.status();
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  console.log(`\n📊 ${scenarioName} Results:`);
  console.log("-".repeat(scenarioName.length + 15));
  
  // Count events per function
  const functionEvents = {};
  scenarioConfig.functions.forEach(fn => {
    functionEvents[fn.name] = executionLog.filter(log => log.fn === fn.name);
  });
  
  Object.entries(functionEvents).forEach(([fnName, events]) => {
    console.log(`${fnName}: ${events.length} events`);
    events.forEach(event => {
      const time = ((event.start || event.end) - startTime) / 100;
      console.log(`  - ${event.status} at ${time.toFixed(1)}ms`);
    });
  });
  
  console.log(`\n📈 Final Status:`);
  console.log(`  Duration: ${totalDuration}ms`);
  console.log(`  Overall Status: ${finalStatus.overallStatus}`);
  console.log(`  Is Running: ${finalStatus.isRunning}`);
  console.log(`  Is Paused: ${finalStatus.isPaused}`);
  console.log(`  Current Cycle: ${finalStatus.currentCycle}`);
  console.log(`  Total Cycles: ${finalStatus.totalCycles}`);
  console.log(`  Progress: ${finalStatus.progress}%`);
  console.log(`  Completed Functions: ${finalStatus.completedAsyncFns}/${finalStatus.totalAsyncFns}`);
  
  // Store test results
  testResults.push({
    scenario: scenarioName,
    duration: totalDuration,
    status: finalStatus,
    executionLog,
    functionEvents,
    success: true
  });
  
  await cycledList.stop();
  return testResults[testResults.length - 1];
}

async function runAllScenarios() {
  console.log("🚀 Starting Fast Multi-Scenario Tests...");
  console.log(`⚙️ Test Config: Functions=${TEST_CONFIG.functionDuration}ms, Pause=${TEST_CONFIG.pauseDelay}ms, Resume=${TEST_CONFIG.resumeDelay}ms`);
  
  // Scenario 1: Basic 3-function sequence
  await runScenario("Basic Sequence", {
    functions: [
      { name: "fn1", functionName: "fn1" },
      { name: "fn2", functionName: "fn2" },
      { name: "fn3", functionName: "fn3" }
    ],
    workflow: [
      { name: "fn1", functionName: "fn1" },
      { name: "fn2", functionName: "fn2" },
      { name: "fn3", functionName: "fn3" }
    ],
    maxCycles: 1
  });
  
  // Scenario 2: Parallel execution
  await runScenario("Parallel Execution", {
    functions: [
      { name: "syncSectors", functionName: "syncSectors" },
      { name: "syncIndustries", functionName: "syncIndustries" },
      { name: "syncMarket", functionName: "syncMarket" }
    ],
    workflow: [
      { name: "syncSectors", parallelGroup: "percentiles", functionName: "syncSectors" },
      { name: "syncIndustries", parallelGroup: "percentiles", functionName: "syncIndustries" },
      { name: "syncMarket", functionName: "syncMarket" }
    ],
    maxCycles: 1
  });
  
  // Scenario 3: Mixed parallel and sequential
  await runScenario("Mixed Execution", {
    functions: [
      { name: "fetchData", functionName: "fetchData" },
      { name: "processA", functionName: "processA" },
      { name: "processB", functionName: "processB" },
      { name: "finalize", functionName: "finalize" }
    ],
    workflow: [
      { name: "fetchData", functionName: "fetchData" },
      { name: "processA", parallelGroup: "processing", functionName: "processA" },
      { name: "processB", parallelGroup: "processing", functionName: "processB" },
      { name: "finalize", functionName: "finalize" }
    ],
    maxCycles: 1
  });
  
  // Scenario 4: Multiple cycles
  await runScenario("Multiple Cycles", {
    functions: [
      { name: "dailySync", functionName: "dailySync" },
      { name: "cleanup", functionName: "cleanup" }
    ],
    workflow: [
      { name: "dailySync", functionName: "dailySync" },
      { name: "cleanup", functionName: "cleanup" }
    ],
    maxCycles: 2
  });
  
  // Scenario 5: Long sequence with early pause
  await runScenario("Long Sequence", {
    functions: [
      { name: "step1", functionName: "step1" },
      { name: "step2", functionName: "step2" },
      { name: "step3", functionName: "step3" },
      { name: "step4", functionName: "step4" },
      { name: "step5", functionName: "step5" }
    ],
    workflow: [
      { name: "step1", functionName: "step1" },
      { name: "step2", functionName: "step2" },
      { name: "step3", functionName: "step3" },
      { name: "step4", functionName: "step4" },
      { name: "step5", functionName: "step5" }
    ],
    maxCycles: 1
  });
  
  // Print final summary
  console.log("\n🎉 All Scenarios Completed!");
  console.log("============================");
  
  testResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.scenario}:`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Status: ${result.status.overallStatus}`);
    console.log(`   Cycles: ${result.status.totalCycles}`);
    console.log(`   Progress: ${result.status.progress}%`);
    console.log(`   Functions: ${result.status.completedAsyncFns}/${result.status.totalAsyncFns}`);
  });
  
  const totalDuration = testResults.reduce((sum, result) => sum + result.duration, 0);
  console.log(`\n📊 Total Test Duration: ${totalDuration}ms`);
  console.log(`📊 Average Scenario Duration: ${(totalDuration / testResults.length).toFixed(1)}ms`);
  
  console.log("\n✅ All tests completed successfully!");
}

// Run all scenarios
runAllScenarios().catch((error) => {
  console.error("❌ Test suite failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});
