import express from "express";
import { getModel } from "@buydy/se-db";
import logger from "@buydy/se-logger";

const app = express();
const API_PORT = process.env.API_PORT || 4001;

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// CycledLinkedList status endpoint
app.get("/api/jobs/cycled-list-status", async (req, res) => {
  try {
    // Get status from database instead of in-memory
    const CycledListStatus = getModel("cycled_list_status");

    // Get the latest status (there should only be one document, but get the most recent)
    const statusDoc = await CycledListStatus.findOne().sort({ lastUpdated: -1 });

    // If no status document exists, return not initialized
    if (!statusDoc) {
      const response = {
        // Basic info
        name: null,
        isRunning: false,
        isPaused: false,

        // Cycle information
        currentCycle: 0,
        totalCycles: 0,
        maxCycles: null,
        cycleInterval: 24 * 60 * 60 * 1000,

        // Async function execution status
        totalAsyncFns: 0,
        completedAsyncFns: 0,
        failedAsyncFns: 0,
        currentAsyncFnIndex: -1,
        progress: 0,

        // Current async function details
        currentAsyncFn: null,
        nextAsyncFn: null,

        // Conditions
        pauseConditions: [],
        continueConditions: [],

        // Timing
        nextCycleScheduled: null,

        // Additional UI-friendly data
        statusText: "Not Initialized",
        statusColor: "bg-gray-500",
        timeUntilNextCycle: null,
        cycleProgress: {
          current: 0,
          total: 0,
          percentage: 0,
          completed: 0,
          remaining: 0,
        },
      };
      return res.json(response);
    }

    // Format the response for the UI
    const response = {
      // Basic info
      name: statusDoc.name,
      isRunning: statusDoc.isRunning,
      isPaused: statusDoc.isPaused,
      manualPause: statusDoc.manualPause || false,
      pauseReason: statusDoc.pauseReason || null,
      stopReason: statusDoc.stopReason || null,

      // Cycle information
      currentCycle: statusDoc.currentCycle,
      totalCycles: statusDoc.totalCycles,
      maxCycles: statusDoc.maxCycles,
      cycleInterval: statusDoc.cycleInterval,

      // Async function execution status
      totalAsyncFns: statusDoc.totalAsyncFns,
      completedAsyncFns: statusDoc.completedAsyncFns,
      failedAsyncFns: statusDoc.failedAsyncFns,
      currentAsyncFnIndex: statusDoc.currentAsyncFnIndex,
      progress: statusDoc.progress,

      // Current async function details
      currentAsyncFn: statusDoc.currentAsyncFn,
      nextAsyncFn: statusDoc.nextAsyncFn,

      // Conditions
      pauseConditions: statusDoc.pauseConditions || [],
      continueConditions: statusDoc.continueConditions || [],

      // Timing
      nextCycleScheduled: statusDoc.nextCycleScheduled,

      // Additional UI-friendly data
      statusText: getStatusText(statusDoc.overallStatus),
      statusColor: getStatusColor(statusDoc.overallStatus),
      timeUntilNextCycle: formatTimeUntilNextCycle(statusDoc.nextCycleScheduled),
      cycleProgress: getCycleProgress(statusDoc),
    };

    res.json(response);
  } catch (error) {
    logger.business("Error fetching cycled list status:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch cycled list status" });
  }
});

/**
 * Helper to get UI-friendly status text
 */
function getStatusText(overallStatus) {
  switch (overallStatus) {
    case "running":
      return "Running";
    case "paused":
      return "Paused (EODHD Limit)";
    case "stopped":
      return "Stopped";
    case "completed":
      return "Completed";
    case "not_initialized":
      return "Not Initialized";
    default:
      return "Unknown";
  }
}

/**
 * Helper to get UI-friendly status color
 */
function getStatusColor(overallStatus) {
  switch (overallStatus) {
    case "running":
      return "bg-green-500";
    case "paused":
      return "bg-yellow-500";
    case "stopped":
      return "bg-red-500";
    case "completed":
      return "bg-blue-500";
    case "not_initialized":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
}

/**
 * Helper to format time until next cycle
 */
function formatTimeUntilNextCycle(nextCycleScheduled) {
  if (!nextCycleScheduled) {
    return null;
  }

  const now = new Date();
  const nextCycle = new Date(nextCycleScheduled);
  const diffMs = nextCycle.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Now";
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Helper to get cycle progress for UI
 */
function getCycleProgress(status) {
  if (!status || status.totalAsyncFns === 0) {
    return {
      current: 0,
      total: 0,
      percentage: 0,
      completed: 0,
      remaining: 0,
    };
  }

  return {
    current: status.currentAsyncFnIndex + 1,
    total: status.totalAsyncFns,
    percentage: Math.round(status.progress),
    completed: status.completedAsyncFns,
    remaining: status.totalAsyncFns - status.completedAsyncFns,
  };
}

// Start the server
app.listen(API_PORT, "0.0.0.0", () => {
  logger.business(`🌐 HTTP server started on port ${API_PORT}`);
});

export default app;
