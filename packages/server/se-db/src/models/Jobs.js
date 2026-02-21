import mongoose from "mongoose";
import cron from "node-cron";
import logger from "@buydy/se-logger";

/**
 * Jobs Schema
 * Represents job execution tracking and logging
 */
const jobsSchema = new mongoose.Schema(
  {
    // Job name/identifier
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Machine name where the job is running
    machineName: {
      type: String,
      required: false,
      trim: true,
      index: true,
      default: null,
    },

    // Job execution status
    status: {
      type: String,
      required: true,
      enum: [
        "scheduled",
        "running",
        "completed",
        "failed",
        "paused",
        "cancelled",
        "retrying",
        "skipped",
      ],
      default: "scheduled",
      index: true,
    },

    // When the job was scheduled
    scheduledAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    // When the job started executing
    startedAt: {
      type: Date,
      default: null,
    },

    // When the job finished (successfully or with error)
    endedAt: {
      type: Date,
      default: null,
    },

    // Job progress (0.0 to 1.0)
    progress: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    // Job execution result (on success)
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Error message (on failure) - kept for backward compatibility
    error: {
      type: String,
      default: null,
    },

    // Full error details (JSON object with complete error information)
    errorDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Job execution logs
    logs: [
      {
        ts: {
          type: Date,
          required: true,
          default: Date.now,
        },
        level: {
          type: String,
          required: true,
          enum: ["info", "warn", "error"],
          default: "info",
        },
        msg: {
          type: String,
          required: true,
        },
      },
    ],

    // Job metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Schedule information (for scheduled jobs)
    cronExpression: {
      type: String,
      default: null,
      trim: true,
    },

    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },

    // Next scheduled run (calculated from cron expression)
    nextRun: {
      type: Date,
      default: null,
    },
  },
  {
    // Collection name
    collection: "jobs",

    // Disable automatic timestamps (we handle our own)
    timestamps: false,

    // Ensure indexes
    autoIndex: true,
  }
);

// Indexes for better query performance
jobsSchema.index({ name: 1, scheduledAt: -1 }); // Compound index for job history
jobsSchema.index({ status: 1, scheduledAt: -1 }); // For finding running/failed jobs
jobsSchema.index({ "logs.ts": -1 }); // For log queries

// Instance methods
jobsSchema.methods.addLog = function (msg, level = "info") {
  this.logs.push({
    ts: new Date(),
    level,
    msg,
  });
  return this.save();
};

// Atomic version that prevents parallel save conflicts
jobsSchema.methods.addLogAtomic = function (msg, level = "info") {
  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $push: {
        logs: {
          ts: new Date(),
          level,
          msg,
        },
      },
    },
    { new: true }
  );
};

jobsSchema.methods.updateProgress = function (progress) {
  if (typeof progress !== "number" || progress < 0 || progress > 1) {
    throw new Error("Progress must be a number between 0 and 1");
  }
  this.progress = progress;
  return this.save();
};

jobsSchema.methods.markAsRunning = function () {
  this.status = "running";
  this.startedAt = new Date();
  // Preserve progress if it exists (important for resumed jobs)
  // Progress will be 0 for new jobs, or preserved value for resumed jobs
  return this.save();
};

jobsSchema.methods.markAsCompleted = function (result = null) {
  this.status = "completed";
  this.endedAt = new Date();
  this.progress = 1;
  this.result = result;
  return this.save();
};

// Atomic version that prevents parallel save conflicts
jobsSchema.methods.markAsCompletedAtomic = function (result = null) {
  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: {
        status: "completed",
        endedAt: new Date(),
        progress: 1,
        result: result,
      },
    },
    { new: true }
  );
};

jobsSchema.methods.markAsFailed = function (error, errorDetails = null) {
  this.status = "failed";
  this.endedAt = new Date();
  this.error = typeof error === "string" ? error : error?.message || String(error);
  this.errorDetails = errorDetails || (typeof error === "object" ? error : null);
  return this.save();
};

// Resume-related status methods
jobsSchema.methods.markAsPaused = function () {
  this.status = "paused";
  this.endedAt = new Date();
  return this.save();
};

jobsSchema.methods.markAsCancelled = function (reason = null) {
  this.status = "cancelled";
  this.endedAt = new Date();
  if (reason) {
    this.error = reason;
  }
  return this.save();
};

