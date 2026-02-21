# dv-async-priority-queue

Async queue manager with concurrency control and priority support for Buydy applications.

## Features

- ✅ **Concurrency Control**: Limit the number of parallel async operations
- ✅ **Automatic Queuing**: Tasks are automatically queued when max concurrency is reached
- ✅ **Immediate Execution**: Tasks execute as soon as a slot becomes available (no batch waiting)
- ✅ **Priority Support**: Optional priority-based task ordering (lower number = higher priority)
- ✅ **Individual Task Promises**: Each task returns a promise that resolves/rejects independently
- ✅ **Cancellation**: Cancel all pending tasks in the queue
- ✅ **Progress Tracking**: Real-time progress callbacks
- ✅ **Error Handling**: Comprehensive error tracking and callbacks
- ✅ **Detailed Logging**: Built-in logging with timestamps and queue name
- ✅ **Memory Efficient**: Better than static batching
- ✅ **Isomorphic**: Works in Node.js and browser environments

## Installation

```bash
yarn add @buydy/dv-async-priority-queue
```

## Usage

### Basic Queue (FIFO)

```javascript
import { AsyncQueueManager } from '@buydy/dv-async-priority-queue';

// Create a queue with max 10 concurrent tasks
const queue = new AsyncQueueManager({
  maxConcurrency: 10,
  name: 'API Queue',
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
});

// Add tasks - each returns a promise
const urls = ['url1', 'url2', 'url3'];
const promises = urls.map(url => queue.addTask(() => fetch(url)));

// Wait for all tasks
await Promise.all(promises);

// Or wait for completion
const { results, errors } = await queue.waitForCompletion();
```

### Priority Queue

```javascript
const queue = new AsyncQueueManager({
  maxConcurrency: 5,
  name: 'Priority Queue'
});

// Lower priority number = higher priority (executes first)
await queue.addTask(() => fetchCriticalData(), 1);   // High priority
await queue.addTask(() => fetchNormalData(), 50);    // Medium priority  
await queue.addTask(() => fetchLowPriorityData(), 100); // Low priority

// Tasks execute in priority order: 1, 50, 100
await queue.waitForCompletion();
```

### Individual Task Promises

```javascript
const queue = new AsyncQueueManager({ maxConcurrency: 3, name: 'Task Queue' });

// Each task returns a promise
const task1 = queue.addTask(async () => {
  await delay(100);
  return 'result1';
});

const task2 = queue.addTask(async () => {
  throw new Error('Task failed');
});

// Wait for individual tasks
try {
  const result = await task1;
  console.log(result); // 'result1'
} catch (error) {
  console.error('Task 1 failed');
}

try {
  await task2;
} catch (error) {
  console.error('Task 2 failed:', error.message);
}
```

### Cancel Pending Tasks

```javascript
const queue = new AsyncQueueManager({ maxConcurrency: 2, name: 'Cancelable Queue' });

// Add many tasks
for (let i = 0; i < 100; i++) {
  queue.addTask(() => processItem(i));
}

// Cancel all pending tasks (running tasks will complete)
queue.cancel();

// Queue is now reset and empty
```

### With Callbacks

```javascript
const queue = new AsyncQueueManager({
  maxConcurrency: 15,
  name: 'EODHD API',
  onTaskComplete: (result, index) => {
    console.log(`✅ Task ${index} completed:`, result);
  },
  onTaskError: (error, index) => {
    console.error(`❌ Task ${index} failed:`, error.message);
  },
  onProgress: (completed, total) => {
    console.log(`📊 ${completed}/${total} completed`);
  }
});

// Add tasks
await queue.addTask(() => processItem(item1));
await queue.addTask(() => processItem(item2));

// Get summary
const summary = await queue.waitForCompletion();
console.log('Summary:', summary);
```

### Real-World Example: API Rate Limiting

```javascript
import { AsyncQueueManager } from '@buydy/dv-async-priority-queue';
import { EODHDClient } from '@buydy/se-eodhd';

const client = new EODHDClient({ apiKey: process.env.API_KEY });

// Limit to 15 concurrent API requests
const queue = new AsyncQueueManager({
  maxConcurrency: 15,
  name: 'Stock Data Fetcher',
  onProgress: (completed, total) => {
    console.log(`Processed ${completed}/${total} stocks`);
  }
});

// Add thousands of API calls with priority
for (const symbol of criticalSymbols) {
  queue.addTask(() => client.stocks.getFundamentalData(symbol), 1); // High priority
}

for (const symbol of normalSymbols) {
  queue.addTask(() => client.stocks.getFundamentalData(symbol), 50); // Normal priority
}

// All requests respect the 15 concurrent limit and priority order
await queue.waitForCompletion();
```

