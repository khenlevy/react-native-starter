/**
 * CycledLinkedList Singleton
 * Manages endless execution of linked lists with smart controls
 */

import { LinkedList } from "./LinkedList.js";
import logger from "@buydy/se-logger";

export class CycledLinkedList {
  constructor() {
    if (CycledLinkedList.instance) {
      return CycledLinkedList.instance;
    }

    this.linkedList = new LinkedList();
    this.name = null;
    this.asyncFns = [];
    this.isRunning = false;
    this.isPaused = false;
    this.manualPause = false; // Manual pause state (user-initiated)
    this.pauseReason = null; // Optional reason for pausing (e.g., "EODHD limit reached")
    this.stopReason = null; // Optional reason for stopping (e.g., "Job failure", "EODHD limit reached")
    this.cycleInterval = null; // Deprecated - cycles now run continuously without intervals
    this.maxCycles = null; // null = infinite
    this.currentCycle = 0;
    this.totalCycles = 0;
    this.pauseConditions = [];
    this.continueConditions = [];
    this.cycleTimeout = null;
    this.cancelFunction = null; // Function to call when cancellation is needed
    this.statusChangeCallback = null; // Optional callback for status changes

    CycledLinkedList.instance = this;
    logger.business("🔄 CycledLinkedList singleton initialized");
  }

  /**
   * Set callback for status changes (for persistence)
   */
  setStatusChangeCallback(callback) {
    this.statusChangeCallback = callback;
  }

  static getInstance() {
    if (!CycledLinkedList.instance) {
      new CycledLinkedList();
    }
    return CycledLinkedList.instance;
  }

  /**
   * Notify status change (for external persistence)
   */
  async notifyStatusChange() {
    if (this.statusChangeCallback && typeof this.statusChangeCallback === "function") {
      try {
        await this.statusChangeCallback(this.status());
      } catch (error) {
        logger.debug("Status change callback failed:", error.message);
      }
    }
  }

  /**
   * Create a new cycled list with async functions
   */
  async create(name, asyncFns, options = {}) {
    if (this.name) {
      throw new Error("CycledLinkedList already exists. Use stop() first to create a new one.");
    }

    // Store configuration in memory
    this.name = name;
    this.asyncFns = asyncFns;
    // cycleInterval is deprecated - cycles run continuously now
    this.cycleInterval = null;
    this.maxCycles = options.maxCycles || null;
    this.currentCycle = 0;
    this.totalCycles = 0;
    this.cancelFunction = options.cancelFunction || null; // Store cancellation function

    // Add async functions to linked list
    asyncFns.forEach((asyncFn, index) => {
      this.linkedList.addNode(`asyncFn_${index}`, {
        name: asyncFn.name,
        parallelGroup: asyncFn.parallelGroup,
        functionName: asyncFn.functionName || asyncFn.name,
        skipped: asyncFn.skipped || false, // Preserve skipped flag from workflow
      });
    });

    logger.business(`📋 Created cycled list "${name}" with ${asyncFns.length} async functions`);

    // Start first cycle (which will persist status)
    await this.startCycle();

    return { name, asyncFns, status: "created" };
  }

