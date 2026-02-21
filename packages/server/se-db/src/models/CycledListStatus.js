import mongoose from "mongoose";

/**
 * CycledListStatus Schema
 * Tracks the status of the cycled list system that manages job workflows
 */
const cycledListStatusSchema = new mongoose.Schema(
  {
    // Name of the cycled list (e.g., "Stocks Scanner Daily Sync")
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // Overall status of the cycled list
    overallStatus: {
      type: String,
      required: true,
      enum: ["running", "paused", "stopped", "completed", "not_initialized"],
      default: "not_initialized",
      index: true,
    },

    // Basic state
    isRunning: {
      type: Boolean,
      required: true,
      default: false,
    },

    isPaused: {
      type: Boolean,
      required: true,
      default: false,
    },

    manualPause: {
      type: Boolean,
      required: true,
      default: false,
    },

    pauseReason: {
      type: String,
      default: null,
    },

    stopReason: {
      type: String,
      default: null,
    },

    // Cycle information
    currentCycle: {
      type: Number,
      required: true,
      default: 0,
    },

    totalCycles: {
      type: Number,
      required: true,
      default: 0,
    },

    maxCycles: {
      type: Number,
      default: null, // null means infinite
    },

    cycleInterval: {
      type: Number,
      required: false, // Deprecated - cycles run continuously now
      default: null, // No longer used for scheduling
    },

    // Async function execution status
    totalAsyncFns: {
      type: Number,
      required: true,
      default: 0,
    },

    completedAsyncFns: {
      type: Number,
      required: true,
      default: 0,
    },

    failedAsyncFns: {
      type: Number,
      required: true,
      default: 0,
    },

    currentAsyncFnIndex: {
      type: Number,
      required: true,
      default: -1,
    },

    progress: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },

    // Current async function details
    currentAsyncFn: {
      name: String,
      parallelGroup: String,
      functionName: String,
    },

    nextAsyncFn: {
      name: String,
      parallelGroup: String,
      functionName: String,
    },

    // Conditions
    pauseConditions: {
      type: [String],
      default: [],
    },

    continueConditions: {
      type: [String],
      default: [],
    },

    // Timing
    nextCycleScheduled: {
      type: Date,
      default: null,
    },

    // Timestamps
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    collection: "cycled_list_status",
  }
);

// Additional indexes (name and overallStatus already have index: true in schema)
cycledListStatusSchema.index({ lastUpdated: -1 });

// Instance methods
cycledListStatusSchema.methods.updateStatus = function (statusData) {
  // Update all fields from status data
  Object.keys(statusData).forEach((key) => {
    if (this.schema.paths[key]) {
      this[key] = statusData[key];
    }
  });
  this.lastUpdated = new Date();
  return this.save();
};

// Static methods
cycledListStatusSchema.statics.getByName = function (name) {
  return this.findOne({ name });
};

cycledListStatusSchema.statics.getCurrent = function () {
  return this.findOne().sort({ lastUpdated: -1 });
};

// Export model
export const CycledListStatus = mongoose.model("CycledListStatus", cycledListStatusSchema);
