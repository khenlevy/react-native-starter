export class AsyncQueueManager {
  constructor({
    maxConcurrency,
    onProgress,
    onTaskComplete,
    onTaskError,
    name = 'Queue',
    verbose = false,
  }) {
    if (!maxConcurrency || maxConcurrency < 1) {
      throw new Error('maxConcurrency must be at least 1');
    }

    this.maxConcurrency = maxConcurrency;
    this.onProgress = onProgress;
    this.onTaskComplete = onTaskComplete;
    this.onTaskError = onTaskError;
    this.name = name;
    this.verbose = verbose;

    this.reset();
    this._log(`🚀 Created (maxConcurrency=${maxConcurrency})`);
  }

  // === Public API ===

  /**
   * Add a task
   * @param {Function} taskFn - async function to run
   * @param {number} [priority] - optional priority (lower = more important)
   */
  addTask(taskFn, priority = null) {
    const taskIndex = this.taskIndex++;
    this.totalTasks++;

    if (this.verbose) {
      this._log(
        `➕ Task ${taskIndex} added (total=${this.totalTasks}, priority=${
          priority ?? 'FIFO'
        })`,
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: taskFn,
        index: taskIndex,
        resolve,
        reject,
        startedAt: null,
        priority,
      });
      this._processQueue();
    });
  }

  addTasks(taskFns) {
    return Promise.all(taskFns.map((fn) => this.addTask(fn)));
  }

  async waitForCompletion() {
    if (
      this.completed === this.totalTasks &&
      this.running === 0 &&
      this.queue.length === 0
    ) {
      this._log('✅ All tasks already completed');
      return { results: this.results, errors: this.errors };
    }
    if (!this.completionPromise) {
      this.completionPromise = new Promise((resolve, reject) => {
        this.completionResolve = resolve;
        this.completionReject = reject;
      });
    }
    return this.completionPromise;
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      completed: this.completed,
      failed: this.errors.filter(Boolean).length,
      totalTasks: this.totalTasks,
    };
  }

  getResults() {
    return { results: this.results, errors: this.errors };
  }

  reset() {
    this.queue = [];
    this.running = 0;
    this.completed = 0;
    this.totalTasks = 0;
    this.taskIndex = 0;
    this.results = [];
    this.errors = [];
    this.completionPromise = null;
    this.completionResolve = null;
    this.completionReject = null;
  }

  cancel() {
    this.queue = [];
    this.completionReject?.(new Error('Queue cancelled'));
    this._log('🛑 Queue cancelled');
    this.reset();
  }

  // === Internal ===

  _processQueue() {
    // Sort queue by priority (lower = more important, null = FIFO)
    this.queue.sort((a, b) => {
      if (a.priority == null && b.priority == null) {
        return a.index - b.index; // FIFO
      }
      if (a.priority == null) return 1; // put non-priority later
      if (b.priority == null) return -1;
      return a.priority - b.priority; // lower runs sooner
    });

    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      this._executeTask(task);
    }
  }

  async _executeTask(task) {
    this.running++;
    task.startedAt = Date.now();

    if (this.verbose) {
      this._log(
        `▶️  Starting task ${task.index} (priority=${task.priority ?? 'FIFO'})`,
      );
    }

    try {
      const result = await task.fn();
      const duration = ((Date.now() - task.startedAt) / 1000).toFixed(2);

      this.results[task.index] = result;
      task.resolve?.(result);

      if (this.verbose) {
        this._log(`✅ Task ${task.index} completed in ${duration}s`);
      }
      if (this.onTaskComplete) this.onTaskComplete(result, task.index);
    } catch (error) {
      const duration = ((Date.now() - task.startedAt) / 1000).toFixed(2);

      this.errors[task.index] = error;
      task.reject?.(error);

      this._log(
        `❌ Task ${task.index} failed after ${duration}s: ${error.message}`,
      );
      if (this.onTaskError) this.onTaskError(error, task.index);
    } finally {
      this.running--;
      this.completed++;

      if (this.onProgress) this.onProgress(this.completed, this.totalTasks);
      this._log(
        `📊 Progress: ${this.completed}/${this.totalTasks} (running=${this.running}, queued=${this.queue.length})`,
      );

      if (
        this.completed === this.totalTasks &&
        this.running === 0 &&
        this.queue.length === 0
      ) {
        this._log('🎉 All tasks completed');
        this.completionResolve?.({
          results: this.results,
          errors: this.errors,
        });
      } else {
        this._processQueue();
      }
    }
  }

  _log(message) {
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${ts}] [${this.name}] ${message}`);
  }
}