  /**
   * Start a new cycle
   */
  async startCycle() {
    if (!this.name) {
      throw new Error("No cycled list exists. Call create() first.");
    }

    if (this.isRunning) {
      logger.business("⚠️ Cycle already running, skipping start");
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.currentCycle++;
    // Reset index when starting a new cycle
    this.currentAsyncFnIndex = -1;

    logger.business(`🚀 Starting cycle ${this.currentCycle}`);

    // Persist status
    await this.notifyStatusChange();

    // Execute the linked list
    await this.executeList();
  }

  /**
   * Execute the linked list
   */
  async executeList() {
    try {
      // Get all nodes in execution order
      const allNodes = [];
      for (let i = 0; i < this.linkedList.executionOrder.length; i++) {
        const nodeId = this.linkedList.executionOrder[i];
        const node = this.linkedList.nodes.get(nodeId);
        if (node) {
          allNodes.push({ ...node, index: i });
        }
      }

      // Start from stored index if resuming, otherwise start from 0
      let i = this.currentAsyncFnIndex >= 0 ? this.currentAsyncFnIndex : 0;

      while (i < allNodes.length) {
        if (this.isPaused) {
          return;
        }

        // Check pause conditions
        if (await this.checkPauseConditions()) {
          await this.pause();
          return;
        }

        const node = allNodes[i];

        // Update current index for tracking
        this.currentAsyncFnIndex = i;
        const { id, parallelGroup } = node;

        if (parallelGroup) {
          // Collect all nodes in this parallel group (consecutive nodes with same group)
          const currentGroup = [];
          while (i < allNodes.length && allNodes[i].parallelGroup === parallelGroup) {
            currentGroup.push(allNodes[i]);
            i++;
          }
          i--; // Adjust for loop increment

          // Execute this parallel group
          logger.business(`⚡ Executing parallel group: ${parallelGroup}`);

          const parallelPromises = currentGroup.map((nodeInGroup) => {
            this.linkedList.updateNodeStatus(nodeInGroup.id, "running");
            logger.business(`🔄 Executing async function: ${nodeInGroup.name}`);

            return this.executeAsyncFn(nodeInGroup)
              .then((result) => {
                // Check if node was cancelled during execution
                if (this.linkedList.isNodeCancelled(nodeInGroup.id)) {
                  logger.business(`🛑 Node ${nodeInGroup.id} was cancelled during execution`);
                  return { node: nodeInGroup, cancelled: true };
                }

                this.linkedList.updateNodeStatus(nodeInGroup.id, "completed");
                logger.business(`✅ Node ${nodeInGroup.id} completed`);
                return { node: nodeInGroup, result };
              })
              .catch((error) => {
                // Check if it was cancelled
                if (this.linkedList.isNodeCancelled(nodeInGroup.id)) {
                  logger.business(`🛑 Node ${nodeInGroup.id} was cancelled`);
                  return { node: nodeInGroup, cancelled: true };
                }

                this.linkedList.updateNodeStatus(nodeInGroup.id, "failed");
                logger.business(`❌ Node ${nodeInGroup.id} failed: ${error.message}`);
                return { node: nodeInGroup, error };
              });
          });

          // Wait for this parallel group to complete before continuing
          const results = await Promise.allSettled(parallelPromises);

          // Check if any failed (but not cancelled)
          const failures = results.filter(
            (result) =>
              result.status === "fulfilled" && result.value.error && !result.value.cancelled
          );

          if (failures.length > 0) {
            logger.business(`❌ ${failures.length} parallel nodes failed`);

            // Check if we should pause instead of stop (use first failure error)
            const firstFailure = failures[0];
            const error = firstFailure.value?.error;
            if (await this.checkPauseConditions(error)) {
              logger.business("⏸️ Pause condition met, pausing instead of stopping");
              await this.pause();
            } else {
              const failedNodeNames = currentGroup
                .map((n, idx) => failures[idx]?.value?.node?.name || n.name)
                .filter(Boolean)
                .join(", ");
              const stopReason = `Parallel job failures (${
                failures.length
              }): ${failedNodeNames} - ${error?.message || "Unknown error"}`;
              logger.business(`🛑 Stopping cycle due to failures: ${stopReason}`);
              await this.stop(stopReason);
            }
            return;
          }
        } else {
          // Execute non-parallel node immediately
          this.linkedList.updateNodeStatus(id, "running");
          logger.business(`🔄 Executing async function: ${node.name}`);

          try {
            const result = await this.executeAsyncFn(node);

            // Check if node was cancelled during execution
            if (this.linkedList.isNodeCancelled(id)) {
              logger.business(`🛑 Node ${id} was cancelled during execution`);
              // Don't mark as completed, will retry when resumed
              return;
            }

            // If executeAsyncFn returns null, it means the job was already completed (e.g., resume scenario)
            if (result === null) {
              logger.business(`⏭️ Node ${id} already completed, skipping`);
              // Continue to next node - don't mark as completed in linked list since it was already done
            } else {
              this.linkedList.updateNodeStatus(id, "completed");
              logger.business(`✅ Node ${id} completed`);
            }
          } catch (error) {
            // Check if it was cancelled
            if (this.linkedList.isNodeCancelled(id)) {
              logger.business(`🛑 Node ${id} was cancelled`);
              return; // Don't stop the list, just return
            }

            this.linkedList.updateNodeStatus(id, "failed");
            logger.business(`❌ Node ${id} failed: ${error.message}`);

            // Check if we should pause instead of stop
            logger.business("🔍 About to check pause conditions", { errorMessage: error.message });
            if (await this.checkPauseConditions(error)) {
              logger.business("⏸️ Pause condition met, pausing instead of stopping");
              await this.pause();
            } else {
              const stopReason = `Job failure: ${node.name} - ${error.message}`;
              logger.business(`🛑 Stopping cycle due to node failure: ${stopReason}`);
              await this.stop(stopReason);
            }
            return;
          }
        }

        i++;
      }

      // Cycle completed
      if (!this.isPaused) {
        await this.completeCycle();
      } else {
        // Persist status even if paused
        await this.notifyStatusChange();
      }
    } catch (error) {
      logger.business(`❌ Cycle execution failed: ${error.message}`);

      // Check if we should pause instead of stop
      if (await this.checkPauseConditions(error)) {
        logger.business("⏸️ Pause condition met, pausing instead of stopping");
        await this.pause();
      } else {
        const stopReason = `Cycle execution error: ${error.message}`;
        logger.business(`🛑 Stopping cycle due to error: ${stopReason}`);
        await this.stop(stopReason);
      }
    }
  }

  /**
   * Execute a single async function
   */
  async executeAsyncFn(node) {
    // This is where external async function execution would happen
    // For now, simulate execution
    logger.business(`⚡ Executing ${node.name}...`);

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error(`${node.name} failed randomly`);
    }

    return { success: true, asyncFn: node.name };
  }