## API

### Constructor Options

```javascript
new AsyncQueueManager({
  maxConcurrency: number,              // Required: Max parallel tasks
  name?: string,                       // Optional: Queue name for logging (default: "Queue")
  onProgress?: (completed, total) => void,
  onTaskComplete?: (result, index) => void,
  onTaskError?: (error, index) => void
})
```

### Methods

#### `addTask(taskFn, priority?)`

Add a single task to the queue. Returns a promise that resolves/rejects with the task result.

```javascript
const promise = queue.addTask(
  async () => myAsyncFunction(),
  10  // Optional priority (lower = higher priority)
);

const result = await promise;
```

#### `addTasks(taskFns)`

Add multiple tasks at once. Returns a promise that resolves when all tasks complete.

```javascript
await queue.addTasks([
  () => task1(),
  () => task2(),
  () => task3()
]);
```

#### `waitForCompletion()`

Wait for all tasks to complete and get results summary.

```javascript
const { results, errors } = await queue.waitForCompletion();
console.log(`Completed: ${results.length}, Failed: ${errors.filter(Boolean).length}`);
```

#### `getStats()`

Get current queue statistics.

```javascript
const { running, queued, completed, failed, totalTasks } = queue.getStats();
```

#### `getResults()`

Get results without waiting.

```javascript
const { results, errors } = queue.getResults();
```

#### `reset()`

Reset the queue manager to initial state.

```javascript
queue.reset();
```

#### `cancel()`

Cancel all pending tasks and reset the queue.

```javascript
queue.cancel(); // Clears queue and rejects waitForCompletion promise
```

## Priority System

- **Priority is a number**: Lower values = higher priority
- **Priority 1**: Critical tasks (execute first)
- **Priority 50**: Normal tasks
- **Priority 100+**: Low priority tasks
- **No priority (null)**: FIFO order

```javascript
// Priority examples
queue.addTask(() => critical(), 1);      // Runs first
queue.addTask(() => normal(), 50);       // Runs second
queue.addTask(() => lowPriority(), 100); // Runs last
queue.addTask(() => fifo());             // FIFO with other no-priority tasks
```

## Logging

Built-in logging shows queue activity with timestamps:

```
[10:30:45] [Stock Fetcher] 🚀 Created (maxConcurrency=15)
[10:30:45] [Stock Fetcher] ➕ Task 0 added (total=1, priority=FIFO)
[10:30:45] [Stock Fetcher] ▶️  Starting task 0 (priority=FIFO)
[10:30:46] [Stock Fetcher] ✅ Task 0 completed in 0.85s
[10:30:46] [Stock Fetcher] 📊 Progress: 1/10 (running=0, queued=9)
```

## Testing

```bash
yarn test
```

## Benefits Over Static Batching

### Static Batching (Inefficient)
```javascript
// Process in batches of 15
for (let i = 0; i < items.length; i += 15) {
  const batch = items.slice(i, i + 15);
  await Promise.all(batch.map(item => process(item)));
  // ❌ Waits for ALL 15 to complete before starting next batch
  // ❌ If 14 finish quickly, slot sits idle waiting for 1 slow task
}
```

### AsyncQueueManager (Efficient)
```javascript
const queue = new AsyncQueueManager({ maxConcurrency: 15, name: 'Processor' });
for (const item of items) {
  queue.addTask(() => process(item));
  // ✅ Starts immediately when slot available
  // ✅ No idle slots - always running at max capacity
}
await queue.waitForCompletion();
```

## Performance Comparison

For 1000 API calls with varying response times:
- **Static batching**: ~90 seconds (many idle slots)
- **AsyncQueueManager**: ~60 seconds (optimal utilization)

## Use Cases

- **API Rate Limiting**: Control concurrent API requests with priority
- **Database Operations**: Limit parallel DB queries
- **File Processing**: Process files with concurrency limit
- **Web Scraping**: Respect server load limits
- **Batch Processing**: Efficient bulk operations with priority
- **Resource Management**: Control resource-intensive operations

## License

MIT