jobsSchema.methods.markAsRetrying = function () {
  this.status = "retrying";
  this.startedAt = new Date();
  this.endedAt = null;
  this.error = null;
  this.errorDetails = null;
  return this.save();
};

// Atomic versions for resume-related statuses
jobsSchema.methods.markAsPausedAtomic = function () {
  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: {
        status: "paused",
        endedAt: new Date(),
      },
    },
    { new: true }
  );
};

jobsSchema.methods.markAsCancelledAtomic = function (reason = null) {
  const updateData = {
    status: "cancelled",
    endedAt: new Date(),
  };
  if (reason) {
    updateData.error = reason;
  }

  return this.constructor.findByIdAndUpdate(this._id, { $set: updateData }, { new: true });
};

jobsSchema.methods.markAsRetryingAtomic = function () {
  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: {
        status: "retrying",
        startedAt: new Date(),
        endedAt: null,
        error: null,
        errorDetails: null,
        // Preserve progress when resuming (don't reset to 0)
        // Progress will remain at its current value if it exists
      },
    },
    { new: true }
  );
};

// Atomic version that prevents parallel save conflicts
jobsSchema.methods.markAsFailedAtomic = function (error, errorDetails = null) {
  const errorMessage = typeof error === "string" ? error : error?.message || String(error);
  const fullErrorDetails = errorDetails || (typeof error === "object" ? error : null);

  return this.constructor.findByIdAndUpdate(
    this._id,
    {
      $set: {
        status: "failed",
        endedAt: new Date(),
        error: errorMessage,
        errorDetails: fullErrorDetails,
      },
    },
    { new: true }
  );
};

// Calculate next run time from cron expression
jobsSchema.methods.calculateNextRun = function () {
  if (!this.cronExpression) return null;

  try {
    const now = new Date();
    const nextRun = cron.getNextDate(this.cronExpression, now);
    return nextRun;
  } catch (error) {
    logger.business(`Invalid cron expression: ${this.cronExpression}`, { error });
    return null;
  }
};

// Static methods
jobsSchema.statics.findRecentJobs = function (limit = 50) {
  return this.find({})
    .sort({ scheduledAt: -1 })
    .limit(limit)
    .select("name status scheduledAt startedAt endedAt progress error errorDetails");
};

jobsSchema.statics.findRunningJobs = function () {
  return this.find({ status: "running" }).sort({ startedAt: -1 });
};

jobsSchema.statics.findFailedJobs = function (since = null) {
  const query = { status: "failed" };
  if (since) {
    query.endedAt = { $gte: since };
  }
  return this.find(query).sort({ endedAt: -1 }).select("name endedAt error errorDetails");
};

jobsSchema.statics.getJobHistory = function (jobName, limit = 20) {
  return this.find({ name: jobName })
    .sort({ scheduledAt: -1 })
    .limit(limit)
    .select(
      "name machineName status scheduledAt startedAt endedAt progress error errorDetails result metadata"
    )
    .lean();
};

jobsSchema.statics.getJobSchedules = function () {
  return this.aggregate([
    {
      $match: {
        cronExpression: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$name",
        cronExpression: { $first: "$cronExpression" },
        timezone: { $first: "$timezone" },
        nextRun: { $first: "$nextRun" },
        lastRun: { $max: "$scheduledAt" },
        totalRuns: { $sum: 1 },
        completedRuns: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        failedRuns: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
        runningRuns: {
          $sum: { $cond: [{ $eq: ["$status", "running"] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        name: "$_id",
        cronExpression: 1,
        timezone: 1,
        nextRun: 1,
        lastRun: 1,
        totalRuns: 1,
        completedRuns: 1,
        failedRuns: 1,
        runningRuns: 1,
        successRate: {
          $cond: [
            { $gt: ["$totalRuns", 0] },
            { $multiply: [{ $divide: ["$completedRuns", "$totalRuns"] }, 100] },
            0,
          ],
        },
      },
    },
    {
      $sort: { name: 1 },
    },
  ]);
};

// Pre-save middleware to update updatedAt
jobsSchema.pre("save", function (next) {
  // No updatedAt field in this schema, but we could add it if needed
  next();
});

// Create and export the model
export const Jobs = mongoose.model("Jobs", jobsSchema);
export default Jobs;