  /**
   * Complete the current cycle
   */
  async completeCycle() {
    this.isRunning = false;
    this.totalCycles++;
    this.stopReason = null; // Clear stop reason on successful completion

    logger.business(`✅ Cycle ${this.currentCycle} completed`);

    // Persist status
    await this.notifyStatusChange();

    // Start next cycle immediately instead of scheduling
    await this.startNextCycleImmediately();
  }

  /**
   * Start the next cycle immediately
   */
  async startNextCycleImmediately() {
    if (this.maxCycles && this.totalCycles >= this.maxCycles) {
      const stopReason = "Max cycles reached";
      logger.business(`🏁 ${stopReason}, stopping`);
      await this.stop(stopReason);
      return;
    }

    // Clear any existing timeout
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }

    // Check continue conditions before starting
    if (await this.checkContinueConditions()) {
      logger.business("🚀 Starting next cycle immediately");
      // Start next cycle right away
      await this.startCycle();
    } else {
      logger.business("⏸️ Continue conditions not met, pausing");
      await this.pause();
    }
  }

  /**
   * Schedule the next cycle (deprecated - cycles now start immediately)
   * Kept for backward compatibility if needed
   */
  async scheduleNextCycle() {
    // Redirect to immediate start for consistency
    await this.startNextCycleImmediately();
  }

  /**
   * Add pause condition
   */
  async pauseOnTruthy(conditionFn, interval = 5000) {
    this.pauseConditions.push({ fn: conditionFn, interval });
    logger.business("⏸️ Added pause condition");

    // Start checking conditions
    this.startConditionChecking();
  }

  /**
   * Add continue condition
   */
  async continueOnTruthy(conditionFn, interval = 5000) {
    this.continueConditions.push({ fn: conditionFn, interval });
    logger.business("▶️ Added continue condition");

    // Start checking conditions
    this.startConditionChecking();
  }

  /**
   * Check pause conditions
   */
  async checkPauseConditions(error = null) {
    for (const condition of this.pauseConditions) {
      try {
        const result = await condition.fn(error);
        if (result) {
          logger.business("⏸️ Pause condition met - cancelling current operations");
          await this.cancelCurrentOperations();
          return true;
        }
      } catch (error) {
        logger.business(`❌ Pause condition error: ${error.message}`);
        await this.stop();
        return true;
      }
    }
    return false;
  }

  /**
   * Cancel current running operations
   */
  async cancelCurrentOperations() {
    logger.business("🛑 Cancelling current operations...");

    // Cancel all running nodes
    for (const [nodeId, node] of this.linkedList.nodes.entries()) {
      if (node.status === "running") {
        this.linkedList.cancelNode(nodeId);
      }
    }

    // Call external cancellation function if provided
    if (this.cancelFunction) {
      try {
        await this.cancelFunction();
        logger.business("🛑 External cancellation function called");
      } catch (error) {
        logger.business(`❌ Cancellation function error: ${error.message}`);
      }
    }
  }

  /**
   * Check continue conditions
   */
  async checkContinueConditions() {
    // If manually paused, don't auto-resume even if conditions are met
    if (this.manualPause) {
      logger.business("⏸️ Manual pause active - cannot auto-resume");
      return false;
    }

    if (this.continueConditions.length === 0) {
      return true; // No conditions = always continue (unless manually paused)
    }

    for (const condition of this.continueConditions) {
      try {
        const result = await condition.fn();
        if (!result) {
          logger.business("⏸️ Continue condition not met");
          return false;
        }
      } catch (error) {
        logger.business(`❌ Continue condition error: ${error.message}`);
        await this.stop();
        return false;
      }
    }
    return true;
  }

  /**
   * Start checking conditions periodically
   */
  startConditionChecking() {
    if (this.conditionInterval) return; // Already running

    this.conditionInterval = setInterval(async () => {
      // Only auto-resume if paused AND not manually paused AND continue conditions are met
      if (this.isPaused && !this.manualPause && (await this.checkContinueConditions())) {
        await this.continue();
      }
    }, 5000);
  }

  /**
   * Pause execution
   */
  async pause(reason = null) {
    this.isPaused = true;
    this.isRunning = false;
    if (reason) {
      this.pauseReason = reason;
    }

    logger.business(`⏸️ CycledLinkedList paused${reason ? `: ${reason}` : ""}`);

    // Persist status
    await this.notifyStatusChange();
  }

  /**
   * Continue execution
   */
  async continue() {
    if (!this.isPaused) {
      logger.business("⚠️ Not paused, cannot continue");
      return;
    }

    this.isPaused = false;
    this.manualPause = false; // Clear manual pause when continuing
    this.pauseReason = null; // Clear pause reason when continuing
    this.stopReason = null; // Clear stop reason when continuing

    logger.business("▶️ CycledLinkedList continued");

    // Persist status
    await this.notifyStatusChange();

    // Resume execution
    await this.executeList();
  }

  /**
   * Manually pause execution (user-initiated)
   * This prevents auto-resume even when EODHD limits are cleared
   */
  async pauseManually() {
    this.manualPause = true;
    this.isPaused = true;
    this.isRunning = false;
    this.pauseReason = "Manually paused by user";

    logger.business("⏸️ CycledLinkedList manually paused");

    // Cancel current operations
    await this.cancelCurrentOperations();

    // Persist status
    await this.notifyStatusChange();
  }

  /**
   * Manually resume execution (user-initiated)
   * This clears manual pause and resumes execution
   */
  async resumeManually() {
    if (!this.manualPause && !this.isPaused) {
      logger.business("⚠️ Not manually paused, cannot resume");
      return;
    }

    this.manualPause = false;
    await this.continue(); // Use continue() which will clear pauseReason and resume
  }

  /**
   * Stop execution permanently
   * @param {string} reason - Optional reason for stopping (e.g., "Job failure", "EODHD limit reached")
   */
  async stop(reason = null) {
    this.isRunning = false;
    this.isPaused = false;
    this.stopReason = reason || null;

    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }

    if (this.conditionInterval) {
      clearInterval(this.conditionInterval);
      this.conditionInterval = null;
    }

    // Only reset singleton instance if explicitly requested (for testing)
    // Don't reset on normal stop to preserve status for API
    logger.business(`🛑 CycledLinkedList stopped${reason ? `: ${reason}` : ""}`);

    // Persist status
    await this.notifyStatusChange();
  }

  /**
   * Reset singleton instance (for testing only)
   */
  resetInstance() {
    CycledLinkedList.instance = null;
    logger.business("🔄 CycledLinkedList instance reset");
  }

  /**
   * Restart from beginning
   */
  async restart() {
    await this.stop();

    if (this.name) {
      this.linkedList.reset();
      this.currentCycle = 0;
      this.stopReason = null; // Clear stop reason on restart
      this.pauseReason = null; // Clear pause reason on restart
      this.manualPause = false; // Clear manual pause on restart

      logger.business("🔄 CycledLinkedList restarted");

      // Start first cycle
      await this.startCycle();
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    const listStatus = this.linkedList.getStatus();

    return {
      ...listStatus,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      manualPause: this.manualPause,
      pauseReason: this.pauseReason,
      stopReason: this.stopReason,
      currentCycle: this.currentCycle,
      totalCycles: this.totalCycles,
      name: this.name,
    };
  }

  /**
   * Get detailed status information
   */
  status() {
    const listStatus = this.linkedList.getStatus();
    const currentNode = this.linkedList.getCurrentNode();

    return {
      // Basic info
      name: this.name,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      manualPause: this.manualPause,
      pauseReason: this.pauseReason,
      stopReason: this.stopReason,

      // Cycle information
      currentCycle: this.currentCycle,
      totalCycles: this.totalCycles,
      maxCycles: this.maxCycles,
      cycleInterval: this.cycleInterval,

      // Async function execution status
      totalAsyncFns: listStatus.total,
      completedAsyncFns: listStatus.completed,
      failedAsyncFns: listStatus.failed,
      currentAsyncFnIndex: listStatus.current,
      progress: listStatus.progress,

      // Current async function details
      currentAsyncFn: currentNode
        ? {
            name: currentNode.name,
            parallelGroup: currentNode.parallelGroup,
            functionName: currentNode.functionName,
            attempts: currentNode.attempts,
            maxAttempts: currentNode.maxAttempts,
            status: currentNode.status,
          }
        : null,

      // Next async function info
      nextAsyncFn: this.getNextAsyncFnInfo(),

      // Conditions
      pauseConditions: this.pauseConditions,
      continueConditions: this.continueConditions,

      // Timing
      nextCycleScheduled: this.getNextCycleTime(),

      // Overall status
      overallStatus: this.getOverallStatus(),
    };
  }

  /**
   * Get information about the next async function to run
   */
  getNextAsyncFnInfo() {
    if (this.linkedList.isCompleted()) {
      return null;
    }

    const nextNode = this.linkedList.getNextNode();
    if (!nextNode) {
      return null;
    }

    return {
      name: nextNode.name,
      parallelGroup: nextNode.parallelGroup,
      functionName: nextNode.functionName,
      attempts: nextNode.attempts,
      maxAttempts: nextNode.maxAttempts,
    };
  }

  /**
   * Get when the next cycle is scheduled
   * Returns null since cycles now run continuously without scheduling
   */
  getNextCycleTime() {
    // Cycles run continuously - no scheduled time
    // nextCycleScheduled is only set when paused (e.g., EODHD limit) to show resume time
    return null;
  }

  /**
   * Get overall status summary
   */
  getOverallStatus() {
    if (!this.name) {
      return "not_initialized";
    }

    if (this.isPaused) {
      return "paused";
    }

    if (this.isRunning) {
      return "running";
    }

    if (this.maxCycles && this.totalCycles >= this.maxCycles) {
      return "completed";
    }

    return "stopped";
  }
}
