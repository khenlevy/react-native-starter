import { test } from "node:test";
import assert from "node:assert";
import { AsyncQueueManager } from "../src/index.js";

// Helper to create delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("AsyncQueueManager - basic concurrency control", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 2, name: "TestQueue" });

  let running = 0;
  let maxRunning = 0;

  const tasks = Array.from({ length: 10 }, (_, i) =>
    queue.addTask(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await delay(10);
      running--;
      return `task-${i}`;
    })
  );

  await Promise.all(tasks);
  const { results } = await queue.waitForCompletion();

  assert.strictEqual(maxRunning, 2, "Should not exceed maxConcurrency");
  assert.strictEqual(results.length, 10, "Should have 10 results");
  assert.strictEqual(queue.getStats().completed, 10, "Should complete all tasks");
});

test("AsyncQueueManager - priority ordering", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 1, name: "PriorityQueue" });

  const executionOrder = [];

  // Add tasks with different priorities (lower = more important)
  const tasks = [
    queue.addTask(
      async () => {
        executionOrder.push("low");
        return "low-priority";
      },
      100
    ), // Low priority
    queue.addTask(
      async () => {
        executionOrder.push("high");
        return "high-priority";
      },
      1
    ), // High priority
    queue.addTask(
      async () => {
        executionOrder.push("medium");
        return "medium-priority";
      },
      50
    ), // Medium priority
  ];

  await Promise.all(tasks);

  // With concurrency 1, tasks should execute in priority order: high, medium, low
  assert.deepStrictEqual(
    executionOrder,
    ["low", "high", "medium"],
    "First task starts immediately (FIFO), then priority takes over"
  );
});

test("AsyncQueueManager - FIFO when no priority", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 1, name: "FIFOQueue" });

  const executionOrder = [];

  await queue.addTask(async () => executionOrder.push(1));
  await queue.addTask(async () => executionOrder.push(2));
  await queue.addTask(async () => executionOrder.push(3));

  await queue.waitForCompletion();

  assert.deepStrictEqual(executionOrder, [1, 2, 3], "Should execute in FIFO order");
});

test("AsyncQueueManager - error handling", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 2, name: "ErrorQueue" });

  const errorCallbacks = [];
  queue.onTaskError = (error, index) => {
    errorCallbacks.push({ error: error.message, index });
  };

  // Add successful task
  await queue.addTask(async () => "success");

  // Add failing task
  try {
    await queue.addTask(async () => {
      throw new Error("Task failed");
    });
    assert.fail("Should have thrown error");
  } catch (error) {
    assert.strictEqual(error.message, "Task failed");
  }

  const { errors } = await queue.waitForCompletion();

  assert.strictEqual(errors.filter(Boolean).length, 1, "Should have 1 error");
  assert.strictEqual(errorCallbacks.length, 1, "Should call error callback once");
});

test("AsyncQueueManager - progress tracking", async () => {
  const progressUpdates = [];

  const queue = new AsyncQueueManager({
    maxConcurrency: 2,
    name: "ProgressQueue",
    onProgress: (completed, total) => {
      progressUpdates.push({ completed, total });
    },
  });

  const tasks = Array.from({ length: 5 }, () => queue.addTask(async () => delay(10)));

  await Promise.all(tasks);
  await queue.waitForCompletion();

  assert.strictEqual(progressUpdates.length, 5, "Should have 5 progress updates");
  assert.strictEqual(progressUpdates[4].completed, 5, "Final progress should be 5/5");
  assert.strictEqual(progressUpdates[4].total, 5, "Total should be 5");
});

test("AsyncQueueManager - cancel queue", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 1, name: "CancelQueue" });

  const results = [];

  // Add first task
  queue.addTask(async () => {
    results.push(1);
    await delay(10);
  });

  // Add more tasks
  queue.addTask(async () => results.push(2));
  queue.addTask(async () => results.push(3));

  // Cancel immediately
  await delay(5);
  queue.cancel();

  // Wait a bit to ensure cancelled tasks don't run
  await delay(50);

  // Only the first task should have run
  assert.strictEqual(results.length, 1, "Should only run first task before cancel");
  assert.strictEqual(queue.getStats().queued, 0, "Queue should be empty after cancel");
});

test("AsyncQueueManager - getStats", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 2, name: "StatsQueue" });

  // Add tasks
  const task1 = queue.addTask(async () => delay(20));
  const task2 = queue.addTask(async () => delay(20));
  const task3 = queue.addTask(async () => delay(20));

  // Check stats while running
  await delay(5);
  const stats = queue.getStats();

  assert.strictEqual(stats.running, 2, "Should have 2 running");
  assert.strictEqual(stats.queued, 1, "Should have 1 queued");
  assert.strictEqual(stats.totalTasks, 3, "Should have 3 total tasks");

  await Promise.all([task1, task2, task3]);
  await queue.waitForCompletion();

  const finalStats = queue.getStats();
  assert.strictEqual(finalStats.completed, 3, "Should complete all 3 tasks");
  assert.strictEqual(finalStats.running, 0, "Should have 0 running");
  assert.strictEqual(finalStats.queued, 0, "Should have 0 queued");
});

test("AsyncQueueManager - reset", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 2, name: "ResetQueue" });

  await queue.addTask(async () => "result1");
  await queue.waitForCompletion();

  assert.strictEqual(queue.getStats().completed, 1, "Should have 1 completed");

  queue.reset();

  const stats = queue.getStats();
  assert.strictEqual(stats.completed, 0, "Completed should be reset");
  assert.strictEqual(stats.totalTasks, 0, "Total tasks should be reset");
  assert.strictEqual(stats.running, 0, "Running should be reset");
});

test("AsyncQueueManager - addTasks batch", async () => {
  const queue = new AsyncQueueManager({ maxConcurrency: 3, name: "BatchQueue" });

  const taskFns = Array.from({ length: 5 }, (_, i) => async () => `result-${i}`);

  await queue.addTasks(taskFns);
  const { results } = await queue.waitForCompletion();

  assert.strictEqual(results.length, 5, "Should have 5 results");
  assert.strictEqual(results[0], "result-0", "First result should match");
  assert.strictEqual(results[4], "result-4", "Last result should match");
});

test("AsyncQueueManager - task completion callback", async () => {
  const completedTasks = [];

  const queue = new AsyncQueueManager({
    maxConcurrency: 2,
    name: "CallbackQueue",
    onTaskComplete: (result, index) => {
      completedTasks.push({ result, index });
    },
  });

  await queue.addTask(async () => "task-1");
  await queue.addTask(async () => "task-2");
  await queue.waitForCompletion();

  assert.strictEqual(completedTasks.length, 2, "Should call callback twice");
  assert.strictEqual(completedTasks[0].result, "task-1", "First callback result should match");
});

