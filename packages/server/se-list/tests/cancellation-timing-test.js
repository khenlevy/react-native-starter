#!/usr/bin/env node

/**
 * Comprehensive Cancellation Test
 * Tests the internal cancellation functionality with realistic timing
 */

import { getCycledList } from "../src/index.js";

console.log("🧪 Comprehensive Cancellation Test");
console.log("===================================");
console.log("");

async function testCancellationWithTiming() {
  const cycledList = getCycledList();
  
  // Stop any existing instance
  await cycledList.stop();

  // Track execution timing
  const startTime = Date.now();
  const executionLog = [];

  // Mock 5-second async functions
  const mockAsyncFunctions = {
    async fn1() {
      const fnStartTime = Date.now();
      console.log(`  🚀 fn1 started at ${((fnStartTime - startTime) / 1000).toFixed(1)}s`);
      executionLog.push({ fn: 'fn1', start: fnStartTime, status: 'started' });
      
      // Simulate 5 seconds of work
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const fnEndTime = Date.now();
      console.log(`  ✅ fn1 completed at ${((fnEndTime - startTime) / 1000).toFixed(1)}s`);
      executionLog.push({ fn: 'fn1', end: fnEndTime, status: 'completed' });
      
      return { success: true, fn: 'fn1' };
    },

    async fn2() {
      const fnStartTime = Date.now();
      console.log(`  🚀 fn2 started at ${((fnStartTime - startTime) / 1000).toFixed(1)}s`);
      executionLog.push({ fn: 'fn2', start: fnStartTime, status: 'started' });
      
      // Simulate 5 seconds of work
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const fnEndTime = Date.now();
      console.log(`  ✅ fn2 completed at ${((fnEndTime - startTime) / 1000).toFixed(1)}s`);
      executionLog.push({ fn: 'fn2', end: fnEndTime, status: 'completed' });
      
      return { success: true, fn: 'fn2' };
    },

    async fn3() {
      const fnStartTime = Date.now();
      console.log(`  🚀 fn3 started at ${((fnStartTime - startTime) / 1000).toFixed(1)}s`);
      executionLog.push({ fn: 'fn3', start: fnStartTime, status: 'started' });
      
      // Simulate 5 seconds of work
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const fnEndTime = Date.now();
      console.log(`  ✅ fn3 completed at ${((fnEndTime - startTime) / 1000).toFixed(1)}s`);
      executionLog.push({ fn: 'fn3', end: fnEndTime, status: 'completed' });
      
      return { success: true, fn: 'fn3' };
    }
  };

  // Override the executeAsyncFn method to use our mock functions
  const originalExecuteAsyncFn = cycledList.executeAsyncFn;
  cycledList.executeAsyncFn = async function(node) {
    const mockFunctions = {
      fn1: mockAsyncFunctions.fn1,
      fn2: mockAsyncFunctions.fn2,
      fn3: mockAsyncFunctions.fn3
    };
    
    const fn = mockFunctions[node.functionName];
    if (fn) {
      return await fn();
    }
    
    // Fallback to original method
    return await originalExecuteAsyncFn.call(this, node);
  };

  // Define workflow
  const workflow = [
    { name: "fn1", functionName: "fn1" },
    { name: "fn2", functionName: "fn2" },
    { name: "fn3", functionName: "fn3" }
  ];

  // Set up pause condition that triggers at 8 seconds
  let shouldPause = false;
  
  await cycledList.pauseOnTruthy(async () => {
    const currentTime = (Date.now() - startTime) / 1000;
    console.log(`  🔍 Checking pause condition at ${currentTime.toFixed(1)}s`);
    
    if (shouldPause) {
      console.log(`  ⚠️ Pause condition met at ${currentTime.toFixed(1)}s - cancelling operations!`);
      return true;
    }
    
    return false;
  });

  // Set up continue condition
  await cycledList.continueOnTruthy(async () => {
    const currentTime = (Date.now() - startTime) / 1000;
    console.log(`  🔍 Checking continue condition at ${currentTime.toFixed(1)}s`);
    
    if (shouldPause) {
      console.log(`  ⏸️ Still paused at ${currentTime.toFixed(1)}s`);
      return false;
    }
    
    console.log(`  ✅ Resuming execution at ${currentTime.toFixed(1)}s`);
    return true;
  });

  // Trigger pause at 8 seconds
  setTimeout(() => {
    console.log("\n🚨 PAUSE TRIGGERED AT 8 SECONDS!");
    console.log("=================================");
    shouldPause = true;
  }, 8000);

  // Resume after 3 seconds of pause (at 11 seconds total)
  setTimeout(() => {
    console.log("\n✅ RESUMING AT 11 SECONDS!");
    console.log("==========================");
    shouldPause = false;
  }, 11000);

  // Create the cycled list with external cancellation function
  await cycledList.create("Cancellation Test", workflow, {
    cycleInterval: 1000,
    maxCycles: 1,
    cancelFunction: async () => {
      const currentTime = (Date.now() - startTime) / 1000;
      console.log(`  🛑 External cancellation called at ${currentTime.toFixed(1)}s`);
      console.log(`  🛑 This would cancel HTTP requests, DB connections, etc.`);
    }
  });

  // Wait for test to complete
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  // Analyze results
  console.log("\n📊 Test Results Analysis:");
  console.log("=========================");
  
  const fn1Events = executionLog.filter(log => log.fn === 'fn1');
  const fn2Events = executionLog.filter(log => log.fn === 'fn2');
  const fn3Events = executionLog.filter(log => log.fn === 'fn3');
  
  console.log(`fn1 events: ${fn1Events.length}`);
  fn1Events.forEach(event => {
    const time = ((event.start || event.end) - startTime) / 1000;
    console.log(`  - ${event.status} at ${time.toFixed(1)}s`);
  });
  
  console.log(`fn2 events: ${fn2Events.length}`);
  fn2Events.forEach(event => {
    const time = ((event.start || event.end) - startTime) / 1000;
    console.log(`  - ${event.status} at ${time.toFixed(1)}s`);
  });
  
  console.log(`fn3 events: ${fn3Events.length}`);
  fn3Events.forEach(event => {
    const time = ((event.start || event.end) - startTime) / 1000;
    console.log(`  - ${event.status} at ${time.toFixed(1)}s`);
  });
  
  // Verify expected behavior
  const fn2Started = fn2Events.find(e => e.status === 'started');
  const fn2Completed = fn2Events.find(e => e.status === 'completed');
  
  if (fn2Started && !fn2Completed) {
    console.log("\n✅ SUCCESS: fn2 was cancelled as expected!");
    console.log("✅ fn2 started but never completed - cancellation worked!");
  } else if (fn2Started && fn2Completed) {
    console.log("\n⚠️ PARTIAL SUCCESS: fn2 completed, but should have been cancelled");
  } else {
    console.log("\n❌ FAILURE: fn2 never started or unexpected behavior");
  }
  
  await cycledList.stop();
}

// Run the test
testCancellationWithTiming().catch((error) => {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
});